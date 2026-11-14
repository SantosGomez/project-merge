<template>
  <q-page class="my-cases-page">
    <q-tabs
      v-model="pestana"
      no-caps
      inline-label
      align="left"
      active-color="primary"
      indicator-color="primary"
      class="my-cases-page__tabs"
    >
      <q-tab name="casos" icon="list_alt" label="Mis casos">
        <q-tooltip>Los casos que registraste o te asignaron.</q-tooltip>
      </q-tab>
      <q-tab name="actividades" icon="task_alt" label="Mis actividades">
        <q-tooltip>
          Tu jornada de hoy, lo que te toca hacer en el mes, tu calendario de vencimientos y tus
          informes de horas.
        </q-tooltip>
      </q-tab>
    </q-tabs>

    <q-tab-panels
      v-model="pestana"
      keep-alive
      animated
      transition-prev="fade"
      transition-next="fade"
      :transition-duration="150"
      class="my-cases-page__paneles"
    >
      <q-tab-panel name="casos" class="my-cases-page__panel">
    <div class="my-cases-page__head">
      <p class="my-cases-page__lead">
        Aquí están los casos que registraste, los que te asignó el administrador, los de tus auxiliares y los de los contadores a los que apoyas. Cambia el estado desde la lista; usa «Ver» para consultar la ficha completa sin cambiarla y «Editar» para modificarla.<template v-if="session.esAuxiliar"> Solo tu contador puede marcar un caso como importante.</template>
      </p>
      <q-btn
        class="my-cases-page__register-btn control-touch boton-presionable"
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
      <q-select
        :transition-duration="180"
        v-if="contadoresQueMeTienenComoAuxiliar.length > 0"
        v-model="contadorSeleccionadoParaRegistro"
        :options="contadoresQueMeTienenComoAuxiliar.map((c) => ({ label: c.nombre, value: c.id }))"
        option-label="label"
        option-value="value"
        emit-value
        map-options
        dense
        outlined
        options-dense
        dropdown-icon="expand_more"
        popup-content-class="menu-seleccion-custom"
        transition-show="jump-down"
        transition-hide="jump-up"
        class="selector-moderno my-cases-page__registrar-para"
        :disable="cases.guardando"
        label="Registrar caso para"
      >
        <template #prepend><q-icon name="person_add" /></template>
        <q-tooltip>Registra el caso a nombre de este contador (tú eres su auxiliar).</q-tooltip>
      </q-select>
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
        title="Todavía no tienes casos"
        message="Registra el primero con «Registrar caso». Los casos que te asigne el administrador también aparecerán aquí."
        action-label="Registrar caso"
        @action="abrirRegistro"
      />

      <template v-else>
        <FiltrosCasos v-model="filtros" />

        <div v-if="paginacion.totalPaginas === 0" class="sin-resultados" role="status">
          <q-icon name="filter_alt" size="28px" color="dg-texto-tenue" aria-hidden="true" />
          <p v-if="sonFiltrosIniciales" class="sin-resultados__texto">
            No tienes casos abiertos. Los terminados están en el filtro «Finalizado».
          </p>
          <template v-else>
            <p class="sin-resultados__texto">Ningún caso cumple estos filtros.</p>
            <q-btn
              flat
              no-caps
              color="primary"
              icon="filter_alt_off"
              label="Limpiar filtros"
              class="sin-resultados__limpiar control-touch boton-presionable"
              @click="limpiarFiltros"
            >
              <q-tooltip>Vuelve a mostrar los casos abiertos, sin otros filtros.</q-tooltip>
            </q-btn>
          </template>
        </div>

        <!-- Las filas van directo en la lista: así se pintan los separadores y todas existen en la página. -->
        <q-list v-else bordered separator class="case-list" aria-label="Tus casos">
          <!-- Solo se anima la salida de una fila que pasa a Finalizado; al filtrar no se anima nada. -->
          <TransitionGroup
            name="caso-salida"
            :css="animarSalida"
            :move-class="animarSalida ? 'caso-salida-move' : 'caso-sin-movimiento'"
          >
            <CasoItem
              v-for="item in filas"
              :id="`caso-${item.id}`"
              :key="item.id"
              tabindex="-1"
              :class="{ 'caso-resaltado': String(item.id) === casoResaltadoId }"
              :caso="item"
              :deshabilitado="guardandoId === item.id"
              :contador-autenticado-id="contadorAutenticadoId"
              :puede-marcar-importante="!session.esAuxiliar"
              @alternar-importante="guardarCambio(item.id, { importante: !item.important })"
              @cambiar-estado="(v) => guardarCambio(item.id, { estado: v })"
              @editar="abrirEdicion(item.id)"
              @ver="abrirDetalle(item.id)"
            />
          </TransitionGroup>
        </q-list>

        <div v-if="paginacion.totalPaginas > 0" class="paginacion">
          <p class="paginacion__texto" aria-live="polite">{{ paginacion.texto }}</p>
          <q-select
            v-model="porPagina"
            :options="OPCIONES_POR_PAGINA"
            dense
            outlined
            options-dense
            dropdown-icon="expand_more"
            popup-content-class="menu-seleccion-custom"
            transition-show="jump-down"
            transition-hide="jump-up"
            :transition-duration="180"
            label="Por página"
            class="paginacion__por-pagina selector-moderno"
          >
            <template #option="{ itemProps, opt, selected }">
              <q-item
                v-bind="itemProps"
                :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
              >
                <q-item-section>
                  <q-item-label>{{ opt }}</q-item-label>
                </q-item-section>
                <q-item-section v-if="selected" side>
                  <q-icon name="check" size="18px" color="primary" />
                </q-item-section>
              </q-item>
            </template>
            <q-tooltip>Cuántos casos se muestran en cada página.</q-tooltip>
          </q-select>
          <q-pagination
            v-if="paginacion.totalPaginas > 1"
            :model-value="paginacion.pagina"
            :max="paginacion.totalPaginas"
            :max-pages="5"
            direction-links
            boundary-numbers
            color="primary"
            active-design="unelevated"
            class="paginacion__paginas"
            @update:model-value="(p) => (pagina = p)"
          />
        </div>
      </template>
    </div>

    <CaseFormDialog
      v-model="dialogoRegistroAbierto"
      :caso="casoEnEdicion"
      :contador-duenio-id="contadorSeleccionadoParaRegistro"
      @registrado="alRegistrar"
      @guardado="alGuardarEdicion"
    />
    <CasoDetalleDialog
      v-if="casoEnDetalle"
      v-model="detalleAbierto"
      :caso="casoEnDetalle"
    />
      </q-tab-panel>

      <q-tab-panel name="actividades" class="my-cases-page__panel">
        <MisActividades />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>

