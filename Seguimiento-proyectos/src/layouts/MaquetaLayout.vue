<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Primer elemento con foco: con teclado evita cruzar todo el menú en cada pantalla. -->
    <q-btn
      unelevated
      no-caps
      color="primary"
      label="Saltar al contenido"
      class="saltar-contenido"
      :inert="fondoBloqueado"
      @click="saltarAlContenido"
    />

    <q-header
      v-if="$q.screen.lt.md"
      elevated
      class="bg-primary text-dg-texto-claro"
      :inert="fondoBloqueado"
    >
      <div class="layout-bar">
        <div class="layout-bar__row">
          <q-btn
            ref="botonMenu"
            flat
            icon="menu"
            aria-label="Abrir menú de navegación"
            :aria-expanded="drawerOpen ? 'true' : 'false'"
            aria-controls="menu-lateral"
            class="layout-bar__menu control-touch"
            @click="drawerOpen = !drawerOpen"
          />

          <h1 class="layout-bar__title">
            {{ pageTitle }}
            <q-tooltip>{{ pageTitle }}</q-tooltip>
          </h1>

          <CampanaAvisos v-if="session.veCampana" clara />
        </div>
      </div>
    </q-header>

    <q-drawer
      id="menu-lateral"
      v-model="drawerOpen"
      show-if-above
      :breakpoint="1023"
      :width="250"
      :mini="menuCompacto"
      :mini-to-overlay="!menuFijado"
      :mini-width="96"
      @mouseenter="alEntrarCursor"
      @mouseleave="alSalirCursor"
      @focusin="alEntrarFoco"
      @focusout="alSalirFoco"
      @keydown.esc="cerrarMenuMovil"
      class="bg-primary menu-lateral"
      :class="{ 'menu-lateral--al-instante': esEscritorio && !cursorEnMenu && !acompanarMenu }"
    >
      <div class="drawer-marca">
        <!-- Siempre el mismo botón: crearlo o destruirlo al cruzar 1024 px perdía el foco. -->
        <q-btn
          flat
          unelevated
          padding="0"
          :ripple="false"
          type="button"
          class="drawer-marca__logo-boton"
          aria-label="Fijar menú abierto"
          :aria-pressed="menuFijado"
          :aria-disabled="!esEscritorio"
          :tabindex="esEscritorio ? 0 : -1"
          @click="alternarMenuFijado"
        >
          <img
            class="drawer-marca__logo"
            src="logos/PNG/DELGROW_ISOTIPO-OF_T.png"
            alt=""
            width="64"
            height="64"
          />
          <q-tooltip v-if="esEscritorio">{{ textoBotonMenu }}</q-tooltip>
        </q-btn>
        <div class="drawer-marca__textos">
          <p class="drawer-marca__empresa">Grupo DelGrow S.C.</p>
          <p class="drawer-marca__app">Seguimiento de Proyectos</p>
        </div>
      </div>

      <q-scroll-area class="drawer-nav">
        <!-- El menú es la navegación principal: así lo anuncian los lectores de pantalla. -->
        <nav aria-label="Navegación principal">
        <q-list padding>
          <template v-if="session.esAdministrador">
            <q-item-label header>Administración</q-item-label>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'admin-dashboard' }"
              :aria-current="paginaActual('admin-dashboard')"
              aria-label="Ir al resumen del equipo"
            >
              <q-item-section avatar>
                <q-icon name="dashboard" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Resumen del equipo</q-item-label>
                <q-item-label caption>Ver conteos y casos</q-item-label>
              </q-item-section>
            </q-item>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'admin-directorio' }"
              :aria-current="paginaActual('admin-directorio')"
              aria-label="Ir al directorio de usuarios"
            >
              <q-item-section avatar>
                <q-icon name="group" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Directorio</q-item-label>
                <q-item-label caption>Ver cuentas y elegir contador</q-item-label>
              </q-item-section>
            </q-item>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'auditorias' }"
              :active="enAuditorias"
              :aria-current="enAuditorias ? 'page' : undefined"
              aria-label="Ir a auditorías"
            >
              <q-item-section avatar>
                <q-icon name="fact_check" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Auditorías</q-item-label>
                <q-item-label caption>Registrar y dar seguimiento</q-item-label>
              </q-item-section>
            </q-item>
          </template>

          <template v-if="session.trabajaCasos">

            <q-item-label header>Mi trabajo</q-item-label>
            
            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'contador-dashboard' }"
              :aria-current="paginaActual('contador-dashboard')"
              aria-label="Ir a mi resumen"
            >
              <q-item-section avatar>
                <q-icon name="insights" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Mi resumen</q-item-label>
                <q-item-label caption>Gráficas de casos y auditorías</q-item-label>
              </q-item-section>
            </q-item>


            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'contador-casos' }"
              :aria-current="paginaActual('contador-casos')"
              aria-label="Ir a mi trabajo"
            >
              <q-item-section avatar>
                <q-icon name="list_alt" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Mi trabajo</q-item-label>
                <q-item-label caption>Registrar, revisar y editar</q-item-label>
              </q-item-section>
            </q-item>

            <!-- Solo el contador entra a auditorías; el auxiliar, no. -->
            <q-item
              v-if="session.esContador"
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'auditorias' }"
              :active="enAuditorias"
              :aria-current="enAuditorias ? 'page' : undefined"
              aria-label="Ir a auditorías"
            >
              <q-item-section avatar>
                <q-icon name="fact_check" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Auditorías</q-item-label>
                <q-item-label caption>Registrar y dar seguimiento</q-item-label>
              </q-item-section>
            </q-item>
          </template>

          <template v-if="session.esUsuarioSistema">
            <q-item-label header>Usuarios</q-item-label>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'admin-directorio' }"
              :aria-current="paginaActual('admin-directorio')"
              aria-label="Ir al directorio de usuarios"
            >
              <q-item-section avatar>
                <q-icon name="group" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Directorio</q-item-label>
                <q-item-label caption>Crear cuentas y cambiar contraseñas</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-list>
        </nav>
      </q-scroll-area>

      <div class="drawer-usuario" v-if="session.autenticado">
        <!-- Quien trabaja casos entra a «Mi perfil» desde su nombre; el resto ve el bloque sin enlace. -->
        <router-link
          v-if="session.nombreVisible && session.trabajaCasos"
          :to="{ name: 'mi-perfil' }"
          :aria-current="paginaActual('mi-perfil')"
          aria-label="Ir a mi perfil"
          class="drawer-usuario__fila drawer-usuario__fila--enlace"
          active-class="drawer-usuario__fila--activa"
        >
          <div class="drawer-usuario__avatar" aria-hidden="true">{{ iniciales }}</div>
          <div class="drawer-usuario__datos">
            <p class="drawer-usuario__nombre">
              {{ session.nombreVisible }}
              <q-tooltip>{{ session.nombreVisible }}</q-tooltip>
            </p>
            <p class="drawer-usuario__rol">{{ rolLegible }}</p>
          </div>
        </router-link>
        <div v-else-if="session.nombreVisible" class="drawer-usuario__fila">
          <div class="drawer-usuario__avatar" aria-hidden="true">{{ iniciales }}</div>
          <div class="drawer-usuario__datos">
            <p class="drawer-usuario__nombre">
              {{ session.nombreVisible }}
              <q-tooltip>{{ session.nombreVisible }}</q-tooltip>
            </p>
            <p class="drawer-usuario__rol">{{ rolLegible }}</p>
          </div>
        </div>

        <div class="drawer-usuario__salir">
          <q-item
            clickable
            v-ripple
            class="q-item--nav"
            aria-label="Cerrar sesión"
            :disable="cerrandoSesion"
            @click="abrirDialogoCierre"
          >
            <q-item-section avatar>
              <q-icon name="logout" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Cerrar sesión</q-item-label>
            </q-item-section>
          </q-item>
        </div>
      </div>
    </q-drawer>

    <q-page-container
      id="contenido-principal"
      tabindex="-1"
      class="contenedor-paginas"
      :class="{ 'contenedor-paginas--acompana-menu': acompanarMenu }"
      :inert="fondoBloqueado"
    >
      <header v-if="$q.screen.gt.sm" class="page-header">
        <h1 class="page-header__title">{{ pageTitle }}</h1>
        <CampanaAvisos v-if="session.veCampana" class="page-header__campana" />
      </header>

      <q-page v-if="session.sesionCaducada" class="access-page">
        <AvisoSesionCaducada />
      </q-page>
      <q-page v-else-if="accessDenied" class="access-page">
        <AccessDenied />
      </q-page>
      <router-view v-else />
    </q-page-container>

    <!-- Fundido corto: nada aparece desde escala 0. Quasar pone el rol de diálogo; aquí solo el nombre. -->
    <q-dialog
      v-model="dialogoCierreAbierto"
      transition-show="dialogo-entra"
      transition-hide="dialogo-sale"
      :transition-duration="220"
      aria-labelledby="dialogo-cierre-titulo"
      @hide="alCerrarDialogo"
    >
      <q-card class="dialogo-cierre">
        <q-card-section>
          <h2 id="dialogo-cierre-titulo" class="dialogo-cierre__titulo">¿Cerrar sesión?</h2>
          <p class="dialogo-cierre__texto">Tendrás que iniciar sesión de nuevo.</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            autofocus
            flat
            no-caps
            label="Cancelar"
            class="control-touch boton-presionable"
            :disable="cerrandoSesion"
            @click="cancelarCierre"
          >
            <q-tooltip>Conserva la sesión actual y vuelve a la pantalla.</q-tooltip>
          </q-btn>
          <q-btn
            color="primary"
            no-caps
            label="Cerrar sesión"
            class="control-touch boton-presionable"
            :loading="cerrandoSesion"
            :disable="cerrandoSesion"
            @click="confirmarCierre"
          >
            <q-tooltip>Confirma el cierre de sesión y vuelve a la pantalla de inicio.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-layout>
