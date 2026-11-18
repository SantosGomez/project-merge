<template>
  <q-page class="juntas-page">
    <div class="juntas-page__head">
      <p class="juntas-page__lead">
        Consulta tus juntas por año, mes, semana o día. Pulsa un hueco libre del calendario para
        crear una junta, o una junta para ver sus datos.
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

    <div class="juntas-page__agenda">
      <q-select
        :model-value="agendaId"
        :options="opcionesDeAgenda"
        emit-value
        map-options
        outlined
        dense
        options-dense
        label="Ver agenda de"
        dropdown-icon="expand_more"
        popup-content-class="menu-seleccion-custom"
        transition-show="jump-down"
        transition-hide="jump-up"
        :transition-duration="180"
        class="selector-moderno juntas-page__selector"
        :loading="cargandoPersonas"
        @update:model-value="cambiarAgenda"
      >
        <template #prepend>
          <q-icon name="event_note" />
        </template>
        <q-tooltip>
          Elige a otra persona para ver cuándo está ocupada y agendar una junta con ella.
        </q-tooltip>
      </q-select>
      <h2 v-if="agendaId" class="juntas-page__agenda-titulo">{{ tituloAgenda }}</h2>
    </div>

    <q-toggle
      v-if="vencimientosDisponibles"
      :model-value="mostrarVencimientos"
      label="Mostrar vencimientos de casos"
      color="primary"
      class="juntas-page__vencimientos control-touch"
      @update:model-value="cambiarMostrarVencimientos"
    >
      <q-tooltip>
        Marca en el calendario el día en que vence cada caso que no está finalizado. Se recuerda
        para tu cuenta en este equipo.
      </q-tooltip>
    </q-toggle>

    <q-banner
      v-if="vencimientosActivos && errorVencimientos"
      dense
      rounded
      class="juntas-page__aviso-vencimientos"
      role="status"
    >
      <template #avatar>
        <q-icon name="event_busy" color="dg-aviso-texto" />
      </template>
      No se pudieron cargar los vencimientos.
      <template #action>
        <q-btn
          flat
          no-caps
          dense
          color="primary"
          label="Reintentar"
          class="control-touch boton-presionable"
          @click="cargarVencimientos()"
        >
          <q-tooltip>Vuelve a pedir los vencimientos de los casos.</q-tooltip>
        </q-btn>
      </template>
    </q-banner>

    <ScreenLoader v-if="cargando" :text="textoCarga" />

    <ErrorState v-else-if="errorCarga" :detail="errorCarga" @retry="cargar()" />

    <template v-else>
      <q-banner v-if="juntas.length === 0" dense rounded class="juntas-page__vacio" role="status">
        <template #avatar>
          <q-icon name="event_available" color="dg-acento" />
        </template>
        {{ textoVacio }}
      </q-banner>

      <AnioJuntas
        v-if="vista === 'anio'"
        :anio="anio"
        :juntas="juntas"
        :hoy="hoy"
        @elegir-dia="elegirDia"
      />

      <CalendarioJuntas
        v-else
        :vista="vista"
        :fecha="fecha"
        :juntas="juntas"
        :usuario-id="session.id"
        :vencimientos="vencimientos"
        :rol="session.rol ?? ''"
        @abrir-junta="abrirDetalle"
        @nueva-junta="abrirNueva"
        @abrir-vencimiento="abrirVencimiento"
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
      :invitado-inicial="agendaId ? usuarioAgenda : null"
      @guardada="alGuardar"
    />
  </q-page>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

import AnioJuntas from '../components/AnioJuntas.vue'
import CalendarioJuntas from '../components/CalendarioJuntas.vue'
import ErrorState from '../components/ErrorState.vue'
import JuntaDetalleDialog from '../components/JuntaDetalleDialog.vue'
import JuntaFormDialog from '../components/JuntaFormDialog.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { getMisCasos } from '../services/caseService.js'
import { getCasosImportantesCalendario } from '../services/counterService.js'
import { agendaDe, listar, obtener, participantesDisponibles } from '../services/juntaService.js'
import { useSessionStore } from '../stores/session.js'
import { formatearRol } from '../utils/formateadores.js'
import {
  esJuntaOcupada,
  hoyISO,
  leerAgendaDeUrl,
  leerVistaDeUrl,
  moverPeriodo,
  rangoVisible,
  textoPeriodo,
} from '../utils/juntas.js'
import {
  destinoDeVencimiento,
  guardarMostrarVencimientos,
  leerMostrarVencimientos,
  puedeVerVencimientos,
  vencimientosDeCasos,
} from '../utils/vencimientosEnCalendario.js'

