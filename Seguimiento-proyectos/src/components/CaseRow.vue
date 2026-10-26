<template>
  <li class="case-row" :class="{ 'case-row--readonly': readonly }">
    <div class="case-row__main">
      <p class="case-row__client">{{ caseItem.client }}</p>
      <p v-if="caseItem.description" class="case-row__description" :title="caseItem.description">
        {{ caseItem.description }}
      </p>

      <dl class="case-row__meta">
        <div class="case-row__meta-item">
          <dt class="case-row__meta-label">Estado</dt>
          <dd class="case-row__meta-value">
            <span
              class="case-row__status"
              tabindex="0"
              :aria-label="estadoAccesible"
            >
              {{ statusLabel }}

              <!-- Ayuda contextual del estado: puntero, teclado y toque (RNF-03). -->
              <q-tooltip v-if="statusTooltip">{{ statusTooltip }}</q-tooltip>
            </span>
          </dd>
        </div>

        <div class="case-row__meta-item">
          <dt class="case-row__meta-label">Prioridad</dt>
          <dd class="case-row__meta-value">
            <PriorityTag :priority="caseItem.priority" />
          </dd>
        </div>

        <div v-if="caseItem.startDate" class="case-row__meta-item">
          <dt class="case-row__meta-label">Inicio</dt>
          <dd class="case-row__meta-value">{{ caseItem.startDate }}</dd>
        </div>

        <div v-if="caseItem.dueDate" class="case-row__meta-item">
          <dt class="case-row__meta-label">Vence</dt>
          <dd class="case-row__meta-value">
            <span class="case-row__due" tabindex="0">
              {{ caseItem.dueDate }}
              <q-tooltip>Fecha límite calculada en días hábiles según la prioridad.</q-tooltip>
            </span>
          </dd>
        </div>
      </dl>
    </div>

    <!--
      Zona de acciones prevista para P-5 (T10): allí se añaden los selectores de estado
      y prioridad sin duplicar esta fila. P-2 no pasa el slot, así que queda en solo lectura.
    -->
    <div v-if="!readonly && $slots.actions" class="case-row__actions">
      <slot name="actions" :item="caseItem" />
    </div>
  </li>
</template>

<script setup>
import { computed } from 'vue'

import PriorityTag from './PriorityTag.vue'
import { formatearEstado } from '../utils/formateadores.js'
import { estadoABackend } from '../utils/traduccionBackend.js'
import { STATUS_LABELS } from '../utils/constants.js'

/*
 * Fila de un caso (RF-13, RF-28, RF-29, RNF-08, RNF-03): cliente completo, estado y etiqueta
 * de prioridad. En P-2 se usa en modo solo lectura y no ofrece ningún control de edición
 * (RF-13, RF-15). La zona `actions` queda preparada para los selectores de P-5 sin crear otra fila.
 */
const props = defineProps({
  /** Fila de `casoAFila`: `{ id, client, status, priority, counterId, startDate, dueDate, description }`. */
  caseItem: {
    type: Object,
    required: true,
  },
  /** Solo lectura: ni siquiera se muestra la zona de acciones (RF-13, RF-15). */
  readonly: {
    type: Boolean,
    default: false,
  },
})

/** Etiqueta en español del estado; el estado nunca se comunica solo con color. */
const statusLabel = computed(() => STATUS_LABELS[props.caseItem.status] ?? props.caseItem.status)

/** Ayuda contextual del estado: qué significa cada uno (RNF-03). */
const statusTooltip = computed(
  () => formatearEstado(estadoABackend(props.caseItem.status))?.tooltip ?? '',
)

/** Nombre accesible del estado: el texto visible y, cuando existe, la ayuda contextual. */
const estadoAccesible = computed(() =>
  statusTooltip.value === ''
    ? `Estado ${statusLabel.value}`
    : `Estado ${statusLabel.value}. ${statusTooltip.value}`,
)
</script>

<style scoped>
.case-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 16px;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 10px;
  background: #ffffff;
}

.case-row--readonly {
  border-left: 4px solid #9fb3c8;
}

.case-row__main {
  flex: 1 1 220px;
  min-width: 0;
}

.case-row__client {
  margin: 0 0 8px;
  color: #102a43;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

/* La descripción completa queda en el title; en la fila se recorta a dos líneas. */
.case-row__description {
  display: -webkit-box;
  margin: -4px 0 8px;
  overflow: hidden;
  color: #486581;
  font-size: 0.9rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.case-row__due {
  cursor: help;
}

.case-row__due:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

.case-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  margin: 0;
}

.case-row__meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.case-row__meta-label {
  color: #486581;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.case-row__meta-value {
  margin: 0;
  color: #102a43;
  font-size: 0.95rem;
  line-height: 1.3;
}

/* El estado recibe foco para que su ayuda se lea con teclado, con foco siempre visible (RNF-03, RNF-07). */
.case-row__status {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  cursor: help;
}

.case-row__status:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

/* Área táctil de 44 px de alto para la ayuda (RNF-02) sin cambiar el aspecto de la fila. */
.case-row__status::after {
  content: '';
  position: absolute;
  inset: -10px 0;
}

.case-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}
</style>
