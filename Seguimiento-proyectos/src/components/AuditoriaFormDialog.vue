<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando"
    aria-labelledby="auditoria-titulo"
    @show="enfocarCliente"
  >
    <q-card class="auditoria-form">
      <q-form class="auditoria-form__form" novalidate :aria-label="textos.formulario" @submit="submit">
        <q-card-section class="auditoria-form__head">
          <h2 id="auditoria-titulo" class="auditoria-form__title">{{ textos.titulo }}</h2>
          <p class="auditoria-form__help">{{ textos.ayuda }}</p>
        </q-card-section>

        <q-card-section class="auditoria-form__body">
          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Identificación</legend>

            <div class="form-group">
              <label class="form-label">Cliente <span class="required-mark">*</span></label>
              <q-input
                ref="clienteInput"
                v-model="cliente"
                type="text"
                placeholder="Nombre del cliente auditado"
                maxlength="100"
                outlined
                dense
                counter
                aria-required="true"
                :error="!!errorDeCampo('cliente')"
                :error-message="errorDeCampo('cliente')"
                @update:model-value="clearError()"
              />
            </div>

            <div class="form-group">
              <label class="form-label">No. de expediente / orden <span class="required-mark">*</span></label>
              <q-input
                v-model="noExpediente"
                type="text"
                placeholder="VDM-0001/2026"
                maxlength="100"
                outlined
                dense
                counter
                aria-required="true"
                :error="!!errorDeCampo('noExpediente')"
                :error-message="errorDeCampo('noExpediente')"
                @update:model-value="clearError()"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Dependencia <span class="required-mark">*</span></label>
              <q-input
                v-model="dependencia"
                type="text"
                placeholder="Quién audita: SAT – ADAF, Secretaría de Finanzas…"
                maxlength="200"
                outlined
                dense
                counter
                aria-required="true"
                :error="!!errorDeCampo('dependencia')"
                :error-message="errorDeCampo('dependencia')"
                @update:model-value="clearError()"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Tipo de auditoría <span class="required-mark">*</span></label>
              <q-select
                :model-value="tipoAud"
                :options="opcionesTipo"
                use-input
                hide-selected
                fill-input
                input-debounce="0"
                placeholder="Elige o escribe: Revisión de Gabinete, Visita Domiciliaria…"
                outlined
                dense
                aria-required="true"
                :error="!!errorDeCampo('tipoAud')"
                :error-message="errorDeCampo('tipoAud')"
                @filter="filtrarTipos"
                @input-value="escribirTipo"
                @update:model-value="elegirTipo"
              >
                <q-tooltip>Puedes elegir un tipo de la lista o escribir otro.</q-tooltip>
              </q-select>
            </div>

            <div class="form-group auditoria-form__ancho-completo auditoria-form__toggle">
              <q-toggle v-model="estatal" color="dg-acento" label="Auditoría estatal" aria-describedby="estatal-help">
                <q-tooltip>Marca si la audita una autoridad estatal (impuestos locales).</q-tooltip>
              </q-toggle>
              <p id="estatal-help" class="form-help">Actívalo si la auditoría es de alcance estatal.</p>
            </div>
          </fieldset>

          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Periodo y fechas</legend>

            <div v-for="campo in CAMPOS_FECHA" :key="campo.clave" class="form-group">
              <label class="form-label">{{ campo.etiqueta }} <span class="required-mark">*</span></label>
              <q-input
                v-model="fechas[campo.clave]"
                type="text"
                placeholder="DD-MM-AAAA"
                maxlength="10"
                outlined
                dense
                aria-required="true"
                :error="!!errorDeCampo(campo.clave)"
                :error-message="errorDeCampo(campo.clave)"
                @update:model-value="clearError()"
              >
                <template #append>
                  <q-icon name="event" class="auditoria-form__cal" tabindex="0" role="button" aria-label="Abrir calendario">
                    <q-popup-proxy cover :breakpoint="700" transition-show="scale" transition-hide="scale">
                      <q-date
                        v-model="fechas[campo.clave]"
                        mask="DD-MM-YYYY"
                        today-btn
                        :options="campo.desde ? (dia) => diaNoAnterior(dia, fechas[campo.desde]) : undefined"
                        @update:model-value="clearError()"
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
          </fieldset>

          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Estatus y asignación</legend>

            <div v-if="modoEdicion" class="form-group">
              <label class="form-label">Estatus de la auditoría <span class="required-mark">*</span></label>
              <q-select
                v-model="estado"
                :options="opcionesEstado"
                outlined
                dense
                aria-required="true"
                :error="!!errorDeCampo('estado')"
                :error-message="errorDeCampo('estado')"
              />
            </div>
            <div v-else class="form-group">
              <span class="form-label">Estatus de la auditoría</span>
              <p class="estado-fijo">Pendiente</p>
            </div>

            <div v-if="esAdmin" class="form-group">
              <label class="form-label">Contadores asignados <span class="required-mark">*</span></label>
              <q-select
                v-model="contadoresSeleccionados"
                :options="opcionesContador"
                option-label="label"
                option-value="value"
                multiple
                outlined
                dense
                emit-value
                map-options
                use-chips
                aria-required="true"
                :error="!!errorDeCampo('contadores')"
                :error-message="errorDeCampo('contadores')"
                @update:model-value="clearError()"
              />
            </div>
            <div v-else-if="!modoEdicion" class="form-group">
              <span class="form-label">Contadores asignados</span>
              <p class="estado-fijo">Tú quedas asignado</p>
            </div>
          </fieldset>

          <fieldset class="auditoria-form__seccion">
            <legend class="auditoria-form__seccion-titulo">Notas (opcional)</legend>

            <div class="form-group auditoria-form__ancho-completo">
              <label class="form-label">Descripción</label>
              <q-input
                v-model="descripcion"
                type="textarea"
                placeholder="Qué se revisa: impuestos, ejercicio, alcance…"
                outlined
                dense
                rows="2"
                maxlength="2000"
                counter
                :error="!!errorDeCampo('descripcion')"
                :error-message="errorDeCampo('descripcion')"
                @update:model-value="clearError()"
              />
            </div>

            <div class="form-group auditoria-form__ancho-completo">
              <label class="form-label">Observación</label>
              <q-input
                v-model="observacion"
                type="textarea"
                placeholder="Notas de seguimiento para el equipo"
                outlined
                dense
                rows="3"
                maxlength="2000"
                counter
                :error="!!errorDeCampo('observacion')"
                :error-message="errorDeCampo('observacion')"
                @update:model-value="clearError()"
              />
            </div>
          </fieldset>

          <ErrorState
            v-if="errorGuardado"
            class="auditoria-form__error"
            :title="textos.errorGuardado"
            :detail="mensajeError"
            @retry="submit"
          />
        </q-card-section>

        <q-card-actions align="right" class="auditoria-form__actions">
          <q-btn flat no-caps label="Cancelar" class="control-touch" :disable="guardando" @click="cerrar">
            <q-tooltip>{{ textos.tooltipCancelar }}</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            :label="textos.boton"
            :icon="modoEdicion ? 'save' : 'add_circle'"
            no-caps
            unelevated
            class="control-touch"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>{{ textos.tooltipBoton }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

import ErrorState from './ErrorState.vue'
import { actualizarAuditoria, registrarAuditoria } from '../services/auditoriaService.js'
import { TIPOS_AUDITORIA, campoConError, diaNoAnterior, filtrarSugerencias } from '../utils/formularioAuditoria.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  auditoria: {
    type: Object,
    default: null,
  },
  /** Contadores asignables { id, nombre } (solo los usa el administrador). */
  contadores: {
    type: Array,
    default: () => [],
  },
  /** El administrador elige a los contadores; al contador que registra lo asigna el backend. */
  esAdmin: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['registrada', 'guardada'])

