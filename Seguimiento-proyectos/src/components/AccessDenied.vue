<template>
  <section class="access-denied" role="alert" :aria-labelledby="titleId">
    <h2 :id="titleId" class="access-denied__title">Acceso denegado</h2>

    <p class="access-denied__message">
      Esta dirección pertenece a una pantalla de otro perfil, así que no puedes verla. Vuelve a la
      pantalla principal de tu perfil para continuar.
    </p>

    <q-btn
      color="primary"
      no-caps
      icon="home"
      label="Volver a mi pantalla principal"
      class="access-denied__action control-touch"
      :to="{ name: homeRouteName }"
    >
      <q-tooltip>Vuelve a la pantalla principal de tu perfil.</q-tooltip>
    </q-btn>

    <!-- Ayuda siempre visible: se lee con puntero, con teclado y con toque (RNF-3). -->
    <section class="access-denied__help" aria-labelledby="access-denied-help-title">
      <h3 id="access-denied-help-title" class="access-denied__help-title">
        Por qué ves este aviso
      </h3>
      <ul class="access-denied__help-list">
        <li>
          Tu sesión es de perfil <strong>{{ profileLabel }}</strong> y esta pantalla no pertenece a
          ese perfil.
        </li>
        <li>
          El perfil lo determina la cuenta de ejemplo con la que iniciaste sesión: no se elige a
          mano.
        </li>
        <li>
          La maqueta no ofrece ningún control que lleve a una pantalla del otro perfil: cada cuenta
          de ejemplo solo abre las pantallas de su perfil.
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup>
import { computed, useId } from 'vue'

import { useMaquetaStore } from '../stores/maqueta.js'
import { PROFILES } from '../utils/constants.js'

/*
 * Aviso de acceso denegado (RF-6): se muestra en la dirección solicitada, sin cambiar de pantalla,
 * y ofrece volver a la pantalla principal del perfil conectado (P-2 para administrador, P-5 para contador).
 */
const maqueta = useMaquetaStore()

/** Pantalla principal del perfil conectado (Definiciones: pantalla principal del perfil). */
const homeRouteName = computed(() => (maqueta.isAdmin ? 'admin-dashboard' : 'contador-casos'))

/** Perfil de la sesión actual, con el nombre de las constantes. */
const profileLabel = computed(() =>
  maqueta.session?.profile === PROFILES.contador ? 'contador' : 'administrador',
)

const titleId = useId()
</script>

<style scoped>
.access-denied {
  max-width: 560px;
  margin: 0 auto;
  padding: 8px 0;
  text-align: center;
}

.access-denied__title {
  margin: 0 0 12px;
  color: #7a1f1a;
  font-size: clamp(1.3rem, 5vw, 1.6rem);
  line-height: 1.2;
}

.access-denied__message {
  margin: 0 0 20px;
  color: #334e68;
  font-size: 1rem;
  line-height: 1.5;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-8). */
.access-denied__action:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}

.access-denied__help {
  margin-top: 24px;
  padding: 16px;
  border-left: 4px solid #1f5f99;
  border-radius: 8px;
  background: #f0f6fc;
  text-align: left;
}

.access-denied__help-title {
  margin: 0 0 8px;
  color: #102a43;
  font-size: 1rem;
}

.access-denied__help-list {
  margin: 0;
  padding-left: 20px;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.access-denied__help-list li + li {
  margin-top: 6px;
}
</style>
