<template>
  <q-page class="dashboard-page">
    <div class="dashboard-page__head">
      <p class="dashboard-page__lead">
        Revisa cuántos casos tiene cada contador en cada estado y selecciona uno para ver el detalle
        de sus casos.
      </p>

      <q-btn
        class="dashboard-page__directory-btn control-touch"
        color="primary"
        no-caps
        unelevated
        icon="groups"
        label="Ver directorio"
        :to="{ name: 'admin-directorio' }"
      />
    </div>

    <ScreenLoader
      v-if="screenStateName === SCREEN_STATES.loading"
      text="Cargando los contadores del equipo y los conteos de sus casos…"
    />

    <ErrorState
      v-else-if="screenStateName === SCREEN_STATES.error"
      detail="los contadores del equipo y los conteos de sus casos."
      @retry="retry"
    />

    <div v-else class="dashboard-page__grid">
      <section class="dashboard-panel" aria-labelledby="counter-list-title">
        <div class="dashboard-panel__head">
          <h2 id="counter-list-title" class="dashboard-panel__title">Contadores del equipo</h2>
          <p class="dashboard-panel__help">
            Cada conteo indica cuántos casos tiene el contador en estado Pendiente, En proceso o
            Finalizado; se muestra 0 cuando no hay casos en ese estado. Selecciona un contador para
            ver el detalle de sus casos.
          </p>
        </div>

        <div class="dashboard-panel__body">
          <ul class="counter-list">
            <CounterCountsRow
              v-for="counter in counters"
              :key="counter.id"
              :counter="counter"
              :counts="maqueta.countsFor(counter.id)"
              :selected="counter.id === maqueta.selectedCounterId"
              @select="selectCounter(counter.id)"
            />
          </ul>
        </div>
      </section>

      <section class="dashboard-panel" aria-labelledby="counter-detail-title">
        <div class="dashboard-panel__head">
          <h2 id="counter-detail-title" class="dashboard-panel__title">Detalle de casos</h2>

          <p v-if="selectedCounter" class="dashboard-panel__help">
            Casos de {{ selectedCounter.name }}. Esta vista es de solo consulta: no permite cambiar
            el estado ni la prioridad.
          </p>
          <p v-else class="dashboard-panel__help">
            Selecciona un contador de la lista para ver el cliente, el estado y la prioridad de cada
            uno de sus casos.
          </p>
        </div>

        <div class="dashboard-panel__body">
          <p v-if="!selectedCounter" class="dashboard-panel__prompt" role="status">
            Todavía no hay un contador seleccionado. Elige uno de la lista para ver sus casos.
          </p>

          <EmptyState
            v-else-if="selectedCases.length === 0"
            title="Este contador no tiene casos"
            :message="`El contador ${selectedCounter.name} no tiene casos registrados. Selecciona otro contador de la lista para ver su detalle.`"
          />

          <ul v-else class="case-list">
            <CaseRow
              v-for="oneCase in selectedCases"
              :key="oneCase.id"
              :case-item="oneCase"
              readonly
            />
          </ul>
        </div>
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'

import CaseRow from '../components/CaseRow.vue'
import CounterCountsRow from '../components/CounterCountsRow.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { exampleCounters } from '../services/exampleData.js'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { casesByCounter } from '../utils/caseRules.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

/*
 * P-2 Dashboard del administrador (RF-11 a RF-15, RF-42, RNF-9, RNF-10).
 * Lista todos los contadores con sus tres conteos y muestra el detalle del seleccionado.
 * Solo consulta: no hay controles para cambiar estado ni prioridad (RF-13, RF-15).
 */
const maqueta = useMaquetaStore()
const counters = exampleCounters

const screen = computed(() => maqueta.screens[SCREEN_IDS.dashboard])

/** Carga, error o contenido; los conteos siempre existen porque hay contadores (RF-35, RF-37). */
const screenStateName = computed(() =>
  screenState({
    loading: screen.value.loading,
    error: screen.value.error,
    rows: counters,
  }),
)

const selectedCounter = computed(
  () => counters.find((counter) => counter.id === maqueta.selectedCounterId) ?? null,
)

/** Casos del contador seleccionado; cambiar de selección reemplaza el detalle (RF-15). */
const selectedCases = computed(() =>
  selectedCounter.value ? casesByCounter(maqueta.cases, selectedCounter.value.id) : [],
)

const selectCounter = (counterId) => {
  if (screen.value.loading || screen.value.error) {
    return
  }

  maqueta.selectCounter(counterId)
}

/** Reintento de la carga; el store descarta la selección anterior en P-2 (RF-37). */
const retry = () => {
  maqueta.retryScreen(SCREEN_IDS.dashboard)
}

// Cada vez que se abre P-2 se repite la carga simulada de aproximadamente un segundo (RF-35).
onMounted(() => {
  maqueta.startScreenLoad(SCREEN_IDS.dashboard)
})
</script>

<style scoped>
.dashboard-page {
  padding: 16px;
}

.dashboard-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.dashboard-page__lead {
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

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-8). */
.dashboard-page__directory-btn:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}

.dashboard-page__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.dashboard-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.dashboard-panel__head {
  margin-bottom: 12px;
}

.dashboard-panel__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.dashboard-panel__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

.dashboard-panel__body {
  min-width: 0;
}

.dashboard-panel__prompt {
  margin: 0;
  padding: 20px 16px;
  border: 1px dashed #b9c4d0;
  border-radius: 10px;
  background: #ffffff;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
  text-align: center;
}

.counter-list,
.case-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * En escritorio, la lista de contadores y el detalle tienen desplazamiento vertical
 * propio, sin paginación y sin recortar filas (RNF-10).
 */
@media (min-width: 1024px) {
  .dashboard-page {
    padding: 20px 24px;
  }

  .dashboard-page__grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: start;
  }

  .dashboard-panel__body {
    max-height: 52vh;
    overflow-y: auto;
    padding-right: 4px;
  }
}
</style>
