<template>
  <section class="filtros-casos" aria-label="Filtros de casos">
    <div class="filtros-casos__grupo filtros-casos__grupo--estados" role="group" aria-labelledby="filtro-estado-titulo">
      <span id="filtro-estado-titulo" class="filtros-casos__titulo">Estado</span>
      <q-chip
        v-for="opcion in opcionesVisibles"
        :key="opcion.valor"
        clickable
        :outline="filtros.estado !== opcion.valor"
        :color="filtros.estado === opcion.valor ? 'primary' : 'dg-texto-tenue'"
        :text-color="filtros.estado === opcion.valor ? 'dg-superficie' : 'dg-texto'"
        :aria-pressed="filtros.estado === opcion.valor ? 'true' : 'false'"
        class="filtros-casos__chip boton-presionable"
        @click="cambiar({ estado: opcion.valor })"
      >
        {{ opcion.etiqueta }}
        <q-tooltip>{{ opcion.ayuda }}</q-tooltip>
      </q-chip>
    </div>

    <div v-if="conInterruptores" class="filtros-casos__grupo">
      <q-toggle
        :model-value="filtros.soloImportantes"
        color="dg-importante"
        checked-icon="star"
        unchecked-icon="star_border"
        label="Solo importantes"
        class="filtros-casos__toggle"
        @update:model-value="(valor) => cambiar({ soloImportantes: valor })"
      >
        <q-tooltip>Muestra solo los casos marcados como importantes.</q-tooltip>
      </q-toggle>
      <q-toggle
        :model-value="filtros.soloVencidos"
        color="dg-error"
        label="Solo vencidos"
        class="filtros-casos__toggle"
        @update:model-value="(valor) => cambiar({ soloVencidos: valor })"
      >
        <q-tooltip>Muestra solo los casos cuya fecha de vencimiento ya pasó y que no están finalizados.</q-tooltip>
      </q-toggle>
      <q-toggle
        :model-value="filtros.soloAlta"
        color="primary"
        label="Solo prioridad Alta"
        class="filtros-casos__toggle"
        @update:model-value="(valor) => cambiar({ soloAlta: valor })"
      >
        <q-tooltip>Muestra solo los casos con prioridad Alta.</q-tooltip>
      </q-toggle>
      <q-toggle
        :model-value="filtros.soloProximos"
        color="dg-aviso-borde"
        label="Próximos a vencer"
        class="filtros-casos__toggle"
        @update:model-value="(valor) => cambiar({ soloProximos: valor })"
      >
        <q-tooltip>Muestra solo los casos sin finalizar que vencen hoy o en los próximos 3 días.</q-tooltip>
      </q-toggle>
      <q-toggle
        :model-value="filtros.soloSinMovimiento"
        color="primary"
        label="Sin movimiento"
        class="filtros-casos__toggle"
        @update:model-value="(valor) => cambiar({ soloSinMovimiento: valor })"
      >
        <q-tooltip
          >Muestra solo los casos sin finalizar que nadie ha editado en los últimos
          {{ DIAS_SIN_MOVIMIENTO }} días.</q-tooltip
        >
      </q-toggle>

      <q-btn
        v-if="hayFiltrosExtra"
        flat
        no-caps
        dense
        color="primary"
        icon="filter_alt_off"
        label="Limpiar filtros"
        class="filtros-casos__limpiar control-touch boton-presionable"
        @click="filtros = { ...FILTROS_INICIALES }"
      >
        <q-tooltip>Vuelve a mostrar los casos abiertos, sin otros filtros.</q-tooltip>
      </q-btn>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import { DIAS_SIN_MOVIMIENTO, FILTROS_INICIALES } from '../utils/filtrosCasos.js'

/*
 * Barra de filtros de casos: estado (chips) y, en «Mis casos», solo importantes, solo vencidos
 * y solo prioridad Alta.
 * Solo edita el objeto de filtros; la lista se filtra en la página con `filtrarCasos`.
 */
const filtros = defineModel({ type: Object, required: true })

const props = defineProps({
  /** Estados que se ofrecen como chips, en orden; por defecto, los de «Mis casos». */
  estados: {
    type: Array,
    default: () => ['abiertos', 'pendiente', 'en_proceso', 'finalizado', 'todos'],
  },
  /** Muestra «Solo importantes», «Solo vencidos», «Solo prioridad Alta» y «Limpiar filtros». */
  conInterruptores: {
    type: Boolean,
    default: true,
  },
})

const OPCIONES_ESTADO = [
  { valor: 'abiertos', etiqueta: 'Abiertos', ayuda: 'Casos pendientes y en proceso.' },
  { valor: 'pendiente', etiqueta: 'Pendiente', ayuda: 'Casos que aún no se empiezan.' },
  { valor: 'en_proceso', etiqueta: 'En proceso', ayuda: 'Casos en los que ya se está trabajando.' },
  { valor: 'finalizado', etiqueta: 'Finalizado', ayuda: 'Casos terminados.' },
  { valor: 'todos', etiqueta: 'Todos', ayuda: 'Todos los casos, incluidos los finalizados.' },
]

const opcionesVisibles = computed(() =>
  props.estados.map((valor) => OPCIONES_ESTADO.find((opcion) => opcion.valor === valor)).filter(Boolean),
)

const hayFiltrosExtra = computed(() =>
  Object.keys(FILTROS_INICIALES).some((clave) => filtros.value[clave] !== FILTROS_INICIALES[clave]),
)

const cambiar = (cambio) => {
  filtros.value = { ...filtros.value, ...cambio }
}
</script>

<style scoped>
.filtros-casos {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-fondo-suave);
}

.filtros-casos__grupo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}

/* Entre filas de chips, 12 px: sus áreas táctiles (44 px) no se enciman al saltar de línea. */
.filtros-casos__grupo--estados {
  row-gap: 12px;
}

.filtros-casos__titulo {
  margin-right: 4px;
  color: var(--dg-texto-tenue);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* El chip se ve de 32 px, pero su área táctil llega a 44 px con 6 px invisibles arriba y abajo. */
.filtros-casos__chip {
  position: relative;
  min-height: 32px;
  margin: 0;
  font-weight: 600;
}

.filtros-casos__chip::after {
  content: '';
  position: absolute;
  inset: -6px 0;
}

.filtros-casos__toggle {
  min-height: 44px;
  color: var(--dg-texto);
  font-weight: 600;
}

.filtros-casos__limpiar {
  margin-left: auto;
}

</style>
