<template>
  <section class="error-state" role="alert" :aria-labelledby="titleId">
    <h2 :id="titleId" class="error-state__title">{{ title }}</h2>

    <!-- Un mensaje de error siempre contiene las tres partes de RNF-1. -->
    <p class="error-state__part">
      <strong class="error-state__part-label">Qué ocurrió:</strong>
      la maqueta intentó obtener los datos de esta pantalla y la carga no terminó bien.
    </p>

    <p class="error-state__part">
      <strong class="error-state__part-label">Sobre qué dato o acción:</strong>
      {{ detail }}
    </p>

    <p class="error-state__part">
      <strong class="error-state__part-label">Qué hacer:</strong>
      pulsa «{{ retryLabel }}» para repetir la carga; si el error continúa, recarga la página para
      volver a los datos de ejemplo.
    </p>

    <q-btn
      class="error-state__button control-touch"
      color="primary"
      no-caps
      icon="refresh"
      :label="retryLabel"
      @click="emit('retry')"
    />
  </section>
</template>

<script setup>
import { useId } from 'vue'

/*
 * Mensaje de error de una pantalla con datos (RF-37, RNF-1).
 * El texto de las tres partes está fijo aquí para que ningún mensaje se quede en un "Error";
 * la pantalla solo indica sobre qué dato o acción falló la carga.
 */
defineProps({
  /** Qué falló, en una frase (parte "qué ocurrió" de RNF-1). */
  title: {
    type: String,
    default: 'No se pudieron cargar los datos',
  },
  /** Dato o acción sobre el que falló la carga (parte "sobre qué" de RNF-1). */
  detail: {
    type: String,
    default: 'la información que esta pantalla necesitaba mostrar.',
  },
  /** Texto del botón de reintento; se mantiene igual en toda la interfaz (RNF-1). */
  retryLabel: {
    type: String,
    default: 'Reintentar',
  },
})

const emit = defineEmits(['retry'])

const titleId = useId()
</script>

<style scoped>
.error-state {
  padding: 24px 16px;
  border: 1px solid #e6b4b8;
  border-left: 6px solid #a3231b;
  border-radius: 12px;
  background: #fdecea;
}

.error-state__title {
  margin: 0 0 12px;
  color: #7a1f1a;
  font-size: 1.15rem;
}

.error-state__part {
  margin: 0 0 8px;
  color: #4a2c29;
  font-size: 0.95rem;
  line-height: 1.5;
}

.error-state__part-label {
  color: #7a1f1a;
}

.error-state__button {
  min-width: 44px;
  min-height: 44px;
  margin-top: 12px;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-8). */
.error-state__button:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}
</style>
