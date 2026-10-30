<template>
  <q-dialog v-model="dialogoAbierto" aria-labelledby="auditoria-detalle-titulo" @show="cargar">
    <q-card class="auditoria-detalle">
      <q-card-section class="auditoria-detalle__head">
        <h2 id="auditoria-detalle-titulo" class="auditoria-detalle__title">Seguimiento de auditoría</h2>
        <p class="auditoria-detalle__help">
          {{ auditoria.cliente }} · Expediente {{ auditoria.noExpediente }}
        </p>
      </q-card-section>

      <q-card-section class="auditoria-detalle__body">
        <div class="auditoria-detalle__resumen">
          <q-chip dense class="auditoria-detalle__estado" :class="`auditoria-detalle__estado--${estadoClase}`">
            {{ auditoria.estado }}
          </q-chip>
          <span class="auditoria-detalle__meta">Inicio {{ auditoria.fechaInicio }}</span>
          <span class="auditoria-detalle__meta">Vence {{ auditoria.fechaVencimiento }}</span>
        </div>

        <h3 class="auditoria-detalle__subtitulo">Bitácora</h3>
        <p class="auditoria-detalle__ayuda">
          Cada oficio, requerimiento, acta o entrega es un evento. Se muestran del más antiguo al más reciente.
        </p>

        <p v-if="cargando" class="auditoria-detalle__vacio" role="status">Cargando bitácora…</p>

        <ErrorState
          v-else-if="errorCarga"
          title="No se pudo cargar la bitácora"
          :detail="errorCarga.mensaje ?? 'la bitácora de la auditoría.'"
          @retry="cargar"
        />

        <template v-else>
          <q-timeline color="dg-acento" class="auditoria-detalle__timeline">
            <q-timeline-entry v-for="ev in eventos" :key="ev.id" color="dg-acento">
              <template #title>
                <span class="auditoria-detalle__fase">{{ ev.evento }}</span>
                <q-chip
                  dense
                  class="auditoria-detalle__estado-fase"
                  :class="`auditoria-detalle__estado-fase--${estadoEventoClase(ev.estado)}`"
                >
                  {{ ev.estado }}
                </q-chip>
              </template>
              <template #subtitle>
                <span class="auditoria-detalle__fecha">{{ ev.fecha }} · {{ ev.fase.nombre }}</span>
              </template>
              <div class="auditoria-detalle__contenido">
                <p v-if="ev.folio" class="auditoria-detalle__linea"><strong>Folio:</strong> {{ ev.folio }}</p>
                <p v-if="ev.fechaLimite" class="auditoria-detalle__linea">
                  <strong>Fecha límite:</strong> {{ ev.fechaLimite }}
                </p>
                <p v-if="ev.fechaEntrega" class="auditoria-detalle__linea">
                  <strong>Fecha de entrega:</strong> {{ ev.fechaEntrega }}
                </p>
                <p v-if="ev.descripcion" class="auditoria-detalle__linea">
                  <strong>Descripción:</strong> {{ ev.descripcion }}
                </p>
                <p v-if="ev.observaciones" class="auditoria-detalle__linea">
                  <strong>Observaciones:</strong> {{ ev.observaciones }}
                </p>
                <p class="auditoria-detalle__linea auditoria-detalle__registro">
                  Registró: {{ ev.registradoPor.nombre }}
                </p>
                <div class="auditoria-detalle__evento-acciones">
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="primary"
                    icon="edit"
                    label="Editar"
                    class="control-touch"
                    :disable="guardando"
                    @click="editar(ev)"
                  >
                    <q-tooltip>Cambia los datos del evento, por ejemplo para registrar la entrega.</q-tooltip>
                  </q-btn>
                  <q-btn
                    flat
                    dense
                    no-caps
                    color="negative"
                    icon="delete"
                    label="Borrar"
                    class="control-touch"
                    :disable="guardando"
                    @click="confirmarBorrado(ev)"
                  >
                    <q-tooltip>Borra el evento si se capturó por error. No se puede deshacer.</q-tooltip>
                  </q-btn>
                </div>
              </div>
            </q-timeline-entry>
          </q-timeline>

          <div v-if="eventos.length === 0" class="auditoria-detalle__vacio">
            Aún no hay eventos en la bitácora. Usa «Agregar evento» para registrar el primero.
          </div>

          <q-expansion-item
            v-model="formularioAbierto"
            :icon="eventoEnEdicion ? 'edit' : 'add_circle'"
            :label="eventoEnEdicion ? 'Editar evento' : 'Agregar evento'"
            header-class="auditoria-detalle__expansion"
            class="auditoria-detalle__expansion-item"
          >
            <q-card flat bordered class="auditoria-detalle__form-card">
              <q-form novalidate @submit="guardar">
                <q-card-section class="auditoria-detalle__form">
                  <div class="form-group auditoria-detalle__ancho">
                    <label class="form-label">Evento <span class="required-mark">*</span></label>
                    <q-input
                      v-model="form.evento"
                      placeholder="Orden de visita, requerimiento, acta parcial, multa…"
                      maxlength="200"
                      counter
                      outlined
                      dense
                      aria-required="true"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Fase <span class="required-mark">*</span></label>
                    <q-select
                      v-model="form.faseId"
                      :options="opcionesFase"
                      emit-value
                      map-options
                      outlined
                      dense
                      aria-required="true"
                    >
                      <q-tooltip>Etapa del procedimiento a la que pertenece el evento.</q-tooltip>
                    </q-select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Estado <span class="required-mark">*</span></label>
                    <q-select v-model="form.estado" :options="ESTADOS_EVENTO" outlined dense aria-required="true" />
                  </div>
                  <div v-for="campo in CAMPOS_FECHA" :key="campo.clave" class="form-group">
                    <label class="form-label">
                      {{ campo.etiqueta }}
                      <span v-if="campo.requerido" class="required-mark">*</span>
                    </label>
                    <q-input
                      v-model="form[campo.clave]"
                      placeholder="DD-MM-AAAA"
                      maxlength="10"
                      outlined
                      dense
                      :aria-required="campo.requerido ? 'true' : 'false'"
                    >
                      <template #append>
                        <q-icon
                          name="event"
                          class="auditoria-detalle__cal"
                          tabindex="0"
                          role="button"
                          aria-label="Abrir calendario"
                        >
                          <q-popup-proxy cover :breakpoint="700">
                            <q-date v-model="form[campo.clave]" mask="DD-MM-YYYY" today-btn>
                              <div class="row justify-end">
                                <q-btn v-close-popup label="Listo" color="primary" flat no-caps />
                              </div>
                            </q-date>
                          </q-popup-proxy>
                        </q-icon>
                      </template>
                      <q-tooltip>{{ campo.ayuda }}</q-tooltip>
                    </q-input>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Folio</label>
                    <q-input v-model="form.folio" placeholder="Folio del oficio o acta" maxlength="200" outlined dense />
                  </div>
                  <div class="form-group auditoria-detalle__ancho">
                    <label class="form-label">Descripción</label>
                    <q-input v-model="form.descripcion" type="textarea" rows="2" maxlength="2000" outlined dense />
                  </div>
                  <div class="form-group auditoria-detalle__ancho">
                    <label class="form-label">Observaciones</label>
                    <q-input v-model="form.observaciones" type="textarea" rows="2" maxlength="2000" outlined dense />
                  </div>
                  <p v-if="errorGuardado" class="auditoria-detalle__error auditoria-detalle__ancho" role="alert">
                    {{ errorGuardado.mensaje ?? 'No se pudo guardar el evento. Intenta de nuevo.' }}
                  </p>
                  <div class="auditoria-detalle__form-acciones">
                    <q-btn
                      v-if="eventoEnEdicion"
                      flat
                      no-caps
                      label="Cancelar edición"
                      class="control-touch"
                      :disable="guardando"
                      @click="limpiarFormulario"
                    />
                    <q-btn
                      type="submit"
                      color="primary"
                      no-caps
                      unelevated
                      :icon="eventoEnEdicion ? 'save' : 'add'"
                      :label="eventoEnEdicion ? 'Guardar cambios' : 'Agregar'"
                      class="control-touch"
                      :loading="guardando"
                    >
                      <q-tooltip>
                        {{ eventoEnEdicion ? 'Guarda los cambios del evento.' : 'Agrega el evento a la bitácora.' }}
                      </q-tooltip>
                    </q-btn>
                  </div>
                </q-card-section>
              </q-form>
            </q-card>
          </q-expansion-item>
        </template>
      </q-card-section>

      <q-card-actions align="right" class="auditoria-detalle__acciones">
        <q-btn flat no-caps label="Cerrar" class="control-touch" @click="dialogoAbierto = false">
          <q-tooltip>Cierra el seguimiento de la auditoría.</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'

