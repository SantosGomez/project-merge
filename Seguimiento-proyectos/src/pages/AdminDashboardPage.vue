<template>
  <q-page class="dashboard-page">
    <div class="dashboard-page__inner">
      <div class="dashboard-page__head">
        <p class="dashboard-page__lead">
          Revisa cuántos casos tiene cada contador en cada estado y selecciona uno para ver el detalle
          de sus casos. Esta pantalla es de solo consulta: aquí no se cambia el estado ni la
          prioridad de ningún caso.
        </p>

        <q-btn
          class="dashboard-page__directory-btn control-touch"
          color="primary"
          no-caps
          unelevated
          icon="groups"
          label="Ver directorio"
          :to="{ name: 'admin-directorio' }"
        >
          <q-tooltip>Abre el directorio de contadores para buscar a una persona por su nombre.</q-tooltip>
        </q-btn>
      </div>

      <ScreenLoader
        v-if="estadoPantalla === SCREEN_STATES.loading"
        text="Cargando los contadores del equipo y los conteos de sus casos…"
      />

      <ErrorState
        v-else-if="estadoPantalla === SCREEN_STATES.error"
        :detail="mensajeError"
        @retry="reintentar"
      />

      <EmptyState
        v-else-if="estadoPantalla === SCREEN_STATES.empty"
        title="No hay contadores registrados"
        message="El equipo todavía no tiene contadores registrados, por eso no hay conteos ni casos que mostrar."
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
                v-for="contador in contadores"
                :key="contador.id"
                :counter="contadorAFila(contador)"
                :counts="contadoresStore.conteosDe(contador.id)"
                :selected="contador.id === contadoresStore.contadorSeleccionadoId"
                @select="seleccionar(contador.id)"
              />
            </ul>
          </div>
        </section>

        <section class="dashboard-panel" aria-labelledby="counter-detail-title">
          <div class="dashboard-panel__head">
            <h2 id="counter-detail-title" class="dashboard-panel__title">Detalle de casos</h2>

            <p v-if="contadorSeleccionado" class="dashboard-panel__help">
              Casos de {{ contadorSeleccionado.nombre }}. Esta vista es de solo consulta: no permite
              cambiar el estado ni la prioridad.
            </p>
            <p v-else class="dashboard-panel__help">
              Selecciona un contador de la lista para ver el cliente, el estado y la prioridad de cada
              uno de sus casos.
            </p>
          </div>

          <div class="dashboard-panel__body">
            <p v-if="!contadorSeleccionado" class="dashboard-panel__prompt" role="status">
              Todavía no hay un contador seleccionado. Elige uno de la lista para ver sus casos.
            </p>

            <ScreenLoader
              v-else-if="estadoDetalle === SCREEN_STATES.loading"
              text="Cargando los casos del contador seleccionado…"
            />

            <!--
              El estado de error del detalle no llega aquí: el store lo comparte con la carga
              general y la pantalla muestra el ErrorState completo, que al reintentar vuelve sin
              contador seleccionado (RF-36).
            -->
            <EmptyState
              v-else-if="estadoDetalle === SCREEN_STATES.empty"
              title="Este contador no tiene casos"
              :message="`El contador ${contadorSeleccionado.nombre} no tiene casos registrados. Selecciona otro contador de la lista para ver su detalle.`"
            />

            <ul v-else class="case-list">
              <CaseRow
                v-for="caso in filasDetalle"
                :key="caso.id"
                :case-item="caso"
                readonly
              />
            </ul>
          </div>
        </section>
      </div>
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
import { useCountersStore } from '../stores/counters.js'
import { casosAFilas, contadorAFila } from '../utils/filasVista.js'
import { SCREEN_STATES } from '../utils/screenState.js'

/*
 * P-2 Dashboard del administrador (RF-11 a RF-15, RF-34 a RF-36, RF-38, RF-39, RNF-02,
 * RNF-03, RNF-08, RNF-09). Obtiene la lista de contadores y sus conteos del backend a
 * través del store, muestra el detalle del contador seleccionado y solo permite consultar:
 * no hay ningún control para cambiar estado ni prioridad (RF-13).
 *
 * Al abrir la pantalla se repite la carga completa y no se muestran datos anteriores
 * (RF-34). Si la carga falla, el store descarta los conteos parciales y la selección;
 * el ErrorState ofrece reintentar y P-2 vuelve sin contador seleccionado (RF-36).
 */
const contadoresStore = useCountersStore()

/** Contadores registrados, tal como los entrega el servicio (`{ id, nombre }`). */
const contadores = computed(() => contadoresStore.contadores)

/** Estado general de la pantalla: carga, error, vacío o contenido (RF-34 a RF-36). */
const estadoPantalla = computed(() => contadoresStore.estadoPantalla)

/** Estado del detalle: carga del contador elegido, vacío de casos o contenido (RF-13, RF-14). */
const estadoDetalle = computed(() => contadoresStore.estadoDetalle)

/** Contador cuyo detalle se está viendo, o null (RF-13). */
const contadorSeleccionado = computed(() => contadoresStore.contadorSeleccionado)

/** Casos del detalle adaptados a las props de CaseRow (cliente, estado y prioridad). */
const filasDetalle = computed(() => casosAFilas(contadoresStore.casosDetalle))

/** Mensaje de tres partes del último error; si no llegó, se describe la carga (RNF-01). */
const mensajeError = computed(
  () => contadoresStore.error?.mensaje ?? 'la carga de los contadores y de sus conteos.',
)

/** Selecciona un contador y reemplaza el detalle anterior (RF-13, RF-15). */
const seleccionar = (contadorId) => contadoresStore.seleccionarContador(contadorId)

/** Reintenta la carga completa; P-2 vuelve sin contador seleccionado (RF-36). */
const reintentar = () => contadoresStore.reintentar()

onMounted(async () => {
  /*
   * RF-17: P-3 deja el contador elegido en el store antes de abrir P-2. La carga de P-2
   * reinicia la selección, así que se guarda aquí y se restablece al terminar, siempre que
   * el contador siga existiendo. Sin selección previa, P-2 se abre sin detalle (RF-13).
   */
  const seleccionPrevia = contadoresStore.contadorSeleccionadoId

  await contadoresStore.cargarContadores()

  if (seleccionPrevia === null) {
    return
  }

  const existe = contadoresStore.contadores.some((contador) => contador.id === seleccionPrevia)

  if (existe) {
    await contadoresStore.seleccionarContador(seleccionPrevia)
  }
})
</script>

<style scoped>
.dashboard-page {
  padding: 16px;
}

.dashboard-page__inner {
  width: 100%;
  min-width: 0;
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

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-07). */
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
  min-width: 0;
}

/* RNF-02: una columna con 720 px de ancho como máximo, centrada, entre 600 y 1023 px. */
@media (min-width: 600px) and (max-width: 1023px) {
  .dashboard-page__inner {
    max-width: 720px;
    margin: 0 auto;
  }
}

/*
 * RNF-09: desde 1024 px hay varias columnas y cada lista se recorre con desplazamiento
 * vertical propio, sin paginación y sin recortar filas.
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
