<template>
  <div class="mi-equipo">
    <ResumenEquipo
      :resumen="equipo"
      :cargando="cargando"
      :error="error"
      @reintentar="emit('reintentar')"
    />

    <div v-if="!cargando && !error" class="mi-equipo__columnas">
      <section class="mi-equipo__panel" aria-labelledby="mi-equipo-auxiliares-titulo">
        <h2 id="mi-equipo-auxiliares-titulo" class="mi-equipo__titulo">Auxiliares de tu equipo</h2>
        <p class="mi-equipo__ayuda">
          Cada número es la cantidad de casos del auxiliar en ese estado. Haz clic en el nombre para
          ver sus casos abiertos o en un número para ver solo ese estado.
        </p>

        <q-list tag="ul" class="mi-equipo__lista">
          <q-item
            v-for="fila in filas"
            :key="fila.id"
            tag="li"
            class="mi-equipo__fila"
            :class="{ 'mi-equipo__fila--elegida': fila.id === seleccionada?.id }"
          >
            <q-btn
              flat
              no-caps
              align="left"
              padding="2px 0"
              :ripple="false"
              class="mi-equipo__nombre-boton boton-presionable"
              :aria-pressed="fila.id === seleccionada?.id ? 'true' : 'false'"
              @click="elegir(fila.id)"
            >
              <span class="mi-equipo__identidad">
                <span class="mi-equipo__nombre">{{ fila.nombre }}</span>
                <span v-if="fila.id === seleccionada?.id" class="mi-equipo__marca"
                  >Seleccionado</span
                >
                <!-- Lo urgente se ve primero, con texto: el color no es el único aviso. -->
                <span v-if="fila.resumen.vencidos > 0" class="mi-equipo__vencidos">
                  <q-icon name="error_outline" aria-hidden="true" />
                  {{ fila.resumen.vencidos }}
                  {{ fila.resumen.vencidos === 1 ? 'vencido' : 'vencidos' }}
                </span>
              </span>
              <q-tooltip>Muestra los casos abiertos de {{ fila.nombre }}.</q-tooltip>
            </q-btn>

            <span class="mi-equipo__conteos">
              <q-btn
                v-for="estado in STATUSES"
                :key="estado"
                flat
                no-caps
                stack
                padding="4px 8px"
                :ripple="false"
                class="mi-equipo__conteo boton-presionable"
                :class="{ 'mi-equipo__conteo--activo': conteoActivo(fila.id, estado) }"
                :aria-pressed="conteoActivo(fila.id, estado) ? 'true' : 'false'"
                :aria-label="`${STATUS_LABELS[estado]}: ${fila.resumen[estado]} casos de ${fila.nombre}. Filtra el detalle.`"
                @click="elegir(fila.id, estado)"
              >
                <span class="mi-equipo__conteo-valor">{{ fila.resumen[estado] }}</span>
                <span class="mi-equipo__conteo-etiqueta">{{ STATUS_LABELS[estado] }}</span>
                <q-tooltip>
                  Casos de {{ fila.nombre }} en estado {{ STATUS_LABELS[estado] }}. Haz clic para
                  ver solo esos casos.
                </q-tooltip>
              </q-btn>
            </span>
          </q-item>
        </q-list>
      </section>

      <section
        v-if="seleccionada"
        ref="panelDetalle"
        class="mi-equipo__panel"
        aria-labelledby="mi-equipo-detalle-titulo"
      >
        <h2 id="mi-equipo-detalle-titulo" class="mi-equipo__titulo">
          Casos de {{ seleccionada.nombre }}
        </h2>
        <p class="mi-equipo__ayuda">
          Puedes cambiar el estado, editar el caso o marcarlo como importante con la estrella para
          que también lo vea el administrador.
        </p>

        <p v-if="seleccionada.casos.length === 0" class="mi-equipo__aviso" role="status">
          {{ seleccionada.nombre }} todavía no tiene casos registrados.
        </p>

        <template v-else>
          <FiltrosCasos v-model="filtros" :con-interruptores="false" />

          <p v-if="paginacion.totalPaginas === 0" class="mi-equipo__aviso" role="status">
            {{ seleccionada.nombre }} no tiene casos con este filtro. Elige otro estado o «Todos».
          </p>

          <q-list
            v-else
            bordered
            separator
            class="mi-equipo__casos"
            :aria-label="`Casos de ${seleccionada.nombre}`"
          >
            <CasoItem
              v-for="caso in filasDeCasos"
              :key="caso.id"
              :caso="caso"
              :deshabilitado="guardandoId === caso.id"
              @alternar-importante="emit('alternar-importante', caso.id, !caso.important)"
              @cambiar-estado="(estado) => emit('cambiar-estado', caso.id, estado)"
              @editar="emit('editar', caso.id)"
              @ver="emit('ver', caso.id)"
            />
          </q-list>

          <div v-if="paginacion.totalPaginas > 0" class="mi-equipo__paginacion">
            <p class="mi-equipo__paginacion-texto" aria-live="polite">{{ paginacion.texto }}</p>
            <q-pagination
              v-if="paginacion.totalPaginas > 1"
              :model-value="paginacion.pagina"
              :max="paginacion.totalPaginas"
              :max-pages="5"
              direction-links
              boundary-numbers
              color="primary"
              active-design="unelevated"
              @update:model-value="(p) => (pagina = p)"
            />
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import CasoItem from './CasoItem.vue'
import FiltrosCasos from './FiltrosCasos.vue'
import ResumenEquipo from './ResumenEquipo.vue'
import { STATUS_LABELS, STATUSES } from '../utils/constants.js'
import { casoAFila } from '../utils/filasVista.js'
import {
  FILTROS_INICIALES,
  esCasoProximoAVencer,
  esCasoVencido,
  filtrarCasos,
  paginar,
} from '../utils/filtrosCasos.js'

