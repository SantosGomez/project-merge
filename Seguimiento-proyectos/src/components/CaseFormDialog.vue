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
        aria-label="Formulario de registro de caso"
      >
        <q-card-section class="registro-caso__head">
          <h2 id="registro-caso-titulo" class="registro-caso__title">Registrar caso</h2>
          <p class="registro-caso__help">
            Completa los campos obligatorios. El estado inicial siempre es Pendiente.
          </p>
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

          <dl class="readonly-info">
            <div class="readonly-row">
              <dt>Estado</dt>
              <dd>{{ statusLabel }}</dd>
            </div>
            <div class="readonly-row">
              <dt>Contador asignado</dt>
              <dd>{{ assignedCounterName }}</dd>
            </div>
          </dl>

          <ErrorState
            v-if="errorGuardado"
            class="registro-caso__error"
            title="No se pudo registrar el caso"
            :detail="mensajeError"
            @retry="submitCase"
          />
        </q-card-section>

        <q-card-actions align="right" class="registro-caso__actions">
          <q-btn
            flat
            no-caps
            label="Cancelar"
            class="control-touch"
            :disable="cases.guardando"
            @click="cerrar"
          >
            <q-tooltip>Cierra el formulario sin registrar el caso.</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            label="Registrar caso"
            icon="add_circle"
            no-caps
            unelevated
            class="control-touch"
            :loading="cases.guardando"
            :disable="cases.guardando"
          >
            <q-tooltip>Guarda el caso en tu lista con estado Pendiente.</q-tooltip>
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
import { CASE_ERROR_CODES } from '../utils/caseRules.js'
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, STATUSES } from '../utils/constants.js'
import { prioridadABackend } from '../utils/traduccionBackend.js'
import { validarCliente, validarPrioridad } from '../utils/validators.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'

/*
 * Registro de caso en un diálogo dentro de «Mis casos» (P-5).
 * El formulario y sus reglas son los de la antigua pantalla P-4; el store ya
 * agrega el caso a la lista local, así que la pantalla se entera al cerrar.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const emit = defineEmits(['registrado'])

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

const assignedCounterName = computed(() =>
  assignedCounter.value ? assignedCounter.value.name : 'Sin asignar',
)

const statusLabel = STATUS_LABELS[STATUSES[0]]

const mensajeError = computed(
  () => errorGuardado.value?.mensaje ?? 'el registro del caso.',
)

const clearFormError = () => {
  formError.value = null
}

const reiniciarFormulario = () => {
  client.value = ''
  priority.value = ''
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

  const resultado = await cases.crearCaso(clienteLimpio, prioridadBackend)

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
.registro-caso {
  width: min(560px, calc(100vw - 32px));
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

.registro-caso__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
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
