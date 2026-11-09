<template>
  <section class="aviso-sesion" role="alert" :aria-labelledby="titleId">
    <h2 :id="titleId" class="aviso-sesion__title">Tu sesión se cerró</h2>

    <!-- Una sola frase: qué pasó y qué hacer (revisión de UI, rebanada 1). -->
    <p class="aviso-sesion__texto">
      Se cerró por seguridad tras un tiempo sin actividad o porque venció. Vuelve a iniciar sesión para continuar.
    </p>

    <q-btn
      class="aviso-sesion__button control-touch boton-presionable"
      color="primary"
      no-caps
      icon="login"
      label="Ir al inicio de sesión"
      :to="{ name: 'login' }"
    >
      <q-tooltip>Abre la pantalla para volver a iniciar sesión.</q-tooltip>
    </q-btn>
  </section>
</template>

<script setup>
import { useId } from 'vue'

const titleId = useId()
</script>

<style scoped>
.aviso-sesion {
  max-width: 560px;
  margin: 0 auto;
  padding: 8px 0;
  text-align: center;
}

.aviso-sesion__title {
  margin: 0 0 12px;
  color: var(--dg-error-oscuro);
  font-size: clamp(1.3rem, 5vw, 1.6rem);
  line-height: 1.2;
}

.aviso-sesion__texto {
  margin: 0 0 8px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
}

.aviso-sesion__button {
  min-width: 44px;
  min-height: 44px;
  margin-top: 12px;
}

.aviso-sesion__button:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

</style>
