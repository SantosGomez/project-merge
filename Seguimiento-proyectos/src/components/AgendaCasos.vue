<template>
  <q-card flat bordered class="agenda-casos" role="region" aria-labelledby="agenda-casos-titulo">
    <q-card-section class="agenda-casos__cabecera">
      <h3 id="agenda-casos-titulo" class="agenda-casos__titulo">Lo que vence pronto</h3>
      <p class="agenda-casos__ayuda">
        Tus casos abiertos que vencen antes, los vencidos primero. Toca uno para editarlo.
      </p>
    </q-card-section>

    <p v-if="casos.length === 0" class="agenda-casos__vacio">No tienes casos abiertos.</p>

    <q-list v-else separator class="agenda-casos__lista">
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

        <q-tooltip>Abre el formulario para editar este caso.</q-tooltip>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup>
import PriorityTag from './PriorityTag.vue'
import { STATUS_LABELS } from '../utils/constants.js'
import { fechaParaFormulario } from '../utils/fechasCaso.js'
import { diasParaVencerCaso, esCasoProximoAVencer, esCasoVencido } from '../utils/filtrosCasos.js'
import { textoDiasPlazo } from '../utils/semaforoAuditoria.js'

/*
 * Agenda de «Mi resumen»: los casos abiertos que vencen antes, ya elegidos y ordenados por la
 * página (`agendaCasos`). Solo pinta; cada fila emite `editar` con el id del caso.
 */
const props = defineProps({
  /** Casos internos del store, ya ordenados por vencimiento. */
  casos: { type: Array, default: () => [] },
  /** Fecha local de hoy en AAAA-MM-DD. */
  hoy: { type: String, required: true },
})

const emit = defineEmits(['editar'])

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
</style>
