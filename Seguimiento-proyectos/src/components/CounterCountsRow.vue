<template>
  <li class="counter-row-item">
    <div class="counter-row" :class="{ 'counter-row--selected': selected }">
      <button
        type="button"
        class="counter-row__select"
        :aria-pressed="selected"
        @click="emit('select')"
      >
        <span class="counter-row__identity">
          <span class="counter-row__name">{{ counter.name }}</span>
          <span v-if="selected" class="counter-row__selected-mark">Seleccionado</span>
        </span>
      </button>

      <span class="counter-row__counts">
        <button
          v-for="status in STATUSES"
          :key="status"
          type="button"
          class="counter-row__count"
          :class="{ 'counter-row__count--activo': estadoActivo === status }"
          :aria-pressed="estadoActivo === status ? 'true' : 'false'"
          :aria-label="`${STATUS_LABELS[status]}: ${counts[status] ?? 0}. ${ayudaConteo(status)}`"
          @click="emit('filtrar', status)"
        >
          <span class="counter-row__count-value">{{ counts[status] ?? 0 }}</span>
          <span class="counter-row__count-label">{{ STATUS_LABELS[status] }}</span>

          <!-- Ayuda contextual de cada conteo: qué cuenta y que filtra al tocarlo (RNF-03). -->
          <q-tooltip v-if="ayudaConteo(status)">{{ ayudaConteo(status) }}</q-tooltip>
        </button>
      </span>
    </div>
  </li>
</template>

<script setup>
import { STATUS_LABELS, STATUSES } from '../utils/constants.js'
import { ayudaConteo } from '../utils/filasVista.js'

/*
 * Fila de un contador en P-2 (RF-12, RF-13, RF-15, RNF-03): nombre completo, sus tres conteos
 * por estado (también el "0") y la selección del contador cuyo detalle se muestra.
 * El componente no decide qué contador está seleccionado ni cuenta casos: recibe los
 * conteos ya calculados y avisa con un evento. El nombre nunca se recorta (RNF-08).
 *
 * El botón del nombre selecciona al contador con todos sus casos. Cada conteo es otro botón:
 * selecciona al contador y filtra su detalle por ese estado (`filtrar`). Quedan fuera del botón
 * del nombre para que cada uno reciba foco y muestre su ayuda con teclado, puntero y toque (RNF-03).
 */
defineProps({
  /** Contador: `{ id, name }`. */
  counter: {
    type: Object,
    required: true,
  },
  /** Conteos por estado ya calculados; las tres claves están siempre presentes (RF-12). */
  counts: {
    type: Object,
    required: true,
  },
  /** Indica si este contador es el que se está viendo en el detalle (RF-13, RF-15). */
  selected: {
    type: Boolean,
    default: false,
  },
  /** Estado por el que se está filtrando el detalle de este contador, o null. */
  estadoActivo: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['select', 'filtrar'])
</script>

<style scoped>
.counter-row-item {
  margin: 0;
}

.counter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid #c9d4e0;
  border-radius: 10px;
  background: #ffffff;
  color: #102a43;
}

.counter-row:hover {
  border-color: #1f5f99;
  background: #f0f6fc;
}

/* Control de selección de la fila: nombre y marca; área táctil de 44 px de alto (RNF-02). */
.counter-row__select {
  display: flex;
  flex: 1 1 180px;
  flex-direction: column;
  align-items: flex-start;
  align-self: stretch;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

/* El foco de teclado siempre es visible (RNF-07). */
.counter-row__select:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

/* El contador seleccionado se distingue también con texto, no solo con color. */
.counter-row--selected {
  border-color: #1f5f99;
  background: #e6f0fb;
  box-shadow: inset 4px 0 0 #1f5f99;
}

.counter-row__identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.counter-row__name {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.counter-row__selected-mark {
  color: #1f5f99;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.counter-row__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.counter-row__count {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  min-height: 44px;
  padding: 4px 8px;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  background: #f4f7fb;
  font: inherit;
  cursor: pointer;
}

.counter-row__count:hover {
  border-color: #1f5f99;
  background: #ffffff;
}

/* Conteo por el que se filtra el detalle: borde y fondo azules, además de aria-pressed. */
.counter-row__count--activo,
.counter-row__count--activo:hover {
  border-color: #1f5f99;
  background: #1f5f99;
}

.counter-row__count--activo .counter-row__count-value,
.counter-row__count--activo .counter-row__count-label {
  color: #ffffff;
}

/* Cada conteo es un botón con foco visible (RNF-03, RNF-07). */
.counter-row__count:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

.counter-row__count-value {
  color: #102a43;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.2;
}

.counter-row__count-label {
  color: #334e68;
  font-size: 0.72rem;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
