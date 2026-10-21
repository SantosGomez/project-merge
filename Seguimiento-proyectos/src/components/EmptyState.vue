<template>
  <section class="empty-state" role="status" :aria-labelledby="titleId">
    <h2 :id="titleId" class="empty-state__title">{{ title }}</h2>
    <p class="empty-state__message">{{ message }}</p>

    <div v-if="$slots.action" class="empty-state__action">
      <slot name="action" />
    </div>

    <!-- Control de acción opcional sin slot, para pantallas que solo necesitan un botón. -->
    <div v-else-if="actionLabel" class="empty-state__action">
      <q-btn
        class="empty-state__button control-touch"
        color="primary"
        no-caps
        :label="actionLabel"
        @click="emit('action')"
      />
    </div>
  </section>
</template>

<script setup>
import { useId } from 'vue'

/*
 * Mensaje de vacío de una pantalla (RF-36): dice qué información falta y ofrece,
 * cuando hace falta, un control para resolverlo (RF-14, RF-34).
 * El texto concreto lo decide la pantalla, porque es distinto en cada estado vacío.
 */
defineProps({
  /** Qué es lo que falta; se muestra como título del aviso. */
  title: {
    type: String,
    default: 'Sin información que mostrar',
  },
  /** Qué información falta y por qué no hay nada que mostrar (RF-36). */
  message: {
    type: String,
    default: 'No hay información que mostrar en esta pantalla.',
  },
  /** Etiqueta del control de acción, para pantallas que no necesitan un slot propio. */
  actionLabel: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['action'])

const titleId = useId()
</script>

<style scoped>
.empty-state {
  padding: 24px 16px;
  border: 1px dashed #b9c4d0;
  border-radius: 12px;
  background: #f7f9fc;
  text-align: center;
}

.empty-state__title {
  margin: 0 0 8px;
  color: #102a43;
  font-size: 1.15rem;
}

.empty-state__message {
  max-width: 40em;
  margin: 0 auto;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.empty-state__action {
  margin-top: 16px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

/* El botón de Quasar trae la clase `no-outline`; el foco se refuerza a propósito (RNF-8). */
.empty-state__button:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}
</style>
