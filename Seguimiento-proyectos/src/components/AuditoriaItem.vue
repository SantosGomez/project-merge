<template>
  <q-card class="auditoria-item" :class="`auditoria-item--${semaforoClase}`" flat bordered>
    <q-card-section class="auditoria-item__head">
      <div class="auditoria-item__titulo">
        <span class="auditoria-item__cliente">{{ auditoria.cliente }}</span>
        <q-chip dense square class="auditoria-item__estado" :class="`auditoria-item__estado--${estadoClase}`">
          {{ auditoria.estado }}
          <q-tooltip>Estatus de la auditoría; se cambia con «Editar».</q-tooltip>
        </q-chip>
        <q-chip
          dense
          square
          icon="traffic"
          class="auditoria-item__semaforo"
          :class="`auditoria-item__semaforo--${semaforoClase}`"
        >
          {{ auditoria.semaforo }}
          <q-tooltip>{{ AYUDA_SEMAFORO[auditoria.semaforo] }}</q-tooltip>
        </q-chip>
      </div>
      <p class="auditoria-item__expediente">
        <q-icon name="folder_open" size="14px" aria-hidden="true" /> Expediente {{ auditoria.noExpediente }}
        <span class="auditoria-item__separador">·</span>
        {{ auditoria.tipoAud }}
        <span v-if="auditoria.estatal" class="auditoria-item__estatal">Estatal</span>
      </p>
    </q-card-section>

    <q-card-section class="auditoria-item__body">
      <p class="auditoria-item__proximo" :class="{ 'auditoria-item__proximo--vacio': !auditoria.proximoVencimiento }">
        <q-icon name="event" size="18px" aria-hidden="true" />
        <template v-if="auditoria.proximoVencimiento">
          <span>
            <strong>Próximo:</strong> {{ auditoria.queVence }} · vence {{ auditoria.proximoVencimiento }}
            <span class="auditoria-item__dias">({{ textoDias }})</span>
          </span>
        </template>
        <span v-else>Sin plazos pendientes en la bitácora</span>
      </p>

      <div class="auditoria-item__fases">
        <ol class="auditoria-item__puntos" :aria-label="`Avance: ${textoFase}`">
          <li
            v-for="numero in TOTAL_FASES"
            :key="numero"
            class="auditoria-item__punto"
            :class="{
              'auditoria-item__punto--cumplida': numero < faseActual,
              'auditoria-item__punto--actual': numero === faseActual,
            }"
            aria-hidden="true"
          />
        </ol>
        <span class="auditoria-item__fase-texto">{{ textoFase }}</span>
        <q-tooltip>Fase más avanzada registrada en la bitácora.</q-tooltip>
      </div>

      <p class="auditoria-item__secundario">
        <span>{{ auditoria.dependencia }}</span>
        <span>Periodo {{ auditoria.periodoInicio }} al {{ auditoria.periodoFinal }}</span>
        <span>Inicio {{ auditoria.fechaInicio }}</span>
        <span>Vence {{ auditoria.fechaVencimiento }}</span>
      </p>

      <p v-if="auditoria.descripcion" class="auditoria-item__descripcion">{{ auditoria.descripcion }}</p>

      <div class="auditoria-item__contadores">
        <q-icon name="group" size="16px" aria-hidden="true" />
        <q-chip
          v-for="nombre in nombresContadores"
          :key="nombre"
          dense
          outline
          color="dg-acento"
          class="auditoria-item__contador"
        >
          {{ nombre }}
        </q-chip>
        <span v-if="nombresContadores.length === 0" class="auditoria-item__sin-contador">Sin asignar</span>
      </div>
    </q-card-section>

    <q-card-actions align="right" class="auditoria-item__acciones">
      <q-btn
        flat
        no-caps
        dense
        color="dg-acento"
        icon="visibility"
        label="Ver ficha"
        class="control-touch"
        :disable="deshabilitado"
        @click="emit('ver-detalle')"
      >
        <q-tooltip>Abre la ficha con el avance por fase y la bitácora.</q-tooltip>
      </q-btn>
      <q-btn
        outline
        no-caps
        dense
        color="primary"
        icon="edit"
        label="Editar"
        class="control-touch"
        :disable="deshabilitado"
        @click="emit('editar')"
      >
        <q-tooltip>Abre el formulario para cambiar los datos de la auditoría.</q-tooltip>
      </q-btn>
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** Auditoría en la forma de las pantallas (auditoriaService). */
  auditoria: {
    type: Object,
    required: true,
  },
  /** Nombres de los contadores asignados a esta auditoría. */
  nombresContadores: {
    type: Array,
    default: () => [],
  },
  /** Mientras se guarda un cambio, no se aceptan otros. */
  deshabilitado: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['ver-detalle', 'editar'])

const TOTAL_FASES = 6

const ESTADO_CLASE = {
  Pendiente: 'pendiente',
  'En Proceso': 'en-proceso',
  Completado: 'completado',
  'Aplazado por acta': 'aplazado',
}