</template>

<script setup>
import { computed, ref } from 'vue'
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import AccessDenied from '../components/AccessDenied.vue'
import CampanaAvisos from '../components/CampanaAvisos.vue'
import AvisoSesionCaducada from '../components/AvisoSesionCaducada.vue'
import { accessDenied } from '../router/accessState.js'
import { eventos } from '../services/eventosService.js'
import { useCasesStore } from '../stores/cases.js'
import { useCountersStore } from '../stores/counters.js'
import { useSessionStore } from '../stores/session.js'
import { auditoriaConChatAbierto, avisoDeMensaje } from '../utils/avisosChat.js'
import { formatearIniciales, formatearRol } from '../utils/formateadores.js'
import { guardarMenuFijado, leerMenuFijado } from '../utils/preferenciaMenu.js'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const counters = useCountersStore()
const cases = useCasesStore()

const drawerOpen = ref(false)
const menuFijado = ref(leerMenuFijado())
// Cursor y foco se siguen por separado: el menú se compacta solo sin ninguno de los dos.
const cursorEnMenu = ref(false)
const focoEnMenu = ref(false)
const menuCompacto = computed(() => !menuFijado.value && !cursorEnMenu.value && !focoEnMenu.value)

// Pasar el cursor por el borde no es intención: el menú se despliega si el cursor se queda un momento.
const ESPERA_CURSOR_MS = 150
let esperaCursor = null

