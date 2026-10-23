<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <div class="layout-bar">
        <div class="layout-bar__row">
          <q-btn
            v-if="backRouteName && !accessDenied"
            flat
            no-caps
            icon="arrow_back"
            label="Volver"
            text-color="white"
            class="control-touch"
            :to="{ name: backRouteName }"
            :aria-label="`Volver a ${backTitle}`"
          >
            <q-tooltip>Vuelve a {{ backTitle }}, la pantalla anterior del recorrido.</q-tooltip>
          </q-btn>

          <q-btn
            flat
            icon="menu"
            aria-label="Abrir menú de navegación"
            class="lt-lg layout-bar__menu control-touch"
            @click="drawerOpen = !drawerOpen"
          />

          <h1 class="layout-bar__title">{{ pageTitle }}</h1>

          <q-btn
            ref="botonCerrarSesion"
            flat
            no-caps
            icon="logout"
            label="Cerrar sesión"
            text-color="white"
            class="control-touch layout-bar__close"
            :aria-label="'Cerrar sesión'"
            :disable="cerrandoSesion"
            @click="abrirDialogoCierre"
          >
            <q-tooltip>Cierra la sesión actual y vuelve a la pantalla de inicio de sesión.</q-tooltip>
          </q-btn>
        </div>
      </div>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :breakpoint="1024"
      :width="250"
      class="bg-primary menu-lateral"
      aria-label="Navegación principal"
      transition-show="slide-right"
      transition-hide="slide-left"
    >
      <div class="drawer-marca">
        <img
          class="drawer-marca__logo"
          src="logos/PNG/DELGROW_ISOTIPO-OF_T.png"
          alt=""
          width="64"
          height="64"
        />
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
              aria-label="Ir al directorio de contadores"
            >
              <q-item-section avatar>
                <q-icon name="group" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Directorio</q-item-label>
                <q-item-label caption>Elegir contador</q-item-label>
              </q-item-section>
              <q-tooltip>Ir al directorio de contadores</q-tooltip>
            </q-item>
          </template>

          <template v-if="session.esContador">
            <q-item-label header>Mis casos</q-item-label>

            <q-item
              clickable
              v-ripple
              class="q-item--nav"
              active-class="q-item--nav-activo"
              :to="{ name: 'contador-registro' }"
              aria-label="Ir al registro de caso"
            >
              <q-item-section avatar>
                <q-icon name="add_circle" />
              </q-item-section>
              <q-item-section>
                <q-item-label>Registro de caso</q-item-label>
                <q-item-label caption>Crear nuevo caso</q-item-label>
              </q-item-section>
              <q-tooltip>Ir al registro de caso</q-tooltip>
            </q-item>

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
                <q-item-label caption>Revisar y editar</q-item-label>
              </q-item-section>
              <q-tooltip>Ir a mis casos</q-tooltip>
            </q-item>
          </template>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
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

import AccessDenied from '../components/AccessDenied.vue'
import AvisoSesionCaducada from '../components/AvisoSesionCaducada.vue'
import { accessDenied } from '../router/accessState.js'
import { useCasesStore } from '../stores/cases.js'
import { useCountersStore } from '../stores/counters.js'
import { useSessionStore } from '../stores/session.js'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const counters = useCountersStore()
const cases = useCasesStore()

const drawerOpen = ref(false)

const dialogoCierreAbierto = ref(false)
const cerrandoSesion = ref(false)

const pageTitle = computed(() => route.meta.titulo ?? 'Pantalla')
const backRouteName = computed(() => route.meta.volverA ?? null)
const backTitle = computed(() => {
  if (!backRouteName.value) {
    return 'la pantalla anterior'
  }

  return router.resolve({ name: backRouteName.value }).meta.titulo ?? 'la pantalla anterior'
})

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
  padding: 6px 12px 8px;
}

.layout-bar__row {
  display: flex;
  flex-wrap: wrap;
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
}

.layout-bar__close {
  min-width: 44px;
  min-height: 44px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

.layout-bar__menu {
  min-width: 44px;
  min-height: 44px;
}

@media (min-width: 1024px) {
  .layout-bar__menu {
    display: none;
  }
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

.drawer-marca__textos {
  min-width: 0;
}

.drawer-marca__empresa,
.drawer-marca__app {
  margin: 0;
  line-height: 1.2;
}

.drawer-marca__empresa {
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 600;
}

.drawer-marca__app {
  color: #c9cfd8;
  font-size: 0.8rem;
}

.drawer-nav {
  flex: 1 1 auto;
  min-height: 0;
}

.drawer-nav .q-item__label--header {
  color: var(--q-secondary);
}

.q-item--nav {
  color: #ffffff;
}

.q-item--nav .q-icon {
  color: var(--q-secondary);
}

.q-item--nav .q-item__label--caption {
  color: #c9cfd8;
}

.q-item--nav-activo {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 3px 0 0 var(--q-secondary);
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
  color: #334e68;
  line-height: 1.5;
}
</style>