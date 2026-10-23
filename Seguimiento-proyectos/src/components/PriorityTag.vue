<template>
  <span class="priority-tag" :class="colorClass" tabindex="0" :aria-label="etiquetaAccesible">
    <span class="priority-tag__text">{{ label }}</span>

    <!-- Ayuda contextual: se muestra con puntero, con foco de teclado y con toque (RNF-03). -->
    <q-tooltip v-if="tooltip">{{ tooltip }}</q-tooltip>
  </span>
</template>

<script setup>
import { computed } from 'vue'

import { formatearPrioridad } from '../utils/formateadores.js'
import { prioridadABackend } from '../utils/traduccionBackend.js'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../utils/constants.js'

/*
 * Etiqueta de prioridad de un caso (RF-20, RF-29, RNF-06, RNF-07, RNF-03).
 * El texto es siempre visible y acompaña al color: el color nunca es el único
 * portador del significado. La etiqueta no decide reglas de negocio, solo pinta
 * la prioridad que recibe por prop y explica qué significa (RNF-03).
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

/** El color de cada prioridad sale de las constantes; aquí solo se aplica su tono accesible. */
const colorClass = computed(() => {
  const colorName = PRIORITY_COLORS[props.priority]

  return colorName === undefined ? 'priority-tag--unknown' : `priority-tag--${colorName}`
})

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
.priority-tag {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
  cursor: help;
}

/*
 * La etiqueta recibe foco para que su ayuda se lea también con teclado (RNF-03, RNF-07);
 * el foco siempre es visible.
 */
.priority-tag:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

/*
 * Área táctil de 44 px de alto para la ayuda (RNF-02) sin cambiar el aspecto de la
 * etiqueta ni tapar los controles que están a su lado.
 */
.priority-tag::after {
  content: '';
  position: absolute;
  inset: -9px 0;
}

.priority-tag__text {
  white-space: nowrap;
}

/*
 * Contraste texto/fondo comprobado con la fórmula de la WCAG 2 (RNF-7):
 * Alta 5.56:1, Media 5.51:1 y Baja 6.93:1, todas iguales o superiores a 4.5:1.
 * Son los tonos accesibles de los colores rojo, ámbar y verde de PRIORITY_COLORS;
 * el borde lleva el contraste de elementos no textuales (mínimo 3:1) de cada tono.
 */
.priority-tag--red {
  border-color: #c2655f;
  background: #fde7e9;
  color: #b71c1c;
}

.priority-tag--amber {
  border-color: #a97c14;
  background: #fff4d6;
  color: #8a5800;
}

.priority-tag--green {
  border-color: #3f6b4d;
  background: #e6f4ea;
  color: #1b5e20;
}

/* Prioridad no prevista: gris neutro, también con contraste suficiente. */
.priority-tag--unknown {
  border-color: #6b7a8d;
  background: #eceff4;
  color: #334e68;
}
</style>
