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
        :to="{ name: 'contador-registro' }"
      />
    </div>

    <ScreenLoader v-if="screenStateName === SCREEN_STATES.loading" text="Cargando tus casos…" />

    <ErrorState
      v-else-if="screenStateName === SCREEN_STATES.error"
      detail="tus casos asignados."
      @retry="retry"
    />

    <div v-else class="my-cases-page__body">
      <EmptyState
        v-if="cases.length === 0"
        title="No tienes casos registrados"
        message="Aún no hay casos asignados a tu cuenta. Usa el control «Registrar caso» para registrar el primero y empezar a gestionar tu carga."
        action-label="Registrar caso"
        @action="openNewCase"
      />

      <ul v-else class="case-list">
        <CaseRow v-for="oneCase in cases" :key="oneCase.id" :case-item="oneCase">
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
                  @update:model-value="(v) => changeStatus(item.id, v)"
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
                  @update:model-value="(v) => changePriority(item.id, v)"
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
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import CaseRow from '../components/CaseRow.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS } from '../utils/constants.js'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const maqueta = useMaquetaStore()
const router = useRouter()

const screen = computed(() => maqueta.screens[SCREEN_IDS.myCases])

const screenStateName = computed(() =>
  screenState({
    loading: screen.value.loading,
    error: screen.value.error,
    rows: maqueta.myCases,
  }),
)

const cases = computed(() => maqueta.myCases)

/** Texto de la confirmación del último cambio (RF-39): dice qué se cambió y en qué caso. */
const confirmation = ref('')

const statusOptions = computed(() => STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s })))

const priorityOptions = computed(() =>
  PRIORITIES.map((p) => ({ label: PRIORITY_LABELS[p], value: p })),
)

/** Nombre del caso al que pertenece un cambio, para que la confirmación sea inequívoca. */
const clientNameOf = (caseId) =>
  cases.value.find((oneCase) => oneCase.id === caseId)?.client ?? 'el caso'

const changeStatus = (caseId, newStatus) => {
  maqueta.changeCaseStatus(caseId, newStatus)
  confirmation.value = `El caso de ${clientNameOf(caseId)} ahora está en ${
    STATUS_LABELS[newStatus] ?? newStatus
  }.`
}

const changePriority = (caseId, newPriority) => {
  maqueta.changeCasePriority(caseId, newPriority)
  confirmation.value = `La prioridad de ${clientNameOf(caseId)} ahora es ${
    PRIORITY_LABELS[newPriority] ?? newPriority
  }.`
}

/** "Registrar caso" abre P-4, tanto si la lista tiene casos como si está vacía (RF-43). */
const openNewCase = () => {
  router.push({ name: 'contador-registro' })
}

const retry = () => {
  maqueta.retryScreen(SCREEN_IDS.myCases)
}

onMounted(() => {
  maqueta.startScreenLoad(SCREEN_IDS.myCases)
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
