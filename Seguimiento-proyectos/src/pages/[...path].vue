<template>
  <main class="no-encontrada">
    <q-card flat class="no-encontrada__card">
      <q-img
        class="no-encontrada__logo"
        src="logos/PNG/DELGROW_LOGO-OF.png"
        alt="DelGrow Business Solutions"
        fit="cover"
        width="240px"
        height="52px"
        loading="eager"
        fetchpriority="high"
        no-spinner
      />

      <q-icon name="travel_explore" size="40px" color="dg-acento" class="no-encontrada__icono" aria-hidden="true" />
      <h1 class="no-encontrada__titulo">No encontramos esta página</h1>
      <p class="no-encontrada__texto">
        La dirección no existe o cambió. Revisa el enlace o vuelve a una pantalla conocida.
      </p>

      <q-btn
        color="primary"
        no-caps
        unelevated
        :icon="destino.icono"
        :label="destino.etiqueta"
        :to="destino.ruta"
        class="no-encontrada__accion control-touch boton-presionable"
      >
        <q-tooltip>{{ destino.ayuda }}</q-tooltip>
      </q-btn>
    </q-card>
  </main>
</template>

<script setup>
import { computed } from 'vue'

import { useSessionStore } from '../stores/session.js'

/*
 * Página 404 (revisión de UI, rebanada 1): cualquier dirección que no existe llega aquí,
 * dentro del layout del login, en lugar de dejar la pantalla en blanco.
 */
const sesion = useSessionStore()

/** Con sesión se vuelve a la pantalla principal del perfil; sin sesión, al inicio de sesión. */
const destino = computed(() =>
  sesion.autenticado && sesion.pantallaPrincipal
    ? {
        ruta: sesion.pantallaPrincipal,
        etiqueta: 'Ir a mi pantalla principal',
        icono: 'home',
        ayuda: 'Abre la pantalla principal de tu perfil.',
      }
    : {
        ruta: { name: 'login' },
        etiqueta: 'Ir al inicio de sesión',
        icono: 'login',
        ayuda: 'Abre la pantalla para iniciar sesión.',
      },
)
</script>

<style scoped>
.no-encontrada {
  width: 100%;
  max-width: 440px;
  min-width: 0;
}

/* Misma tarjeta que el inicio de sesión. */
.no-encontrada__card {
  width: 100%;
  padding: 24px;
  border-radius: 16px;
  background: var(--dg-superficie);
  box-shadow: 0 12px 32px rgb(16 42 67 / 12%);
  text-align: center;
}

/* El PNG trae margen blanco arriba y abajo: fit="cover" lo recorta. */
.no-encontrada__logo {
  display: block;
  max-width: 100%;
  margin: 0 auto 24px;
}

.no-encontrada__icono {
  margin-bottom: 8px;
}

.no-encontrada__titulo {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  text-wrap: balance;
}

.no-encontrada__texto {
  margin: 0 0 24px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
}

.no-encontrada__accion {
  width: 100%;
  font-size: 1rem;
}

.control-touch {
  min-height: 48px;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-07). */
.no-encontrada__accion:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}
</style>