<script setup>
import { computed, nextTick, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

import CaseFormDialog from '../components/CaseFormDialog.vue'
import CasoDetalleDialog from '../components/CasoDetalleDialog.vue'
import CasoItem from '../components/CasoItem.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import FiltrosCasos from '../components/FiltrosCasos.vue'
import MisActividades from '../components/MisActividades.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { eventos } from '../services/eventosService.js'
import { useCasesStore } from '../stores/cases.js'
import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useSessionStore } from '../stores/session.js'
import { STATUS_LABELS } from '../utils/constants.js'
import { casoAFila } from '../utils/filasVista.js'
import {
  FILTROS_INICIALES,
  OPCIONES_POR_PAGINA,
  esCasoProximoAVencer,
  esCasoVencido,
  filtrarCasos,
  filtrosDesdeConsulta,
  hoyLocal,
  paginar,
  ubicarCaso,
} from '../utils/filtrosCasos.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const cases = useCasesStore()
const session = useSessionStore()
const auxiliaresStore = useAuxiliaresStore()
const $q = useQuasar()
const route = useRoute()
const router = useRouter()

// Pestaña en la URL (?tab=actividades), como «Mi equipo» en «Mi resumen»; sin parámetro, «Mis casos».
const PESTANAS = ['casos', 'actividades']
const pestana = computed({
  get: () => (PESTANAS.includes(route.query.tab) ? route.query.tab : 'casos'),
  set: (valor) => router.replace({ query: { ...route.query, tab: valor } }),
})

