<template>
  <q-card
    v-aparecer="{ cortina: true, duracion: 900, desenfoque: 12, distancia: 40 }"
    class="aviso-sesion"
    role="alert"
    :aria-labelledby="titleId"
  >
    <!-- Mismo estilo que la tarjeta del login: superficie, radio 16 px, sombra y entrada con cortina. -->
    <q-card-section class="aviso-sesion__contenido">
      <q-avatar
        class="aviso-sesion__icono"
        icon="lock_clock"
        size="64px"
        font-size="32px"
        aria-hidden="true"
      />

      <h2 :id="titleId" class="aviso-sesion__title">Tu sesión se cerró</h2>

      <!-- Una sola frase: qué pasó y qué hacer (revisión de UI, rebanada 1). -->
      <p class="aviso-sesion__texto">
        Se cerró por seguridad tras un tiempo sin actividad o porque venció. Vuelve a iniciar sesión
        para continuar.
      </p>

      <q-btn
        class="aviso-sesion__button control-touch boton-presionable"
        color="primary"
        no-caps
        unelevated
        icon="login"
        label="Ir al inicio de sesión"
        :to="{ name: 'login' }"
      >
        <q-tooltip>Abre la pantalla para volver a iniciar sesión.</q-tooltip>
      </q-btn>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useId } from 'vue'

import { vAparecer } from '../utils/aparecer.js'

const titleId = useId()
</script>

<style scoped>
.aviso-sesion {
  width: 100%;
  max-width: 440px;
  margin: 48px auto 0;
  border-radius: 16px;
  background: var(--dg-superficie);
  box-shadow: var(--dg-sombra-tarjeta);
  text-align: center;
}

.aviso-sesion__contenido {
  padding: 32px 24px 24px;
}

.aviso-sesion__icono {
  margin: 0 auto 16px;
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-borde);
}

.aviso-sesion__title {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  text-wrap: balance;
}

.aviso-sesion__texto {
  margin: 0 0 24px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
  text-wrap: pretty;
}

.aviso-sesion__button {
  width: 100%;
  min-height: 48px;
}

.aviso-sesion__button:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

@media (max-width: 599px) {
  .aviso-sesion {
    margin-top: 16px;
  }
}
</style>
