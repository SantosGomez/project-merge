<template>
  <q-layout view="lHh Lpr lFf">
    <q-header v-if="$q.screen.lt.md" elevated class="bg-primary text-white">
      <div class="layout-bar">
        <div class="layout-bar__row">
          <q-btn
            flat
            icon="menu"
            aria-label="Abrir menú de navegación"
            class="layout-bar__menu control-touch"
            @click="drawerOpen = !drawerOpen"
          />

          <q-btn
            v-if="backRouteName && !accessDenied"
            flat
            no-caps
            icon="arrow_back"
            text-color="white"
            class="control-touch"
            :to="{ name: backRouteName }"
            :aria-label="`Volver a ${backTitle}`"
          >
            <q-tooltip>Volver a {{ backTitle }}</q-tooltip>
          </q-btn>

          <h1 class="layout-bar__title">
            {{ pageTitle }}
            <q-tooltip>{{ pageTitle }}</q-tooltip>
          </h1>
        </div>
      </div>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :breakpoint="1023"
      :width="250"
      :mini="menuCompacto"
      :mini-to-overlay="!menuFijado"
      :mini-width="96"
      @mouseenter="cursorEnMenu = true"
      @mouseleave="cursorEnMenu = false"
      @focusin="alEntrarFoco"
      @focusout="alSalirFoco"
      class="bg-primary menu-lateral"
      aria-label="Navegación principal"
      transition-show="slide-right"
      transition-hide="slide-left"
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
        <q-list padding>
          <template v-if="session.esAdministrador">
            <q-item-label header>Administración</q-item-label>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'admin-dashboard' }"
              aria-label="Ir al dashboard del administrador"
            >
              <q-item-section avatar>
                <q-icon name="dashboard" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Dashboard admin</q-item-label>
                <q-item-label caption>Ver conteos y casos</q-item-label>
              </q-item-section>
              <q-tooltip>Ir al dashboard del administrador</q-tooltip>
            </q-item>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'admin-directorio' }"
              aria-label="Ir al directorio de usuarios"
            >
              <q-item-section avatar>
                <q-icon name="group" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Directorio</q-item-label>
                <q-item-label caption>Ver cuentas y elegir contador</q-item-label>
              </q-item-section>
              <q-tooltip>Ir al directorio de usuarios</q-tooltip>
            </q-item>
          </template>

          <template v-if="session.esContador">
            <q-item-label header>Mis casos</q-item-label>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'contador-casos' }"
              aria-label="Ir a mis casos"
            >
              <q-item-section avatar>
                <q-icon name="list_alt" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Mis casos</q-item-label>
                <q-item-label caption>Registrar, revisar y editar</q-item-label>
              </q-item-section>
              <q-tooltip>Ir a mis casos</q-tooltip>
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
              aria-label="Ir al directorio de usuarios"
            >
              <q-item-section avatar>
                <q-icon name="group" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Directorio</q-item-label>
                <q-item-label caption>Crear cuentas y cambiar contraseñas</q-item-label>
              </q-item-section>
              <q-tooltip>Ir al directorio de usuarios</q-tooltip>
            </q-item>
          </template>
        </q-list>
      </q-scroll-area>

      <div class="drawer-usuario" v-if="session.autenticado">
        <div class="drawer-usuario__fila" v-if="session.nombreVisible">
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
              <q-item-label>Cerrar Sesión</q-item-label>
            </q-item-section>
            <q-tooltip>Cierra la sesión actual y vuelve a la pantalla de inicio de sesión.</q-tooltip>
          </q-item>
        </div>
      </div>
    </q-drawer>

    <q-page-container class="contenedor-paginas">
      <header v-if="$q.screen.gt.sm" class="page-header">
        <q-btn
          v-if="backRouteName && !accessDenied"
          flat
          no-caps
          color="primary"
          icon="arrow_back"
          label="Volver"
          class="control-touch"
          :to="{ name: backRouteName }"
          :aria-label="`Volver a ${backTitle}`"
        >
          <q-tooltip>Vuelve a {{ backTitle }}, la pantalla anterior del recorrido.</q-tooltip>
        </q-btn>

        <h1 class="page-header__title">{{ pageTitle }}</h1>
      </header>

      <q-page v-if="session.sesionCaducada" class="access-page">
        <AvisoSesionCaducada />
      </q-page>
      <q-page v-else-if="accessDenied" class="access-page">
        <AccessDenied />
      </q-page>
      <router-view v-else />
    </q-page-container>

    <q-dialog
      v-model="dialogoCierreAbierto"
      transition-show="scale"
      transition-hide="scale"
      @hide="alCerrarDialogo"
    >
      <q-card class="dialogo-cierre" role="dialog" aria-modal="true" aria-labelledby="dialogo-cierre-titulo">
        <q-card-section>
          <h2 id="dialogo-cierre-titulo" class="dialogo-cierre__titulo">¿Cerrar sesión?</h2>
          <p class="dialogo-cierre__texto">Tendrá que iniciar sesión de nuevo.</p>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            flat
            no-caps
            label="Cancelar"
            class="control-touch"
            :disable="cerrandoSesion"
            @click="cancelarCierre"
          >
            <q-tooltip>Conserva la sesión actual y vuelve a la pantalla.</q-tooltip>
          </q-btn>
          <q-btn
            color="primary"
            no-caps
            label="Cerrar sesión"
            class="control-touch"
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
import { onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuasar } from 'quasar'

