<template>
  <!--
    Layout de Ajustes: pantalla de configuración fuera de Seguimiento y de Documentos.
    Sin dock ni menú de módulo; solo el título y la vuelta al selector de módulos.
    Da el q-layout que necesitan las páginas con q-page.
  -->
  <q-layout view="hHh Lpr fFf" class="ajustes-layout">
    <q-header class="ajustes-layout__cabecera">
      <q-toolbar class="ajustes-layout__barra">
        <q-btn
          flat
          no-caps
          icon="arrow_back"
          label="Volver a módulos"
          class="control-touch boton-presionable ajustes-layout__volver"
          :to="{ name: 'modulos' }"
        >
          <q-tooltip>Vuelve al selector para elegir un módulo.</q-tooltip>
        </q-btn>
        <h1 class="ajustes-layout__titulo">Ajustes</h1>
      </q-toolbar>
    </q-header>

    <q-page-container class="ajustes-layout__contenedor">
      <q-page v-if="session.sesionCaducada" class="access-page">
        <AvisoSesionCaducada />
      </q-page>
      <q-page v-else-if="accessDenied" class="access-page">
        <AccessDenied />
      </q-page>
      <router-view v-else />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import AccessDenied from '../components/AccessDenied.vue'
import AvisoSesionCaducada from '../components/AvisoSesionCaducada.vue'
import { accessDenied } from '../router/accessState.js'
import { useSessionStore } from '../stores/session.js'

const session = useSessionStore()
</script>

<style scoped>
.ajustes-layout {
  background: linear-gradient(
    135deg,
    var(--dg-fondo-suave) 0%,
    var(--dg-fondo-panel) 45%,
    var(--dg-fondo-hover) 100%
  );
}

.ajustes-layout__cabecera {
  background: color-mix(in srgb, var(--dg-superficie) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--dg-borde);
  color: var(--dg-texto);
}

.ajustes-layout__barra {
  flex-wrap: wrap;
  gap: 4px 16px;
  min-height: 56px;
  padding: 4px 12px;
}

.ajustes-layout__volver {
  color: var(--dg-acento);
}

.ajustes-layout__titulo {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.2;
  font-weight: 700;
}

.ajustes-layout__contenedor {
  max-width: 1280px;
  margin: 0 auto;
}

.access-page {
  padding: 24px 16px;
}
</style>
