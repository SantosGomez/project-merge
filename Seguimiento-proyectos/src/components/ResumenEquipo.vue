<template>
  <section class="resumen-equipo" aria-labelledby="resumen-equipo-titulo">
    <h2 id="resumen-equipo-titulo" class="resumen-equipo__titulo">
      {{ propios ? 'Resumen de mis casos' : 'Resumen del equipo' }}
    </h2>

    <ScreenLoader
      v-if="cargando"
      :text="
        propios ? 'Cargando el resumen de tus casos…' : 'Cargando el resumen de casos del equipo…'
      "
    />

    <ErrorState
      v-else-if="error"
      :detail="
        error?.mensaje ?? (propios ? 'el resumen de tus casos.' : 'el resumen de casos del equipo.')
      "
      @retry="emit('reintentar')"
    />

    <div
      v-else-if="resumen"
      class="resumen-equipo__contenido"
      :class="{ 'resumen-equipo__contenido--muchas': tarjetas.length > 4 }"
    >
      <q-list
        tag="ul"
        class="resumen-equipo__tarjetas"
        :style="{ '--columnas-tarjetas': tarjetas.length }"
      >
        <q-card
          flat
          tag="li"
          v-for="tarjeta in tarjetas"
          :key="tarjeta.clave"
          class="resumen-tarjeta"
          :class="{
            'resumen-tarjeta--alerta': tarjeta.alerta,
            'resumen-tarjeta--clicable': seleccionable,
            'resumen-tarjeta--activa': seleccionable && activa === tarjeta.clave,
          }"
          tabindex="0"
          :role="seleccionable ? 'button' : undefined"
          :aria-pressed="seleccionable ? String(activa === tarjeta.clave) : undefined"
          @click="seleccionable && emit('seleccionar', tarjeta.clave)"
          @keydown.enter.prevent="seleccionable && emit('seleccionar', tarjeta.clave)"
          @keydown.space="
            seleccionable && ($event.preventDefault(), emit('seleccionar', tarjeta.clave))
          "
        >
          <q-card-section class="resumen-tarjeta__cuerpo">
            <p class="resumen-tarjeta__titulo">{{ tarjeta.titulo }}</p>
            <p class="resumen-tarjeta__valor">{{ tarjeta.valor }}</p>
            <p class="resumen-tarjeta__detalle">{{ tarjeta.detalle }}</p>
          </q-card-section>
          <q-tooltip max-width="280px">{{ tarjeta.ayuda }}</q-tooltip>
        </q-card>
      </q-list>

      <DonaEstados
        :resumen="resumen"
        :seleccionable="seleccionable"
        :activa="activa"
        :propios="propios"
        @seleccionar="(estado) => emit('seleccionar', estado)"
      />
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
 * Tarjetas KPI del dashboard: cifras de todo el equipo (admin) o del propio contador (`propios`).
 * Con `seleccionable`, cada tarjeta y cada estado de la dona emiten `seleccionar` con su clave:
 * el admin filtra su lista de contadores y «Mi resumen» abre «Mis casos» filtrado; `activa`
 * marca la elegida. La página pide el resumen y le pasa los datos, la carga y el error.
 */
const props = defineProps({
  /** Total del equipo de `getResumenEquipo`, o null mientras no hay datos. */
  resumen: { type: Object, default: null },
  cargando: { type: Boolean, default: false },
  /** Error de tres partes de la carga, o null. */
  error: { type: Object, default: null },
  /** Cifras de los casos del propio contador («Mi resumen») en vez de todo el equipo. */
  propios: { type: Boolean, default: false },
  /** Las tarjetas y la dona se pueden tocar y emiten `seleccionar`. */
  seleccionable: { type: Boolean, default: false },
  /** Clave de la tarjeta o del estado elegido, para marcarlo; null sin elección. */
  activa: { type: String, default: null },
})

const emit = defineEmits(['reintentar', 'seleccionar'])

const tarjetas = computed(() =>
  tarjetasResumen(props.resumen, { propios: props.propios, seleccionable: props.seleccionable }),
)
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
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

/* Tarjetas y dona en una sola fila en escritorio; en pantallas angostas se adapta. */
.resumen-equipo__contenido {
  display: flex;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 12px;
  min-width: 0;
}

.resumen-equipo__tarjetas {
  flex: 3 1 auto;
  display: grid;
  grid-template-columns: repeat(var(--columnas-tarjetas, 3), minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}

.resumen-equipo__contenido :deep(.dona-estados),
.resumen-equipo__contenido > .dona-estados {
  flex: 1.3 1 300px;
  min-width: 280px;
}

.resumen-tarjeta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dg-borde);
  border-left: 4px solid var(--q-primary);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
}

.resumen-tarjeta__cuerpo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  flex: 1;
}

.resumen-tarjeta:focus-visible {
  outline: 2px solid var(--q-primary);
  outline-offset: 2px;
}

.resumen-tarjeta--clicable {
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

.resumen-tarjeta--clicable:hover {
  box-shadow: 0 0 0 2px var(--dg-fondo-seleccion);
}

.resumen-tarjeta--activa {
  box-shadow: 0 0 0 2px var(--q-primary);
}

.resumen-tarjeta--alerta {
  border-left-color: var(--dg-error);
  background: var(--dg-error-fondo-suave);
}

.resumen-tarjeta__titulo {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  font-weight: 600;
}

.resumen-tarjeta__valor {
  margin: 0;
  color: var(--dg-texto);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
}

.resumen-tarjeta--alerta .resumen-tarjeta__valor {
  color: var(--dg-error);
}

.resumen-tarjeta__detalle {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

@media (max-width: 960px) {
  .resumen-equipo__contenido {
    flex-wrap: wrap;
  }

  .resumen-equipo__tarjetas {
    flex: 1 1 100%;
  }

  .resumen-equipo__contenido :deep(.dona-estados),
  .resumen-equipo__contenido > .dona-estados {
    flex: 1 1 100%;
  }
}

/* Con 5 tarjetas («Mi resumen») la dona baja antes, para que las tarjetas no queden angostas */
@media (max-width: 1279px) {
  .resumen-equipo__contenido--muchas {
    flex-wrap: wrap;
  }

  .resumen-equipo__contenido--muchas .resumen-equipo__tarjetas,
  .resumen-equipo__contenido--muchas :deep(.dona-estados),
  .resumen-equipo__contenido--muchas > .dona-estados {
    flex: 1 1 100%;
  }
}

/* Tableta: 5 tarjetas en una fila no caben, van de 3 en 3 */
@media (min-width: 601px) and (max-width: 840px) {
  .resumen-equipo__contenido--muchas .resumen-equipo__tarjetas {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .resumen-equipo__tarjetas {
    grid-template-columns: 1fr;
  }
}
</style>
