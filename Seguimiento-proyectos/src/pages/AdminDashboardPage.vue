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

      <ResumenEquipo
        :resumen="resumen"
        :cargando="cargandoResumen"
        :error="errorResumen"
        @reintentar="cargarResumen"
      />

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
              Cada conteo indica cuántos casos importantes tiene el contador en estado Pendiente, En
              proceso o Finalizado (0 si no tiene). Toca el nombre para ver todos sus casos importantes
              o un conteo para ver solo los de ese estado.
            </p>
          </div>

          <div class="dashboard-panel__body">
            <q-input
              v-model="busqueda"
              dense
              outlined
              clearable
              debounce="150"
              type="search"
              label="Buscar contador por nombre"
              aria-label="Buscar contador por nombre"
              class="counter-search"
            >
              <template #prepend>
                <q-icon name="search" aria-hidden="true" />
              </template>
              <q-tooltip>Escribe parte del nombre; no importan mayúsculas ni acentos.</q-tooltip>
            </q-input>
            <p class="counter-search__resultado" aria-live="polite">
              {{ contadoresVisibles.length }} de {{ contadores.length }} contadores
            </p>

            <p v-if="contadoresVisibles.length === 0" class="dashboard-panel__prompt" role="status">
              Ningún contador coincide con «{{ busqueda }}». Revisa el nombre o borra la búsqueda.
            </p>

            <q-list v-else tag="ul" class="counter-list">
              <CounterCountsRow
                v-for="contador in contadoresVisibles"
                :key="contador.id"
                :counter="contadorAFila(contador)"
                :counts="contadoresStore.conteosDe(contador.id)"
                :selected="contador.id === contadoresStore.contadorSeleccionadoId"
                :estado-activo="contador.id === contadoresStore.contadorSeleccionadoId ? estadoConteoActivo : null"
                @select="seleccionar(contador.id)"
                @filtrar="(estado) => filtrarPorConteo(contador.id, estado)"
              />
            </q-list>
          </div>
        </section>

        <section ref="panelDetalle" class="dashboard-panel" aria-labelledby="counter-detail-title">
          <div class="dashboard-panel__head">
            <h2 id="counter-detail-title" class="dashboard-panel__title">Detalle de casos</h2>

            <p v-if="contadorSeleccionado" class="dashboard-panel__help">
              Casos importantes de {{ contadorSeleccionado.nombre }}. Esta vista es de solo consulta: no
              permite cambiar el estado ni la prioridad.
            </p>
            <p v-else class="dashboard-panel__help">
              Selecciona un contador de la lista para ver el cliente, el estado y la prioridad de cada
              uno de sus casos importantes.
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
              title="Este contador no tiene casos importantes"
              :message="`El contador ${contadorSeleccionado.nombre} no tiene casos marcados como importantes. Selecciona otro contador de la lista para ver su detalle.`"
            />

            <template v-else>
              <FiltrosCasos
                v-model="filtrosDetalle"
                :estados="ESTADOS_DETALLE"
                :con-interruptores="false"
              />

              <p v-if="paginacionDetalle.totalPaginas === 0" class="dashboard-panel__prompt" role="status">
                {{ contadorSeleccionado.nombre }} no tiene casos importantes en estado
                {{ STATUS_LABELS[filtrosDetalle.estado] }}. Elige otro estado o «Todos».
              </p>

              <q-list v-else bordered separator class="case-list" aria-label="Casos importantes del contador">
                <CasoItem v-for="caso in filasDetalle" :key="caso.id" :caso="caso" solo-lectura />
              </q-list>

              <div v-if="paginacionDetalle.totalPaginas > 0" class="detalle-paginacion">
                <p class="detalle-paginacion__texto" aria-live="polite">{{ paginacionDetalle.texto }}</p>
                <q-pagination
                  v-if="paginacionDetalle.totalPaginas > 1"
                  :model-value="paginacionDetalle.pagina"
                  :max="paginacionDetalle.totalPaginas"
                  :max-pages="5"
                  direction-links
                  boundary-numbers
                  color="primary"
                  active-design="unelevated"
                  @update:model-value="(p) => (paginaDetalle = p)"
                />
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import CasoItem from '../components/CasoItem.vue'
import CounterCountsRow from '../components/CounterCountsRow.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import FiltrosCasos from '../components/FiltrosCasos.vue'
import ResumenEquipo from '../components/ResumenEquipo.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { getResumenEquipo } from '../services/counterService.js'
import { useCountersStore } from '../stores/counters.js'
import { STATUS_LABELS } from '../utils/constants.js'
import { casoAFila, contadorAFila } from '../utils/filasVista.js'
import { FILTROS_INICIALES, filtrarCasos, filtrarContadores, hoyLocal, paginar } from '../utils/filtrosCasos.js'
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

