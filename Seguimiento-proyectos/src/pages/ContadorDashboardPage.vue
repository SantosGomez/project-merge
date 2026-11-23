<template>
  <q-page class="dashboard-page">
    <div class="dashboard-page__inner">
      <div v-aparecer="{ orden: 0 }" class="dashboard-page__head">
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
          <p v-else-if="pestana === 'equipo'" class="dashboard-page__lead">
            Revisa cómo van los casos de tus auxiliares: cuántos tiene cada uno en cada estado y
            cuáles ya vencieron. Elige un auxiliar para ver y trabajar sus casos.
          </p>
          <p v-else class="dashboard-page__lead">
            Revisa el avance de tus auditorías: sus indicadores, en qué fase va cada una y qué vence
            después. Haz clic en una auditoría para abrir su ficha.
          </p>
        </div>
        <!-- El botón lleva a la pantalla de trabajo de la pestaña abierta -->
        <q-btn
          v-if="pestana === 'casos'"
          class="dashboard-page__ir-btn control-touch boton-presionable"
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
          v-else-if="pestana === 'equipo'"
          class="dashboard-page__ir-btn control-touch boton-presionable"
          color="primary"
          no-caps
          unelevated
          icon="group"
          label="Ver mis auxiliares"
          :to="{ name: 'mi-perfil' }"
        >
          <q-tooltip>Abre «Mi perfil», donde agregas o quitas a los auxiliares que te apoyan.</q-tooltip>
        </q-btn>
        <q-btn
          v-else
          class="dashboard-page__ir-btn control-touch boton-presionable"
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
        v-aparecer="{ orden: 1 }"
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
        <q-tab v-if="tieneEquipo" name="equipo" icon="groups" label="Mi equipo">
          <q-tooltip>Casos de tus auxiliares: cifras del equipo y detalle por auxiliar.</q-tooltip>
        </q-tab>
        <q-tab v-if="session.esContador" name="auditorias" icon="fact_check" label="Auditorías">
          <q-tooltip>Indicadores y avance por fase de tus auditorías.</q-tooltip>
        </q-tab>
      </q-tabs>

      <q-tab-panels
        v-model="pestana"
        v-aparecer="{ orden: 2 }"
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

        <q-tab-panel v-if="tieneEquipo" name="equipo" class="dashboard-page__panel">
          <MiEquipo
            :equipo="equipo.equipo"
            :filas="equipo.filas"
            :hoy="hoy"
            :cargando="cases.cargando"
            :error="cases.error"
            :guardando-id="casoCambiando"
            @reintentar="cases.cargarCasos()"
            @alternar-importante="(casoId, importante) => guardarCambio(casoId, { importante })"
            @cambiar-estado="(casoId, estado) => guardarCambio(casoId, { estado })"
            @editar="abrirEdicion"
            @ver="abrirDetalle"
          />
        </q-tab-panel>

        <q-tab-panel v-if="session.esContador" name="auditorias" class="dashboard-page__panel">
          <TableroAuditorias propias />
        </q-tab-panel>
      </q-tab-panels>

      <!-- El mismo formulario «Editar» de «Mis casos»: guarda en el store y todo se actualiza solo -->
      <CaseFormDialog
        v-model="dialogoEdicionAbierto"
        :caso="casoEnEdicion"
        @guardado="$q.notify({ type: 'positive', message: 'Cambios guardados.' })"
      />
      <!-- La misma ficha «Ver» de «Mis casos», para los casos del equipo -->
      <CasoDetalleDialog v-if="casoEnDetalle" v-model="detalleAbierto" :caso="casoEnDetalle" />
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AgendaCasos from '../components/AgendaCasos.vue'
import CaseFormDialog from '../components/CaseFormDialog.vue'
import CasoDetalleDialog from '../components/CasoDetalleDialog.vue'
import MiEquipo from '../components/MiEquipo.vue'
import ResumenEquipo from '../components/ResumenEquipo.vue'
import TableroAuditorias from '../components/TableroAuditorias.vue'
import { eventos } from '../services/eventosService.js'
import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useCasesStore } from '../stores/cases.js'
import { useSessionStore } from '../stores/session.js'
import { STATUS_LABELS } from '../utils/constants.js'
import { agendaCasos, hoyLocal } from '../utils/filtrosCasos.js'
import { vAparecer } from '../utils/aparecer.js'
import { resumenDeAuxiliares, resumenMisCasos } from '../utils/resumenMisCasos.js'

/*
 * «Mi resumen» del contador: las mismas gráficas del dashboard del administrador, pero solo
 * con sus casos y sus auditorías, más la agenda de lo que vence pronto (que se edita aquí
 * mismo o se le cambia el estado con un botón). Las cifras de casos salen de la misma lista de «Mis casos».
 */

const $q = useQuasar()
const cases = useCasesStore()
const auxiliares = useAuxiliaresStore()
const session = useSessionStore()
const route = useRoute()
const router = useRouter()