const SEMAFORO_CLASE = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
  Concluida: 'concluida',
}
const AYUDA_SEMAFORO = {
  Vencido: 'Un plazo pendiente de la bitácora ya pasó.',
  Crítico: 'Un plazo pendiente vence en 7 días o menos.',
  Atención: 'Un plazo vence en 20 días o menos, o a la autoridad le quedan 60 días o menos para concluir.',
  'En tiempo': 'Sin vencimientos cercanos.',
  Concluida: 'La auditoría está completada.',
}

const estadoClase = computed(() => ESTADO_CLASE[props.auditoria.estado] ?? 'pendiente')
const semaforoClase = computed(() => SEMAFORO_CLASE[props.auditoria.semaforo] ?? 'en-tiempo')

const faseActual = computed(() => props.auditoria.faseActual?.id ?? 1)

// «Fase 3 · Observaciones» → «Fase 3 de 6 · Observaciones».
const textoFase = computed(() => {
  const nombre = props.auditoria.faseActual?.nombre ?? ''
  const etapa = nombre.includes('·') ? nombre.slice(nombre.indexOf('·') + 1).trim() : nombre
  return `Fase ${faseActual.value} de ${TOTAL_FASES}${etapa ? ` · ${etapa}` : ''}`
})

const textoDias = computed(() => {
  const dias = props.auditoria.diasParaVencer
  if (dias === 0) return 'vence hoy'
  if (dias < 0) return `venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  return `en ${dias} ${dias === 1 ? 'día' : 'días'}`
})
</script>

<style scoped>
.auditoria-item {
  border-color: var(--dg-borde);
  border-left-width: 5px;
  background: var(--dg-superficie);
}

/* Franja del semáforo en el borde izquierdo */
.auditoria-item--vencido {
  border-left-color: var(--dg-error);
}

.auditoria-item--critico {
  border-left-color: var(--dg-prioridad-alta-borde);
}

.auditoria-item--atencion {
  border-left-color: var(--dg-importante);
}

.auditoria-item--en-tiempo {
  border-left-color: var(--dg-exito-borde);
}

.auditoria-item--concluida {
  border-left-color: var(--dg-neutro-borde);
}

.auditoria-item__head {
  padding-bottom: 4px;
}

.auditoria-item__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.auditoria-item__cliente {
  min-width: 0;
  margin-right: auto;
  color: var(--dg-texto);
  font-size: 1.05rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.auditoria-item__estado,
.auditoria-item__semaforo {
  margin: 0;
  font-weight: 600;
}

.auditoria-item__estado--pendiente {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.auditoria-item__estado--en-proceso {
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.auditoria-item__estado--completado {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.auditoria-item__estado--aplazado {
  background: var(--dg-error-fondo);
  color: var(--dg-error);
}

.auditoria-item__semaforo--vencido {
  background: var(--dg-error);
  color: var(--dg-superficie);
}

.auditoria-item__semaforo--critico {
  background: var(--dg-prioridad-alta-fondo);
  color: var(--dg-prioridad-alta);
  border: 1px solid var(--dg-prioridad-alta-borde);
}

.auditoria-item__semaforo--atencion {
  background: var(--dg-importante-fondo);
  color: var(--dg-importante-texto);
}

.auditoria-item__semaforo--en-tiempo {
  background: var(--dg-exito-fondo);
  color: var(--dg-exito);
}

.auditoria-item__semaforo--concluida {
  background: var(--dg-neutro-fondo);
  color: var(--dg-texto-secundario);
}

.auditoria-item__expediente {
  margin: 4px 0 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.auditoria-item__separador {
  margin: 0 4px;
}

.auditoria-item__estatal {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
  font-size: 0.75rem;
  font-weight: 600;
}

.auditoria-item__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

/* Lo que más importa: qué vence y cuándo */
.auditoria-item__proximo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--dg-fondo-suave);
  color: var(--dg-texto);
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}

.auditoria-item__proximo--vacio {
  color: var(--dg-texto-tenue);
}

.auditoria-item__dias {
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.auditoria-item__fases {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.auditoria-item__puntos {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.auditoria-item__punto {
  width: 12px;
  height: 12px;
  border: 2px solid var(--dg-borde-fuerte);
  border-radius: 50%;
  background: var(--dg-superficie);
}

.auditoria-item__punto--cumplida {
  border-color: var(--dg-acento);
  background: var(--dg-acento);
}

.auditoria-item__punto--actual {
  border-color: var(--dg-acento);
  background: var(--dg-fondo-seleccion);
  box-shadow: 0 0 0 2px var(--dg-fondo-seleccion);
}

.auditoria-item__fase-texto {
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
  font-weight: 600;
}

.auditoria-item__secundario {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.8rem;
}

/* Descripción recortada a dos líneas; completa al editar */
.auditoria-item__descripcion {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.auditoria-item__contadores {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: var(--dg-texto-tenue);
}

.auditoria-item__contador {
  margin: 0;
}

.auditoria-item__sin-contador {
  font-size: 0.85rem;
  font-style: italic;
}

.auditoria-item__acciones {
  gap: 8px;
  padding: 4px 12px 12px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}
</style>
