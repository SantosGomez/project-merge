<template>
  <q-item tag="li" class="counter-row-item">
    <div class="counter-row" :class="{ 'counter-row--selected': selected }">
      <q-btn
        flat
        no-caps
        align="left"
        padding="2px 0"
        :ripple="false"
        class="counter-row__select boton-presionable"
        :aria-pressed="selected"
        @click="emit('select')"
      >
        <span class="counter-row__identity">
          <span class="counter-row__name">{{ counter.name }}</span>
          <span v-if="selected" class="counter-row__selected-mark">Seleccionado</span>
          <q-badge
            v-if="cifra"
            rounded
            color="dg-acento"
            class="counter-row__cifra"
            :label="cifra"
          />
        </span>
      </q-btn>

      <span class="counter-row__counts">
        <q-btn
          v-for="status in STATUSES"
          :key="status"
          flat
          no-caps
          stack
          padding="4px 8px"
          :ripple="false"
          class="counter-row__count boton-presionable"
          :class="{ 'counter-row__count--activo': estadoActivo === status }"
          :aria-pressed="estadoActivo === status ? 'true' : 'false'"
          :aria-label="`${STATUS_LABELS[status]}: ${counts[status] ?? 0} casos importantes. Filtra el detalle.`"
          @click="emit('filtrar', status)"
        >
          <span class="counter-row__count-value">{{ counts[status] ?? 0 }}</span>
          <span class="counter-row__count-label">{{ STATUS_LABELS[status] }}</span>

          <!-- Ayuda contextual de cada conteo: qué cuenta y que filtra al tocarlo (RNF-03). -->
          <q-tooltip v-if="ayudaConteo(status)">{{ ayudaConteo(status) }}</q-tooltip>
        </q-btn>
      </span>
    </div>
  </q-item>
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
  /** Cifra del filtro de las tarjetas del dashboard («3 vencidos»), o null sin filtro. */
  cifra: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['select', 'filtrar'])
</script>

<style scoped>
/* q-item trae relleno y alto mínimo propios; la fila interior ya los define. */
.counter-row-item {
  min-height: 0;
  margin: 0;
  padding: 0;
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
  border: 1px solid var(--dg-borde-fuerte);
  border-radius: 10px;
  background: var(--dg-superficie);
  color: var(--dg-texto);
}

/* Solo con ratón y solo al pasar sobre el nombre: en táctil el hover se queda pegado. */
@media (hover: hover) and (pointer: fine) {
  .counter-row:not(.counter-row--selected):has(.counter-row__select:hover) {
    border-color: var(--dg-acento);
    background: var(--dg-fondo-hover);
  }

  .counter-row__count:hover {
    border-color: var(--dg-acento);
    background: var(--dg-superficie);
  }
}

/* Al elegir un contador o un conteo, el color cambia con suavidad. */
.counter-row,
.counter-row__count {
  transition: background-color 150ms var(--dg-curva-salida), border-color 150ms var(--dg-curva-salida), transform 120ms var(--dg-curva-salida);
}

/* Sin el sombreado de q-btn al pasar el puntero o al enfocar: el estado se marca con borde y fondo. */
.counter-row__select :deep(.q-focus-helper),
.counter-row__count :deep(.q-focus-helper) {
  display: none;
}

/* Control de selección de la fila: nombre y marca; área táctil de 44 px de alto (RNF-02). */
.counter-row__select {
  flex: 1 1 180px;
  align-self: stretch;
  min-width: 0;
  min-height: 44px;
  border-radius: 0;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
}

/* En táctil el nombre sí mide 44 px: la prop `padding` de q-btn escribe `min-height: 0` en línea
   y dejaba el botón en 26 px. Con ratón la fila conserva su alto compacto. */
@media (pointer: coarse) {
  .counter-row__select {
    min-height: 44px !important;
  }
}

/* El foco de teclado siempre es visible (RNF-07); q-btn trae `no-outline`. */
.counter-row__select:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/* El contador seleccionado se distingue también con texto, no solo con color. */
.counter-row--selected {
  border-color: var(--dg-acento);
  background: var(--dg-fondo-seleccion);
  box-shadow: inset 4px 0 0 var(--dg-acento);
}

.counter-row__identity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  text-align: left;
}

.counter-row__name {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.counter-row__selected-mark {
  color: var(--dg-acento);
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
  min-width: 68px;
  min-height: 44px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-suave);
  font-size: inherit;
  font-weight: 400;
  line-height: inherit;
}


/* Conteo por el que se filtra el detalle: borde y fondo azules, además de aria-pressed. */
.counter-row__count--activo,
.counter-row__count--activo:hover {
  border-color: var(--dg-acento);
  background: var(--dg-acento);
}

.counter-row__count--activo .counter-row__count-value,
.counter-row__count--activo .counter-row__count-label {
  color: var(--dg-superficie);
}

/* Cada conteo es un botón con foco visible (RNF-03, RNF-07). */
.counter-row__count:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.counter-row__count-value {
  color: var(--dg-texto);
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.2;
}

.counter-row__count-label {
  color: var(--dg-texto-secundario);
  font-size: 0.75rem;
  line-height: 1.2;
  white-space: nowrap;
}
</style>
