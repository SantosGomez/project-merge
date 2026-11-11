<template>
  <div class="detalle-contador">
    <p v-if="contador" class="detalle-contador__ayuda">
      Puedes cambiar la prioridad de cada caso y se le avisará a {{ contador.nombre }}; el estado y
      la fecha de vencimiento solo los cambia {{ contador.nombre }}.
    </p>

    <p v-if="!contador" class="detalle-contador__aviso" role="status">
      Todavía no hay un contador seleccionado. Elige uno de la lista para ver sus casos importantes.
    </p>

    <ScreenLoader
      v-else-if="estado === SCREEN_STATES.loading"
      :text="auxiliar ? 'Cargando los casos del auxiliar…' : 'Cargando los casos del contador seleccionado…'"
    />

    <!-- Un fallo del detalle se queda aquí: la lista de contadores sigue a la vista. -->
    <ErrorState
      v-else-if="estado === SCREEN_STATES.error"
      :detail="error?.mensaje ?? 'los casos de este contador.'"
      @retry="emit('reintentar')"
    />

    <EmptyState
      v-else-if="estado === SCREEN_STATES.empty"
      :title="auxiliar ? 'Este auxiliar no tiene casos importantes' : 'Este contador no tiene casos importantes'"
      :message="
        auxiliar
          ? `Ningún contador ha marcado como importante un caso de ${contador.nombre}.`
          : `${contador.nombre} no tiene casos marcados como importantes.`
      "
    />

    <template v-else>
      <FiltrosCasos v-model="filtros" :estados="ESTADOS_DETALLE" :con-interruptores="false" />

      <p v-if="paginacion.totalPaginas === 0" class="detalle-contador__aviso" role="status">
        {{ contador.nombre }} no tiene casos importantes en estado
        {{ STATUS_LABELS[filtros.estado] }}. Elige otro estado o «Todos».
      </p>

      <q-list v-else bordered separator class="detalle-contador__casos" aria-label="Casos importantes del contador">
        <CasoItem
          v-for="caso in filas"
          :key="caso.id"
          :caso="caso"
          solo-lectura
          puede-cambiar-prioridad
          :contador-autenticado-id="contador.id"
          :deshabilitado="guardando"
          @cambiar-prioridad="(prioridad) => emit('cambiar-prioridad', caso, prioridad)"
        />
      </q-list>

      <div v-if="paginacion.totalPaginas > 0" class="detalle-contador__paginacion">
        <p class="detalle-contador__paginacion-texto" aria-live="polite">{{ paginacion.texto }}</p>
        <q-pagination
          v-if="paginacion.totalPaginas > 1"
          :model-value="paginacion.pagina"
          :max="paginacion.totalPaginas"
          :max-pages="5"
          direction-links
          boundary-numbers
          color="primary"
          active-design="unelevated"
          @update:model-value="(p) => emit('cambiar-pagina', p)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import CasoItem from './CasoItem.vue'
import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import FiltrosCasos from './FiltrosCasos.vue'
import ScreenLoader from './ScreenLoader.vue'
import { STATUS_LABELS } from '../utils/constants.js'
import { SCREEN_STATES } from '../utils/screenState.js'

/*
 * Detalle de casos importantes del contador seleccionado en el dashboard del administrador
 * (RF-13, RF-14). Solo pinta: la página decide el contador, filtra, pagina y guarda el cambio de
 * prioridad (este componente solo lo emite). Se usa en el panel
 * de escritorio y en el diálogo de celular y tableta, así el detalle se escribe una sola vez.
 */
defineProps({
  /** Contador seleccionado (`{ id, nombre }`), o null. */
  contador: { type: Object, default: null },
  /** Estado del detalle: carga, vacío o contenido (SCREEN_STATES). */
  estado: { type: String, default: SCREEN_STATES.content },
  /** Casos de la página actual, ya adaptados a CasoItem. */
  filas: { type: Array, default: () => [] },
  /** Resultado de `paginar`: `{ pagina, totalPaginas, texto }`. */
  paginacion: { type: Object, required: true },
  /** Mientras se guarda un cambio de prioridad, no se aceptan otros. */
  guardando: { type: Boolean, default: false },
  /** Error de tres partes de la carga del detalle, o null. */
  error: { type: Object, default: null },
  /** La cuenta es un auxiliar (diálogo del directorio): cambian los textos de carga y de vacío. */
  auxiliar: { type: Boolean, default: false },
})

/** Filtro de estado del detalle; lo comparten los chips y los conteos de la fila del contador. */
const filtros = defineModel('filtros', { type: Object, required: true })

const emit = defineEmits(['cambiar-pagina', 'cambiar-prioridad', 'reintentar'])

const ESTADOS_DETALLE = ['todos', 'pendiente', 'en_proceso', 'finalizado']
</script>

<style scoped>
.detalle-contador {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.detalle-contador__ayuda {
  margin: 0 0 2px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.detalle-contador__aviso {
  margin: 0;
  padding: 20px 16px;
  border: 1px dashed var(--dg-borde-discontinuo);
  border-radius: 10px;
  background: var(--dg-superficie);
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
  text-align: center;
}

.detalle-contador__casos {
  overflow: hidden;
  border-color: var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
}

.detalle-contador__paginacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detalle-contador__paginacion-texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}
</style>