/** Búsqueda por nombre: solo oculta filas de la lista; el detalle abierto se conserva. */
const busqueda = ref('')
const contadoresVisibles = computed(() => filtrarContadores(contadores.value, busqueda.value))

/*
 * Filtro de estado del detalle. Los chips y los conteos del contador seleccionado comparten
 * este valor: tocar un conteo lo cambia y el chip correspondiente se marca, y al revés.
 */
const ESTADOS_DETALLE = ['todos', 'pendiente', 'en_proceso', 'finalizado']
const filtrosDetalle = ref({ ...FILTROS_INICIALES, estado: 'todos' })
const paginaDetalle = ref(1)
const POR_PAGINA_DETALLE = 10

/** Estado marcado en los conteos del contador seleccionado (null con «Todos»). */
const estadoConteoActivo = computed(() =>
  filtrosDetalle.value.estado === 'todos' ? null : filtrosDetalle.value.estado,
)

watch(filtrosDetalle, () => {
  paginaDetalle.value = 1
})

const paginacionDetalle = computed(() =>
  paginar(
    filtrarCasos(contadoresStore.casosDetalle, filtrosDetalle.value, hoyLocal()),
    paginaDetalle.value,
    POR_PAGINA_DETALLE,
  ),
)

/** Casos del detalle adaptados a las props de CasoItem (solo lectura). */
const filasDetalle = computed(() => paginacionDetalle.value.elementos.map(casoAFila))

/** Mensaje de tres partes del último error; si no llegó, se describe la carga (RNF-01). */
const mensajeError = computed(
  () => contadoresStore.error?.mensaje ?? 'la carga de los contadores y de sus conteos.',
)

const panelDetalle = ref(null)

// En celular y tableta el detalle queda debajo de la lista: se lleva la vista hasta él.
const mostrarDetalle = async () => {
  await nextTick()
  if (window.matchMedia('(max-width: 1023px)').matches) {
    panelDetalle.value?.scrollIntoView({ block: 'start' })
  }
}

/** Selecciona un contador; por defecto, con todos sus casos importantes (RF-13, RF-15). */
const seleccionar = async (contadorId, estado = 'todos') => {
  filtrosDetalle.value = { ...filtrosDetalle.value, estado }
  // Si ya era el seleccionado no se vuelve a pedir el detalle: solo cambia el filtro.
  if (contadorId !== contadoresStore.contadorSeleccionadoId) {
    await contadoresStore.seleccionarContador(contadorId)
  }
  // Después de cargar: con la página ya completa, el desplazamiento llega hasta el detalle.
  mostrarDetalle()
}

/** Tocar un conteo filtra por ese estado; tocar otra vez el conteo activo quita el filtro. */
const filtrarPorConteo = (contadorId, estado) => {
  const yaActivo = contadorId === contadoresStore.contadorSeleccionadoId && estadoConteoActivo.value === estado
  return seleccionar(contadorId, yaActivo ? 'todos' : estado)
}

/** Reintenta la carga completa; P-2 vuelve sin contador seleccionado (RF-36). */
const reintentar = () => contadoresStore.reintentar()

/*
 * Tarjetas KPI del equipo: se piden aparte de la lista y con su propio estado, así un fallo
 * del resumen no oculta la lista de contadores ni al revés.
 */
const resumen = ref(null)
const cargandoResumen = ref(false)
const errorResumen = ref(null)

const cargarResumen = async () => {
  cargandoResumen.value = true
  errorResumen.value = null
  try {
    resumen.value = await getResumenEquipo()
  } catch (fallo) {
    errorResumen.value = fallo
  } finally {
    cargandoResumen.value = false
  }
}

onMounted(async () => {
  cargarResumen()

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
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

/* La búsqueda queda fija arriba cuando la lista se desplaza dentro del panel (escritorio). */
.counter-search {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f7f9fc;
}

.counter-search__resultado,
.detalle-paginacion__texto {
  margin: -4px 0 0;
  color: #334e68;
  font-size: 0.85rem;
}

.detalle-paginacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detalle-paginacion__texto {
  margin: 0;
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

.counter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}

.case-list {
  overflow: hidden;
  border-color: #dbe4ee;
  border-radius: 10px;
  background: #ffffff;
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
