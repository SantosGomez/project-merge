<template>
  <section class="resumen-equipo" aria-labelledby="resumen-equipo-titulo">
    <h2 id="resumen-equipo-titulo" class="resumen-equipo__titulo">Resumen del equipo</h2>

    <ScreenLoader v-if="cargando" text="Cargando el resumen de casos del equipo…" />

    <ErrorState
      v-else-if="error"
      :detail="error?.mensaje ?? 'el resumen de casos del equipo.'"
      @retry="emit('reintentar')"
    />

    <div v-else-if="resumen" class="resumen-equipo__contenido">
      <ul class="resumen-equipo__tarjetas">
        <li
          v-for="tarjeta in tarjetas"
          :key="tarjeta.clave"
          class="resumen-tarjeta"
          :class="{ 'resumen-tarjeta--alerta': tarjeta.alerta }"
          tabindex="0"
        >
          <p class="resumen-tarjeta__titulo">{{ tarjeta.titulo }}</p>
          <p class="resumen-tarjeta__valor">{{ tarjeta.valor }}</p>
          <p class="resumen-tarjeta__detalle">{{ tarjeta.detalle }}</p>
          <q-tooltip max-width="280px">{{ tarjeta.ayuda }}</q-tooltip>
        </li>
      </ul>

      <DonaEstados :resumen="resumen" />
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

import DonaEstados from './DonaEstados.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { tarjetasResumen } from '../utils/filasVista.js'

/*
 * Tarjetas KPI del dashboard del administrador: cifras de todo el equipo, solo informativas.
 * La página pide el resumen y le pasa los datos, la carga y el error; aquí solo se pintan.
 */
const props = defineProps({
  /** Total del equipo de `getResumenEquipo`, o null mientras no hay datos. */
  resumen: { type: Object, default: null },
  cargando: { type: Boolean, default: false },
  /** Error de tres partes de la carga, o null. */
  error: { type: Object, default: null },
})

const emit = defineEmits(['reintentar'])

const tarjetas = computed(() => tarjetasResumen(props.resumen))
</script>

<style scoped>
.resumen-equipo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  margin-bottom: 16px;
}

.resumen-equipo__titulo {
  margin: 0;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

/* Tarjetas y dona en una fila; en pantallas angostas la dona baja debajo de las tarjetas. */
.resumen-equipo__contenido {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
  min-width: 0;
}

.resumen-equipo__contenido > .dona-estados {
  flex: 1 1 280px;
}

/* Una columna en celular; tres en cuanto caben. */
.resumen-equipo__tarjetas {
  flex: 3 1 480px;
  align-content: start;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.resumen-tarjeta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid #dbe4ee;
  border-left: 4px solid var(--q-primary);
  border-radius: 12px;
  background: #f7f9fc;
}

.resumen-tarjeta:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.resumen-tarjeta--alerta {
  border-left-color: #a3231b;
  background: #fdf2f2;
}

.resumen-tarjeta__titulo {
  margin: 0;
  color: #334e68;
  font-size: 0.9rem;
  font-weight: 600;
}

.resumen-tarjeta__valor {
  margin: 0;
  color: #102a43;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
}

.resumen-tarjeta--alerta .resumen-tarjeta__valor {
  color: #a3231b;
}

.resumen-tarjeta__detalle {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
