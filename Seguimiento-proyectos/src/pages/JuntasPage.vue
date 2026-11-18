<template>
  <q-page class="juntas-page">
    <div class="juntas-page__head">
      <p class="juntas-page__lead">
        Consulta tus juntas por mes, semana o día. Pulsa un hueco libre del calendario para crear
        una junta, o una junta para ver sus datos.
      </p>
      <q-btn
        class="juntas-page__nueva control-touch boton-presionable"
        color="primary"
        no-caps
        unelevated
        icon="add_circle"
        label="Nueva junta"
        aria-haspopup="dialog"
        @click="abrirNueva()"
      >
        <q-tooltip
          >Abre el formulario para crear una junta e invitar a personas del equipo.</q-tooltip
        >
      </q-btn>
    </div>

    <div class="juntas-page__barra">
      <q-btn-toggle
        :model-value="vista"
        :options="OPCIONES_DE_VISTA"
        no-caps
        unelevated
        toggle-color="primary"
        color="dg-superficie"
        text-color="primary"
        class="juntas-page__vistas"
        aria-label="Elegir cómo ver el calendario"
        @update:model-value="cambiarVista"
      />

      <div class="juntas-page__navegacion" role="group" aria-label="Moverse por el calendario">
        <q-btn
          outline
          no-caps
          color="primary"
          icon="chevron_left"
          label="Anterior"
          padding="4px 10px"
          class="control-touch boton-presionable"
          @click="moverA(-1)"
        >
          <q-tooltip>Va al periodo anterior.</q-tooltip>
        </q-btn>
        <q-btn
          outline
          no-caps
          color="primary"
          :icon="$q.screen.gt.xs ? 'today' : undefined"
          label="Hoy"
          padding="4px 12px"
          class="control-touch boton-presionable"
          @click="irAHoy"
        >
          <q-tooltip>Vuelve al día de hoy.</q-tooltip>
        </q-btn>
        <q-btn
          outline
          no-caps
          color="primary"
          icon-right="chevron_right"
          label="Siguiente"
          padding="4px 10px"
          class="control-touch boton-presionable"
          @click="moverA(1)"
        >
          <q-tooltip>Va al periodo siguiente.</q-tooltip>
        </q-btn>
      </div>

      <h2 class="juntas-page__periodo" aria-live="polite">{{ periodo }}</h2>
    </div>

    <ScreenLoader v-if="cargando" text="Cargando tus juntas…" />

    <ErrorState v-else-if="errorCarga" :detail="errorCarga" @retry="cargar()" />

    <template v-else>
      <q-banner v-if="juntas.length === 0" dense rounded class="juntas-page__vacio" role="status">
        <template #avatar>
          <q-icon name="event_available" color="dg-acento" />
        </template>
        No tienes juntas en este periodo.
      </q-banner>

      <CalendarioJuntas
        :vista="vista"
        :fecha="fecha"
        :juntas="juntas"
        :usuario-id="session.id"
        @abrir-junta="abrirDetalle"
        @nueva-junta="abrirNueva"
      />
    </template>

    <JuntaDetalleDialog
      v-if="juntaSeleccionada"
      v-model="detalleAbierto"
      :junta="juntaSeleccionada"
      @editar="abrirEdicion"
      @borrada="alBorrar"
      @respondida="alResponder"
    />

    <JuntaFormDialog
      v-model="formularioAbierto"
      :junta="juntaEnEdicion"
      :fecha-inicial="precarga.fecha"
      :hora-inicial="precarga.hora"
      @guardada="alGuardar"
    />
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

import CalendarioJuntas from '../components/CalendarioJuntas.vue'
import ErrorState from '../components/ErrorState.vue'
import JuntaDetalleDialog from '../components/JuntaDetalleDialog.vue'
import JuntaFormDialog from '../components/JuntaFormDialog.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listar, obtener } from '../services/juntaService.js'
import { useSessionStore } from '../stores/session.js'
import {
  hoyISO,
  leerVistaDeUrl,
  moverPeriodo,
  rangoVisible,
  textoPeriodo,
} from '../utils/juntas.js'

/*
 * Calendario de juntas del equipo. La vista y la fecha viajan en la URL
 * (`?vista=semana&fecha=2026-11-18`) para recargar sin perderlas. Cada cambio de periodo pide
 * `GET /juntas` con el rango visible; al volver a la pestaña se recarga en silencio.
 * Con `?juntaId=` (enlace de un aviso de la campana) abre la ficha de esa junta.
 */
const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const OPCIONES_DE_VISTA = [
  { label: 'Mes', value: 'mes' },
  { label: 'Semana', value: 'semana' },
  { label: 'Día', value: 'dia' },
]

// «Hoy» se recalcula al volver a la pestaña: una pantalla abierta de un día para otro no se queda atrás.
const hoy = ref(hoyISO())
// La vista inicial depende del ancho solo al entrar; después manda la URL.
const anchoAlEntrar = $q.screen.width

const estado = computed(() => leerVistaDeUrl(route.query, anchoAlEntrar, hoy.value))
const vista = computed(() => estado.value.vista)
const fecha = computed(() => estado.value.fecha)
const periodo = computed(() => textoPeriodo(vista.value, fecha.value))
const rango = computed(() => rangoVisible(vista.value, fecha.value))

