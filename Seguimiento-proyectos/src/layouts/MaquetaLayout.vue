<template>
  <q-layout view="hHh Lpr lFf">
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
        </div>

        <div class="layout-bar__simulations">
          <SimulationControls @simulate-error="simulateError" @simulate-expiry="simulateExpiry" />
        </div>
      </div>
    </q-header>

    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :breakpoint="1024"
      :width="220"
      class="bg-blue-1"
      aria-label="Navegación principal"
      transition-show="slide-right"
      transition-hide="slide-left"
    >
      <q-toolbar class="bg-primary text-white">
        <q-toolbar-title>Navegación</q-toolbar-title>
      </q-toolbar>

      <!-- full-height: q-scrollarea colapsa a 0 sin altura (contain: size); el drawer ya gestiona el alto. -->
      <q-scroll-area class="full-height">
        <q-list padding>
          <q-item-label header>Navegación</q-item-label>

          <q-item
            clickable
            v-ripple
            class="q-item--nav"
            active-class="bg-primary text-white"
            :to="{ name: 'admin-dashboard' }"
            aria-label="Ir al dashboard del administrador"
          >
            <q-item-section avatar>
              <q-icon name="dashboard" color="primary" />
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
            active-class="bg-primary text-white"
            :to="{ name: 'admin-directorio' }"
            aria-label="Ir al directorio de contadores"
          >
            <q-item-section avatar>
              <q-icon name="group" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Directorio</q-item-label>
              <q-item-label caption>Elegir contador</q-item-label>
            </q-item-section>
            <q-tooltip>Ir al directorio de contadores</q-tooltip>
          </q-item>

          <q-item
            clickable
            v-ripple
            class="q-item--nav"
            active-class="bg-primary text-white"
            :to="{ name: 'contador-registro' }"
            aria-label="Ir al registro de caso"
          >
            <q-item-section avatar>
              <q-icon name="add_circle" color="primary" />
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
            active-class="bg-primary text-white"
            :to="{ name: 'contador-casos' }"
            aria-label="Ir a mis casos"
          >
            <q-item-section avatar>
              <q-icon name="list_alt" color="primary" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Mis casos</q-item-label>
              <q-item-label caption>Revisar y editar</q-item-label>
            </q-item-section>
            <q-tooltip>Ir a mis casos</q-tooltip>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page v-if="accessDenied" class="access-page">
        <AccessDenied />
      </q-page>
      <router-view v-else />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AccessDenied from '../components/AccessDenied.vue'
import SimulationControls from '../components/SimulationControls.vue'
import { accessDenied } from '../router/accessState.js'
import { useMaquetaStore } from '../stores/maqueta.js'

const route = useRoute()
const router = useRouter()
const maqueta = useMaquetaStore()

const drawerOpen = ref(true)

const pageTitle = computed(() => route.meta.titulo ?? 'Pantalla')
const backRouteName = computed(() => route.meta.volverA ?? null)
const backTitle = computed(() => {
  if (!backRouteName.value) {
    return 'la pantalla anterior'
  }

  return router.resolve({ name: backRouteName.value }).meta.titulo ?? 'la pantalla anterior'
})

// "Simular error" y "Simular caducidad" existen en todas las pantallas internas (RF-38).
const simulateError = () => {
  maqueta.simulateError(route.meta.screenId)
}

const simulateExpiry = () => {
  maqueta.simulateExpiry()
  router.replace({ name: 'login' })
}
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

.layout-bar__simulations {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.q-item--nav:hover {
  background: rgba(0, 0, 0, 0.06);
}

/* El ícono vuelve a blanco cuando el item está activo (active-class bg-primary). */
.q-item--nav.bg-primary .q-icon {
  color: #fff !important;
}
</style>
