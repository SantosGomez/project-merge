<template>
  <section class="bitacora" aria-labelledby="bitacora-titulo">
    <div class="bitacora__encabezado">
      <h2 id="bitacora-titulo" class="bitacora__titulo">Bitácora</h2>
      <div class="bitacora__controles">
        <q-btn-toggle
          v-model="vista"
          :options="opcionesVista"
          no-caps
          unelevated
          toggle-color="primary"
          color="grey-3"
          text-color="grey-9"
          class="bitacora__vista"
          aria-label="Cómo ver la bitácora"
        />
        <q-btn
          v-if="!formularioAbierto"
          color="primary"
          no-caps
          unelevated
          icon="add_circle"
          label="Agregar evento"
          class="control-touch"
          @click="abrirNuevo"
        >
          <q-tooltip>Registra un oficio, requerimiento, acta, multa o entrega.</q-tooltip>
        </q-btn>
      </div>
    </div>
    <p class="bitacora__ayuda">
      Cada oficio, requerimiento, acta o entrega es un evento. Se muestran del más antiguo al más
      reciente; los que tienen un plazo pendiente se resaltan con su cuenta regresiva. «Tabla»
      muestra la historia completa en renglones; para editar o registrar una entrega usa «Línea de
      tiempo».
    </p>

    <q-card v-if="formularioAbierto" flat bordered class="bitacora__form-card">
      <q-form novalidate @submit="guardar">
        <q-card-section class="bitacora__form">
          <h3 class="bitacora__form-titulo bitacora__ancho">
            {{ eventoEnEdicion ? 'Editar evento' : 'Agregar evento' }}
          </h3>
          <div class="form-group bitacora__ancho">
            <label class="form-label">Evento <span class="required-mark">*</span></label>
            <q-select
              :model-value="form.evento"
              :options="opcionesEvento"
              use-input
              hide-selected
              fill-input
              input-debounce="0"
              placeholder="Elige o escribe: orden de visita, requerimiento, acta parcial, multa…"
              outlined
              dense
              aria-required="true"
              @filter="filtrarEventos"
              @input-value="(texto) => (form.evento = texto)"
              @update:model-value="elegirEvento"
            >
              <q-tooltip
                >Al elegir un evento de la lista se propone su fase; puedes cambiarla.</q-tooltip
              >
            </q-select>
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
            <q-select
              v-model="form.estado"
              :options="ESTADOS_EVENTO"
              outlined
              dense
              aria-required="true"
            />
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
                  class="bitacora__cal"
                  tabindex="0"
                  role="button"
                  aria-label="Abrir calendario"
                >
                  <q-popup-proxy cover :breakpoint="700">
                    <q-date
                      v-model="form[campo.clave]"
                      mask="DD-MM-YYYY"
                      today-btn
                      :options="
                        campo.desde ? (dia) => diaNoAnterior(dia, form[campo.desde]) : undefined
                      "
                    >
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
            <q-input
              v-model="form.folio"
              placeholder="Folio del oficio o acta"
              maxlength="200"
              outlined
              dense
            />
          </div>
          <div class="form-group bitacora__ancho">
            <label class="form-label">Descripción</label>
            <q-input
              v-model="form.descripcion"
              type="textarea"
              rows="2"
              maxlength="2000"
              outlined
              dense
            />
          </div>
          <div class="form-group bitacora__ancho">
            <label class="form-label">Observaciones</label>
            <q-input
              v-model="form.observaciones"
              type="textarea"
              rows="2"
              maxlength="2000"
              outlined
              dense
            />
          </div>
          <p v-if="errorGuardado" class="bitacora__error bitacora__ancho" role="alert">
            {{ errorGuardado.mensaje ?? 'No se pudo guardar el evento. Intenta de nuevo.' }}
          </p>
          <div class="bitacora__form-acciones">
            <q-btn
              flat
              no-caps
              label="Cancelar"
              class="control-touch"
              :disable="guardando"
              @click="cerrarFormulario"
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
                {{
                  eventoEnEdicion
                    ? 'Guarda los cambios del evento.'
                    : 'Agrega el evento a la bitácora.'
                }}
              </q-tooltip>
            </q-btn>
          </div>
        </q-card-section>
      </q-form>
    </q-card>

    <p v-if="cargando" class="bitacora__vacio" role="status">Cargando bitácora…</p>

    <ErrorState
      v-else-if="errorCarga"
      title="No se pudo cargar la bitácora"
      :detail="errorCarga.mensaje ?? 'la bitácora de la auditoría.'"
      @retry="cargar"
    />

    <template v-else>
      <div v-if="eventos.length === 0" class="bitacora__vacio">
        Aún no hay eventos en la bitácora. Usa «Agregar evento» para registrar el primero.
      </div>

      <template v-else>
        <q-timeline v-show="vista === 'linea'" color="dg-acento" class="bitacora__timeline">
          <q-timeline-entry
            v-for="ev in eventos"
            :key="ev.id"
            :color="ev.plazo.pendiente ? 'dg-error' : 'dg-acento'"
            :icon="ev.plazo.pendiente ? 'schedule' : undefined"
          >
            <template #title>
              <span class="bitacora__evento">{{ ev.evento }}</span>
              <q-chip
                dense
                class="bitacora__estado"
                :class="`bitacora__estado--${estadoEventoClase(ev.estado)}`"
              >
                {{ ev.estado }}
              </q-chip>
            </template>
            <template #subtitle>
              <span class="bitacora__fecha">{{ ev.fecha }} · {{ ev.fase.nombre }}</span>
            </template>
            <div
              class="bitacora__contenido"
              :class="{ 'bitacora__contenido--pendiente': ev.plazo.pendiente }"
            >
              <p
                v-if="ev.plazo.pendiente"
                class="bitacora__plazo"
                :class="`bitacora__plazo--${SEMAFORO_CLASE[ev.plazo.semaforo]}`"
              >
                <q-icon name="timer" size="16px" aria-hidden="true" />
                Vence {{ ev.fechaLimite }} · {{ textoDias(ev.plazo.dias) }}
              </p>
              <p v-if="ev.folio" class="bitacora__linea"><strong>Folio:</strong> {{ ev.folio }}</p>
              <p v-if="ev.fechaLimite && !ev.plazo.pendiente" class="bitacora__linea">
                <strong>Fecha límite:</strong> {{ ev.fechaLimite }}
              </p>
              <p v-if="ev.fechaEntrega" class="bitacora__linea">
                <strong>Fecha de entrega:</strong> {{ ev.fechaEntrega }}
              </p>
              <p v-if="ev.descripcion" class="bitacora__linea">
                <strong>Descripción:</strong> {{ ev.descripcion }}
              </p>
              <p v-if="ev.observaciones" class="bitacora__linea">
                <strong>Observaciones:</strong> {{ ev.observaciones }}
              </p>
              <p class="bitacora__linea bitacora__registro">
                Registró: {{ ev.registradoPor.nombre }}
              </p>
              <div class="bitacora__acciones">
                <q-btn
                  v-if="ev.plazo.pendiente"
                  unelevated
                  dense
                  no-caps
                  color="dg-exito"
                  icon="task_alt"
                  label="Registrar entrega"
                  class="control-touch"
                  :disable="guardando"
                  @click="registrarEntrega(ev)"
                >
                  <q-tooltip>Marca el evento como Completado y entregado hoy.</q-tooltip>
                </q-btn>
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
                  <q-tooltip
                    >Cambia los datos del evento, por ejemplo otra fecha de entrega.</q-tooltip
                  >
                </q-btn>
                <q-btn
                  flat
                  dense
                  no-caps
                  color="dg-error"
                  icon="delete"
                  label="Borrar"
                  class="control-touch"
                  :disable="guardando"
                  @click="confirmarBorrado(ev)"
                >
                  <q-tooltip
                    >Borra el evento si se capturó por error. No se puede deshacer.</q-tooltip
                  >
                </q-btn>
              </div>
            </div>
          </q-timeline-entry>
        </q-timeline>

        <!-- Historia en renglones, como la ficha del boceto; al imprimir siempre sale esta tabla -->
        <q-markup-table
          v-show="vista === 'tabla'"
          flat
          bordered
          dense
          separator="cell"
          wrap-cells
          class="bitacora__tabla"
          :class="{ 'bitacora__solo-impresion': vista !== 'tabla' }"
        >
          <thead>
            <tr>
              <th class="text-left">Fecha</th>
              <th class="text-left">Evento</th>
              <th class="text-left">Fase</th>
              <th class="text-left">Folio</th>
              <th class="text-left">Descripción</th>
              <th class="text-left">Fecha límite</th>
              <th class="text-left">Entrega</th>
              <th class="text-left">Estado</th>
              <th class="text-left">¿En tiempo?</th>
              <th class="text-left">Comentarios</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ev in eventos"
              :key="ev.id"
              :class="{ 'bitacora__fila--pendiente': ev.plazo.pendiente }"
            >
              <td class="bitacora__celda-fecha">{{ ev.fecha }}</td>
              <td class="bitacora__celda-evento">{{ ev.evento }}</td>
              <td>
                {{ ev.fase.id }}
                <q-tooltip>{{ ev.fase.nombre }}</q-tooltip>
              </td>
              <td>{{ ev.folio }}</td>
              <td>{{ ev.descripcion }}</td>
              <td class="bitacora__celda-fecha">{{ ev.fechaLimite }}</td>
              <td class="bitacora__celda-fecha">{{ ev.fechaEntrega }}</td>
              <td>{{ ev.estado }}</td>
              <td :class="`bitacora__en-tiempo--${CLASE_EN_TIEMPO[entregaEnTiempo(ev)]}`">
                {{ entregaEnTiempo(ev) }}
              </td>
              <td>{{ ev.observaciones }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import ErrorState from './ErrorState.vue'
import {
  actualizarEvento,
  borrarEvento,
  listarEventos,
  registrarEvento,
} from '../services/auditoriaService.js'
import { entregaEnTiempo, plazoDeEvento } from '../utils/listaAuditorias.js'
import {
  EVENTOS_SUGERIDOS,
  diaNoAnterior,
  faseSugerida,
  filtrarSugerencias,
} from '../utils/formularioAuditoria.js'

const props = defineProps({
  auditoriaId: {
    type: Number,
    required: true,
  },
  /** Catálogo de fases { id, nombre } (lo carga la ficha). */
  fases: {
    type: Array,
    default: () => [],
  },
})

// Avisa a la ficha que la bitácora cambió (fase actual, vencimiento y semáforo se recalculan).
const emit = defineEmits(['cambio'])

const $q = useQuasar()

const ESTADO_EVENTO_CLASE = {
  Pendiente: 'pendiente',
  Revision: 'revision',
  'En Proceso': 'en-proceso',
  Rechazado: 'rechazado',
  Completado: 'completado',
}
const ESTADOS_EVENTO = Object.keys(ESTADO_EVENTO_CLASE)
const SEMAFORO_CLASE = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
}
const CAMPOS_FECHA = [
  {
    clave: 'fecha',
    etiqueta: 'Fecha del evento',
    requerido: true,
    ayuda: 'Día en que se notificó o sucedió el evento.',
  },
  {
    clave: 'fechaLimite',
    etiqueta: 'Fecha límite',
    requerido: false,
    desde: 'fecha',
    ayuda: 'Hasta cuándo hay para atenderlo (opcional); no antes de la fecha del evento.',
  },
  {
    clave: 'fechaEntrega',
    etiqueta: 'Fecha de entrega',
    requerido: false,
    desde: 'fecha',
    ayuda: 'Cuándo se entregó o atendió (opcional); no antes de la fecha del evento.',
  },
]

