<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="cases.guardando"
    aria-labelledby="registro-caso-titulo"
    @show="enfocarCliente"
  >
    <q-card class="registro-caso">
      <form
        class="registro-caso__form"
        @submit.prevent="submitCase"
        novalidate
        :aria-label="textos.formulario"
      >
        <q-card-section class="registro-caso__head">
          <h2 id="registro-caso-titulo" class="registro-caso__title">{{ textos.titulo }}</h2>
          <p class="registro-caso__help">{{ textos.ayuda }}</p>
        </q-card-section>

        <q-card-section class="registro-caso__body">
          <div class="form-group">
            <label for="client-field" class="form-label"
              >Cliente <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
              ref="clienteInput"
              for="client-field"
              v-model="client"
              type="text"
              placeholder="Nombre del cliente"
              maxlength="81"
              outlined
              dense
              counter
              aria-required="true"
              aria-describedby="client-help client-error"
              :error="
                !!formError &&
                (formError.code === 'client_required' || formError.code === 'client_too_long')
              "
              @update:model-value="clearFormError()"
            />
            <p id="client-help" class="form-help">Máximo 80 caracteres visibles.</p>
            <p
              v-if="formError && formError.code === 'client_required'"
              id="client-error"
              class="form-error"
              role="alert"
            >
              El cliente es obligatorio.
            </p>
            <p
              v-if="formError && formError.code === 'client_too_long'"
              id="client-error"
              class="form-error"
              role="alert"
            >
              El cliente supera los 80 caracteres permitidos.
            </p>
          </div>

          <div class="form-group">
            <label for="priority-field" class="form-label"
              >Prioridad <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-select
              for="priority-field"
              v-model="priority"
              :options="priorityOptions"
              option-label="label"
              option-value="value"
              placeholder="Elige una prioridad"
              outlined
              dense
              emit-value
              map-options
              aria-required="true"
              aria-describedby="priority-help priority-error"
              :error="!!formError && formError.code === 'priority_required'"
              @update:model-value="clearFormError()"
            >
              <template #option="scope">
                <q-item v-bind="scope.itemProps" clickable>
                  <q-item-section>
                    <PriorityTag :priority="scope.opt.value" />
                  </q-item-section>
                </q-item>
              </template>
              <template #selected>
                <div v-if="priority" class="priority-selected">
                  <PriorityTag :priority="priority" />
                </div>
              </template>
            </q-select>
            <p id="priority-help" class="form-help">Selecciona una de las tres opciones.</p>
            <p
              v-if="formError && formError.code === 'priority_required'"
              id="priority-error"
              class="form-error"
              role="alert"
            >
              Se debe elegir una prioridad.
            </p>
          </div>

          <div class="form-group">
            <label for="fecha-inicio-field" class="form-label"
              >Fecha de inicio
              <span v-if="modoEdicion" aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
              for="fecha-inicio-field"
              v-model="fechaInicio"
              type="text"
              placeholder="DD-MM-AAAA"
              maxlength="10"
              outlined
              dense
              counter
              :aria-required="modoEdicion ? 'true' : 'false'"
              aria-describedby="fecha-inicio-help fecha-inicio-error"
              :error="!!formError && formError.code === 'fecha_inicio_invalido'"
              @update:model-value="clearFormError()"
            />
            <p id="fecha-inicio-help" class="form-help">{{ textos.ayudaFecha }}</p>
            <p
              v-if="formError && formError.code === 'fecha_inicio_invalido'"
              id="fecha-inicio-error"
              class="form-error"
              role="alert"
            >
              {{ formError.message }}
            </p>
          </div>

          <div class="form-group registro-caso__estado">
            <template v-if="modoEdicion">
              <label for="estado-field" class="form-label"
                >Estado <span aria-label="obligatorio" class="required-mark">*</span></label
              >
              <q-select
                for="estado-field"
                v-model="estado"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                outlined
                dense
                emit-value
                map-options
                aria-required="true"
                aria-describedby="estado-help"
              />
              <p id="estado-help" class="form-help">
                Pendiente: sin empezar. En proceso: en trabajo. Finalizado: terminado.
              </p>
            </template>
            <template v-else>
              <span id="estado-label" class="form-label">Estado</span>
              <p class="estado-fijo" aria-labelledby="estado-label" aria-describedby="estado-help">
                {{ statusLabel }}
              </p>
              <p id="estado-help" class="form-help">Todo caso nuevo empieza en Pendiente.</p>
            </template>
          </div>

          <div class="form-group">
            <label for="descripcion-field" class="form-label">Descripción</label>
            <q-input
              for="descripcion-field"
              v-model="descripcion"
              type="textarea"
              outlined
              dense
              rows="3"
              maxlength="1000"
              aria-describedby="descripcion-help descripcion-error"
            />
            <p id="descripcion-help" class="form-help">Máximo 1000 caracteres.</p>
            <p
              v-if="formError && formError.code === 'descripcion_demasiado_largo'"
              id="descripcion-error"
              class="form-error"
              role="alert"
            >
              La descripción no debe superar los 1000 caracteres.
            </p>
          </div>

          <div class="form-group">
            <label for="observaciones-field" class="form-label">Observaciones</label>
            <q-input
              for="observaciones-field"
              v-model="observaciones"
              type="textarea"
              outlined
              dense
              rows="3"
              maxlength="2000"
              aria-describedby="observaciones-help observaciones-error"
            />
            <p id="observaciones-help" class="form-help">Máximo 2000 caracteres.</p>
            <p
              v-if="formError && formError.code === 'observaciones_demasiado_largo'"
              id="observaciones-error"
              class="form-error"
              role="alert"
            >
              Las observaciones no deben superar los 2000 caracteres.
            </p>
          </div>

          <dl class="readonly-info">
            <div v-if="modoEdicion" class="readonly-row">
              <dt>Vence</dt>
              <dd>{{ vencimientoActual }}</dd>
            </div>
            <div class="readonly-row">
              <dt>Contador asignado</dt>
              <dd>{{ assignedCounterName }}</dd>
            </div>
          </dl>

          <ErrorState
            v-if="errorGuardado"
            class="registro-caso__error registro-caso__ancho-completo"
            :title="textos.errorGuardado"
            :detail="mensajeError"
            @retry="submitCase"
          />
        </q-card-section>

        <q-card-actions align="right" class="registro-caso__actions">
          <p v-if="modoEdicion && !hayCambios" class="form-help registro-caso__sin-cambios">
            Aún no cambias ningún dato.
          </p>
          <q-btn
            flat
            no-caps
            label="Cancelar"
            class="control-touch"
            :disable="cases.guardando"
            @click="cerrar"
          >
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
            :loading="cases.guardando"
            :disable="cases.guardando || (modoEdicion && !hayCambios)"
          >
            <q-tooltip>{{ textos.tooltipBoton }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

import ErrorState from './ErrorState.vue'
import PriorityTag from './PriorityTag.vue'
import { CASE_ERROR_CODES, cambiosDelCaso } from '../utils/caseRules.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES, MAX_DESCRIPCION_LENGTH, MAX_OBSERVACIONES_LENGTH } from '../utils/constants.js'
import { prioridadABackend } from '../utils/traduccionBackend.js'
import { validarCliente, validarFechaInicio, validarPrioridad, validarTextoOpcional } from '../utils/validators.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'

/*
 * Registro y edición de caso en un diálogo dentro de «Mis casos» (P-5).
 * Sin `caso` registra uno nuevo; con `caso` edita ese caso y solo envía lo que cambió.
 * El store actualiza la lista local, así que la pantalla se entera al cerrar.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Caso del store a editar; null para registrar uno nuevo. */
  caso: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['registrado', 'guardado'])