/*
 * Pestaña «Mi equipo» de «Mi resumen»: el contador ve a sus auxiliares como el administrador ve
 * a los contadores. Arriba, las cifras de todos los auxiliares; a la izquierda, una fila por
 * auxiliar con sus conteos; a la derecha, los casos del auxiliar elegido con las mismas acciones
 * que en «Mis casos» (estado, estrella de importante, «Ver» y «Editar»).
 * Solo pinta y emite: la página calcula las cifras (`resumenDeAuxiliares`) y guarda los cambios.
 */
const props = defineProps({
  /** Total de los auxiliares (`resumenDeAuxiliares().equipo`). */
  equipo: { type: Object, default: null },
  /** Una fila por auxiliar: `{ id, nombre, casos, resumen }`. */
  filas: { type: Array, default: () => [] },
  /** Fecha local de hoy en AAAA-MM-DD, para «Vencido» y «Vence pronto». */
  hoy: { type: String, required: true },
  cargando: { type: Boolean, default: false },
  /** Error de tres partes de la carga de casos, o null. */
  error: { type: Object, default: null },
  /** Id del caso que se está guardando: solo esa fila se deshabilita. */
  guardandoId: { type: [Number, String], default: null },
})

const emit = defineEmits(['reintentar', 'alternar-importante', 'cambiar-estado', 'editar', 'ver'])

const $q = useQuasar()

const seleccionadoId = ref(null)
// Sin elección (o si el auxiliar elegido ya no está en el equipo) se muestra el primero: el más urgente.
const seleccionada = computed(
  () => props.filas.find((fila) => fila.id === seleccionadoId.value) ?? props.filas[0] ?? null,
)

const filtros = ref({ ...FILTROS_INICIALES })
const pagina = ref(1)
const POR_PAGINA = 10

watch(filtros, () => {
  pagina.value = 1
})

const paginacion = computed(() =>
  paginar(
    filtrarCasos(seleccionada.value?.casos ?? [], filtros.value, props.hoy),
    pagina.value,
    POR_PAGINA,
  ),
)

/** Casos de la página adaptados a CasoItem, con las mismas alertas que «Mis casos». */
const filasDeCasos = computed(() =>
  paginacion.value.elementos.map((caso) => ({
    ...casoAFila(caso),
    vencido: esCasoVencido(caso, props.hoy),
    proximo: esCasoProximoAVencer(caso, props.hoy),
  })),
)

const conteoActivo = (auxiliarId, estado) =>
  auxiliarId === seleccionada.value?.id && filtros.value.estado === estado

const panelDetalle = ref(null)

/**
 * Elige un auxiliar. Con el nombre se ven sus casos abiertos; con un conteo, solo ese estado
 * (tocar otra vez el conteo activo vuelve a los abiertos).
 */
const elegir = async (auxiliarId, estado = null) => {
  const estadoNuevo =
    estado === null || conteoActivo(auxiliarId, estado) ? FILTROS_INICIALES.estado : estado
  seleccionadoId.value = auxiliarId
  filtros.value = { ...filtros.value, estado: estadoNuevo }

  // En celular y tableta el detalle queda debajo de la lista: se lleva a la vista, sin animación
  // (es una acción frecuente y el salto directo responde al instante).
  if ($q.screen.lt.md) {
    await nextTick()
    panelDetalle.value?.scrollIntoView({ block: 'start' })
  }
}
</script>

<style scoped>
.mi-equipo {
  min-width: 0;
}

.mi-equipo__columnas {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

/* Misma proporción lista/detalle que el dashboard del administrador. */
@media (min-width: 1024px) {
  .mi-equipo__columnas {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: start;
  }
}

.mi-equipo__panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
  /* Al llevarlo a la vista en celular no queda pegado a la barra superior. */
  scroll-margin-top: 72px;
}

.mi-equipo__titulo {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.mi-equipo__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.mi-equipo__lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mi-equipo__fila {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  min-height: 0;
  padding: 10px 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.mi-equipo__fila--elegida {
  border-color: var(--dg-acento);
  background: var(--dg-fondo-seleccion);
}

.mi-equipo__nombre-boton {
  flex: 1 1 180px;
  min-width: 0;
  min-height: 44px;
  color: var(--dg-texto);
  text-align: left;
}

.mi-equipo__identidad {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  min-width: 0;
}

.mi-equipo__nombre {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.mi-equipo__marca {
  color: var(--dg-acento);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mi-equipo__vencidos {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border: 1px solid var(--dg-error);
  border-radius: 999px;
  background: var(--dg-error-fondo);
  color: var(--dg-error);
  font-size: 0.75rem;
  font-weight: 700;
}

.mi-equipo__conteos {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mi-equipo__conteo {
  min-width: 72px;
  min-height: 44px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-suave);
  color: var(--dg-texto);
}

.mi-equipo__conteo--activo {
  border-color: var(--dg-acento);
  background: var(--dg-superficie);
  box-shadow: inset 0 0 0 1px var(--dg-acento);
}

.mi-equipo__conteo-valor {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.mi-equipo__conteo-etiqueta {
  color: var(--dg-texto-secundario);
  font-size: 0.72rem;
  line-height: 1.2;
}

.mi-equipo__nombre-boton:focus-visible,
.mi-equipo__conteo:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

.mi-equipo__aviso {
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

.mi-equipo__casos {
  overflow: hidden;
  border-color: var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-superficie);
}

.mi-equipo__paginacion {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mi-equipo__paginacion-texto {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

@media (prefers-reduced-motion: reduce) {
  .mi-equipo__fila {
    transition: none;
  }
}
</style>
