<template>
  <q-page class="my-cases-page">
    <div class="my-cases-page__head">
      <p class="my-cases-page__lead">
        Revisa y actualiza los casos que tienes asignados. Puedes cambiar el estado y la prioridad
        en cualquier momento.
      </p>
      <q-btn
        class="my-cases-page__register-btn control-touch"
        color="primary"
        no-caps
        unelevated
        icon="add_circle"
        label="Registrar caso"
        aria-haspopup="dialog"
        :disable="cases.guardando"
        @click="abrirRegistro"
      >
        <q-tooltip>Abre el formulario para registrar un caso nuevo.</q-tooltip>
      </q-btn>
    </div>

    <ScreenLoader v-if="screenStateName === SCREEN_STATES.loading" text="Cargando tus casos…" />

    <ErrorState
      v-else-if="screenStateName === SCREEN_STATES.error"
      :detail="mensajeError"
      @retry="retry"
    />

    <div v-else class="my-cases-page__body">
      <EmptyState
        v-if="cases.casos.length === 0"
        title="No tienes casos registrados"
        message="Aún no hay casos asignados a tu cuenta. Usa el control «Registrar caso» para registrar el primero y empezar a gestionar tu carga."
        action-label="Registrar caso"
        @action="abrirRegistro"
      />

      <ul v-else class="case-list">
        <CaseRow v-for="oneCase in filas" :key="oneCase.id" :case-item="oneCase">
          <template #actions="{ item }">
            <div class="case-actions">
              <div class="case-action-group">
                <label :for="`status-${item.id}`" class="case-action-label">Estado</label>
                <q-select
                  :for="`status-${item.id}`"
                  dense
                  outlined
                  :model-value="item.status"
                  :options="statusOptions"
                  option-label="label"
                  option-value="value"
                  emit-value
                  map-options
                  aria-label="Cambiar estado del caso"
                  :disable="cases.guardando"
                  @update:model-value="(v) => guardarCambio(item.id, { estado: v })"
                />
              </div>
              <div class="case-action-group">
                <label :for="`priority-${item.id}`" class="case-action-label">Prioridad</label>
                <q-select
                  :for="`priority-${item.id}`"
                  dense
                  outlined
                  :model-value="item.priority"
                  :options="priorityOptions"
                  option-label="label"
                  option-value="value"
                  emit-value
                  map-options
                  aria-label="Cambiar prioridad del caso"
                  :disable="cases.guardando"
                  @update:model-value="(v) => guardarCambio(item.id, { prioridad: v })"
                />
              </div>
            </div>
          </template>
        </CaseRow>
      </ul>

      <div v-if="confirmation" class="confirmation-banner" role="status" aria-live="polite">
        <q-icon name="check_circle" color="positive" size="24px" />
        <p class="confirmation-banner__text">{{ confirmation }}</p>
      </div>
    </div>

    <CaseFormDialog v-model="dialogoRegistroAbierto" @registrado="alRegistrar" />
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'

import CaseFormDialog from '../components/CaseFormDialog.vue'
import CaseRow from '../components/CaseRow.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from '../utils/constants.js'
import { useCasesStore } from '../stores/cases.js'
import { casosAFilas } from '../utils/filasVista.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const cases = useCasesStore()

const filas = computed(() => casosAFilas(cases.casos))

const screenStateName = computed(() =>
  screenState({
    loading: cases.cargando,
    error: cases.error || errorCambio.value,
    rows: cases.casos,
  }),
)

const confirmation = ref('')
const dialogoRegistroAbierto = ref(false)
const errorCambio = ref(null)
const ultimoCambio = ref(null)

const mensajeError = computed(() => {
  const error = cases.error || errorCambio.value
  return error?.mensaje ?? 'tus casos asignados.'
})

const statusOptions = computed(() => STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })))

const priorityOptions = computed(() =>
  PRIORITIES.map((p) => ({ label: PRIORITY_LABELS[p], value: p })),
)

// Guarda un cambio de estado o de prioridad; se recuerda para poder reintentarlo si falla.
const guardarCambio = async (caseId, cambios) => {
  if (cases.guardando) return
  confirmation.value = ''
  errorCambio.value = null
  ultimoCambio.value = { id: caseId, cambios }

  const resultado = await cases.actualizarCaso(caseId, cambios)

  if (resultado.ok) {
    confirmation.value = 'Cambio guardado.'
    ultimoCambio.value = null
  } else {
    errorCambio.value = resultado.error
  }
}

const abrirRegistro = () => {
  // El diálogo se prepara solo al abrirse; aquí se descarta el aviso anterior.
  confirmation.value = ''
  dialogoRegistroAbierto.value = true
}

const alRegistrar = async () => {
  confirmation.value = 'Caso registrado.'

  // Si la lista no había cargado, se recarga para que el caso nuevo quede visible.
  if (cases.error) {
    await cases.reintentar()
  }
}

const retry = async () => {
  if (errorCambio.value && ultimoCambio.value) {
    const { id, cambios } = ultimoCambio.value
    await guardarCambio(id, cambios)
    return
  }

  errorCambio.value = null
  ultimoCambio.value = null
  await cases.reintentar()
}

onMounted(() => {
  cases.cargarCasos()
})
</script>

<style scoped>
.my-cases-page {
  padding: 16px;
}

.my-cases-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.my-cases-page__lead {
  flex: 1 1 260px;
  min-width: 0;
  margin: 0;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

.my-cases-page__register-btn:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}

.case-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.case-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}

.case-action-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.case-action-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #486581;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.confirmation-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-top: 12px;
  border: 1px solid #d4edda;
  border-radius: 10px;
  background: #e8f5e9;
}

.confirmation-banner__text {
  margin: 0;
  font-weight: 600;
  color: #1b5e20;
  font-size: 0.95rem;
}

@media (min-width: 1024px) {
  .my-cases-page {
    padding: 20px 24px;
  }
}
</style>