<template>
  <q-card class="auditoria-item" flat bordered>
    <q-card-section class="auditoria-item__head">
      <div class="auditoria-item__titulo">
        <span class="auditoria-item__cliente">{{ auditoria.cliente }}</span>
        <q-chip
          dense
          square
          class="auditoria-item__estado"
          :class="`auditoria-item__estado--${estadoClase}`"
        >
          {{ auditoria.estado }}
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
      <dl class="auditoria-item__datos">
        <div class="auditoria-item__dato">
          <dt>Dependencia</dt>
          <dd>{{ auditoria.dependencia }}</dd>
        </div>
        <div class="auditoria-item__dato">
          <dt>Periodo</dt>
          <dd>{{ auditoria.periodoInicio }} al {{ auditoria.periodoFinal }}</dd>
        </div>
        <div class="auditoria-item__dato">
          <dt>Inicio</dt>
          <dd>{{ auditoria.fechaInicio }}</dd>
        </div>
        <div class="auditoria-item__dato">
          <dt>Vencimiento</dt>
          <dd>{{ auditoria.fechaVencimiento }}</dd>
        </div>
        <div class="auditoria-item__dato auditoria-item__dato--ancho">
          <dt>Contadores asignados</dt>
          <dd>
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
          </dd>
        </div>
      </dl>

      <p v-if="auditoria.descripcion" class="auditoria-item__descripcion">{{ auditoria.descripcion }}</p>
    </q-card-section>

    <q-card-actions align="right" class="auditoria-item__acciones">
      <q-btn
        flat
        no-caps
        dense
        color="dg-acento"
        icon="visibility"
        label="Ver seguimiento"
        class="control-touch"
        :disable="deshabilitado"
        @click="emit('ver-detalle')"
      >
        <q-tooltip>Abre el historial de fases y seguimiento de la auditoría.</q-tooltip>
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
  /** Fila de auditoría (mock, forma del frontend). */
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

const ESTADO_CLASE = {
  Pendiente: 'pendiente',
  'En Proceso': 'en-proceso',
  Completado: 'completado',
  'Aplazado por acta': 'aplazado',
}

const estadoClase = computed(() => ESTADO_CLASE[props.auditoria.estado] ?? 'pendiente')
</script>

<style scoped>
.auditoria-item {
  margin-bottom: 12px;
  border-color: var(--dg-borde);
  background: var(--dg-superficie);
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
  color: var(--dg-texto);
  font-size: 1.05rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.auditoria-item__estado {
  font-weight: 600;
  text-transform: none;
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

.auditoria-item__expediente {
  margin: 4px 0 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}

.auditoria-item__estatal {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--dg-fondo-seleccion);
  color: var(--dg-acento);
  font-size: 0.75rem;
  font-weight: 700;
}

.auditoria-item__separador {
  margin: 0 4px;
}

.auditoria-item__body {
  padding-top: 4px;
}

.auditoria-item__datos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
  margin: 0;
}

.auditoria-item__dato {
  min-width: 0;
}

.auditoria-item__dato--ancho {
  grid-column: 1 / -1;
}

.auditoria-item__dato dt {
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  font-weight: 600;
}

.auditoria-item__dato dd {
  margin: 0;
  color: var(--dg-texto);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.auditoria-item__contador {
  margin: 2px 4px 2px 0;
  font-size: 0.75rem;
}

.auditoria-item__sin-contador {
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  font-style: italic;
}

.auditoria-item__descripcion {
  margin: 8px 0 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.auditoria-item__acciones {
  gap: 8px;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

@media (max-width: 599px) {
  .auditoria-item__datos {
    grid-template-columns: 1fr;
  }
}
</style>