const alEntrarCursor = () => {
  clearTimeout(esperaCursor)
  esperaCursor = setTimeout(() => {
    cursorEnMenu.value = true
  }, ESPERA_CURSOR_MS)
}

const alSalirCursor = () => {
  clearTimeout(esperaCursor)
  cursorEnMenu.value = false
}

const alEntrarFoco = (evento) => {
  // Solo el foco de teclado despliega: el que QDialog devuelve tras un clic no es visible.
  focoEnMenu.value = evento.target.matches(':focus-visible')
}

const alSalirFoco = (evento) => {
  // Al tabular dentro del menú el foco sigue contenido.
  if (!evento.currentTarget.contains(evento.relatedTarget)) {
    focoEnMenu.value = false
  }
}

const textoBotonMenu = computed(() =>
  menuFijado.value ? 'Volver a menú compacto' : 'Fijar menú abierto',
)

// Por debajo de 1024 px el menú se abre con el botón de la barra y el logo no fija nada.
const esEscritorio = computed(() => $q.screen.gt.sm)

// Al fijar o desfijar cambia el espacio que deja el menú: el contenido se desliza con él.
const DURACION_MENU_MS = 150
const acompanarMenu = ref(false)
let esperaAcompanar = null

const alternarMenuFijado = () => {
  if (!esEscritorio.value) return
  clearTimeout(esperaAcompanar)
  acompanarMenu.value = true
  esperaAcompanar = setTimeout(() => {
    acompanarMenu.value = false
  }, DURACION_MENU_MS)
  menuFijado.value = !menuFijado.value
  guardarMenuFijado(menuFijado.value)
}

