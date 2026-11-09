<template>
  <q-page class="my-cases-page">
    <div class="my-cases-page__head">
      <p class="my-cases-page__lead">
        Revisa y actualiza los casos que tienes asignados. Cambia el estado desde la lista y el resto
        de los datos, incluida la prioridad, con «Editar».
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
        message="Aún no has registrado ningún caso. Usa el control «Registrar caso» para registrar el primero y empezar a gestionar tu carga."
        action-label="Registrar caso"
        @action="abrirRegistro"
      />

      <template v-else>
        <FiltrosCasos v-model="filtros" />

        <div v-if="paginacion.totalPaginas === 0" class="sin-resultados" role="status">
          <q-icon name="filter_alt" size="28px" color="grey-7" aria-hidden="true" />
          <p class="sin-resultados__texto">
            Ningún caso cumple estos filtros. Cambia el estado o usa «Limpiar filtros» para ver tus casos abiertos.
          </p>
        </div>

        <q-list v-else bordered separator class="case-list" aria-label="Tus casos">
          <!-- Cada fila entra con un desvanecido al aparecer en pantalla; el alto mínimo evita saltos. -->
          <q-intersection
            v-for="item in filas"
            :key="item.id"
            once
            transition="fade"
            class="case-list__entrada"
          >
            <CasoItem
              :caso="item"
              :deshabilitado="cases.guardando"
              @alternar-importante="guardarCambio(item.id, { importante: !item.important })"
              @cambiar-estado="(v) => guardarCambio(item.id, { estado: v })"
              @editar="abrirEdicion(item.id)"
            />
          </q-intersection>
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
import { casoAFila } from '../utils/filasVista.js'
import {
  OPCIONES_POR_PAGINA,
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

const hoy = hoyLocal()

const paginacion = computed(() =>
  paginar(filtrarCasos(cases.casos, filtros.value, hoy), pagina.value, porPagina.value),
)

const filas = computed(() =>
  paginacion.value.elementos.map((caso) => ({ ...casoAFila(caso), vencido: esCasoVencido(caso, hoy) })),
)

const screenStateName = computed(() =>
  screenState({
    loading: cases.cargando,
    error: cases.error || errorCambio.value,
    rows: cases.casos,
  }),
)

const dialogoRegistroAbierto = ref(false)
const casoEnEdicion = ref(null)
const errorCambio = ref(null)
const ultimoCambio = ref(null)

const mensajeError = computed(() => {
  const error = cases.error || errorCambio.value
  return error?.mensaje ?? 'tus casos asignados.'
})

// Guarda un cambio de estado, prioridad o importante; se recuerda para poder reintentarlo si falla.
const guardarCambio = async (caseId, cambios) => {
  if (cases.guardando) return
  errorCambio.value = null
  ultimoCambio.value = { id: caseId, cambios }

  const resultado = await cases.actualizarCaso(caseId, cambios)

  if (resultado.ok) {
    $q.notify({ type: 'positive', message: 'Cambio guardado.' })
    ultimoCambio.value = null
  } else {
    errorCambio.value = resultado.error
    $q.notify({ type: 'negative', message: resultado.error?.mensaje ?? 'Error al guardar el cambio.' })
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

.my-cases-page__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.case-list {
  overflow: hidden;
  border-color: #dbe4ee;
  border-radius: 10px;
  background: #ffffff;
}

/* Alto mínimo de la fila mientras aún no aparece en pantalla (QIntersection). */
.case-list__entrada {
  min-height: 88px;
}

.sin-resultados {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px dashed #c9d4e0;
  border-radius: 10px;
  background: #ffffff;
}

.sin-resultados__texto {
  margin: 0;
  color: #334e68;
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
  color: #334e68;
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