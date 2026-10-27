<template>
  <!--
    q-chip solo aplica tabindex cuando es clicable; por eso el foco, el nombre accesible y la
    ayuda van en el texto, que ocupa toda la etiqueta.
  -->
  <q-chip
    dense
    :ripple="false"
    :color="colorFondo"
    :text-color="colorTexto"
    class="priority-tag"
    :class="claseBorde"
  >
    <span class="priority-tag__text" tabindex="0" :aria-label="etiquetaAccesible">
      {{ label }}

      <!-- Ayuda contextual: se muestra con puntero, con foco de teclado y con toque (RNF-03). -->
      <q-tooltip v-if="tooltip">{{ tooltip }}</q-tooltip>
    </span>
  </q-chip>
</template>

<script setup>
import { computed } from 'vue'

import { formatearPrioridad } from '../utils/formateadores.js'
import { prioridadABackend } from '../utils/traduccionBackend.js'
import { PRIORITIES, PRIORITY_LABELS } from '../utils/constants.js'

/*
 * Etiqueta de prioridad de un caso (RF-20, RF-29, RNF-06, RNF-07, RNF-03).
 * El texto es siempre visible y acompaña al color: el color nunca es el único
 * portador del significado. La etiqueta no decide reglas de negocio, solo pinta
 * la prioridad que recibe por prop y explica qué significa (RNF-03).
 * Es un q-chip (no q-badge: su role="status" anunciaría cada etiqueta como un aviso).
 */
const props = defineProps({
  /** Prioridad del caso: 'alta', 'media' o 'baja' (PRIORITIES de las constantes). */
  priority: {
    type: String,
    required: true,
  },
})

/** Etiqueta en español de la prioridad recibida. */
const label = computed(() => PRIORITY_LABELS[props.priority] ?? props.priority)

const esConocida = computed(() => PRIORITIES.includes(props.priority))

/*
 * Colores de la paleta $dg-colores (contraste comprobado en contrastePrioridad.test.js);
 * una prioridad no prevista se pinta en gris neutro.
 */
const colorTexto = computed(() =>
  esConocida.value ? `dg-prioridad-${props.priority}` : 'dg-texto-secundario',
)
const colorFondo = computed(() =>
  esConocida.value ? `dg-prioridad-${props.priority}-fondo` : 'dg-neutro-fondo',
)
const claseBorde = computed(() =>
  esConocida.value ? `priority-tag--${props.priority}` : 'priority-tag--desconocida',
)

/** Ayuda contextual de la prioridad: qué significa cada una (RNF-03). */
const tooltip = computed(
  () => formatearPrioridad(prioridadABackend(props.priority))?.tooltip ?? '',
)

/** Nombre accesible: el texto visible y, cuando existe, la ayuda contextual. */
const etiquetaAccesible = computed(() =>
  tooltip.value === '' ? `Prioridad ${label.value}` : `Prioridad ${label.value}. ${tooltip.value}`,
)
</script>

<style scoped>
/* Medidas de la etiqueta anterior: q-chip trae otro alto, margen y tamaño de letra. */
.priority-tag {
  min-height: 26px;
  height: auto;
  margin: 0;
  padding: 0;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
}

/* El texto ocupa toda la etiqueta: es lo que recibe el foco, el puntero y el toque. */
.priority-tag__text {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
  cursor: help;
}

/*
 * La etiqueta recibe foco para que su ayuda se lea también con teclado (RNF-03, RNF-07);
 * el foco siempre es visible.
 */
.priority-tag__text:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 3px;
}

/*
 * Área táctil de 44 px de alto para la ayuda (RNF-02) sin cambiar el aspecto de la
 * etiqueta ni tapar los controles que están a su lado.
 */
.priority-tag__text::after {
  content: '';
  position: absolute;
  inset: -10px 0;
}

/* El borde es un elemento no textual: contraste de 3:1 con su fondo (WCAG 1.4.11). */
.priority-tag--alta {
  border-color: var(--dg-prioridad-alta-borde);
}

.priority-tag--media {
  border-color: var(--dg-prioridad-media-borde);
}

.priority-tag--baja {
  border-color: var(--dg-prioridad-baja-borde);
}

.priority-tag--desconocida {
  border-color: var(--dg-neutro-borde);
}
</style>
