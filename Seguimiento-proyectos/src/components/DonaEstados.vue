<template>
  <figure class="dona-estados" aria-labelledby="dona-estados-titulo">
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
            :stroke="segmento.color"
            stroke-width="6"
            pathLength="100"
            :stroke-dasharray="`${segmento.arco} ${100 - segmento.arco}`"
            :stroke-dashoffset="-segmento.desplazamiento"
          />
        </g>
        <text x="21" y="21" class="dona-estados__total">{{ dona.total }}</text>
        <text x="21" y="26.5" class="dona-estados__total-etiqueta">casos</text>
      </svg>

      <ul class="dona-estados__leyenda">
        <li v-for="segmento in dona.segmentos" :key="segmento.clave" class="dona-estados__item">
          <span
            class="dona-estados__muestra"
            :style="{ background: segmento.color }"
            aria-hidden="true"
          />
          <span class="dona-estados__etiqueta">{{ segmento.etiqueta }}</span>
          <span class="dona-estados__cifra">{{ segmento.valor }} · {{ segmento.porcentaje }}%</span>
        </li>
      </ul>
    </div>
  </figure>
</template>

<script setup>
import { computed } from 'vue'

import { segmentosDona } from '../utils/filasVista.js'

/*
 * Dona «Casos por estado» del dashboard, dibujada en SVG sin librerías. La leyenda repite
 * cada número y porcentaje en texto: el color nunca es la única pista.
 */
const props = defineProps({
  /** Total del equipo: `{ pendiente, en_proceso, finalizado }`. */
  resumen: { type: Object, default: null },
})

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
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.dona-estados__titulo {
  color: #334e68;
  font-size: 0.9rem;
  font-weight: 600;
}

.dona-estados__vacio {
  margin: 0;
  color: #486581;
  font-size: 0.9rem;
}

/* La leyenda baja debajo de la gráfica cuando no cabe al lado. */
.dona-estados__cuerpo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.dona-estados__grafica {
  width: 120px;
  height: 120px;
  flex: 0 0 auto;
}

.dona-estados__total {
  fill: #102a43;
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
}

.dona-estados__total-etiqueta {
  fill: #486581;
  font-size: 4px;
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

.dona-estados__item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #102a43;
  font-size: 0.9rem;
}

.dona-estados__muestra {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 3px;
}

.dona-estados__cifra {
  color: #486581;
}
</style>
