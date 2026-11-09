<template>
  <q-page class="dashboard-page">
    <div class="dashboard-page__inner">
      <div class="dashboard-page__head">
        <div class="dashboard-page__title-area">
          <h2 class="dashboard-page__title">
            Hola<template v-if="session.nombreVisible">, {{ session.nombreVisible }}</template>
          </h2>
          <!-- El texto de ayuda describe la pestaña abierta -->
          <p v-if="pestana === 'casos'" class="dashboard-page__lead">
            Revisa cuántos casos tienes en cada estado, cuántos ya vencieron y cuántos son de
            prioridad Alta. Haz clic en una tarjeta o en un estado de la leyenda para ver esos casos
            en «Mis casos».
          </p>
          <p v-else class="dashboard-page__lead">
            Revisa el avance de tus auditorías: sus indicadores, en qué fase va cada una y qué vence
            después. Haz clic en una auditoría para abrir su ficha.
          </p>
        </div>
        <!-- El botón lleva a la pantalla de trabajo de la pestaña abierta -->
        <q-btn
          v-if="pestana === 'casos'"
          class="dashboard-page__ir-btn control-touch"
          color="primary"
          no-caps
          unelevated
          icon="list_alt"
          label="Ver mis casos"
          :to="{ name: 'contador-casos' }"
        >
          <q-tooltip
            >Abre la lista de tus casos para registrarlos, revisarlos y editarlos.</q-tooltip
          >
        </q-btn>
        <q-btn
          v-else
          class="dashboard-page__ir-btn control-touch"
          color="primary"
          no-caps
          unelevated
          icon="fact_check"
          label="Ver mis auditorías"
          :to="{ name: 'auditorias' }"
        >
          <q-tooltip
            >Abre la lista de tus auditorías para registrarlas y darles seguimiento.</q-tooltip
          >
        </q-btn>
      </div>

      <q-tabs
        v-model="pestana"
        no-caps
        inline-label
        align="left"
        active-color="primary"
        indicator-color="primary"
        class="dashboard-page__tabs"
      >
        <q-tab name="casos" icon="assignment" label="Casos">
          <q-tooltip>Resumen de tus casos por estado.</q-tooltip>
        </q-tab>
        <q-tab name="auditorias" icon="fact_check" label="Auditorías">
          <q-tooltip>Indicadores y avance por fase de tus auditorías.</q-tooltip>
        </q-tab>
      </q-tabs>

      <q-tab-panels
        v-model="pestana"
        keep-alive
        animated
        transition-prev="fade"
        transition-next="fade"
        :transition-duration="150"
        class="dashboard-page__paneles"
      >
        <q-tab-panel name="casos" class="dashboard-page__panel">
          <ResumenEquipo
            propios
            seleccionable
            :resumen="resumen"
            :cargando="cases.cargando"
            :error="cases.error"
            @reintentar="cases.cargarCasos()"
            @seleccionar="abrirMisCasos"
          />

          <!-- Reserva el lugar de la agenda mientras carga: la página no salta al aparecer. -->
          <q-skeleton v-if="cases.cargando" type="rect" height="180px" class="dashboard-page__esqueleto" />
          <AgendaCasos
            v-else-if="!cases.error"
            :casos="agenda"
            :total-abiertos="resumen.abiertos"
            :hoy="hoy"
            :cambiando="casoCambiando"
            @editar="abrirEdicion"
            @cambiar-estado="cambiarEstado"
          />
        </q-tab-panel>

        <q-tab-panel name="auditorias" class="dashboard-page__panel">
          <TableroAuditorias propias />
        </q-tab-panel>
      </q-tab-panels>

      <!-- El mismo formulario «Editar» de «Mis casos»: guarda en el store y todo se actualiza solo -->
      <CaseFormDialog
        v-model="dialogoEdicionAbierto"
        :caso="casoEnEdicion"
        @guardado="$q.notify({ type: 'positive', message: 'Cambio guardado.' })"
      />
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AgendaCasos from '../components/AgendaCasos.vue'
import CaseFormDialog from '../components/CaseFormDialog.vue'
import ResumenEquipo from '../components/ResumenEquipo.vue'
import TableroAuditorias from '../components/TableroAuditorias.vue'
import { eventos } from '../services/eventosService.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'
import { STATUS_LABELS } from '../utils/constants.js'
import { agendaCasos, hoyLocal } from '../utils/filtrosCasos.js'
import { resumenMisCasos } from '../utils/resumenMisCasos.js'

