<template>
  <span class="priority-tag" :class="colorClass">
    <span class="priority-tag__text">{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

import { PRIORITY_COLORS, PRIORITY_LABELS } from '../utils/constants.js'

/*
 * Etiqueta de prioridad de un caso (RF-20, RF-29, RNF-7).
 * El texto es siempre visible y acompaña al color: el color nunca es el único
 * portador del significado. La etiqueta no decide reglas de negocio, solo pinta
 * la prioridad que recibe por prop.
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
</script>

<style scoped>
.priority-tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 2px 10px;
  border: 1px solid;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.2;
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