// Pestaña en la URL (?tab=auditorias): al volver de una ficha se regresa a la misma pestaña.
// El auxiliar no tiene auditorías: solo ve la pestaña de casos.
// «Mi equipo» solo existe para el contador que tiene al menos un auxiliar.
const tieneEquipo = computed(() => session.esContador && auxiliares.total > 0)
const pestanas = computed(() => [
  'casos',
  ...(tieneEquipo.value ? ['equipo'] : []),
  ...(session.esContador ? ['auditorias'] : []),
])
const pestana = computed({
  get: () => (pestanas.value.includes(route.query.tab) ? route.query.tab : 'casos'),
  set: (valor) => router.replace({ query: { ...route.query, tab: valor } }),
})

// «Hoy» se recalcula al volver a la ventana: si la app queda abierta de un día para otro,
// los vencidos, los próximos a vencer y la agenda se actualizan.
const hoy = ref(hoyLocal())
const actualizarHoy = () => {
  if (document.visibilityState !== 'visible') return
  hoy.value = hoyLocal()
  // Además se relee la lista: un cambio hecho mientras la ventana estaba oculta puede no haber llegado.
  cases.refrescarEnSilencio()
}

const resumen = computed(() => resumenMisCasos(cases.casos, hoy.value))
const agenda = computed(() => agendaCasos(cases.casos, hoy.value))
// Cifras de «Mi equipo»: salen de la misma lista de casos, que ya trae los de los auxiliares.
const equipo = computed(() => resumenDeAuxiliares(cases.casos, auxiliares.auxiliares, hoy.value))

const dialogoEdicionAbierto = ref(false)
const casoEnEdicion = ref(null)

/** Abre el formulario «Editar» con el caso tal como lo guarda el store. */
const abrirEdicion = (casoId) => {
  casoEnEdicion.value = cases.casos.find((caso) => String(caso.id) === String(casoId)) ?? null
  dialogoEdicionAbierto.value = casoEnEdicion.value !== null
}

// Ficha «Ver» de un caso del equipo; si el caso cambia con la ficha abierta, recibe la versión nueva.
const detalleAbierto = ref(false)
const casoEnDetalle = ref(null)
const abrirDetalle = (casoId) => {
  casoEnDetalle.value = cases.casos.find((caso) => String(caso.id) === String(casoId)) ?? null
  detalleAbierto.value = casoEnDetalle.value !== null
}
watch(
  () => cases.casos.find((caso) => String(caso.id) === String(casoEnDetalle.value?.id)),
  (nuevo) => {
    if (detalleAbierto.value && nuevo) casoEnDetalle.value = nuevo
  },
)

const casoCambiando = ref(null)

/**
 * Guarda un cambio hecho desde «Mi equipo» (estado o marca de importante) y avisa del resultado.
 * @param {number|string} casoId
 * @param {{ estado?: string, importante?: boolean }} cambios
 */
const guardarCambio = async (casoId, cambios) => {
  if (casoCambiando.value !== null) return
  const cliente = cases.casos.find((caso) => String(caso.id) === String(casoId))?.cliente ?? 'este cliente'
  casoCambiando.value = casoId
  const resultado = await cases.actualizarCaso(casoId, cambios)
  casoCambiando.value = null

  if (resultado.ok) {
    const mensaje =
      cambios.estado !== undefined
        ? `Caso de ${cliente} ahora está ${STATUS_LABELS[cambios.estado]}.`
        : cambios.importante
          ? `Caso de ${cliente} marcado como importante: el administrador ya puede verlo.`
          : `Caso de ${cliente} ya no está marcado como importante.`
    $q.notify({ type: 'positive', message: mensaje })
  } else if (!resultado.descartado) {
    $q.notify({
      type: 'negative',
      message: `No se guardó el cambio del caso de ${cliente}.`,
      caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
      actions: [{ label: 'Reintentar', color: 'dg-texto-claro', noCaps: true, handler: () => guardarCambio(casoId, cambios) }],
    })
  }
}

/**
 * Botón de la agenda: guarda el estado siguiente y avisa; si falla, muestra el motivo del servidor.
 * @param {number|string} casoId
 * @param {string} estado - código interno del estado nuevo.
 */
const cambiarEstado = async (casoId, estado) => {
  // Un guardado a la vez: «Deshacer» no se cruza con otro cambio en curso.
  if (casoCambiando.value !== null) return
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
          ? [{ label: 'Deshacer', color: 'dg-texto-claro', noCaps: true, handler: () => cambiarEstado(casoId, 'en_proceso') }]
          : [],
    })
  } else if (!resultado.descartado) {
    $q.notify({
      type: 'negative',
      message: `No se guardó el cambio del caso de ${cliente}.`,
      caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
      actions: [
        { label: 'Reintentar', color: 'dg-texto-claro', noCaps: true, handler: () => cambiarEstado(casoId, estado) },
      ],
    })
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
  // Solo el contador tiene auxiliares; un fallo aquí solo deja sin pestaña «Mi equipo».
  if (session.esContador) auxiliares.cargarAuxiliares(Number(session.id))
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