import ErrorState from './ErrorState.vue'
import {
  actualizarEvento,
  borrarEvento,
  listarEventos,
  listarFases,
  registrarEvento,
} from '../services/auditoriaService.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  auditoria: {
    type: Object,
    required: true,
  },
})

// Avisa a la página que la bitácora cambió (fase actual, vencimiento y semáforo se recalculan).
const emit = defineEmits(['cambio'])

const $q = useQuasar()

const ESTADO_AUDITORIA_CLASE = {
  Pendiente: 'pendiente',
  'En Proceso': 'en-proceso',
  Completado: 'completado',
  'Aplazado por acta': 'aplazado',
}
const ESTADO_EVENTO_CLASE = {
  Pendiente: 'pendiente',
  Revision: 'revision',
  'En Proceso': 'en-proceso',
  Rechazado: 'rechazado',
  Completado: 'completado',
}
const ESTADOS_EVENTO = Object.keys(ESTADO_EVENTO_CLASE)
const CAMPOS_FECHA = [
  { clave: 'fecha', etiqueta: 'Fecha del evento', requerido: true, ayuda: 'Día en que se notificó o sucedió el evento.' },
  { clave: 'fechaLimite', etiqueta: 'Fecha límite', requerido: false, ayuda: 'Hasta cuándo hay para atenderlo (opcional).' },
  { clave: 'fechaEntrega', etiqueta: 'Fecha de entrega', requerido: false, ayuda: 'Cuándo se entregó o atendió (opcional).' },
]