const modoEdicion = computed(() => props.auditoria !== null)

const TEXTOS_REGISTRO = {
  titulo: 'Registrar auditoría',
  formulario: 'Formulario de registro de auditoría',
  ayuda: 'Completa los campos marcados con *. El estatus inicial siempre es Pendiente.',
  boton: 'Registrar auditoría',
  tooltipBoton: 'Guarda la auditoría.',
  tooltipCancelar: 'Cierra el formulario sin registrar la auditoría.',
  errorGuardado: 'No se pudo registrar la auditoría',
}

const TEXTOS_EDICION = {
  titulo: 'Editar auditoría',
  formulario: 'Formulario de edición de auditoría',
  ayuda: 'Cambia los datos que necesites de la auditoría.',
  boton: 'Guardar cambios',
  tooltipBoton: 'Guarda los cambios de la auditoría.',
  tooltipCancelar: 'Cierra el formulario sin guardar los cambios.',
  errorGuardado: 'No se pudieron guardar los cambios',
}

// Fechas del formulario; `desde` bloquea en el calendario los días anteriores a esa otra fecha.
const CAMPOS_FECHA = [
  { clave: 'periodoInicio', etiqueta: 'Periodo revisado: desde', ayuda: 'Primer día del periodo que se revisa.' },
  {
    clave: 'periodoFinal',
    etiqueta: 'Periodo revisado: hasta',
    desde: 'periodoInicio',
    ayuda: 'Último día del periodo que se revisa; no puede ser anterior al inicio.',
  },
  { clave: 'fechaInicio', etiqueta: 'Fecha de inicio', ayuda: 'Notificación de inicio de la auditoría.' },
  {
    clave: 'fechaVencimiento',
    etiqueta: 'Fecha de vencimiento',
    desde: 'fechaInicio',
    ayuda: 'Plazo de la autoridad para concluir; no puede ser anterior a la fecha de inicio.',
  },
]