// Evento: sugerencias del boceto con su fase; se acepta cualquier texto escrito.
const NOMBRES_EVENTO = EVENTOS_SUGERIDOS.map((s) => s.evento)
const opcionesEvento = ref([...NOMBRES_EVENTO])

const filtrarEventos = (texto, actualizar) => {
  actualizar(() => {
    opcionesEvento.value = filtrarSugerencias(NOMBRES_EVENTO, texto)
  })
}

const elegirEvento = (valor) => {
  form.value.evento = valor ?? ''
  const fase = faseSugerida(form.value.evento)
  if (fase) form.value.faseId = fase
}

const estadoEventoClase = (estado) => ESTADO_EVENTO_CLASE[estado] ?? 'pendiente'

// Línea de tiempo (con acciones) o tabla (historia completa, como la ficha del boceto).
const vista = ref('linea')
const opcionesVista = [
  { label: 'Línea de tiempo', value: 'linea', icon: 'timeline' },
  { label: 'Tabla', value: 'tabla', icon: 'table_rows' },
]
const CLASE_EN_TIEMPO = { Sí: 'si', No: 'no', '—': 'sin-dato' }

const textoDias = (dias) => {
  if (dias === 0) return 'vence hoy'
  if (dias < 0) return `venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  return `faltan ${dias} ${dias === 1 ? 'día' : 'días'}`
}

// Fecha local de hoy en DD-MM-AAAA (sin pasar por UTC).
const hoyDDMM = () => {
  const hoy = new Date()
  return (
    [hoy.getDate(), hoy.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('-') +
    `-${hoy.getFullYear()}`
  )
}

const eventosCrudos = ref([])
const eventos = computed(() =>
  eventosCrudos.value.map((ev) => ({ ...ev, plazo: plazoDeEvento(ev) })),
)
const cargando = ref(false)
const errorCarga = ref(null)

const opcionesFase = computed(() => props.fases.map((f) => ({ label: f.nombre, value: f.id })))

const formularioVacio = () => ({
  evento: '',
  faseId: props.fases[0]?.id ?? null,
  estado: 'Pendiente',
  fecha: hoyDDMM(),
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

const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    eventosCrudos.value = await listarEventos(props.auditoriaId)
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

// Tras cualquier cambio se vuelve a leer para respetar el orden cronológico del backend.
const releer = async () => {
  eventosCrudos.value = await listarEventos(props.auditoriaId)
  emit('cambio')
}

const abrirNuevo = () => {
  eventoEnEdicion.value = null
  form.value = formularioVacio()
  errorGuardado.value = null
  formularioAbierto.value = true
}

const cerrarFormulario = () => {
  formularioAbierto.value = false
  eventoEnEdicion.value = null
  errorGuardado.value = null
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
      await actualizarEvento(props.auditoriaId, eventoEnEdicion.value.id, form.value)
      $q.notify({ type: 'positive', message: 'Evento actualizado.' })
    } else {
      await registrarEvento(props.auditoriaId, form.value)
      $q.notify({ type: 'positive', message: 'Evento agregado a la bitácora.' })
    }
    cerrarFormulario()
    await releer()
  } catch (error) {
    errorGuardado.value = error
  } finally {
    guardando.value = false
  }
}

// Acción rápida: entregado hoy y Completado, sin abrir el formulario.
const registrarEntrega = async (ev) => {
  guardando.value = true
  try {
    await actualizarEvento(props.auditoriaId, ev.id, {
      fechaEntrega: hoyDDMM(),
      estado: 'Completado',
    })
    $q.notify({ type: 'positive', message: `Entrega registrada: «${ev.evento}».` })
    await releer()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo registrar la entrega.' })
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
      await borrarEvento(props.auditoriaId, ev.id)
      if (eventoEnEdicion.value?.id === ev.id) cerrarFormulario()
      $q.notify({ type: 'positive', message: 'Evento borrado.' })
      await releer()
    } catch (error) {
      $q.notify({ type: 'negative', message: error.mensaje ?? 'No se pudo borrar el evento.' })
    } finally {
      guardando.value = false
    }
  })
}
</script>

<style scoped>
.bitacora {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bitacora__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bitacora__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.1rem;
  font-weight: 700;
}

.bitacora__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.bitacora__timeline {
  padding-left: 4px;
}

.bitacora__controles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.bitacora__vista :deep(.q-btn) {
  min-height: 40px;
}

.bitacora__tabla {
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
}

.bitacora__tabla th {
  color: var(--dg-texto-secundario);
  font-weight: 700;
}

.bitacora__tabla td {
  vertical-align: top;
  color: var(--dg-texto);
}

.bitacora__celda-fecha {
  white-space: nowrap;
}

.bitacora__celda-evento {
  font-weight: 600;
}

.bitacora__fila--pendiente {
  background: var(--dg-error-fondo);
}

.bitacora__en-tiempo--si {
  color: var(--dg-exito);
  font-weight: 700;
}

.bitacora__en-tiempo--no {
  color: var(--dg-error);
  font-weight: 700;
}

.bitacora__en-tiempo--sin-dato {
  color: var(--dg-texto-tenue);
}

/* Impresión: la historia sale como tabla, sin línea de tiempo ni formulario */
@media print {
  .bitacora__tabla.bitacora__solo-impresion {
    display: block !important;
  }

  .bitacora__timeline,
  .bitacora__form-card,
  .bitacora__controles {
    display: none !important;
  }
}

.bitacora__evento {
  color: var(--dg-texto);
  font-weight: 600;
  margin-right: 8px;
}

.bitacora__estado {
  font-size: 0.75rem;
  text-transform: none;
}

.bitacora__estado--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.bitacora__estado--revision {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
}

.bitacora__estado--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.bitacora__estado--rechazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.bitacora__estado--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.bitacora__fecha {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.bitacora__contenido {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Evento con plazo pendiente: recuadro para que destaque en la historia */
.bitacora__contenido--pendiente {
  padding: 8px 10px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-suave);
}

.bitacora__plazo {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 6px;
  margin: 0;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
}

.bitacora__plazo--vencido {
  background: var(--dg-error);
  color: var(--dg-superficie);
}

.bitacora__plazo--critico {
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
}

.bitacora__plazo--atencion {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.bitacora__plazo--en-tiempo {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.bitacora__linea {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.bitacora__registro {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.bitacora__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 4px;
}

.bitacora__vacio {
  color: var(--dg-texto-tenue);
  font-size: 0.9rem;
  font-style: italic;
}

.bitacora__form-card {
  border-color: var(--dg-borde);
}

.bitacora__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

@media (min-width: 600px) {
  .bitacora__form {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.bitacora__form-titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
}

.bitacora__ancho {
  grid-column: 1 / -1;
}

.bitacora__cal {
  cursor: pointer;
  color: var(--dg-acento);
}

.bitacora__error {
  margin: 0;
  color: var(--dg-error);
  font-size: 0.9rem;
}

.bitacora__form-acciones {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>
