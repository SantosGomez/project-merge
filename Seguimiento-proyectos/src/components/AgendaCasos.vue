<template>
  <q-card flat bordered class="agenda-casos" role="region" aria-labelledby="agenda-casos-titulo">
    <q-card-section class="agenda-casos__cabecera">
      <h2 id="agenda-casos-titulo" class="agenda-casos__titulo">Tus próximos vencimientos</h2>
      <p class="agenda-casos__ayuda">
        Tus casos abiertos con el vencimiento más cercano, los vencidos primero. Haz clic en uno
        para editarlo o usa su botón para cambiarle el estado.
      </p>
    </q-card-section>

    <p v-if="casos.length === 0" class="agenda-casos__vacio">
      No tienes casos abiertos. Los que registres en «Mis casos» aparecerán aquí por fecha de
      vencimiento.
    </p>

    <q-list v-else separator class="agenda-casos__lista">
      <!-- Sin `tag`, TransitionGroup no agrega envoltorio: las filas siguen siendo hijas de la lista. -->
      <TransitionGroup name="agenda-salida">
        <q-item
          v-for="caso in casos"
          :key="caso.id"
          clickable
          class="agenda-casos__item"
          :aria-label="`${caso.cliente}, ${STATUS_LABELS[caso.estado]}, vence el ${fechaParaFormulario(caso.fecha_vencimiento)}: ${textoDiasPlazo(diasParaVencerCaso(caso, hoy))}. Editar el caso.`"
          @click="emit('editar', caso.id)"
        >
          <q-item-section>
            <q-item-label class="agenda-casos__cliente">{{ caso.cliente }}</q-item-label>
            <q-item-label caption>
              {{ STATUS_LABELS[caso.estado] }} · Vence
              {{ fechaParaFormulario(caso.fecha_vencimiento) }}
            </q-item-label>
          </q-item-section>

          <q-item-section side class="agenda-casos__lado">
            <PriorityTag :priority="caso.prioridad" />
            <span class="agenda-casos__plazo" :class="`agenda-casos__plazo--${urgencia(caso)}`">
              {{ textoDiasPlazo(diasParaVencerCaso(caso, hoy)) }}
            </span>
          </q-item-section>

          <!-- Cambio de estado sin abrir el formulario; .stop para no abrir también «Editar» -->
          <q-item-section v-if="accionRapidaEstado(caso.estado)" side class="agenda-casos__accion-seccion">
            <q-btn
              outline
              no-caps
              dense
              color="primary"
              class="agenda-casos__accion control-touch boton-presionable"
              :icon="accionRapidaEstado(caso.estado).icono"
              :label="accionRapidaEstado(caso.estado).etiqueta"
              :loading="cambiando === caso.id"
              :disable="cambiando !== null"
              :aria-label="`${accionRapidaEstado(caso.estado).etiqueta}: ${caso.cliente}`"
              @click.stop="emit('cambiarEstado', caso.id, accionRapidaEstado(caso.estado).estado)"
              @keydown.enter.stop
              @keydown.space.stop
            >
              <q-tooltip>{{ accionRapidaEstado(caso.estado).ayuda }}</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </TransitionGroup>
    </q-list>

    <q-card-actions v-if="totalAbiertos > casos.length" class="agenda-casos__mas">
      <q-btn
        flat
        no-caps
        color="primary"
        icon-right="arrow_forward"
        class="control-touch boton-presionable"
        :label="`Ver los ${totalAbiertos} casos abiertos`"
        :to="{ name: 'contador-casos', query: { filtro: 'abiertos' } }"
      >
        <q-tooltip>Abre «Mis casos» con todos tus casos abiertos.</q-tooltip>
      </q-btn>
    </q-card-actions>
  </q-card>
</template>
<script setup>
import PriorityTag from './PriorityTag.vue'
import { STATUS_LABELS } from '../utils/constants.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import {
  accionRapidaEstado,
  diasParaVencerCaso,
  esCasoProximoAVencer,
  esCasoVencido,
} from '../utils/filtrosCasos.js'
import { textoDiasPlazo } from '../utils/semaforoAuditoria.js'

/*
 * Agenda de «Mi resumen»: los casos abiertos que vencen antes, ya elegidos y ordenados por la
 * página (`agendaCasos`). Solo pinta; cada fila emite `editar` con el id del caso y su botón
 * `cambiarEstado` con el id y el estado siguiente.
 */
const props = defineProps({
  /** Casos internos del store, ya ordenados por vencimiento. */
  casos: { type: Array, default: () => [] },
  /** Fecha local de hoy en AAAA-MM-DD. */
  hoy: { type: String, required: true },
  /** Id del caso cuyo estado se está guardando; mientras tanto los botones se bloquean. */
  cambiando: { type: [Number, String], default: null },
  /** Cuántos casos abiertos hay en total; si son más que los de la agenda, se ofrece verlos todos. */
  totalAbiertos: { type: Number, default: 0 },
})

const emit = defineEmits(['editar', 'cambiarEstado'])

/** Color del plazo: rojo si ya venció, ámbar si vence en 3 días o menos. */
const urgencia = (caso) => {
  if (esCasoVencido(caso, props.hoy)) return 'vencido'
  if (esCasoProximoAVencer(caso, props.hoy)) return 'proximo'
  return 'normal'
}
</script>

<style scoped>
.agenda-casos {
  border-radius: 12px;
  background: var(--dg-fondo-panel);
}

.agenda-casos__cabecera {
  padding: 12px 16px 6px;
}

.agenda-casos__titulo {
  margin: 0 0 2px;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.agenda-casos__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.4;
}

.agenda-casos__vacio {
  margin: 0;
  padding: 8px 16px 16px;
  color: var(--dg-texto-tenue);
}

.agenda-casos__item {
  min-height: 56px;
}

.agenda-casos__cliente {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* Prioridad y plazo apilados a la derecha, alineados al final */
.agenda-casos__lado {
  align-items: flex-end;
  gap: 2px;
}

.agenda-casos__plazo {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.agenda-casos__plazo--vencido {
  color: var(--dg-error);
}

.agenda-casos__plazo--proximo {
  color: var(--dg-prioridad-media);
}

/* Al finalizar desde la agenda, la fila sale en 150 ms y las demás suben con la misma curva. */
.agenda-salida-leave-active {
  position: absolute;
  width: 100%;
  transition: opacity 150ms cubic-bezier(0.23, 1, 0.32, 1), transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}

.agenda-salida-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.agenda-salida-move {
  transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1);
}

.agenda-casos__lista {
  position: relative;
}

.agenda-casos__mas {
  padding: 4px 8px 8px;
}

/* En celular el botón baja a su propia línea para que el cliente tenga espacio. */
@media (max-width: 599px) {
  .agenda-casos__item {
    flex-wrap: wrap;
  }

  .agenda-casos__accion-seccion {
    flex-basis: 100%;
    align-items: flex-start;
    padding: 4px 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .agenda-salida-leave-active,
  .agenda-salida-move {
    transition: opacity 150ms linear;
  }

  .agenda-salida-leave-to {
    transform: none;
  }
}
</style>
