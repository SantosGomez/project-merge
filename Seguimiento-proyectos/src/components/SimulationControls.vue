<template>
  <div class="simulation-controls">
    <div class="simulation-controls__item">
      <q-btn
        class="simulation-controls__button control-touch"
        flat
        no-caps
        icon="error_outline"
        :label="SIMULATION.error"
        text-color="white"
        :aria-describedby="errorHelpId"
        @click="emit('simulate-error')"
      />

      <!-- Ayuda siempre visible: se lee con puntero, con teclado y con toque (RNF-3). -->
      <p :id="errorHelpId" class="simulation-controls__help">
        Reproduce el estado de error de esta pantalla: la maqueta simula que no pudo obtener los
        datos y ofrece reintentar.
      </p>
    </div>

    <div class="simulation-controls__item">
      <q-btn
        class="simulation-controls__button control-touch"
        flat
        no-caps
        icon="timer_off"
        :label="SIMULATION.expiry"
        text-color="white"
        :aria-describedby="expiryHelpId"
        @click="emit('simulate-expiry')"
      />

      <p :id="expiryHelpId" class="simulation-controls__help">
        Reproduce el fin de la sesión simulada para revisar el aviso de sesión caducada; después
        tendrás que iniciar sesión otra vez.
      </p>
    </div>
  </div>
</template>

<script setup>
import { useId } from 'vue'

import { SIMULATION } from '../utils/constants.js'

/*
 * Controles de simulación de las pantallas internas (RF-38, RNF-3).
 * Se etiquetan con "Simular..." para no confundirlos con acciones reales y cada uno
 * explica qué estado reproduce. El componente no toca el estado de la maqueta:
 * avisa con eventos y la pantalla que lo usa decide qué hacer.
 */
const emit = defineEmits(['simulate-error', 'simulate-expiry'])

const errorHelpId = useId()
const expiryHelpId = useId()
</script>

<style scoped>
.simulation-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.simulation-controls__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  max-width: 100%;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

.simulation-controls__help {
  max-width: 34em;
  margin: 0;
  /* Blanco sobre el azul de la cabecera: 4.60:1, igual que el resto de textos de la barra. */
  color: #ffffff;
  font-size: 0.75rem;
  line-height: 1.3;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-8). */
.simulation-controls__button:focus-visible {
  outline: 3px solid #ffffff !important;
  outline-offset: 2px;
}
</style>