// En el celular: al abrir el menú el foco entra a la primera opción; al cerrarlo vuelve al botón.
const botonMenu = ref(null)

// Con el menú del celular abierto, la barra y el contenido quedan inertes: el foco no sale del menú.
const fondoBloqueado = computed(() => !esEscritorio.value && drawerOpen.value)

/** Escape cierra el menú del celular también con el foco dentro (Quasar no lo hace). */
const cerrarMenuMovil = () => {
  if (esEscritorio.value || !drawerOpen.value) return
  drawerOpen.value = false
}
watch(
  () => drawerOpen.value,
  async (abierto, antes) => {
    if (esEscritorio.value) return
    await nextTick()
    if (abierto) {
      document.querySelector('#menu-lateral .q-item--nav')?.focus()
    } else if (antes && document.getElementById('menu-lateral')?.contains(document.activeElement)) {
      botonMenu.value?.$el?.focus()
    }
  },
)

const dialogoCierreAbierto = ref(false)
const cerrandoSesion = ref(false)

const pageTitle = computed(() => route.meta.titulo ?? 'Pantalla')

/** `aria-current` de cada opción del menú: el lector anuncia en qué pantalla estás. */
const paginaActual = (nombre) => (route.name === nombre ? 'page' : undefined)

/** La ficha de una auditoría es una ruta hermana: «Auditorías» sigue marcado como activo. */
const enAuditorias = computed(() =>
  ['auditorias', 'auditoria-ficha'].includes(route.name),
)

/** «Saltar al contenido»: lleva el foco al contenido de la página. */
const saltarAlContenido = () => {
  document.getElementById('contenido-principal')?.focus()
}


const iniciales = computed(() => formatearIniciales(session.nombreVisible))
const rolLegible = computed(() => formatearRol(session.rol))

const abrirDialogoCierre = () => {
  dialogoCierreAbierto.value = true
}

const cancelarCierre = () => {
  dialogoCierreAbierto.value = false
}

const confirmarCierre = async () => {
  if (cerrandoSesion.value) return
  cerrandoSesion.value = true
  try {
    await session.cerrarSesionVoluntaria()
    counters.reiniciar()
    cases.reiniciar()
    await router.replace({ name: 'login' })
  } finally {
    cerrandoSesion.value = false
    dialogoCierreAbierto.value = false
  }
}

const alCerrarDialogo = () => {
  // Si se cierra con Escape o clic fuera, se considera cancelación.
  if (cerrandoSesion.value) return
  dialogoCierreAbierto.value = false
}

const manejarActividad = () => {
  session.marcarActividad()
}

// Tiempo real: el servidor puede avisar que la sesión ya no vale (vencida o revocada)
const dejarDeEscucharSesion = eventos.escuchar('sesion-cerrada', () => session.caducarSesion())

/**
 * Mensaje nuevo del chat: aviso emergente con «Ver mensajes» para el contador, en cualquier
 * pantalla. El aviso también queda en la campana (lo guarda el backend).
 */
const alRecibirMensajeDelChat = (datos) => {
  const aviso = avisoDeMensaje(datos, {
    esContador: session.esContador,
    usuarioId: session.id,
    chatAbiertoId: auditoriaConChatAbierto.value,
  })
  if (!aviso) return
  $q.notify({
    icon: 'forum',
    color: 'primary',
    message: aviso.titulo,
    caption: aviso.texto,
    position: 'top-right',
    timeout: 8000,
    actions: [
      {
        label: 'Ver mensajes',
        color: 'dg-texto-claro',
        noCaps: true,
        handler: () =>
          router.push({ name: 'auditoria-ficha', params: { id: aviso.auditoriaId }, query: { chat: '1' } }),
      },
    ],
  })
}
const dejarDeEscucharChat = eventos.escuchar('mensaje-auditoria', alRecibirMensajeDelChat)