// Id del contador autenticado (texto en la sesión, número en el caso). Se usa para mostrar «de …»
// cuando el caso es de un auxiliar.
const contadorAutenticadoId = computed(() => (session.id ? Number(session.id) : null))

// Contadores para los que el contador autenticado es auxiliar; se usa para registrar casos en su nombre.
const contadoresQueMeTienenComoAuxiliar = ref([])
const contadorSeleccionadoParaRegistro = ref(null)

// «Mi resumen» abre esta pantalla ya filtrada (?filtro=vencidos, ?filtro=pendiente…).
const filtros = ref(filtrosDesdeConsulta(route.query.filtro))
const pagina = ref(1)
const porPagina = ref(OPCIONES_POR_PAGINA[0])

// Al cambiar los filtros o el tamaño de página se vuelve a la primera página.
watch([filtros, porPagina], () => {
  pagina.value = 1
})

// «Hoy» se recalcula al volver a la ventana: si la app queda abierta de un día para otro,
// los vencidos y los próximos a vencer se actualizan.
const hoy = ref(hoyLocal())
const actualizarHoy = () => {
  if (document.visibilityState !== 'visible') return
  hoy.value = hoyLocal()
  // Además se relee la lista: un cambio hecho mientras la ventana estaba oculta puede no haber llegado.
  cases.refrescarEnSilencio()
}

const paginacion = computed(() =>
  paginar(filtrarCasos(cases.casos, filtros.value, hoy.value), pagina.value, porPagina.value),
)

const filas = computed(() =>
  paginacion.value.elementos.map((caso) => ({
    ...casoAFila(caso),
    vencido: esCasoVencido(caso, hoy.value),
    proximo: esCasoProximoAVencer(caso, hoy.value),
  })),
)

const sonFiltrosIniciales = computed(() =>
  Object.keys(FILTROS_INICIALES).every((clave) => filtros.value[clave] === FILTROS_INICIALES[clave]),
)

const limpiarFiltros = () => {
  filtros.value = { ...FILTROS_INICIALES }
}

// Un fallo al guardar un cambio se avisa aparte: la lista sigue a la vista.
const screenStateName = computed(() =>
  screenState({
    loading: cases.cargando,
    error: cases.error,
    rows: cases.casos,
  }),
)

const dialogoRegistroAbierto = ref(false)
const casoEnEdicion = ref(null)
// Detalle de solo lectura («Ver»).
const detalleAbierto = ref(false)
const casoEnDetalle = ref(null)
// Fila que se está guardando: solo esa se deshabilita mientras tanto.
const guardandoId = ref(null)
// Se activa solo al finalizar un caso, para que esa fila salga con un fundido (no al filtrar).
const animarSalida = ref(false)
const DURACION_SALIDA_MS = 150

const mensajeError = computed(() => cases.error?.mensaje ?? 'la lista de tus casos.')

const clienteDe = (caseId) =>
  cases.casos.find((caso) => String(caso.id) === String(caseId))?.cliente ?? 'este cliente'

const avisoDeExito = (cliente, cambios) => {
  if (cambios.estado === 'finalizado') {
    return `Caso de ${cliente} marcado como Finalizado. Lo encuentras en el filtro «Finalizado».`
  }
  if (cambios.estado) return `Estado cambiado a «${STATUS_LABELS[cambios.estado] ?? cambios.estado}».`
  return 'Cambio guardado.'
}

// Espera que apaga la animación de salida; se cancela al desmontar la vista.
let esperaSalida = null