const textos = computed(() => (modoEdicion.value ? TEXTOS_EDICION : TEXTOS_REGISTRO))

const guardando = ref(false)

const cliente = ref('')
const noExpediente = ref('')
const dependencia = ref('')
const tipoAud = ref('')
const estatal = ref(false)
const fechas = ref({ periodoInicio: '', periodoFinal: '', fechaInicio: '', fechaVencimiento: '' })
const descripcion = ref('')
const observacion = ref('')
const estado = ref('Pendiente')
const contadoresSeleccionados = ref([])

const clienteInput = ref(null)
const formError = ref(null)
const errorGuardado = ref(null)

const opcionesEstado = ['Pendiente', 'En Proceso', 'Completado', 'Aplazado por acta']
const opcionesTipo = ref([...TIPOS_AUDITORIA])

const opcionesContador = computed(() =>
  (props.contadores ?? []).map((c) => ({ label: c.nombre, value: c.id })),
)

const mensajeError = computed(() => errorGuardado.value?.mensaje ?? 'los datos de la auditoría.')

const clearError = () => {
  formError.value = null
}

const errorDeCampo = (campo) => (formError.value?.campo === campo ? formError.value.mensaje : null)

const enfocarCliente = () => {
  nextTick(() => clienteInput.value?.focus())
}

// Tipo de auditoría: sugerencias del boceto, pero se acepta cualquier texto escrito.
const filtrarTipos = (texto, actualizar) => {
  actualizar(() => {
    opcionesTipo.value = filtrarSugerencias(TIPOS_AUDITORIA, texto)
  })
}

const escribirTipo = (texto) => {
  tipoAud.value = texto
  clearError()
}

const elegirTipo = (valor) => {
  tipoAud.value = valor ?? ''
  clearError()
}

const reiniciarFormulario = () => {
  const a = props.auditoria
  cliente.value = a?.cliente ?? ''
  noExpediente.value = a?.noExpediente ?? ''
  dependencia.value = a?.dependencia ?? ''
  tipoAud.value = a?.tipoAud ?? ''
  estatal.value = Boolean(a?.estatal)
  fechas.value = {
    periodoInicio: a?.periodoInicio ?? '',
    periodoFinal: a?.periodoFinal ?? '',
    fechaInicio: a?.fechaInicio ?? '',
    fechaVencimiento: a?.fechaVencimiento ?? '',
  }
  descripcion.value = a?.descripcion ?? ''
  observacion.value = a?.observacion ?? ''
  estado.value = a?.estado ?? 'Pendiente'
  contadoresSeleccionados.value = (a?.contadores ?? []).map((c) => c.id)
  formError.value = null
  errorGuardado.value = null
}