/*
 * Calendario de juntas del equipo. La vista y la fecha viajan en la URL
 * (`?vista=semana&fecha=2026-11-18`) para recargar sin perderlas. Cada cambio de periodo pide
 * `GET /juntas` con el rango visible; al volver a la pestaña se recarga en silencio.
 * Con `?juntaId=` (enlace de un aviso de la campana) abre la ficha de esa junta.
 * Con `?agenda=ID` se ve la agenda de otra persona (`GET /juntas/agenda/:id`): las juntas donde participas
 * salen completas y las demás como «Ocupado», sin ficha. Desde esa agenda, «Nueva junta» y los huecos
 * abren el formulario con esa persona ya invitada.
 * En `?vista=anio` se ven los 12 meses con la cantidad de juntas de cada día; un clic en un día abre la
 * vista Día. En mes, semana y día, el administrador, el contador y el auxiliar ven además el vencimiento
 * de sus casos (no los finalizados) con el interruptor «Mostrar vencimientos de casos»; en la agenda de
 * otra persona no se muestran. Si esa carga falla, las juntas se siguen viendo con un aviso para reintentar.
 */
const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const OPCIONES_DE_VISTA = [
  { label: 'Año', value: 'anio' },
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
const anio = computed(() => Number(fecha.value.slice(0, 4)))

// Persona de `?agenda=` (id como texto) o null si se ve la propia agenda.
const agendaId = computed(() => leerAgendaDeUrl(route.query, session.id))

const irA = (nuevaVista, nuevaFecha) =>
  router.replace({ query: { ...route.query, vista: nuevaVista, fecha: nuevaFecha } })

const cambiarVista = (nuevaVista) => irA(nuevaVista, fecha.value)
const moverA = (direccion) => irA(vista.value, moverPeriodo(vista.value, fecha.value, direccion))
const irAHoy = () => {
  hoy.value = hoyISO()
  irA(vista.value, hoy.value)
}

// En la vista de año, un clic en un día abre la vista Día de esa fecha.
const elegirDia = (dia) => irA('dia', dia)

// --- agenda de otra persona --------------------------------------------------------------------------

const personas = ref([])
const cargandoPersonas = ref(false)
// Persona cuya agenda se ve, tal como la devolvió la API ({ id, nombre, rol }); null en la propia.
const usuarioAgenda = ref(null)

const opcionesDeAgenda = computed(() => [
  { label: 'Mi agenda', value: null },
  ...personas.value.map((p) => ({
    label: `${p.nombre} (${formatearRol(p.rol)})`,
    value: String(p.id),
  })),
])

const nombreDeLaAgenda = computed(
  () =>
    usuarioAgenda.value?.nombre ??
    personas.value.find((p) => String(p.id) === agendaId.value)?.nombre ??
    'la persona elegida',
)
const tituloAgenda = computed(() => `Agenda de ${nombreDeLaAgenda.value}`)
const textoCarga = computed(() =>
  agendaId.value ? `Cargando la agenda de ${nombreDeLaAgenda.value}…` : 'Cargando tus juntas…',
)
const textoVacio = computed(() =>
  agendaId.value
    ? `${nombreDeLaAgenda.value} no tiene juntas en este periodo.`
    : 'No tienes juntas en este periodo.',
)

const cambiarAgenda = (id) => {
  const query = { ...route.query }
  if (id) query.agenda = id
  else delete query.agenda
  router.replace({ query })
}

const cargarPersonas = async () => {
  cargandoPersonas.value = true
  try {
    personas.value = await participantesDisponibles()
  } catch {
    personas.value = []
  } finally {
    cargandoPersonas.value = false
  }
}

// --- datos ----------------------------------------------------------------------------------------

const juntas = ref([])
const cargando = ref(true)
const errorCarga = ref('')
// Solo vale la última petición: una respuesta lenta de un periodo anterior se descarta.
let peticionActual = 0

const MENSAJE_DE_CARGA =
  'Qué ocurrió: No se pudieron cargar las juntas. Sobre: el calendario de juntas. Qué hacer: Pulsa «Reintentar»; si el error continúa, revisa tu conexión.'

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
    const pedida = agendaId.value
    const respuesta = pedida ? await agendaDe(pedida, rango.value) : null
    const lista = respuesta ? respuesta.juntas : await listar(rango.value)
    if (numero !== peticionActual) return
    juntas.value = lista
    usuarioAgenda.value = respuesta ? respuesta.usuario : null
    errorCarga.value = ''
  } catch (error) {
    if (numero !== peticionActual || silencioso) return
    errorCarga.value = error?.mensaje ?? MENSAJE_DE_CARGA
  } finally {
    if (numero === peticionActual) cargando.value = false
  }
}

