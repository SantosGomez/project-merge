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
          <div class="form-group">
            <label for="cliente-field" class="form-label">Cliente <span class="required-mark">*</span></label>
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
            <label for="expediente-field" class="form-label">No. de expediente <span class="required-mark">*</span></label>
            <q-input
              v-model="noExpediente"
              type="text"
              placeholder="EXP-2026-001"
              maxlength="100"
              outlined
              dense
              counter
              aria-required="true"
              :error="!!errorDeCampo('expediente')"
              :error-message="errorDeCampo('expediente')"
              @update:model-value="clearError()"
            />
          </div>

          <div class="form-group">
            <label for="dependencia-field" class="form-label">Dependencia <span class="required-mark">*</span></label>
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
            <label for="tipo-field" class="form-label">Tipo de auditoría <span class="required-mark">*</span></label>
            <q-input
              v-model="tipoAud"
              type="text"
              placeholder="Revisión de Gabinete, Visita Domiciliaria…"
              maxlength="200"
              outlined
              dense
              counter
              aria-required="true"
              :error="!!errorDeCampo('tipo')"
              :error-message="errorDeCampo('tipo')"
              @update:model-value="clearError()"
            />
          </div>

          <div class="form-group auditoria-form__toggle">
            <q-toggle
              v-model="estatal"
              color="dg-acento"
              label="Auditoría estatal"
              aria-describedby="estatal-help"
            >
              <q-tooltip>Marca si la auditoría es de alcance estatal.</q-tooltip>
            </q-toggle>
            <p id="estatal-help" class="form-help">Actívalo si la auditoría es de alcance estatal.</p>
          </div>

          <div class="form-group">
            <label for="periodo-inicio-field" class="form-label">Periodo: fecha inicio <span class="required-mark">*</span></label>
            <q-input
              v-model="periodoInicio"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              aria-required="true"
              :error="!!errorDeCampo('periodoInicio')"
              :error-message="errorDeCampo('periodoInicio')"
              @update:model-value="clearError()"
            >
              <template #append>
                <q-icon name="event" class="auditoria-form__cal" tabindex="0" role="button" aria-label="Abrir calendario">
                  <q-popup-proxy cover :breakpoint="700" transition-show="scale" transition-hide="scale">
                    <q-date v-model="periodoInicio" mask="DD-MM-YYYY" today-btn @update:model-value="clearError()">
                      <div class="row justify-end"><q-btn v-close-popup label="Listo" color="primary" flat no-caps /></div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="form-group">
            <label for="periodo-final-field" class="form-label">Periodo: fecha final <span class="required-mark">*</span></label>
            <q-input
              v-model="periodoFinal"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              aria-required="true"
              :error="!!errorDeCampo('periodoFinal')"
              :error-message="errorDeCampo('periodoFinal')"
              @update:model-value="clearError()"
            >
              <template #append>
                <q-icon name="event" class="auditoria-form__cal" tabindex="0" role="button" aria-label="Abrir calendario">
                  <q-popup-proxy cover :breakpoint="700" transition-show="scale" transition-hide="scale">
                    <q-date v-model="periodoFinal" mask="DD-MM-YYYY" today-btn @update:model-value="clearError()">
                      <div class="row justify-end"><q-btn v-close-popup label="Listo" color="primary" flat no-caps /></div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="form-group">
            <label for="fecha-inicio-field" class="form-label">Fecha de inicio <span class="required-mark">*</span></label>
            <q-input
              v-model="fechaInicio"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              aria-required="true"
              :error="!!errorDeCampo('fechaInicio')"
              :error-message="errorDeCampo('fechaInicio')"
              @update:model-value="clearError()"
            >
              <template #append>
                <q-icon name="event" class="auditoria-form__cal" tabindex="0" role="button" aria-label="Abrir calendario">
                  <q-popup-proxy cover :breakpoint="700" transition-show="scale" transition-hide="scale">
                    <q-date v-model="fechaInicio" mask="DD-MM-YYYY" today-btn @update:model-value="clearError()">
                      <div class="row justify-end"><q-btn v-close-popup label="Listo" color="primary" flat no-caps /></div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="form-group">
            <label for="fecha-vencimiento-field" class="form-label">Fecha de vencimiento <span class="required-mark">*</span></label>
            <q-input
              v-model="fechaVencimiento"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              aria-required="true"
              :error="!!errorDeCampo('fechaVencimiento')"
              :error-message="errorDeCampo('fechaVencimiento')"
              @update:model-value="clearError()"
            >
              <template #append>
                <q-icon name="event" class="auditoria-form__cal" tabindex="0" role="button" aria-label="Abrir calendario">
                  <q-popup-proxy cover :breakpoint="700" transition-show="scale" transition-hide="scale">
                    <q-date v-model="fechaVencimiento" mask="DD-MM-YYYY" today-btn @update:model-value="clearError()">
                      <div class="row justify-end"><q-btn v-close-popup label="Listo" color="primary" flat no-caps /></div>
                    </q-date>
                  </q-popup-proxy>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div v-if="modoEdicion" class="form-group">
            <label for="estado-field" class="form-label">Estado <span class="required-mark">*</span></label>
            <q-select
              v-model="estado"
              :options="opcionesEstado"
              outlined
              dense
              aria-required="true"
            />
          </div>
          <div v-else class="form-group">
            <span class="form-label">Estado</span>
            <p class="estado-fijo">Pendiente</p>
          </div>

          <div class="form-group auditoria-form__ancho-completo">
            <label for="descripcion-field" class="form-label">Descripción (opcional)</label>
            <q-input
              v-model="descripcion"
              type="textarea"
              placeholder="Qué se revisa: impuestos, ejercicio, alcance…"
              outlined
              dense
              rows="2"
              maxlength="2000"
              counter
              @update:model-value="clearError()"
            />
          </div>

          <div class="form-group auditoria-form__ancho-completo">
            <label for="observacion-field" class="form-label">Observación (opcional)</label>
            <q-input
              v-model="observacion"
              type="textarea"
              placeholder="Notas de seguimiento para el equipo"
              outlined
              dense
              rows="3"
              maxlength="2000"
              counter
              @update:model-value="clearError()"
            />
          </div>

          <div v-if="esAdmin" class="form-group auditoria-form__ancho-completo">
            <label for="contadores-field" class="form-label">Contadores asignados <span class="required-mark">*</span></label>
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

          <ErrorState
            v-if="errorGuardado"
            class="auditoria-form__error auditoria-form__ancho-completo"
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
  ayuda: 'Completa los campos obligatorios. El estado inicial siempre es Pendiente.',
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

