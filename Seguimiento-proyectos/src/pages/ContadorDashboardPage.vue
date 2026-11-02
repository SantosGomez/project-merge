<template>
  <q-page class="dashboard-page">
    <div class="dashboard-page__inner">
      <div class="dashboard-page__head">
        <div class="dashboard-page__title-area">
          <h1 class="dashboard-page__title">
            Buen día<template v-if="session.nombreVisible">, {{ session.nombreVisible }}</template>
          </h1>
          <!-- El texto de ayuda describe la pestaña abierta -->
          <p v-if="pestana === 'casos'" class="dashboard-page__lead">
            Revisa de un vistazo cuántos casos tienes en cada estado, cuántos ya vencieron y cuántos
            son de prioridad Alta. Toca una tarjeta o un estado de la gráfica para ver esos casos en
            «Mis casos».
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

      <q-tab-panels v-model="pestana" keep-alive animated class="dashboard-page__paneles">
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
        </q-tab-panel>

        <q-tab-panel name="auditorias" class="dashboard-page__panel">
          <TableroAuditorias propias />
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ResumenEquipo from '../components/ResumenEquipo.vue'
import TableroAuditorias from '../components/TableroAuditorias.vue'
import { eventos } from '../services/eventosService.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'
import { hoyLocal } from '../utils/filtrosCasos.js'
import { resumenMisCasos } from '../utils/resumenMisCasos.js'

/*
 * «Mi resumen» del contador: las mismas gráficas del dashboard del administrador, pero solo
 * con sus casos y sus auditorías. Es de solo consulta; el trabajo se hace en «Mis casos» y
 * en «Auditorías». Las cifras de casos salen de la misma lista de «Mis casos».
 */

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

const resumen = computed(() => resumenMisCasos(cases.casos, hoyLocal()))

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
