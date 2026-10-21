<template>
  <li class="case-row" :class="{ 'case-row--readonly': readonly }">
    <div class="case-row__main">
      <p class="case-row__client">{{ caseItem.client }}</p>

      <dl class="case-row__meta">
        <div class="case-row__meta-item">
          <dt class="case-row__meta-label">Estado</dt>
          <dd class="case-row__meta-value">{{ statusLabel }}</dd>
        </div>

        <div class="case-row__meta-item">
          <dt class="case-row__meta-label">Prioridad</dt>
          <dd class="case-row__meta-value">
            <PriorityTag :priority="caseItem.priority" />
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
import { STATUS_LABELS } from '../utils/constants.js'

/*
 * Fila de un caso (RF-13, RF-29, RNF-9): cliente completo, estado y etiqueta de prioridad.
 * En P-2 se usa en modo solo lectura y no ofrece ningún control de edición (RF-13, RF-15).
 * La zona `actions` queda preparada para los selectores de P-5 sin crear otra fila.
 */
const props = defineProps({
  /** Caso de ejemplo: `{ id, client, status, priority, counterId }`. */
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

.case-row__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}
</style>