const estadoClase = computed(() => ESTADO_AUDITORIA_CLASE[props.auditoria.estado] ?? 'pendiente')
const estadoEventoClase = (estado) => ESTADO_EVENTO_CLASE[estado] ?? 'pendiente'

const eventos = ref([])
const fases = ref([])
const cargando = ref(false)
const errorCarga = ref(null)

const opcionesFase = computed(() => fases.value.map((f) => ({ label: f.nombre, value: f.id })))

const formularioVacio = () => ({
  evento: '',
  faseId: fases.value[0]?.id ?? null,
  estado: 'Pendiente',
  fecha: '',
  fechaLimite: '',
  fechaEntrega: '',
  folio: '',
  descripcion: '',
  observaciones: '',
})

const form = ref(formularioVacio())
const formularioAbierto = ref(false)
const eventoEnEdicion = ref(null)
const guardando = ref(false)
const errorGuardado = ref(null)

const limpiarFormulario = () => {
  eventoEnEdicion.value = null
  form.value = formularioVacio()
  errorGuardado.value = null
}

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const [lista, catalogo] = await Promise.all([listarEventos(props.auditoria.id), listarFases()])
    eventos.value = lista
    fases.value = catalogo
    limpiarFormulario()
    formularioAbierto.value = false
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

const editar = (ev) => {
  eventoEnEdicion.value = ev
  form.value = {
    evento: ev.evento,
    faseId: ev.fase.id,
    estado: ev.estado,
    fecha: ev.fecha,
    fechaLimite: ev.fechaLimite,
    fechaEntrega: ev.fechaEntrega,
    folio: ev.folio,
    descripcion: ev.descripcion,
    observaciones: ev.observaciones,
  }
  errorGuardado.value = null
  formularioAbierto.value = true
}