const modoEdicion = computed(() => props.caso !== null)

const TEXTOS_REGISTRO = {
  titulo: 'Registrar caso',
  formulario: 'Formulario de registro de caso',
  ayuda: 'Completa los campos obligatorios. El estado inicial siempre es Pendiente.',
  ayudaFecha: 'Formato DD-MM-AAAA. Deja vacío para usar hoy.',
  boton: 'Registrar caso',
  tooltipBoton: 'Guarda el caso en tu lista con estado Pendiente.',
  tooltipCancelar: 'Cierra el formulario sin registrar el caso.',
  errorGuardado: 'No se pudo registrar el caso',
  errorDetalle: 'el registro del caso.',
}

const TEXTOS_EDICION = {
  titulo: 'Editar caso',
  formulario: 'Formulario de edición de caso',
  ayuda:
    'Cambia los datos que necesites. El vencimiento se recalcula al guardar si cambias la prioridad o la fecha de inicio.',
  ayudaFecha: 'Formato DD-MM-AAAA.',
  boton: 'Guardar cambios',
  tooltipBoton: 'Guarda los cambios del caso.',
  tooltipCancelar: 'Cierra el formulario sin guardar los cambios.',
  errorGuardado: 'No se pudieron guardar los cambios',
  errorDetalle: 'los cambios del caso.',
}

