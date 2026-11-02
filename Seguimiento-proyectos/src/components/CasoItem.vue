<template>
  <q-item
    class="caso-item"
    :class="{
      'caso-item--importante': caso.important && !soloLectura,
      'caso-item--finalizado': esFinalizado,
    }"
  >
    <q-item-section v-if="!soloLectura" avatar class="caso-item__estrella">
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
        <span v-if="caso.important && !soloLectura" class="caso-item__importante" tabindex="0">
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
          :class="{ 'caso-item__vence--vencido': vencido }"
          tabindex="0"
        >
          <q-icon name="schedule" aria-hidden="true" /> Vence {{ caso.dueDate }}
          <strong v-if="vencido">· Vencido</strong>
          <q-tooltip>{{
            vencido
              ? 'La fecha de vencimiento ya pasó y el caso no está finalizado.'
              : 'Fecha límite calculada en días hábiles según la prioridad.'
          }}</q-tooltip>
        </span>
        <span v-if="caso.inProgressSince && !soloLectura" tabindex="0" class="caso-item__ayuda">
          <q-icon name="play_circle_outline" aria-hidden="true" /> En proceso desde {{ caso.inProgressSince }}
          <q-tooltip>Primer día en que el caso pasó a «En proceso».</q-tooltip>
        </span>
      </q-item-label>
    </q-item-section>

    <q-item-section v-if="soloLectura" side class="caso-item__acciones">
      <q-select
        v-if="puedeCambiarPrioridad"
        dense
        outlined
        :model-value="caso.priority"
        :options="opcionesPrioridad"
        option-label="label"
        option-value="value"
        emit-value
        map-options
        label="Prioridad"
        :aria-label="`Cambiar la prioridad del caso de ${caso.client}`"
        :disable="deshabilitado"
        class="caso-item__estado"
        @update:model-value="(prioridad) => emit('cambiar-prioridad', prioridad)"
      >
        <q-tooltip>Cambia la prioridad y avisa al contador. La fecha de vencimiento no cambia.</q-tooltip>
      </q-select>
      <span class="caso-item__estado-fijo" tabindex="0">
        {{ STATUS_LABELS[caso.status] ?? caso.status }}
        <q-tooltip>Pendiente: sin empezar. En proceso: en trabajo. Finalizado: terminado.</q-tooltip>
      </span>
    </q-item-section>

    <q-item-section v-else side class="caso-item__acciones">
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
        :color="esFinalizado ? 'dg-exito' : 'primary'"
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
import { computed } from 'vue'

import PriorityTag from './PriorityTag.vue'
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from '../utils/constants.js'

/*
 * Un caso de «Mis casos» como QItem: estrella de importante, datos del caso y acciones rápidas
 * (estado y Editar). La prioridad se ve como etiqueta y se cambia desde «Editar».
 * En `solo-lectura` (dashboard del administrador) el estado se muestra como texto y no se muestran
 * la estrella, «Importante», «Vencido» ni «En proceso desde»; con `puede-cambiar-prioridad`
 * aparece un selector de prioridad (el administrador la cambia y se avisa al contador).
 */
const props = defineProps({
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
  /** Sin controles de edición (vista de consulta del administrador). */
  soloLectura: {
    type: Boolean,
    default: false,
  },
  /** En la vista de consulta, el administrador puede cambiar la prioridad. */
  puedeCambiarPrioridad: {
    type: Boolean,
    default: false,
  },
})

const vencido = computed(() => Boolean(props.caso.vencido) && !props.soloLectura)

/*
 * El verde de Finalizado es solo del contador: en la vista de consulta del administrador
 * la fila se queda con sus colores neutros.
 */
const esFinalizado = computed(() => !props.soloLectura && props.caso.status === 'finalizado')

const emit = defineEmits(['alternar-importante', 'cambiar-estado', 'editar', 'cambiar-prioridad'])

const opcionesEstado = STATUSES.map((s) => ({ label: STATUS_LABELS[s], value: s }))
const opcionesPrioridad = PRIORITIES.map((p) => ({ label: PRIORITY_LABELS[p], value: p }))
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

/*
 * Un caso Finalizado se pinta en verde. Va después del ámbar para que el verde gane
 * cuando el caso sea además «Importante»; el texto «Finalizado» sigue visible, así que
 * el color nunca es el único indicador.
 */
.caso-item--finalizado {
  border-left-color: var(--dg-estado-finalizado);
  background: var(--dg-exito-fondo);
}

.caso-item--finalizado .caso-item__estado {
  color: var(--dg-exito);
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

.caso-item__estado-fijo {
  padding: 2px 10px;
  border: 1px solid #c9d4e0;
  border-radius: 999px;
  background: #f5f8fb;
  color: #102a43;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: help;
}

.caso-item__estado-fijo:focus-visible {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
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
