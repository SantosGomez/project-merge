<template>
  <q-page class="directory-page">
    <section class="directory-panel" aria-labelledby="directory-title">
      <div class="directory-panel__head">
        <h2 id="directory-title" class="directory-panel__title">Directorio de contadores</h2>
        <p class="directory-panel__help">
          Solo se muestran los nombres; al elegir uno se abre su detalle. No hay conteos ni casos
          aquí.
        </p>
      </div>

      <div class="directory-panel__body">
        <ScreenLoader
          v-if="screenStateName === SCREEN_STATES.loading"
          text="Cargando el directorio de contadores…"
        />

        <ErrorState
          v-else-if="screenStateName === SCREEN_STATES.error"
          detail="el directorio de contadores."
          @retry="retry"
        />

        <EmptyState
          v-else-if="screenStateName === SCREEN_STATES.empty"
          title="No hay contadores"
          message="No hay contadores registrados en el equipo."
        />

        <ul v-else class="counter-names-list">
          <li v-for="counter in counters" :key="counter.id">
            <button
              type="button"
              class="counter-name-btn"
              :class="{ 'counter-name-btn--selected': counter.id === contadoresStore.contadorSeleccionadoId }"
              :aria-pressed="counter.id === contadoresStore.contadorSeleccionadoId"
              @click="selectCounter(counter.id)"
            >
              <span class="counter-name-btn__text">{{ counter.name }}</span>
              <span
                v-if="counter.id === contadoresStore.contadorSeleccionadoId"
                class="counter-name-btn__selected-mark"
                >Seleccionado</span
              >
            </button>
          </li>
        </ul>
      </div>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { useCountersStore } from '../stores/counters.js'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { contadorAFila } from '../utils/filasVista.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const router = useRouter()
const maqueta = useMaquetaStore()
const contadoresStore = useCountersStore()

/** Contadores adaptados a filas con nombre visible (RNF-08, RF-16). */
const counters = computed(() =>
  contadoresStore.contadores.map(contadorAFila).filter((fila) => fila !== null),
)

const screenStateName = computed(() =>
  screenState({
    loading: contadoresStore.cargando,
    error: contadoresStore.error,
    rows: counters.value,
  }),
)

const selectCounter = (counterId) => {
  if (contadoresStore.cargando || contadoresStore.error) return
  // RF-17: se deja el contador elegido en el store para que P-2 lo muestre seleccionado.
  contadoresStore.contadorSeleccionadoId = counterId
  // Compatibilidad con la maqueta 001: se mantiene la selección sincronizada.
  maqueta.selectCounter(counterId)
  router.push({ name: 'admin-dashboard' })
}

const retry = () => {
  contadoresStore.reintentar()
}

onMounted(() => {
  // Compatibilidad con el flujo anterior (carga inicial de la pantalla en la maqueta).
  maqueta.startScreenLoad(SCREEN_IDS.directory)
  contadoresStore.cargarContadores()
})
</script>

<style scoped>
.directory-page {
  padding: 16px;
}

.directory-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.directory-panel__head {
  margin-bottom: 12px;
}

.directory-panel__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.directory-panel__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

.directory-panel__body {
  min-width: 0;
}

.counter-names-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.counter-name-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid #c9d4e0;
  border-radius: 10px;
  background: #ffffff;
  color: #102a43;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.counter-name-btn:hover {
  border-color: #1f5f99;
  background: #f0f6fc;
}

.counter-name-btn:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

.counter-name-btn--selected {
  border-color: #1f5f99;
  background: #e6f0fb;
  box-shadow: inset 4px 0 0 #1f5f99;
}

.counter-name-btn__text {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.counter-name-btn__selected-mark {
  color: #1f5f99;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
}

@media (min-width: 1024px) {
  .directory-page {
    padding: 20px 24px;
  }
  .directory-panel__body {
    max-height: 52vh;
    overflow-y: auto;
    padding-right: 4px;
  }
}
</style>