// Guarda un cambio de estado o de importante. Si falla, el aviso ofrece repetir el mismo cambio.
const guardarCambio = async (caseId, cambios) => {
  if (cases.guardando) return
  const cliente = clienteDe(caseId)
  guardandoId.value = caseId
  if (cambios.estado === 'finalizado') animarSalida.value = true

  const resultado = await cases.actualizarCaso(caseId, cambios)
  guardandoId.value = null
  // Se apaga cuando la fila ya salió, para que el siguiente filtro no se anime.
  if (animarSalida.value) {
    clearTimeout(esperaSalida)
    esperaSalida = setTimeout(() => (animarSalida.value = false), DURACION_SALIDA_MS + 50)
  }

  if (resultado.ok) {
    $q.notify({ type: 'positive', message: avisoDeExito(cliente, cambios) })
  } else if (!resultado.descartado) {
    // Un guardado descartado (llegó otro más nuevo) no es un fallo: no se avisa.
    $q.notify({
      type: 'negative',
      message: `No se guardó el cambio del caso de ${cliente}.`,
      caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
      actions: [{ label: 'Reintentar', color: 'dg-texto-claro', noCaps: true, handler: () => guardarCambio(caseId, cambios) }],
    })
  }
}

const abrirRegistro = () => {
  casoEnEdicion.value = null
  dialogoRegistroAbierto.value = true
}

// El mismo diálogo, en modo edición, con el caso tal como lo guarda el store.
const abrirEdicion = (caseId) => {
  casoEnEdicion.value = cases.casos.find((caso) => String(caso.id) === String(caseId)) ?? null
  dialogoRegistroAbierto.value = casoEnEdicion.value !== null
}

// Abre la ficha de solo lectura con los datos completos del caso.
const casoParaDetalle = (caseId) => {
  const caso = cases.casos.find((c) => String(c.id) === String(caseId)) ?? null
  // El POST /casos no devuelve el nombre del contador (sin join); si es el propio, se usa el de la sesión.
  if (caso && !caso.nombre_contador && session.nombreVisible && String(caso.contador_id) === String(session.id)) {
    return { ...caso, nombre_contador: session.nombreVisible }
  }
  return caso
}

const abrirDetalle = (caseId) => {
  casoEnDetalle.value = casoParaDetalle(caseId)
  detalleAbierto.value = casoEnDetalle.value !== null
}

/*
 * Si el caso cambia mientras la ficha está abierta (aviso en tiempo real o recarga silenciosa),
 * la ficha recibe la versión nueva y ella misma dice qué cambió. Si el caso ya no está en la
 * lista, la ficha conserva lo último que mostró. Se vigila el caso tal como está en el store:
 * su identidad solo cambia cuando llega una versión nueva.
 */
watch(
  () => cases.casos.find((c) => String(c.id) === String(casoEnDetalle.value?.id)),
  (nuevo) => {
    if (detalleAbierto.value && nuevo) casoEnDetalle.value = casoParaDetalle(nuevo.id)
  },
)

const alGuardarEdicion = () => {
  $q.notify({ type: 'positive', message: 'Cambios guardados.' })
}

const alRegistrar = async () => {
  $q.notify({ type: 'positive', message: 'Caso registrado.' })

  // Si la lista no había cargado, se recarga para que el caso nuevo quede visible.
  if (cases.error) {
    await cases.reintentar()
  } else if (contadorSeleccionadoParaRegistro.value !== null) {
    // El caso para el contador al que apoyas se guardó en otro store: se relee la lista.
    await cases.refrescarEnSilencio()
  }

  // Después de registrar, se limpia el selector para no crear el siguiente caso
  // para el mismo auxiliar por error.
  contadorSeleccionadoParaRegistro.value = null
}

const retry = () => cases.reintentar()

/*
 * Aviso de la campana (?casoId=): cuando la lista termina de cargar, ajusta filtro y página para
 * que el caso quede a la vista, lleva la pantalla hasta él y lo resalta unos segundos.
 * La marca se quita de la dirección para no repetirlo en cada recarga de la lista.
 */
const casoResaltadoId = ref(null)
let temporizadorResaltado = null

