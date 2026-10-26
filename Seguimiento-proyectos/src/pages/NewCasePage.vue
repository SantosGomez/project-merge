<template>
  <q-page class="new-case-page">
    <div class="new-case-page__head">
      <p class="new-case-page__lead">
        Registra un nuevo caso para el contador asignado. El estado inicial siempre es Pendiente.
      </p>
    </div>

    <ScreenLoader
      v-if="screenStateName === SCREEN_STATES.loading"
      text="Cargando el registro de caso…"
    />

    <ErrorState
      v-else-if="screenStateName === SCREEN_STATES.error"
      :detail="mensajeError"
      @retry="retry"
    />

    <div v-else class="new-case-page__body">
      <section class="new-case-panel" aria-labelledby="new-case-title">
        <div class="new-case-panel__head">
          <h2 id="new-case-title" class="new-case-panel__title">Registro de caso</h2>
          <p class="new-case-panel__help">
            Completa los campos obligatorios y envía para agregar el caso.
          </p>
        </div>

        <form
          class="new-case-form"
          @submit.prevent="submitCase"
          novalidate
          aria-label="Formulario de registro de caso"
        >
          <div class="form-group">
            <label for="client-field" class="form-label"
              >Cliente <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
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

          <div class="form-actions">
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
            />
          </div>
        </form>

        <div v-if="successMessage" class="success-banner" role="status" aria-live="polite">
          <q-icon name="check_circle" color="positive" size="24px" />
          <div>
            <p class="success-banner__title">Caso registrado</p>
            <p class="success-banner__message">
              Se agregó el caso a tu cuenta. El formulario está limpio.
            </p>
          </div>
          <q-btn
            color="primary"
            label="Ver mis casos"
            icon="visibility"
            no-caps
            unelevated
            :to="{ name: 'contador-casos' }"
            class="control-touch"
          />
        </div>
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'

import ErrorState from '../components/ErrorState.vue'
import PriorityTag from '../components/PriorityTag.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { PRIORITIES, PRIORITY_LABELS } from '../utils/constants.js'
import { CASE_ERROR_CODES } from '../utils/caseRules.js'
import { STATUS_LABELS, STATUSES } from '../utils/constants.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'
import { validarCliente, validarPrioridad } from '../utils/validators.js'
import { prioridadABackend } from '../utils/traduccionBackend.js'

const cases = useCasesStore()
const session = useSessionStore()

const client = ref('')
const priority = ref('')
const formError = ref(null)
const successMessage = ref(false)

const cargando = ref(true)
const errorCarga = ref(null)
const errorGuardado = ref(null)

const assignedCounter = computed(() =>
  session.nombreVisible ? { id: session.id, name: session.nombreVisible } : null,
)

const screenStateName = computed(() =>
  screenState({
    loading: cargando.value,
    error: errorCarga.value || errorGuardado.value,
    rows: assignedCounter.value ? [assignedCounter.value] : [],
  }),
)

const priorityOptions = computed(() =>
  PRIORITIES.map((p) => ({ label: PRIORITY_LABELS[p], value: p })),
)

const assignedCounterName = computed(() =>
  assignedCounter.value ? assignedCounter.value.name : 'Sin asignar',
)

const statusLabel = STATUS_LABELS[STATUSES[0]]

const mensajeError = computed(() => {
  const error = errorCarga.value || errorGuardado.value
  return error?.mensaje ?? 'el registro de caso.'
})

const clearFormError = () => {
  formError.value = null
}

const submitCase = async () => {
  if (cases.guardando) return

  clearFormError()
  successMessage.value = false
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
    errorGuardado.value = resultado.error
    return
  }

  successMessage.value = true
  client.value = ''
  priority.value = ''
}

const retry = async () => {
  if (errorGuardado.value) {
    await submitCase()
    return
  }

  errorCarga.value = null
  cargando.value = false
}

onMounted(() => {
  cargando.value = true
  // Preparación síncrona del formulario: no hay datos que obtener del backend.
  cargando.value = false
})
</script>

<style scoped>
.new-case-page {
  padding: 16px;
  min-width: 0;
}

.new-case-page__head {
  margin-bottom: 16px;
}

.new-case-page__lead {
  margin: 0;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.new-case-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.new-case-panel__head {
  margin-bottom: 12px;
}

.new-case-panel__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.new-case-panel__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

.new-case-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
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

.form-actions {
  margin-top: 4px;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-top: 16px;
  border: 1px solid #d4edda;
  border-radius: 10px;
  background: #e8f5e9;
}

.success-banner__title {
  margin: 0 0 2px;
  font-weight: 700;
  color: #1b5e20;
}

.success-banner__message {
  margin: 0;
  color: #2e7d32;
  font-size: 0.95rem;
}

.priority-selected {
  display: inline-flex;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

@media (min-width: 1024px) {
  .new-case-page {
    padding: 20px 24px;
  }
}
</style>