// Al caducar o cerrar sesión se corta la conexión; al volver a entrar se abre otra
watch(
  () => session.autenticado,
  (autenticado) => (autenticado ? eventos.conectar() : eventos.desconectar()),
)

onMounted(() => {
  // Reinicio del contador de inactividad con la interacción del usuario (RNF-02, RF-07).
  window.addEventListener('click', manejarActividad, true)
  window.addEventListener('keydown', manejarActividad, true)
  window.addEventListener('pointerdown', manejarActividad, true)
  window.addEventListener('touchstart', manejarActividad, true)

  // El temporizador solo se arranca si hay sesión viva y no está caducada.
  if (session.autenticado && !session.sesionCaducada) {
    session.iniciarTemporizador()
    eventos.conectar()
  }
})

onBeforeUnmount(() => {
  eventos.desconectar()
  dejarDeEscucharSesion()
  dejarDeEscucharChat()
  window.removeEventListener('click', manejarActividad, true)
  window.removeEventListener('keydown', manejarActividad, true)
  window.removeEventListener('pointerdown', manejarActividad, true)
  window.removeEventListener('touchstart', manejarActividad, true)
})
</script>

<style scoped>
/* «Saltar al contenido»: invisible hasta que recibe el foco con el teclado; entonces aparece arriba. */
.saltar-contenido {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 3000;
}

.saltar-contenido:not(:focus) {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  width: 1px;
  height: 1px;
  overflow: hidden;
  white-space: nowrap;
}

.saltar-contenido:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/*
 * El menú compacto anima su ancho solo cuando lo despliega el cursor; con el teclado cambia al
 * instante (las acciones de teclado no se animan). La regla de Quasar lleva !important y se
 * aplica al <aside class="q-drawer">, mientras que nuestras clases quedan en su contenido.
 */
/*
 * Curva de salida de la app ($curva-salida) en lugar del `ease` de Quasar. Quasar quita la
 * clase de animación a los 155 ms, así que la duración no puede pasar de 150 ms.
 */
:global(.q-body--layout-animate .q-drawer:has(> .menu-lateral)) {
  transition:
    transform 150ms var(--dg-curva-salida),
    width 150ms var(--dg-curva-salida) !important;
}

:global(.q-body--layout-animate .q-drawer:has(> .menu-lateral--al-instante)) {
  transition: none !important;
}

/* Al fijar o desfijar, el contenido se desliza al mismo ritmo que el menú. */
.contenedor-paginas--acompana-menu {
  transition: padding-left 150ms var(--dg-curva-salida) !important;
}

@media (prefers-reduced-motion: reduce) {
  :global(.q-body--layout-animate .q-drawer:has(> .menu-lateral)),
  .contenedor-paginas--acompana-menu {
    transition: none !important;
  }
}

/* El contenido recibe el foco del salto sin dibujar un anillo alrededor de toda la página. */
.contenedor-paginas:focus {
  outline: none;
}

.layout-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 12px;
}

.layout-bar__row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}

