<template>
  <q-table
    class="auditorias-tabla"
    flat
    bordered
    aria-label="Auditorías"
    :rows="auditorias"
    :columns="columnas"
    row-key="id"
    v-model:pagination="paginacion"
    :rows-per-page-options="[10, 25, 50, 0]"
    rows-per-page-label="Filas por página"
    :pagination-label="(inicio, fin, total) => `${inicio}–${fin} de ${total}`"
    @row-click="(_evento, fila) => emit('ver-detalle', fila.id)"
  >
    <template #body-cell-semaforo="props">
      <q-td
        :props="props"
        class="auditorias-tabla__franja"
        :class="`semaforo--${claseSemaforo(props.row.semaforo)}`"
      >
        <q-chip
          dense
          square
          class="auditorias-tabla__semaforo semaforo-etiqueta"
          :class="`semaforo--${claseSemaforo(props.row.semaforo)}`"
        >
          {{ etiquetaSemaforo(props.row.semaforo) }}
          <q-tooltip>{{ AYUDA_SEMAFORO[props.row.semaforo] }}</q-tooltip>
        </q-chip>
      </q-td>
    </template>

    <template #body-cell-cliente="props">
      <q-td :props="props">
        <div class="auditorias-tabla__cliente">{{ props.row.cliente }}</div>
        <div class="auditorias-tabla__tenue">
          Expediente {{ props.row.noExpediente }}
          <span v-if="props.row.estatal" class="auditorias-tabla__estatal">Estatal</span>
        </div>
      </q-td>
    </template>

    <template #body-cell-estado="props">
      <q-td :props="props">
        <q-chip
          dense
          square
          class="auditorias-tabla__estado"
          :class="`auditorias-tabla__estado--${ESTADO_CLASE[props.row.estado] ?? 'pendiente'}`"
        >
          {{ etiquetaEstado(props.row.estado) }}
          <q-tooltip>Estado de la auditoría; se cambia con «Editar».</q-tooltip>
        </q-chip>
      </q-td>
    </template>

    <template #body-cell-fase="props">
      <q-td :props="props">
        <span class="auditorias-tabla__fase"
          >{{ props.row.faseActual?.id ?? 1 }} de {{ TOTAL_FASES }}</span
        >
        <div class="auditorias-tabla__tenue">{{ etapaDeFase(props.row.faseActual) }}</div>
        <q-tooltip>Fase más avanzada registrada en la bitácora.</q-tooltip>
      </q-td>
    </template>

    <template #body-cell-proximo="props">
      <q-td :props="props">
        <template v-if="props.row.proximoVencimiento">
          <div class="auditorias-tabla__proximo">{{ props.row.queVence }}</div>
          <div class="auditorias-tabla__tenue">
            {{ props.row.proximoVencimiento }} · {{ textoDiasPlazo(props.row.diasParaVencer) }}
          </div>
        </template>
        <span v-else class="auditorias-tabla__tenue">Sin plazos pendientes</span>
      </q-td>
    </template>

    <template #body-cell-contadores="props">
      <q-td :props="props">
        <span v-if="props.row.contadores.length === 0" class="auditorias-tabla__tenue"
          >Sin asignar</span
        >
        <div v-for="contador in props.row.contadores" :key="contador.id ?? contador.nombre">
          {{ contador.nombre }}
        </div>
      </q-td>
    </template>

    <template #body-cell-acciones="props">
      <q-td :props="props" class="auditorias-tabla__acciones">
        <!-- .stop: sin él, el clic también abriría la ficha (row-click) -->
        <q-btn
          flat
          round
          dense
          color="dg-acento"
          icon="forum"
          :aria-label="`Mensajes de ${props.row.cliente}`"
          aria-haspopup="dialog"
          class="control-touch boton-presionable"
          @click.stop="emit('abrir-chat', props.row)"
        >
          <q-tooltip>Abre el chat con el administrador y los contadores de esta auditoría.</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          color="dg-acento"
          icon="visibility"
          :aria-label="`Ver ficha de ${props.row.cliente}`"
          class="control-touch boton-presionable"
          @click.stop="emit('ver-detalle', props.row.id)"
        >
          <q-tooltip>Abre la ficha con el avance por fase y la bitácora.</q-tooltip>
        </q-btn>
        <q-btn
          flat
          round
          dense
          color="primary"
          icon="edit"
          :aria-label="`Editar ${props.row.cliente}`"
          class="control-touch boton-presionable"
          @click.stop="emit('editar', props.row.id)"
        >
          <q-tooltip>Abre el formulario para cambiar los datos de la auditoría.</q-tooltip>
        </q-btn>
      </q-td>
    </template>
  </q-table>