const textos = computed(() => (modoEdicion.value ? TEXTOS_EDICION : TEXTOS_REGISTRO))

const guardando = ref(false)

const cliente = ref('')
const noExpediente = ref('')
const dependencia = ref('')
const tipoAud = ref('')
const estatal = ref(false)
const periodoInicio = ref('')
const periodoFinal = ref('')
const fechaInicio = ref('')
const fechaVencimiento = ref('')
const descripcion = ref('')
const observacion = ref('')
const estado = ref('Pendiente')
const contadoresSeleccionados = ref([])

const clienteInput = ref(null)
const formError = ref(null)
const errorGuardado = ref(null)

const opcionesEstado = ['Pendiente', 'En Proceso', 'Completado', 'Aplazado por acta']

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

const reiniciarFormulario = () => {
  const a = props.auditoria
  cliente.value = a?.cliente ?? ''
  noExpediente.value = a?.noExpediente ?? ''
  dependencia.value = a?.dependencia ?? ''
  tipoAud.value = a?.tipoAud ?? ''
  estatal.value = Boolean(a?.estatal)
  periodoInicio.value = a?.periodoInicio ?? ''
  periodoFinal.value = a?.periodoFinal ?? ''
  fechaInicio.value = a?.fechaInicio ?? ''
  fechaVencimiento.value = a?.fechaVencimiento ?? ''
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
  if (!validarRequerido(noExpediente.value, 'expediente', 'El no. de expediente')) return
  if (!validarRequerido(dependencia.value, 'dependencia', 'La dependencia')) return
  if (!validarRequerido(tipoAud.value, 'tipo', 'El tipo de auditoría')) return
  if (!validarRequerido(periodoInicio.value, 'periodoInicio', 'El periodo inicio')) return
  if (!validarRequerido(periodoFinal.value, 'periodoFinal', 'El periodo final')) return
  if (!validarRequerido(fechaInicio.value, 'fechaInicio', 'La fecha de inicio')) return
  if (!validarRequerido(fechaVencimiento.value, 'fechaVencimiento', 'La fecha de vencimiento')) return
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
      periodoInicio: periodoInicio.value.trim(),
      periodoFinal: periodoFinal.value.trim(),
      fechaInicio: fechaInicio.value.trim(),
      fechaVencimiento: fechaVencimiento.value.trim(),
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
    errorGuardado.value = error
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
</style>
