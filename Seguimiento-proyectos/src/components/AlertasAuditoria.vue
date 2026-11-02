<template>
  <q-card
    v-if="alertas.length > 0"
    flat
    bordered
    class="alertas-auditoria"
    role="region"
    aria-labelledby="alertas-auditoria-titulo"
  >
    <q-card-section class="alertas-auditoria__cabecera">
      <q-icon name="warning_amber" size="sm" class="alertas-auditoria__icono" aria-hidden="true" />
      <h3 id="alertas-auditoria-titulo" class="alertas-auditoria__titulo">
        {{ alertas.length === 1 ? 'Tienes 1 auditoría' : `Tienes ${alertas.length} auditorías` }}
        que requieren atención
      </h3>
    </q-card-section>

    <q-list separator class="alertas-auditoria__lista">
      <q-item
        v-for="alerta in alertas"
        :key="alerta.id"
        clickable
        class="alertas-auditoria__item"
        :aria-label="`${alerta.cliente}, ${alerta.semaforo}: ${textoDiasPlazo(alerta.diasParaVencer)}. Abrir su ficha.`"
        @click="emit('irFicha', alerta.id)"
      >
        <q-item-section side>
          <q-badge
            rounded
            class="semaforo-etiqueta"
            :class="`semaforo--${claseSemaforo(alerta.semaforo)}`"
            :label="alerta.semaforo"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label class="alertas-auditoria__cliente">
            {{ alerta.cliente }}
            <span class="alertas-auditoria__expediente">· Exp. {{ alerta.noExpediente }}</span>
          </q-item-label>
          <q-item-label caption>
            <template v-if="alerta.queVence">{{ alerta.queVence }}: </template>
            {{ textoDiasPlazo(alerta.diasParaVencer) }}
          </q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-icon name="chevron_right" aria-hidden="true" />
        </q-item-section>
        <q-tooltip>{{ AYUDA_SEMAFORO[alerta.semaforo] }} Toca para abrir su ficha.</q-tooltip>
      </q-item>
    </q-list>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

import { alertasAuditoria } from '../utils/listaAuditorias.js'
import { AYUDA_SEMAFORO, claseSemaforo, textoDiasPlazo } from '../utils/semaforoAuditoria.js'

/*
 * Alertas de «Mi resumen»: las auditorías del contador con semáforo Vencido o Crítico, las más
 * urgentes primero. Recibe la lista que ya cargó el tablero; cada fila emite `irFicha` con su id.
 * Sin alertas no se muestra nada.
 */
const props = defineProps({
  /** Auditorías ya traducidas por auditoriaService (con `semaforo` y `diasParaVencer`). */
  auditorias: { type: Array, default: () => [] },
})

const emit = defineEmits(['irFicha'])

const alertas = computed(() => alertasAuditoria(props.auditorias))
</script>

<style scoped>
.alertas-auditoria {
  border-left: 4px solid var(--dg-error);
  border-radius: 12px;
  background: var(--dg-error-fondo-suave);
}

.alertas-auditoria__cabecera {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 4px;
}

.alertas-auditoria__icono {
  color: var(--dg-error);
}

.alertas-auditoria__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.alertas-auditoria__lista {
  max-height: 260px;
  overflow-y: auto;
}

.alertas-auditoria__item {
  min-height: 52px;
}

.alertas-auditoria__cliente {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.alertas-auditoria__expediente {
  color: var(--dg-texto-tenue);
  font-weight: 400;
}
</style>