</template>

<script setup>
import { ref } from 'vue'

import {
  AYUDA_SEMAFORO,
  claseSemaforo,
  etiquetaSemaforo,
  etiquetaEstado,
  textoDiasPlazo,
} from '../utils/semaforoAuditoria.js'

defineProps({
  /** Auditorías ya filtradas y ordenadas por la página (auditoriaService). */
  auditorias: {
    type: Array,
    required: true,
  },
})

const emit = defineEmits(['ver-detalle', 'editar', 'abrir-chat'])

const TOTAL_FASES = 6

// Sin `sortable`: el orden lo decide «Ordenar por» de la página, igual que en las tarjetas.
const columnas = [
  { name: 'semaforo', label: 'Semáforo', field: 'semaforo', align: 'left' },
  { name: 'cliente', label: 'Cliente y expediente', field: 'cliente', align: 'left' },
  { name: 'tipo', label: 'Tipo', field: 'tipoAud', align: 'left' },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left' },
  { name: 'fase', label: 'Fase', field: (fila) => fila.faseActual?.id ?? 1, align: 'left' },
  { name: 'proximo', label: 'Próximo plazo', field: 'proximoVencimiento', align: 'left' },
  {
    name: 'contadores',
    label: 'Contadores',
    field: (fila) => fila.contadores.length,
    align: 'left',
  },
  { name: 'acciones', label: 'Acciones', field: 'id', align: 'right' },
]

const paginacion = ref({ page: 1, rowsPerPage: 25 })

const ESTADO_CLASE = {
  Pendiente: 'pendiente',
  'En Proceso': 'en-proceso',
  Completado: 'completado',
  'Aplazado por acta': 'aplazado',
}

// «Fase 3 · Observaciones» → «Observaciones».
const etapaDeFase = (fase) => {
  const nombre = fase?.nombre ?? ''
  return nombre.includes('·') ? nombre.slice(nombre.indexOf('·') + 1).trim() : nombre
}
</script>

<style scoped>
.auditorias-tabla {
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
}

.auditorias-tabla :deep(tbody tr) {
  cursor: pointer;
}

.auditorias-tabla :deep(th) {
  color: var(--dg-texto-secundario);
  font-weight: 700;
}

.auditorias-tabla :deep(td) {
  vertical-align: top;
  white-space: normal;
}

/* Franja del semáforo en el borde izquierdo de la fila, como en las tarjetas */
.auditorias-tabla__franja {
  box-shadow: inset 5px 0 0 var(--semaforo-color);
}

.auditorias-tabla__semaforo,
.auditorias-tabla__estado {
  margin: 0;
  font-weight: 600;
}

.auditorias-tabla__estado--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.auditorias-tabla__estado--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.auditorias-tabla__estado--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.auditorias-tabla__estado--aplazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.auditorias-tabla__cliente,
.auditorias-tabla__proximo {
  color: var(--dg-texto);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.auditorias-tabla__fase {
  color: var(--dg-texto);
  font-weight: 600;
}

.auditorias-tabla__tenue {
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

.auditorias-tabla__estatal {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
  font-size: 0.75rem;
  font-weight: 600;
}

.auditorias-tabla__acciones {
  white-space: nowrap;
}

</style>
