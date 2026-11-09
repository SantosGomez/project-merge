<template>
  <!-- Excepción acordada: la gráfica es un SVG propio dentro de un q-card (AGENTS.md). -->
  <q-card flat tag="figure" class="dona-estados" aria-labelledby="dona-estados-titulo">
    <figcaption id="dona-estados-titulo" class="dona-estados__titulo">Casos por estado</figcaption>

    <p v-if="dona.total === 0" class="dona-estados__vacio">Sin casos registrados</p>

    <div v-else class="dona-estados__cuerpo">
      <svg class="dona-estados__grafica" viewBox="0 0 42 42" role="img" :aria-label="descripcion">
        <!-- Cada arco empieza donde terminó el anterior; el giro hace que el primero salga de arriba. -->
        <g transform="rotate(-90 21 21)">
          <circle
            v-for="segmento in dona.segmentos"
            :key="segmento.clave"
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            :style="{ stroke: segmento.color }"
            stroke-width="6"
            pathLength="100"
            :stroke-dasharray="`${segmento.arco} ${100 - segmento.arco}`"
            :stroke-dashoffset="-segmento.desplazamiento"
          />
        </g>
        <text x="21" y="21" class="dona-estados__total">{{ dona.total }}</text>
        <text x="21" y="27.5" class="dona-estados__total-etiqueta">casos</text>
      </svg>

      <q-list tag="ul" class="dona-estados__leyenda">
        <q-item
          v-for="segmento in dona.segmentos"
          :key="segmento.clave"
          tag="li"
          class="dona-estados__item"
          :class="{ 'boton-presionable': seleccionable }"
          :clickable="seleccionable"
          :active="activa === segmento.clave"
          active-class="dona-estados__item--activo"
          :aria-pressed="seleccionable && !propios ? String(activa === segmento.clave) : undefined"
          @click="seleccionable && emit('seleccionar', segmento.clave)"
        >
          <q-tooltip v-if="seleccionable">
            <template v-if="propios">
              Haz clic para ver tus casos en estado {{ segmento.etiqueta }} en «Mis casos».
            </template>
            <template v-else>
              Haz clic para ver solo a los contadores con casos en estado {{ segmento.etiqueta }}.
            </template>
          </q-tooltip>
          <span
            class="dona-estados__muestra"
            :style="{ background: segmento.color }"
            aria-hidden="true"
          />
          <span class="dona-estados__etiqueta">{{ segmento.etiqueta }}</span>
          <span class="dona-estados__cifra">{{ segmento.valor }} · {{ segmento.porcentaje }}%</span>
        </q-item>
      </q-list>
    </div>
  </q-card>
</template>

<script setup>
import { computed } from 'vue'

import { segmentosDona } from '../utils/filasVista.js'

/*
 * Dona «Casos por estado» del dashboard, dibujada en SVG sin librerías. La leyenda repite
 * cada número y porcentaje en texto: el color nunca es la única pista. Con `seleccionable`,
 * cada estado de la leyenda emite `seleccionar` con su clave y `activa` marca el elegido.
 */
const props = defineProps({
  /** Total del equipo: `{ pendiente, en_proceso, finalizado }`. */
  resumen: { type: Object, default: null },
  /** Los estados de la leyenda se pueden tocar y emiten `seleccionar`. */
  seleccionable: { type: Boolean, default: false },
  /** Estado elegido, para marcarlo; null sin elección. */
  activa: { type: String, default: null },
  /** Casos del propio contador: el tooltip habla de «Mis casos» en vez de la lista de contadores. */
  propios: { type: Boolean, default: false },
})

const emit = defineEmits(['seleccionar'])

const dona = computed(() => segmentosDona(props.resumen))

/** Lo que un lector de pantalla anuncia en lugar de la gráfica. */
const descripcion = computed(
  () =>
    `Casos por estado, ${dona.value.total} en total: ` +
    dona.value.segmentos.map((s) => `${s.etiqueta} ${s.valor} (${s.porcentaje}%)`).join(', '),
)
</script>

<style scoped>
.dona-estados {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
}

.dona-estados__titulo {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  font-weight: 600;
}

.dona-estados__vacio {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.9rem;
}

/* Gráfica y leyenda lado a lado de forma compacta */
.dona-estados__cuerpo {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 14px;
}

.dona-estados__grafica {
  width: 90px;
  height: 90px;
  flex: 0 0 auto;
}

.dona-estados__total {
  fill: var(--dg-texto);
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
}

.dona-estados__total-etiqueta {
  fill: var(--dg-texto-tenue);
  font-size: 5.5px;
  text-anchor: middle;
}

.dona-estados__leyenda {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}

/* q-item trae relleno y alto mínimo propios; la leyenda es compacta. */
.dona-estados__item {
  align-items: center;
  gap: 8px;
  min-height: 0;
  padding: 0;
  color: var(--dg-texto);
  font-size: 0.9rem;
}

/* Con clic, cada estado de la leyenda tiene un área de 44 px (PRODUCT.md). */
.dona-estados__item.q-item--clickable {
  min-height: 44px;
  padding: 0 8px;
  border-radius: 8px;
}

.dona-estados__item--activo {
  color: var(--q-primary);
  font-weight: 600;
}

.dona-estados__muestra {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 3px;
}

.dona-estados__cifra {
  color: var(--dg-texto-tenue);
}

/* Al llegar un cambio en tiempo real, los arcos se reacomodan en vez de saltar. */
.dona-estados__grafica circle {
  transition: stroke-dasharray 300ms cubic-bezier(0.23, 1, 0.32, 1), stroke-dashoffset 300ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .dona-estados__grafica circle {
    transition: none;
  }
}
</style>