/*
 * «Mi resumen» del contador: las mismas gráficas del dashboard del administrador, pero solo
 * con sus casos y sus auditorías, más la agenda de lo que vence pronto (que se edita aquí
 * mismo o se le cambia el estado con un botón). Las cifras de casos salen de la misma lista de «Mis casos».
 */

const $q = useQuasar()
const cases = useCasesStore()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

// Pestaña en la URL (?tab=auditorias): al volver de una ficha se regresa a la misma pestaña.
const PESTANAS = ['casos', 'auditorias']
const pestana = computed({
  get: () => (PESTANAS.includes(route.query.tab) ? route.query.tab : 'casos'),
  set: (valor) => router.replace({ query: { ...route.query, tab: valor } }),
})

// «Hoy» se recalcula al volver a la ventana: si la app queda abierta de un día para otro,
// los vencidos, los próximos a vencer y la agenda se actualizan.
const hoy = ref(hoyLocal())
const actualizarHoy = () => {
  if (document.visibilityState === 'visible') hoy.value = hoyLocal()
}

const resumen = computed(() => resumenMisCasos(cases.casos, hoy.value))
const agenda = computed(() => agendaCasos(cases.casos, hoy.value))

const dialogoEdicionAbierto = ref(false)
const casoEnEdicion = ref(null)

/** Abre el formulario «Editar» con el caso tal como lo guarda el store. */
const abrirEdicion = (casoId) => {
  casoEnEdicion.value = cases.casos.find((caso) => String(caso.id) === String(casoId)) ?? null
  dialogoEdicionAbierto.value = casoEnEdicion.value !== null
}

const casoCambiando = ref(null)

/**
 * Botón de la agenda: guarda el estado siguiente y avisa; si falla, muestra el motivo del servidor.
 * @param {number|string} casoId
 * @param {string} estado - código interno del estado nuevo.
 */
const cambiarEstado = async (casoId, estado) => {
  const cliente = cases.casos.find((caso) => String(caso.id) === String(casoId))?.cliente ?? 'este cliente'
  casoCambiando.value = casoId
  const resultado = await cases.actualizarCaso(casoId, { estado })
  casoCambiando.value = null

  if (resultado.ok) {
    $q.notify({
      type: 'positive',
      message: `Caso de ${cliente} ahora está ${STATUS_LABELS[estado]}.`,
      // Finalizar se hace con un clic: se puede deshacer (desde la agenda solo se finaliza lo que estaba En proceso).
      actions:
        estado === 'finalizado'
          ? [{ label: 'Deshacer', color: 'white', noCaps: true, handler: () => cambiarEstado(casoId, 'en_proceso') }]
          : [],
    })
  } else if (!resultado.descartado) {
    $q.notify({ type: 'negative', message: resultado.error?.mensaje ?? 'Error al guardar el cambio.' })
  }
}

/**
 * Abre «Mis casos» con el filtro de la tarjeta o del estado de la dona que se tocó.
 * @param {string} filtro - clave de la tarjeta (`vencidos`, `abiertos`, `alta_abiertos`) o del estado.
 */
const abrirMisCasos = (filtro) => router.push({ name: 'contador-casos', query: { filtro } })

// Tiempo real: si el administrador asigna un caso o cambia una prioridad, las cifras se actualizan solas.
const dejarDeEscuchar = [
  eventos.escuchar('aviso-nuevo', () => cases.refrescarEnSilencio()),
  eventos.escuchar('reconectado', () => cases.refrescarEnSilencio()),
]
onBeforeUnmount(() => dejarDeEscuchar.forEach((dejar) => dejar()))

onMounted(() => {
  cases.cargarCasos()
  document.addEventListener('visibilitychange', actualizarHoy)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', actualizarHoy))
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 20px;
  margin-bottom: 20px;
}

.dashboard-page__title-area {
  flex: 1 1 300px;
  min-width: 0;
}

.dashboard-page__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: clamp(1.35rem, 3.5vw, 1.8rem);
  font-weight: 700;
  line-height: 1.25;
}

.dashboard-page__lead {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.95rem;
  line-height: 1.5;
}

.dashboard-page__tabs {
  margin-bottom: 4px;
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto-secundario);
}

.dashboard-page__paneles {
  background: transparent;
}

.dashboard-page__panel {
  padding: 12px 0 0;
}

.dashboard-page__esqueleto {
  border-radius: 12px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-07). */
.dashboard-page__ir-btn:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/* Misma columna centrada que el dashboard del administrador entre 600 y 1023 px. */
@media (min-width: 600px) and (max-width: 1023px) {
  .dashboard-page__inner {
    max-width: 720px;
    margin: 0 auto;
  }
}

@media (min-width: 1024px) {
  .dashboard-page {
    padding: 20px 24px;
  }
}
</style>