.layout-bar__title {
  flex: 1 1 180px;
  min-width: 0;
  margin: 0;
  font-size: clamp(1.05rem, 4vw, 1.4rem);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * QPage calcula su alto mínimo sin contar el encabezado de escritorio, lo que dejaba
 * un scroll de sobra. El contenedor reparte la ventana: el encabezado toma su alto y
 * la página se estira con el resto.
 */
.contenedor-paginas {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.contenedor-paginas > :deep(.q-page) {
  flex: 1 1 auto;
  min-height: 0 !important;
}

/* Encabezado de escritorio: mismo orden que la barra y el relleno horizontal de las páginas. */
.page-header {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 20px 24px 0;
}

/* La campanita del contador va al extremo derecho del encabezado. */
.page-header__campana {
  margin-left: auto;
}

.page-header__title {
  flex: 1 1 180px;
  min-width: 0;
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.2;
}


.layout-bar__menu {
  min-width: 44px;
  min-height: 44px;
}

.access-page {
  padding: 24px 16px;
}

/* La marca ocupa el alto que necesita; la lista se queda con el resto y hace su propio scroll. */
:deep(.menu-lateral) {
  display: flex;
  flex-direction: column;
}

.drawer-marca {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.drawer-marca__logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.drawer-marca__logo-boton {
  display: flex;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.drawer-marca__logo-boton[aria-disabled='true'] {
  cursor: default;
}

/* La regla global de q-btn (app.scss) usa !important; aquí se conserva el anillo secundario. */
.drawer-marca__logo-boton:focus-visible {
  outline: 3px solid var(--q-secondary) !important;
  outline-offset: 2px;
}

/* Sin el sombreado de q-btn al pasar el puntero: el logo se ve igual que antes. */
.drawer-marca__logo-boton :deep(.q-focus-helper) {
  display: none;
}

.drawer-marca__textos {
  min-width: 0;
}

.drawer-marca__empresa,
.drawer-marca__app {
  margin: 0;
  line-height: 1.2;
}

.drawer-marca__empresa {
  color: var(--dg-texto-claro);
  font-size: 0.95rem;
  font-weight: 600;
}

.drawer-marca__app {
  color: var(--dg-texto-claro-tenue);
  font-size: 0.8rem;
}

.drawer-nav {
  flex: 1 1 auto;
  min-height: 0;
}

.drawer-usuario {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-top: 1px solid var(--dg-borde-menu);
}

.drawer-usuario__fila {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* El bloque del usuario es un enlace a «Mi perfil» para quien trabaja casos. */
.drawer-usuario__fila--enlace {
  min-height: 44px;
  padding: 4px 8px;
  margin: 0 -8px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

/* Solo con ratón: en pantallas táctiles el hover se queda pegado tras tocar. */
@media (hover: hover) and (pointer: fine) {
  .drawer-usuario__fila--enlace:hover {
    background: var(--dg-fondo-menu-activo);
  }
}

.drawer-usuario__fila--enlace:focus-visible {
  outline: 2px solid var(--q-secondary) !important;
  outline-offset: -2px;
}

.drawer-usuario__fila--activa {
  background: var(--dg-fondo-menu-activo);
  box-shadow: inset 3px 0 0 var(--q-secondary);
}

.drawer-usuario__salir {
  margin: 0 -16px;
}

.drawer-usuario__avatar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--q-secondary);
  color: var(--q-primary);
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1;
}

.drawer-usuario__datos {
  min-width: 0;
}

.drawer-usuario__nombre {
  color: var(--dg-texto-claro);
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawer-usuario__rol {
  color: var(--q-secondary);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.drawer-usuario__nombre,
.drawer-usuario__rol {
  margin: 0;
  line-height: 1.2;
}

.drawer-nav .q-item__label--header {
  color: var(--q-secondary);
}

.q-item--nav {
  color: var(--dg-texto-claro);
}

.q-item--nav .q-icon {
  color: var(--q-secondary);
}

.q-item--nav .q-item__label--caption {
  color: var(--dg-texto-claro-tenue);
}

/* Foco celeste en los ítems, como el logo; el anillo blanco global tapaba la franja del activo. */
.q-item--nav:focus-visible {
  outline: 2px solid var(--q-secondary) !important;
  outline-offset: -2px;
}

.q-item--nav-activo {
  background: var(--dg-fondo-menu-activo);
  box-shadow: inset 3px 0 0 var(--q-secondary);
}

/*
 * Modo compacto: solo el logo, los iconos y las iniciales. Se cuelga de la clase que
 * QDrawer pone únicamente en escritorio; q-mini-drawer-hide también oculta en móvil.
 */
.q-drawer--mini .drawer-marca__textos,
.q-drawer--mini .drawer-nav .q-item__label--header,
.q-drawer--mini .drawer-usuario__datos {
  display: none;
}

.q-drawer--mini .drawer-usuario__fila {
  justify-content: center;
}

.q-drawer--mini .drawer-usuario__fila--enlace {
  margin: 0;
  padding: 4px 0;
}

.dialogo-cierre {
  min-width: 280px;
  max-width: 90vw;
}

.dialogo-cierre__titulo {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}

.dialogo-cierre__texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  line-height: 1.5;
}
</style>