import AccessDenied from '../components/AccessDenied.vue'
import AvisoSesionCaducada from '../components/AvisoSesionCaducada.vue'
import { accessDenied } from '../router/accessState.js'
import { useCasesStore } from '../stores/cases.js'
import { useCountersStore } from '../stores/counters.js'
import { useSessionStore } from '../stores/session.js'
import { decidirAcceso } from '../utils/accessRules.js'
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

const alternarMenuFijado = () => {
  if (!esEscritorio.value) return
  menuFijado.value = !menuFijado.value
  guardarMenuFijado(menuFijado.value)
}

const dialogoCierreAbierto = ref(false)
const cerrandoSesion = ref(false)

const pageTitle = computed(() => route.meta.titulo ?? 'Pantalla')
// «Volver» solo se ofrece si la sesión puede abrir la pantalla de destino.
const backRouteName = computed(() => {
  const destino = route.meta.volverA ?? null
  if (!destino) return null

  const meta = router.resolve({ name: destino }).meta
  const decision = decidirAcceso({
    ruta: { requiereSesion: meta.requiereSesion === true, perfil: meta.perfil ?? null },
    sesion: { autenticado: session.autenticado, rol: session.rol },
  })
  return decision.accion === 'permitir' ? destino : null
})
const backTitle = computed(() => {
  if (!backRouteName.value) {
    return 'la pantalla anterior'
  }

  return router.resolve({ name: backRouteName.value }).meta.titulo ?? 'la pantalla anterior'
})

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

onMounted(() => {
  // Reinicio del contador de inactividad con la interacción del usuario (RNF-02, RF-07).
  window.addEventListener('click', manejarActividad, true)
  window.addEventListener('keydown', manejarActividad, true)
  window.addEventListener('pointerdown', manejarActividad, true)
  window.addEventListener('touchstart', manejarActividad, true)

  // El temporizador solo se arranca si hay sesión viva y no está caducada.
  if (session.autenticado && !session.sesionCaducada) {
    session.iniciarTemporizador()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('click', manejarActividad, true)
  window.removeEventListener('keydown', manejarActividad, true)
  window.removeEventListener('pointerdown', manejarActividad, true)
  window.removeEventListener('touchstart', manejarActividad, true)
})
</script>

<style scoped>
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

.page-header__title {
  flex: 1 1 180px;
  min-width: 0;
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1.2;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
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
  border-top: 1px solid rgba(255, 255, 255, 0.16);
}

.drawer-usuario__fila {
  display: flex;
  align-items: center;
  gap: 12px;
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

.q-item--nav-activo {
  background: rgba(255, 255, 255, 0.1);
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

.dialogo-cierre {
  min-width: 280px;
  max-width: 90vw;
}

.dialogo-cierre__titulo {
  margin: 0 0 8px;
  font-size: 1.15rem;
}

.dialogo-cierre__texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  line-height: 1.5;
}
</style>