const irAlCasoDelAviso = async () => {
  const casoId = route.query.casoId
  if (!casoId || cases.cargando || cases.error) return

  const consultaSinCaso = { ...route.query }
  delete consultaSinCaso.casoId
  router.replace({ query: consultaSinCaso })

  const ubicacion = ubicarCaso(cases.casos, casoId, filtros.value, hoy.value, porPagina.value)
  if (!ubicacion) {
    $q.notify({ type: 'warning', message: 'Ese caso ya no está en tu lista.' })
    return
  }

  filtros.value = ubicacion.filtros
  // El cambio de filtros regresa a la página 1: la página se fija después de ese ajuste.
  await nextTick()
  pagina.value = ubicacion.pagina
  casoResaltadoId.value = String(casoId)
  await nextTick()

  const fila = document.getElementById(`caso-${casoId}`)
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  fila?.scrollIntoView({ block: 'center', behavior: sinMovimiento ? 'auto' : 'smooth' })
  fila?.focus({ preventScroll: true })

  clearTimeout(temporizadorResaltado)
  temporizadorResaltado = setTimeout(() => {
    casoResaltadoId.value = null
  }, 4000)
}

watch([() => route.query.casoId, () => cases.cargando], irAlCasoDelAviso)
onBeforeUnmount(() => clearTimeout(temporizadorResaltado))

onMounted(async () => {
  cases.cargarCasos()
  document.addEventListener('visibilitychange', actualizarHoy)

  const idPropio = Number(session.id)
  const resultado = await auxiliaresStore.listarContadoresQueMeTienenComoAuxiliar(idPropio)
  if (resultado.ok) {
    contadoresQueMeTienenComoAuxiliar.value = resultado.contadores ?? []
  }
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', actualizarHoy))

// Tiempo real: si el administrador cambia una prioridad, la lista se actualiza sola
const dejarDeEscuchar = [
  eventos.escuchar('aviso-nuevo', () => cases.refrescarEnSilencio()),
  eventos.escuchar('reconectado', () => cases.refrescarEnSilencio()),
]
onBeforeUnmount(() => dejarDeEscuchar.forEach((dejar) => dejar()))
</script>

<style scoped>
.my-cases-page {
  padding: 16px;
}

.my-cases-page__tabs {
  margin-bottom: 4px;
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto-secundario);
}

.my-cases-page__paneles {
  background: transparent;
}

.my-cases-page__panel {
  padding: 12px 0 0;
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
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}


.my-cases-page__register-btn:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.my-cases-page__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.case-list {
  position: relative;
  overflow: hidden;
  border-color: var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
}

/* Caso al que llevó un aviso de la campana: marco de acento unos segundos. */
.caso-resaltado {
  box-shadow: inset 0 0 0 2px var(--dg-acento);
  transition: box-shadow 200ms var(--dg-curva-salida);
}

.caso-resaltado:focus {
  outline: none;
}

/*
 * Salida de la fila que pasa a Finalizado: se desvanece y se corre un poco en 150 ms; las de abajo
 * suben con la misma curva. La fila sale del flujo (absolute) para que las demás puedan moverse.
 */
.caso-salida-leave-active {
  position: absolute;
  width: 100%;
  transition: opacity 150ms var(--dg-curva-salida), transform 150ms var(--dg-curva-salida);
}

.caso-salida-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.caso-salida-move {
  transition: transform 150ms var(--dg-curva-salida);
}

@media (prefers-reduced-motion: reduce) {
  .caso-salida-leave-active,
  .caso-salida-move {
    transition: opacity 150ms linear;
  }

  .caso-salida-leave-to {
    transform: none;
  }
}

.sin-resultados {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px dashed var(--dg-borde-fuerte);
  border-radius: 10px;
  background: var(--dg-superficie);
}

.sin-resultados__texto {
  margin: 0;
  flex: 1 1 220px;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
}

.paginacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.paginacion__texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.paginacion__por-pagina {
  width: 120px;
}

.paginacion__paginas {
  margin-left: auto;
}

@media (max-width: 599px) {
  .paginacion__paginas {
    margin-left: 0;
  }
}

@media (min-width: 1024px) {
  .my-cases-page {
    padding: 20px 24px;
  }
}

.my-cases-page__registrar-para {
  min-width: 240px;
}
</style>