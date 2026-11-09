<template>
  <div class="screen-loader" role="status">
    <q-spinner-dots class="screen-loader__spinner" color="primary" size="36px" aria-hidden="true" />
    <p class="screen-loader__text">{{ text }}</p>
  </div>
</template>

<script setup>
/*
 * Indicador de carga de una pantalla con datos (RF-35, RNF-8).
 * El aviso es texto, no solo una animación, para que se entienda también sin ver el giro.
 * Mientras se muestra, la pantalla no debe pintar datos anteriores ni incompletos.
 */
defineProps({
  /** Qué datos está obteniendo la pantalla (RF-35). */
  text: {
    type: String,
    default: 'Cargando la información de esta pantalla…',
  },
})
</script>

<style scoped>
.screen-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  text-align: center;
}

.screen-loader__text {
  max-width: 32em;
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.45;
}
</style>