const irA = (nuevaVista, nuevaFecha) =>
  router.replace({ query: { ...route.query, vista: nuevaVista, fecha: nuevaFecha } })

const cambiarVista = (nuevaVista) => irA(nuevaVista, fecha.value)
const moverA = (direccion) => irA(vista.value, moverPeriodo(vista.value, fecha.value, direccion))
const irAHoy = () => {
  hoy.value = hoyISO()
  irA(vista.value, hoy.value)
}

// --- datos ----------------------------------------------------------------------------------------

const juntas = ref([])
const cargando = ref(true)
const errorCarga = ref('')
// Solo vale la última petición: una respuesta lenta de un periodo anterior se descarta.
let peticionActual = 0

const MENSAJE_DE_CARGA =
  'Qué ocurrió: No se pudieron cargar tus juntas. Sobre: tus juntas. Qué hacer: Pulsa «Reintentar»; si el error continúa, revisa tu conexión.'

/**
 * Carga las juntas del periodo visible. En silencio (al volver a la pestaña) no muestra el
 * indicador de carga y, si falla, conserva lo que ya se veía sin presentarlo como error de un guardado.
 */
const cargar = async ({ silencioso = false } = {}) => {
  const numero = ++peticionActual
  if (!silencioso) {
    cargando.value = true
    errorCarga.value = ''
  }
  try {
    const lista = await listar(rango.value)
    if (numero !== peticionActual) return
    juntas.value = lista
    errorCarga.value = ''
  } catch (error) {
    if (numero !== peticionActual || silencioso) return
    errorCarga.value = error?.mensaje ?? MENSAJE_DE_CARGA
  } finally {
    if (numero === peticionActual) cargando.value = false
  }
}

watch(
  () => `${rango.value.desde}|${rango.value.hasta}`,
  () => cargar(),
)

const alVolverALaPestana = () => {
  if (document.visibilityState !== 'visible') return
  hoy.value = hoyISO()
  cargar({ silencioso: true })
}

onMounted(() => {
  // Sin vista y fecha en la URL se escriben, para que recargar la página conserve lo que se ve.
  if (route.query.vista !== vista.value || route.query.fecha !== fecha.value) {
    irA(vista.value, fecha.value)
  }
  cargar()
  abrirJuntaDeLaUrl()
  document.addEventListener('visibilitychange', alVolverALaPestana)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolverALaPestana))

// --- diálogos -------------------------------------------------------------------------------------

const juntaSeleccionada = ref(null)
const detalleAbierto = ref(false)
const formularioAbierto = ref(false)
const juntaEnEdicion = ref(null)
const precarga = ref({ fecha: '', hora: '' })

const abrirDetalle = (junta) => {
  juntaSeleccionada.value = junta
  detalleAbierto.value = true
}

// «Nueva junta» sin hueco elegido arranca en el día que se ve, a las 9:00.
const abrirNueva = (hueco = null) => {
  juntaEnEdicion.value = null
  precarga.value = hueco ?? { fecha: fecha.value, hora: '09:00' }
  formularioAbierto.value = true
}

const abrirEdicion = (junta) => {
  detalleAbierto.value = false
  juntaEnEdicion.value = junta
  precarga.value = { fecha: '', hora: '' }
  formularioAbierto.value = true
}

const alGuardar = () => {
  $q.notify({ type: 'positive', message: 'Junta guardada.' })
  cargar({ silencioso: true })
}

const alBorrar = () => {
  $q.notify({ type: 'positive', message: 'Junta borrada.' })
  cargar({ silencioso: true })
}

// La ficha abierta pasa a la versión nueva (con tu respuesta y el estado) y el calendario se recarga.
const alResponder = (junta) => {
  juntaSeleccionada.value = junta
  $q.notify({ type: 'positive', message: 'Respuesta guardada.' })
  cargar({ silencioso: true })
}

// --- enlace de un aviso ---------------------------------------------------------------------------

/**
 * Abre la ficha de la junta de `?juntaId=` aunque caiga fuera del periodo visible, y quita el
 * parámetro de la URL para que recargar o volver a tocar el mismo aviso funcione de nuevo.
 */
const abrirJuntaDeLaUrl = async () => {
  const juntaId = route.query.juntaId
  if (juntaId === undefined) return
  const resto = { ...route.query }
  delete resto.juntaId
  router.replace({ query: { ...resto, vista: vista.value, fecha: fecha.value } })
  try {
    abrirDetalle(await obtener(String(juntaId)))
  } catch {
    $q.notify({ type: 'warning', message: 'Esa junta ya no está disponible.' })
  }
}

watch(
  () => route.query.juntaId,
  (juntaId) => {
    if (juntaId !== undefined) abrirJuntaDeLaUrl()
  },
)
</script>

<style scoped>
.juntas-page {
  padding: 16px;
}

.juntas-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.juntas-page__lead {
  flex: 1 1 260px;
  min-width: 0;
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

.juntas-page__nueva {
  min-width: 44px;
  min-height: 44px;
}

.juntas-page__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 12px;
}

.juntas-page__vistas {
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 6px;
}

.juntas-page__vistas :deep(.q-btn) {
  min-height: 44px;
  min-width: 44px;
}

.juntas-page__navegacion {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.juntas-page__periodo {
  flex: 1 1 220px;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.juntas-page__vacio {
  margin-bottom: 12px;
  border: 1px solid var(--dg-info-borde);
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}
</style>