watch(
  () => `${rango.value.desde}|${rango.value.hasta}|${agendaId.value}`,
  () => cargar(),
)

// --- vencimientos de casos --------------------------------------------------------------------------

const mostrarVencimientos = ref(leerMostrarVencimientos(session.id))
const casosParaVencimientos = ref([])
const vencimientosCargados = ref(false)
const errorVencimientos = ref(false)
let peticionDeVencimientos = 0

// El interruptor existe para quien ve vencimientos, fuera de la agenda de otra persona y de la vista de año.
const vencimientosDisponibles = computed(
  () => puedeVerVencimientos(session.rol) && !agendaId.value && vista.value !== 'anio',
)
const vencimientosActivos = computed(
  () => vencimientosDisponibles.value && mostrarVencimientos.value,
)

const vencimientos = computed(() =>
  vencimientosActivos.value ? vencimientosDeCasos(casosParaVencimientos.value) : [],
)

/**
 * Pide los casos de los que salen los vencimientos: los importantes de todos si eres administrador, los
 * tuyos (con los de tus auxiliares) si eres contador o auxiliar. En silencio conserva lo que ya se veía.
 */
const cargarVencimientos = async ({ silencioso = false } = {}) => {
  const numero = ++peticionDeVencimientos
  if (!silencioso) errorVencimientos.value = false
  try {
    const casos =
      session.rol === 'administrador' ? await getCasosImportantesCalendario() : await getMisCasos()
    if (numero !== peticionDeVencimientos) return
    casosParaVencimientos.value = casos
    vencimientosCargados.value = true
    errorVencimientos.value = false
  } catch {
    if (numero !== peticionDeVencimientos || silencioso) return
    errorVencimientos.value = true
  }
}

const cambiarMostrarVencimientos = (mostrar) => {
  mostrarVencimientos.value = mostrar
  guardarMostrarVencimientos(session.id, mostrar)
}

// Al activarse por primera vez se piden; después solo se recargan al volver a la pestaña.
watch(vencimientosActivos, (activos) => {
  if (activos && !vencimientosCargados.value) cargarVencimientos()
})

const abrirVencimiento = (vencimiento) => {
  const destino = destinoDeVencimiento(vencimiento, session.rol)
  if (destino) router.push(destino)
}

const alVolverALaPestana = () => {
  if (document.visibilityState !== 'visible') return
  hoy.value = hoyISO()
  cargar({ silencioso: true })
  if (vencimientosActivos.value) cargarVencimientos({ silencioso: true })
}

onMounted(() => {
  // Sin vista y fecha en la URL se escriben, para que recargar la página conserve lo que se ve.
  if (route.query.vista !== vista.value || route.query.fecha !== fecha.value) {
    irA(vista.value, fecha.value)
  }
  cargar()
  if (vencimientosActivos.value) cargarVencimientos()
  cargarPersonas()
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

// Los bloques ajenos de la agenda de otra persona no tienen ficha.
const abrirDetalle = (junta) => {
  if (esJuntaOcupada(junta)) return
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

.juntas-page__agenda {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.juntas-page__selector {
  flex: 0 1 320px;
  min-width: min(100%, 240px);
}

.juntas-page__agenda-titulo {
  flex: 1 1 220px;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
}

.juntas-page__periodo {
  flex: 1 1 220px;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.juntas-page__vencimientos {
  margin-bottom: 8px;
}

.juntas-page__aviso-vencimientos {
  margin-bottom: 12px;
  border: 1px solid var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.juntas-page__vacio {
  margin-bottom: 12px;
  border: 1px solid var(--dg-info-borde);
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}
</style>