const guardar = async () => {
  if (guardando.value) return
  errorGuardado.value = null
  if (form.value.evento.trim() === '' || form.value.fecha.trim() === '') {
    errorGuardado.value = { mensaje: 'Escribe el evento y su fecha.' }
    return
  }
  guardando.value = true
  try {
    if (eventoEnEdicion.value) {
      await actualizarEvento(props.auditoria.id, eventoEnEdicion.value.id, form.value)
      $q.notify({ type: 'positive', message: 'Evento actualizado.' })
    } else {
      await registrarEvento(props.auditoria.id, form.value)
      $q.notify({ type: 'positive', message: 'Evento agregado a la bitácora.' })
    }
    // Se vuelve a leer para respetar el orden cronológico del backend.
    eventos.value = await listarEventos(props.auditoria.id)
    emit('cambio')
    limpiarFormulario()
    formularioAbierto.value = false
  } catch (error) {
    errorGuardado.value = error
  } finally {
    guardando.value = false
  }
}

const confirmarBorrado = (ev) => {
  $q.dialog({
    title: 'Borrar evento',
    message: `¿Borrar «${ev.evento}» del ${ev.fecha}? Esta acción no se puede deshacer.`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Borrar', color: 'negative', noCaps: true, unelevated: true },
    persistent: true,
  }).onOk(async () => {
    guardando.value = true
    try {
      await borrarEvento(props.auditoria.id, ev.id)
      eventos.value = eventos.value.filter((e) => e.id !== ev.id)
      emit('cambio')
      if (eventoEnEdicion.value?.id === ev.id) limpiarFormulario()
      $q.notify({ type: 'positive', message: 'Evento borrado.' })
    } catch (error) {
      $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo borrar el evento.' })
    } finally {
      guardando.value = false
    }
  })
}
</script>

<style scoped>
.auditoria-detalle {
  width: min(760px, calc(100vw - 32px));
  max-width: none !important;
}

.auditoria-detalle__head {
  padding-bottom: 0;
}

.auditoria-detalle__title {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.15rem;
}

.auditoria-detalle__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.auditoria-detalle__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auditoria-detalle__resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.auditoria-detalle__estado {
  font-weight: 600;
  text-transform: none;
}

.auditoria-detalle__estado--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.auditoria-detalle__estado--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.auditoria-detalle__estado--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.auditoria-detalle__estado--aplazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.auditoria-detalle__meta {
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.auditoria-detalle__subtitulo {
  margin: 8px 0 0;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
}

.auditoria-detalle__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.auditoria-detalle__timeline {
  padding-left: 4px;
}

.auditoria-detalle__fase {
  color: var(--dg-texto);
  font-weight: 600;
  margin-right: 8px;
}

.auditoria-detalle__estado-fase {
  font-size: 0.75rem;
  text-transform: none;
}

.auditoria-detalle__estado-fase--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.auditoria-detalle__estado-fase--revision {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
}

.auditoria-detalle__estado-fase--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.auditoria-detalle__estado-fase--rechazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.auditoria-detalle__estado-fase--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.auditoria-detalle__fecha {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.auditoria-detalle__contenido {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auditoria-detalle__linea {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.auditoria-detalle__registro {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.auditoria-detalle__evento-acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.auditoria-detalle__vacio {
  color: var(--dg-texto-tenue);
  font-size: 0.9rem;
  font-style: italic;
}

.auditoria-detalle__expansion {
  color: var(--dg-acento);
  font-weight: 600;
}

.auditoria-detalle__form-card {
  margin-top: 8px;
  border-color: var(--dg-borde);
}

.auditoria-detalle__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

@media (min-width: 600px) {
  .auditoria-detalle__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.auditoria-detalle__ancho {
  grid-column: 1 / -1;
}

.auditoria-detalle__cal {
  cursor: pointer;
  color: var(--dg-acento);
}

.auditoria-detalle__error {
  margin: 0;
  color: var(--dg-error);
  font-size: 0.9rem;
}

.auditoria-detalle__form-acciones {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.auditoria-detalle__acciones {
  padding: 8px 16px 16px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>