watch(dialogoAbierto, (abierto) => {
  if (abierto) reiniciarFormulario()
})

const cerrar = () => {
  if (guardando.value) return
  dialogoAbierto.value = false
}

const validarRequerido = (valor, campo, etiqueta) => {
  if (!valor || String(valor).trim() === '') {
    formError.value = { campo, mensaje: `${etiqueta} es obligatorio.` }
    return false
  }
  return true
}

const submit = async () => {
  if (guardando.value) return
  clearError()
  errorGuardado.value = null

  if (!validarRequerido(cliente.value, 'cliente', 'El cliente')) return
  if (!validarRequerido(noExpediente.value, 'noExpediente', 'El no. de expediente')) return
  if (!validarRequerido(dependencia.value, 'dependencia', 'La dependencia')) return
  if (!validarRequerido(tipoAud.value, 'tipoAud', 'El tipo de auditoría')) return
  for (const campo of CAMPOS_FECHA) {
    if (!validarRequerido(fechas.value[campo.clave], campo.clave, campo.etiqueta)) return
  }
  if (props.esAdmin && contadoresSeleccionados.value.length === 0) {
    formError.value = { campo: 'contadores', mensaje: 'Seleccione al menos un contador.' }
    return
  }

  guardando.value = true
  try {
    const datos = {
      cliente: cliente.value.trim(),
      noExpediente: noExpediente.value.trim(),
      dependencia: dependencia.value.trim(),
      tipoAud: tipoAud.value.trim(),
      estatal: estatal.value,
      ...Object.fromEntries(CAMPOS_FECHA.map(({ clave }) => [clave, fechas.value[clave].trim()])),
      descripcion: descripcion.value.trim(),
      observacion: observacion.value.trim(),
    }
    // Solo el administrador manda contadores: el backend rechaza que un contador los cambie.
    if (props.esAdmin) datos.contadores = [...contadoresSeleccionados.value]

    if (modoEdicion.value) {
      datos.estado = estado.value
      emit('guardada', await actualizarAuditoria(props.auditoria.id, datos))
    } else {
      emit('registrada', await registrarAuditoria(datos))
    }
    dialogoAbierto.value = false
  } catch (error) {
    // Si el error nombra un campo, se muestra junto a él; si no, en el aviso general.
    const campo = campoConError(error?.mensaje)
    if (campo) formError.value = { campo, mensaje: error.mensaje }
    else errorGuardado.value = error
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.auditoria-form {
  width: min(920px, calc(100vw - 32px));
  max-width: none !important;
}

.auditoria-form__form {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.auditoria-form__head {
  padding-bottom: 0;
}

.auditoria-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
}

.auditoria-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.auditoria-form__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px 20px;
  align-items: start;
}

@media (min-width: 700px) {
  .auditoria-form__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.auditoria-form__ancho-completo {
  grid-column: 1 / -1;
}

.auditoria-form__toggle {
  align-self: flex-start;
}

.auditoria-form__actions {
  padding: 8px 16px 16px;
}

.auditoria-form__cal {
  cursor: pointer;
  color: var(--dg-acento);
}

.auditoria-form__error {
  grid-column: 1 / -1;
}

.estado-fijo {
  display: flex;
  align-items: center;
  min-height: 40px;
  margin: 0;
  padding: 0 12px;
  border: 1px dashed var(--dg-borde-fuerte);
  border-radius: 4px;
  background: var(--dg-fondo-suave);
  color: var(--dg-texto);
  font-weight: 600;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
.auditoria-form__seccion {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px 20px;
  /* Un fieldset no se encoge por defecto; sin esto desborda en el celular */
  min-width: 0;
  margin: 0;
  padding: 12px 14px 4px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
}

@media (min-width: 700px) {
  .auditoria-form__seccion {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.auditoria-form__seccion-titulo {
  padding: 0 6px;
  color: var(--dg-acento);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
</style>