const textos = computed(() => (modoEdicion.value ? TEXTOS_EDICION : TEXTOS_REGISTRO))

const cases = useCasesStore()
const session = useSessionStore()

const client = ref('')
const priority = ref('')
const formError = ref(null)
const errorGuardado = ref(null)
const clienteInput = ref(null)

const assignedCounter = computed(() =>
  session.nombreVisible ? { id: session.id, name: session.nombreVisible } : null,
)

const priorityOptions = computed(() =>
  PRIORITIES.map((p) => ({ label: PRIORITY_LABELS[p], value: p })),
)

const statusOptions = computed(() => STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })))

const estado = ref('')
const fechaInicio = ref('')
const descripcion = ref('')
const observaciones = ref('')

const vencimientoActual = computed(() => fechaParaFormulario(props.caso?.fecha_vencimiento) || 'Sin fecha')

// Solo lo que cambió respecto al caso guardado (vacío en el registro).
const cambios = computed(() =>
  modoEdicion.value
    ? cambiosDelCaso(props.caso, {
        cliente: client.value,
        estado: estado.value,
        prioridad: priority.value,
        fechaInicio: fechaInicio.value,
        descripcion: descripcion.value,
        observaciones: observaciones.value,
      })
    : {},
)

const hayCambios = computed(() => Object.keys(cambios.value).length > 0)

const assignedCounterName = computed(() =>
  assignedCounter.value ? assignedCounter.value.name : 'Sin asignar',
)

const statusLabel = STATUS_LABELS[STATUSES[0]]

const mensajeError = computed(() => errorGuardado.value?.mensaje ?? textos.value.errorDetalle)

const clearFormError = () => {
  formError.value = null
}

// Registro: formulario vacío. Edición: los valores actuales del caso.
const reiniciarFormulario = () => {
  const caso = props.caso
  client.value = caso?.cliente ?? ''
  priority.value = caso?.prioridad ?? ''
  estado.value = caso?.estado ?? ''
  fechaInicio.value = fechaParaFormulario(caso?.fecha_inicio)
  descripcion.value = caso?.descripcion ?? ''
  observaciones.value = caso?.observaciones ?? ''
  formError.value = null
  errorGuardado.value = null
}

const enfocarCliente = () => {
  nextTick(() => clienteInput.value?.focus())
}

// Al abrir se limpia lo que quedó de la vez anterior; al cerrar no se toca nada.
watch(dialogoAbierto, (abierto) => {
  if (abierto) {
    reiniciarFormulario()
  }
})

const cerrar = () => {
  // Mientras el alta está en curso, el diálogo no se puede cerrar.
  if (cases.guardando) return
  dialogoAbierto.value = false
}

