<template>
  <q-item class="caso-item" :class="{ 'caso-item--importante': caso.important }">
    <q-item-section avatar class="caso-item__estrella">
      <q-btn
        flat
        round
        :color="caso.important ? 'amber-9' : 'grey-6'"
        :icon="caso.important ? 'star' : 'star_border'"
        :aria-pressed="caso.important ? 'true' : 'false'"
        :aria-label="
          caso.important
            ? `Quitar la marca de importante al caso de ${caso.client}`
            : `Marcar como importante el caso de ${caso.client}`
        "
        :disable="deshabilitado"
        class="control-touch"
        @click="emit('alternar-importante')"
      >
        <q-tooltip>{{
          caso.important ? 'Quitar la marca de caso importante.' : 'Marcar como caso importante.'
        }}</q-tooltip>
      </q-btn>
    </q-item-section>

    <q-item-section class="caso-item__datos">
      <q-item-label class="caso-item__cliente">
        <span class="caso-item__nombre">{{ caso.client }}</span>
        <span v-if="caso.important" class="caso-item__importante" tabindex="0">
          Importante
          <q-tooltip>Caso marcado como importante: requiere seguimiento especial.</q-tooltip>
        </span>
        <PriorityTag :priority="caso.priority" />
      </q-item-label>

      <q-item-label v-if="caso.description" caption lines="2" class="caso-item__descripcion" :title="caso.description">
        {{ caso.description }}
      </q-item-label>

      <q-item-label caption class="caso-item__fechas">
        <span v-if="caso.startDate"><q-icon name="event" aria-hidden="true" /> Inicio {{ caso.startDate }}</span>
        <span
          v-if="caso.dueDate"
          class="caso-item__vence"
          :class="{ 'caso-item__vence--vencido': caso.vencido }"
          tabindex="0"
        >
          <q-icon name="schedule" aria-hidden="true" /> Vence {{ caso.dueDate }}
          <strong v-if="caso.vencido">· Vencido</strong>
          <q-tooltip>{{
            caso.vencido
              ? 'La fecha de vencimiento ya pasó y el caso no está finalizado.'
              : 'Fecha límite calculada en días hábiles según la prioridad.'
          }}</q-tooltip>
        </span>
        <span v-if="caso.inProgressSince" tabindex="0" class="caso-item__ayuda">
          <q-icon name="play_circle_outline" aria-hidden="true" /> En proceso desde {{ caso.inProgressSince }}
          <q-tooltip>Primer día en que el caso pasó a «En proceso».</q-tooltip>
        </span>
      </q-item-label>
    </q-item-section>

    <q-item-section side class="caso-item__acciones">
      <q-select
        dense
        outlined
        :model-value="caso.status"
        :options="opcionesEstado"
        option-label="label"
        option-value="value"
        emit-value
        map-options
        label="Estado"
        :aria-label="`Cambiar estado del caso de ${caso.client}`"
        :disable="deshabilitado"
        class="caso-item__estado"
        @update:model-value="(estado) => emit('cambiar-estado', estado)"
      >
        <q-tooltip>Pendiente: sin empezar. En proceso: en trabajo. Finalizado: terminado.</q-tooltip>
      </q-select>
      <q-btn
        outline
        no-caps
        color="primary"
        icon="edit"
        label="Editar"
        aria-haspopup="dialog"
        :aria-label="`Editar el caso de ${caso.client}`"
        :disable="deshabilitado"
        class="control-touch"
        @click="emit('editar')"
      >
        <q-tooltip>Abre el formulario para cambiar la información del caso, incluida la prioridad.</q-tooltip>
      </q-btn>
    </q-item-section>
  </q-item>
</template>

<script setup>
import PriorityTag from './PriorityTag.vue'
import { STATUSES, STATUS_LABELS } from '../utils/constants.js'

/*
 * Un caso de «Mis casos» como QItem: estrella de importante, datos del caso y acciones rápidas
 * (estado y Editar). La prioridad se ve como etiqueta y se cambia desde «Editar».
 */
defineProps({
  /** Fila de `casoAFila` más `vencido` (boolean). */
  caso: {
    type: Object,
    required: true,
  },
  /** Mientras se guarda un cambio, no se aceptan otros. */
  deshabilitado: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['alternar-importante', 'cambiar-estado', 'editar'])

const opcionesEstado = STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s }))
</script>

<style scoped>
.caso-item {
  flex-wrap: wrap;
  gap: 8px 4px;
  padding: 12px;
  border-left: 4px solid transparent;
}

/* El ámbar acompaña a la etiqueta «Importante»: el color no es el único aviso. */
.caso-item--importante {
  border-left-color: #b45309;
  background: #fffaf0;
}

.caso-item__estrella {
  min-width: 44px;
  padding-right: 4px;
}

.caso-item__datos {
  flex: 1 1 260px;
  min-width: 0;
}

.caso-item__cliente {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: #102a43;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.caso-item__nombre {
  overflow-wrap: anywhere;
}

.caso-item__importante {
  padding: 1px 8px;
  border-radius: 999px;
  background: #fff4d6;
  color: #8a4b00;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: help;
}

.caso-item__descripcion {
  margin-top: 4px;
  color: #486581;
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.caso-item__fechas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 6px;
  color: #334e68;
  font-size: 0.85rem;
}

.caso-item__vence,
.caso-item__ayuda {
  cursor: help;
}

.caso-item__vence--vencido {
  color: #a3231b;
}

.caso-item__importante:focus-visible,
.caso-item__vence:focus-visible,
.caso-item__ayuda:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

.caso-item__acciones {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-left: 0;
}

.caso-item__estado {
  width: 150px;
}

/* En celular, las acciones bajan a su propia línea, alineadas con los datos. */
@media (max-width: 599px) {
  .caso-item__acciones {
    flex: 1 1 100%;
    justify-content: flex-start;
    padding-left: 48px;
  }
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>
