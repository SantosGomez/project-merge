<template>
  <q-page class="my-cases-page">
    <div class="my-cases-page__head">
      <p class="my-cases-page__lead">
        Aquí están los casos que registraste y los que te asignó el administrador. Cambia el estado desde la lista; para el resto de los datos usa «Editar».
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
              class="sin-resultados__limpiar control-touch"
              @click="limpiarFiltros"
            >
              <q-tooltip>Vuelve a mostrar los casos abiertos, sin otros filtros.</q-tooltip>
            </q-btn>
          </template>
        </div>

        <!-- Las filas van directo en la lista: así se pintan los separadores y todas existen en la página. -->
        <q-list v-else bordered separator class="case-list" aria-label="Tus casos">
          <CasoItem
            v-for="item in filas"
            :key="item.id"
            :caso="item"
            :deshabilitado="guardandoId === item.id"
            @alternar-importante="guardarCambio(item.id, { importante: !item.important })"
            @cambiar-estado="(v) => guardarCambio(item.id, { estado: v })"
            @editar="abrirEdicion(item.id)"
          />
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
      @registrado="alRegistrar"
      @guardado="alGuardarEdicion"
    />
  </q-page>
</template>

<script setup>
import { computed, ref, onBeforeUnmount, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute } from 'vue-router'

import CaseFormDialog from '../components/CaseFormDialog.vue'
import CasoItem from '../components/CasoItem.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import FiltrosCasos from '../components/FiltrosCasos.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { eventos } from '../services/eventosService.js'
import { useCasesStore } from '../stores/cases.js'
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
} from '../utils/filtrosCasos.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const cases = useCasesStore()
const $q = useQuasar()
const route = useRoute()

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
  if (document.visibilityState === 'visible') hoy.value = hoyLocal()
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
// Fila que se está guardando: solo esa se deshabilita mientras tanto.
const guardandoId = ref(null)

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

// Guarda un cambio de estado o de importante. Si falla, el aviso ofrece repetir el mismo cambio.
const guardarCambio = async (caseId, cambios) => {
  if (cases.guardando) return
  const cliente = clienteDe(caseId)
  guardandoId.value = caseId

  const resultado = await cases.actualizarCaso(caseId, cambios)
  guardandoId.value = null

  if (resultado.ok) {
    $q.notify({ type: 'positive', message: avisoDeExito(cliente, cambios) })
  } else {
    $q.notify({
      type: 'negative',
      message: `No se guardó el cambio del caso de ${cliente}.`,
      caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
      actions: [{ label: 'Reintentar', color: 'white', noCaps: true, handler: () => guardarCambio(caseId, cambios) }],
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

const alGuardarEdicion = () => {
  $q.notify({ type: 'positive', message: 'Cambios guardados.' })
}

const alRegistrar = async () => {
  $q.notify({ type: 'positive', message: 'Caso registrado.' })

  // Si la lista no había cargado, se recarga para que el caso nuevo quede visible.
  if (cases.error) {
    await cases.reintentar()
  }
}

const retry = () => cases.reintentar()

onMounted(() => {
  cases.cargarCasos()
  document.addEventListener('visibilitychange', actualizarHoy)
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

.control-touch {
  min-width: 44px;
  min-height: 44px;
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
  overflow: hidden;
  border-color: var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
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
</style>