const submitCase = async () => {
  if (cases.guardando) return

  clearFormError()
  errorGuardado.value = null

  const clienteLimpio = client.value.trim()

  const validacionCliente = validarCliente(clienteLimpio)
  if (!validacionCliente.valido) {
    formError.value = {
      code:
        validacionCliente.error === 'cliente_requerido'
          ? CASE_ERROR_CODES.clientRequired
          : CASE_ERROR_CODES.clientTooLong,
      message:
        validacionCliente.error === 'cliente_requerido'
          ? 'El cliente es obligatorio.'
          : 'El cliente supera los 80 caracteres permitidos.',
    }
    return
  }

  const prioridadBackend = prioridadABackend(priority.value)
  const validacionPrioridad = validarPrioridad(prioridadBackend)
  if (!validacionPrioridad.valido) {
    formError.value = {
      code: CASE_ERROR_CODES.priorityRequired,
      message: 'Se debe elegir una prioridad.',
    }
    return
  }

  const fechaLimpia = fechaInicio.value.trim()
  if (modoEdicion.value && fechaLimpia === '') {
    formError.value = {
      code: 'fecha_inicio_invalido',
      message: 'La fecha de inicio es obligatoria al editar. Use el formato DD-MM-AAAA.',
    }
    return
  }
  const validacionFecha = validarFechaInicio(fechaLimpia)
  if (!validacionFecha.valido) {
    formError.value = {
      code: 'fecha_inicio_invalido',
      message:
        validacionFecha.error === 'fecha_invalida'
          ? 'La fecha no existe. Use una fecha real en formato DD-MM-AAAA.'
          : 'Formato de fecha inválido. Use DD-MM-AAAA.',
    }
    return
  }

  const validacionDescripcion = validarTextoOpcional(descripcion.value, 'descripcion', MAX_DESCRIPCION_LENGTH)
  if (!validacionDescripcion.valido) {
    formError.value = {
      code: 'descripcion_demasiado_largo',
      message: 'La descripción no debe superar los 1000 caracteres.',
    }
    return
  }

  const validacionObservaciones = validarTextoOpcional(observaciones.value, 'observaciones', MAX_OBSERVACIONES_LENGTH)
  if (!validacionObservaciones.valido) {
    formError.value = {
      code: 'observaciones_demasiado_largo',
      message: 'Las observaciones no deben superar los 2000 caracteres.',
    }
    return
  }

  if (modoEdicion.value) {
    if (!hayCambios.value) return

    const edicion = await cases.actualizarCaso(props.caso.id, cambios.value)
    if (!edicion.ok) {
      errorGuardado.value = edicion.error ?? null
      return
    }

    dialogoAbierto.value = false
    emit('guardado', edicion.caso)
    return
  }

  const resultado = await cases.crearCaso(
    clienteLimpio,
    prioridadBackend,
    fechaLimpia || undefined,
    descripcion.value || undefined,
    observaciones.value || undefined
  )

  if (!resultado.ok) {
    errorGuardado.value = resultado.error ?? null
    return
  }

  reiniciarFormulario()
  dialogoAbierto.value = false
  emit('registrado', resultado.caso)
}
</script>

<style scoped>
/* Más ancho que el tope de 560 px de Quasar para repartir los campos en dos columnas. */
.registro-caso {
  width: min(860px, calc(100vw - 32px));
  max-width: none !important;
  min-width: 0;
}

.registro-caso__form {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.registro-caso__head {
  padding-bottom: 0;
}

.registro-caso__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.registro-caso__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

/* Una columna en móvil; dos desde 700 px: Cliente | Prioridad, Fecha | Estado, Descripción | Observaciones. */
.registro-caso__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px 20px;
  align-items: start;
  min-width: 0;
}

@media (min-width: 700px) {
  .registro-caso__body {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.registro-caso__ancho-completo {
  grid-column: 1 / -1;
}

.estado-fijo {
  display: flex;
  align-items: center;
  min-height: 40px;
  margin: 0;
  padding: 0 12px;
  border: 1px dashed #c9d4e0;
  border-radius: 4px;
  background: #f5f8fb;
  color: #102a43;
  font-weight: 600;
}

.registro-caso__actions {
  min-width: 0;
  padding: 8px 16px 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #102a43;
}

.required-mark {
  color: #a3231b;
  font-weight: 700;
}

.form-help {
  margin: 0 0 4px;
  color: #486581;
  font-size: 0.85rem;
}

.form-error {
  margin: 4px 0 0;
  color: #a3231b;
  font-size: 0.85rem;
}

.readonly-info {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: #e6f0fb;
  border: 1px solid #c9d4e0;
  border-radius: 8px;
  font-size: 0.9rem;
  min-width: 0;
}

.readonly-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.readonly-row dt {
  color: #486581;
  font-weight: 600;
  min-width: 140px;
}

.readonly-row dd {
  margin: 0;
  color: #102a43;
  font-weight: 600;
  min-width: 0;
  overflow-wrap: anywhere;
}

.priority-selected {
  display: inline-flex;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>
