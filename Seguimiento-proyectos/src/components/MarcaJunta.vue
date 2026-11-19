<template>
  <span
    class="marca-junta"
    :class="[`marca-junta--${detalle.tono}`, { 'marca-junta--solo-icono': soloIcono }]"
    :role="soloIcono ? 'img' : undefined"
    :aria-label="soloIcono ? texto : undefined"
  >
    <q-icon v-if="detalle.icono" :name="detalle.icono" size="12px" aria-hidden="true" />
    <span v-if="!soloIcono" class="marca-junta__texto">{{ texto }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue'

import { detalleDeMarca } from '../utils/juntas.js'

/*
 * Píldora con icono y texto de una marca de la junta («Responder», «Por confirmar», «Cancelada»,
 * «Privada», «Solo tú»…). El color refuerza, nunca es el único indicador: siempre hay icono y texto.
 * En modo `solo-icono` (bloques angostos) se ve solo el icono y el texto queda en el `aria-label`.
 */
const props = defineProps({
  /** Texto de la marca, tal como lo devuelve `marcasDeJunta`. */
  texto: { type: String, required: true },
  /** Solo el icono; el texto se conserva en el `aria-label`. */
  soloIcono: { type: Boolean, default: false },
})

const detalle = computed(() => detalleDeMarca(props.texto))
</script>

<style scoped>
.marca-junta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  height: 16px;
  padding: 0 6px 0 4px;
  border: 1px solid var(--dg-neutro-borde);
  border-radius: 999px;
  background: var(--dg-superficie);
  color: var(--dg-texto-secundario);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.marca-junta--solo-icono {
  padding: 0 3px;
}

.marca-junta--acento {
  border-color: var(--dg-acento);
  background: var(--dg-acento);
  color: var(--dg-superficie);
}

.marca-junta--error {
  border-color: var(--dg-error);
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.marca-junta--aviso {
  border-color: var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}
</style>
