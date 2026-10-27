<template>
  <q-banner class="error-state" role="alert" :aria-labelledby="titleId">
    <h2 :id="titleId" class="error-state__title">{{ title }}</h2>

    <!--
      Si el detalle ya es un mensaje completo de tres partes (construirError o el backend),
      se muestra tal cual para no repetir las etiquetas. Si es una frase corta sobre qué falló,
      se envuelve en las tres partes de RNF-01.
    -->
    <template v-if="mensajeCompleto">
      <p class="error-state__part">{{ detail }}</p>
    </template>
    <template v-else>
      <p class="error-state__part">
        <strong class="error-state__part-label">Qué ocurrió:</strong>
        la pantalla intentó obtener los datos del servidor y la carga no terminó bien.
      </p>

      <p class="error-state__part">
        <strong class="error-state__part-label">Sobre qué dato o acción:</strong>
        {{ detail }}
      </p>

      <p class="error-state__part">
        <strong class="error-state__part-label">Qué hacer:</strong>
        pulsa «{{ retryLabel }}» para repetir la carga; si el error continúa, recarga la página.
      </p>
    </template>

    <template #action>
      <q-btn
        class="error-state__button control-touch"
        color="primary"
        no-caps
        icon="refresh"
        :label="retryLabel"
        @click="emit('retry')"
      />
    </template>
  </q-banner>
</template>

<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
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

/** El detalle ya trae las tres partes: se muestra tal cual, sin repetir etiquetas. */
const mensajeCompleto = computed(() => {
  const texto = String(props.detail ?? '')
  return texto.includes('Qué ocurrió:') && texto.includes('Qué hacer:')
})
</script>

<style scoped>
.error-state {
  padding: 24px 16px;
  border: 1px solid var(--dg-error-borde-suave);
  border-left: 6px solid var(--dg-error);
  border-radius: 12px;
  background: var(--dg-error-fondo);
}

/* La ranura de acción de q-banner va a la derecha; el botón queda alineado al texto. */
.error-state :deep(.q-banner__actions) {
  justify-content: flex-start;
  padding-left: 0;
}

.error-state :deep(.q-banner__actions .q-btn) {
  margin: 12px 0 0;
}

.error-state__title {
  margin: 0 0 12px;
  color: var(--dg-error-oscuro);
  font-size: 1.15rem;
}

.error-state__part {
  margin: 0 0 8px;
  color: var(--dg-error-texto);
  font-size: 0.95rem;
  line-height: 1.5;
}

.error-state__part-label {
  color: var(--dg-error-oscuro);
}

.error-state__button {
  min-width: 44px;
  min-height: 44px;
}

.error-state__button:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}
</style>
