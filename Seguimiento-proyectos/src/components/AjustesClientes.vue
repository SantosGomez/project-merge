<template>
  <section class="ajustes-clientes" aria-labelledby="ajustes-clientes-titulo">
    <div class="ajustes-clientes__cabecera">
      <h2 id="ajustes-clientes-titulo" class="ajustes-clientes__titulo">Clientes del despacho</h2>
      <p class="ajustes-clientes__ayuda">
        Consulta todos los clientes con su clave, razón social, RFC, contador y estado. Esta lista
        es solo de consulta: aquí no se agregan ni se editan clientes.
      </p>
    </div>

    <div v-if="estado === SCREEN_STATES.loading" class="ajustes-clientes__carga" role="status">
      <q-skeleton
        v-for="n in 4"
        :key="n"
        type="rect"
        height="48px"
        class="ajustes-clientes__fila-carga"
      />
      <p class="ajustes-clientes__texto-carga">Cargando los clientes…</p>
    </div>

    <ErrorState
      v-else-if="estado === SCREEN_STATES.error"
      :detail="error?.mensaje ?? 'la lista de clientes.'"
      @retry="cargar"
    />

    <EmptyState
      v-else-if="estado === SCREEN_STATES.empty"
      title="Todavía no hay clientes"
      message="Cuando el despacho registre un cliente, aparecerá en esta lista. Si ya registraste uno, vuelve a cargar la lista."
      action-label="Actualizar lista"
      @action="cargar"
    />

    <q-table
      v-else
      class="ajustes-clientes__tabla"
      flat
      bordered
      aria-label="Clientes del despacho"
      :rows="filasFiltradas"
      :columns="columnas"
      row-key="id"
      :grid="$q.screen.lt.sm"
      v-model:pagination="paginacion"
      :rows-per-page-options="[10, 25, 50, 0]"
      no-data-label="Ningún cliente coincide con la búsqueda. Prueba con otro texto o pulsa «Limpiar búsqueda»."
      no-results-label="Ningún cliente coincide con la búsqueda. Prueba con otro texto o pulsa «Limpiar búsqueda»."
    >
      <template #top>
        <div class="ajustes-clientes__filtros">
          <q-input
            v-model="texto"
            class="ajustes-clientes__buscar input-moderno"
            label="Buscar cliente"
            outlined
            dense
            clearable
            debounce="300"
          >
            <template #prepend>
              <q-icon name="search" aria-hidden="true" />
            </template>
            <q-tooltip
              >Escribe parte de la clave, la razón social, el RFC o el contador; no importan
              mayúsculas ni acentos.</q-tooltip
            >
          </q-input>
          <q-btn
            v-if="texto"
            flat
            no-caps
            color="primary"
            icon="filter_alt_off"
            label="Limpiar búsqueda"
            class="control-touch boton-presionable"
            @click="texto = ''"
          >
            <q-tooltip>Quita el texto buscado para ver todos los clientes.</q-tooltip>
          </q-btn>
        </div>
      </template>

      <template #body-cell-nombre="props">
        <q-td :props="props" class="ajustes-clientes__celda-texto">
          <q-tooltip>{{ props.value }}</q-tooltip>
          {{ props.value }}
        </q-td>
      </template>

      <template #body-cell-contador="props">
        <q-td :props="props" class="ajustes-clientes__celda-texto">
          <q-tooltip>{{ props.value }}</q-tooltip>
          {{ props.value }}
        </q-td>
      </template>

      <template #body-cell-estado="props">
        <q-td :props="props">
          <q-chip
            dense
            square
            :color="props.row.activo ? 'dg-exito-fondo' : 'dg-neutro-fondo'"
            :text-color="props.row.activo ? 'dg-exito' : 'dg-texto-secundario'"
            :label="props.value"
          />
        </q-td>
      </template>

      <template #item="props">
        <div class="col-12 ajustes-clientes__tarjeta-envoltura">
          <q-card flat bordered class="ajustes-clientes__tarjeta">
            <q-card-section>
              <p class="ajustes-clientes__tarjeta-nombre">{{ props.row.nombre }}</p>
              <p class="ajustes-clientes__tarjeta-linea">
                <span class="ajustes-clientes__tarjeta-etiqueta">Clave:</span>
                {{ props.row.claveTexto }}
              </p>
              <p class="ajustes-clientes__tarjeta-linea">
                <span class="ajustes-clientes__tarjeta-etiqueta">RFC:</span>
                {{ props.row.rfcTexto }}
              </p>
              <p class="ajustes-clientes__tarjeta-linea">
                <span class="ajustes-clientes__tarjeta-etiqueta">Contador:</span>
                {{ props.row.contador }}
              </p>
              <q-chip
                dense
                square
                :color="props.row.activo ? 'dg-exito-fondo' : 'dg-neutro-fondo'"
                :text-color="props.row.activo ? 'dg-exito' : 'dg-texto-secundario'"
                :label="props.row.estado"
              />
            </q-card-section>
          </q-card>
        </div>
      </template>
    </q-table>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import { listarClientes } from '../services/ajustesService.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

/*
 * Pestaña «Clientes» de Ajustes: lista de solo lectura del catálogo completo.
 * Las altas, ediciones y fusiones no viven aquí.
 */
const $q = useQuasar()

const clientes = ref([])
const cargando = ref(true)
const error = ref(null)
const texto = ref('')
const paginacion = ref({ rowsPerPage: 10 })

/** Texto sin mayúsculas ni acentos, para que la búsqueda los ignore. */
const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Cliente de la API adaptado a una fila con textos legibles. */
const aFila = (cliente) => ({
  id: cliente.id,
  claveTexto: cliente.clave || 'Sin clave',
  nombre: cliente.nombre,
  rfcTexto: cliente.rfc || 'Sin RFC',
  contador: cliente.contador_nombre || 'Sin contador',
  activo: Boolean(cliente.activo),
  estado: cliente.activo ? 'Activo' : 'Inactivo',
})

const filas = computed(() => clientes.value.map(aFila))

const filasFiltradas = computed(() => {
  const buscado = normalizar(texto.value)
  if (buscado === '') return filas.value
  return filas.value.filter((fila) =>
    [fila.claveTexto, fila.nombre, fila.rfcTexto, fila.contador].some((campo) =>
      normalizar(campo).includes(buscado),
    ),
  )
})

// Cada columna conserva su texto completo; la razón social y el contador se recortan con puntos
// suspensivos y su texto completo sale en el tooltip.
const columnas = [
  { name: 'clave', label: 'Clave', field: 'claveTexto', align: 'left', sortable: true },
  { name: 'nombre', label: 'Razón social', field: 'nombre', align: 'left', sortable: true },
  {
    name: 'rfc',
    label: 'RFC',
    field: 'rfcTexto',
    align: 'left',
    sortable: true,
    // En pantallas medianas y chicas se oculta para que la tabla no desborde (en el celular se ve en la tarjeta).
    classes: 'gt-sm',
    headerClasses: 'gt-sm',
  },
  { name: 'contador', label: 'Contador', field: 'contador', align: 'left', sortable: true },
  { name: 'estado', label: 'Estado', field: 'estado', align: 'left', sortable: true },
]

// Con otra búsqueda la página actual puede quedar vacía: se vuelve a la primera.
watch(texto, () => {
  paginacion.value.page = 1
})

const estado = computed(() =>
  screenState({ loading: cargando.value, error: error.value, rows: filas.value }),
)

const cargar = async () => {
  cargando.value = true
  error.value = null
  try {
    clientes.value = await listarClientes()
  } catch (fallo) {
    error.value = fallo
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>
.ajustes-clientes {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
}

.ajustes-clientes__cabecera {
  margin-bottom: 12px;
}

.ajustes-clientes__titulo {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.ajustes-clientes__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.ajustes-clientes__tabla {
  min-width: 0;
}

.ajustes-clientes__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
}

.ajustes-clientes__buscar {
  flex: 1 1 260px;
  min-width: 0;
}

/* Razón social y contador: una línea con puntos suspensivos; el texto completo va en el tooltip. */
.ajustes-clientes__celda-texto {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ajustes-clientes__tarjeta-envoltura {
  padding: 4px 0;
}

.ajustes-clientes__tarjeta p {
  margin: 0 0 4px;
  overflow-wrap: anywhere;
}

.ajustes-clientes__tarjeta-nombre {
  color: var(--dg-texto);
  font-weight: 600;
}

.ajustes-clientes__tarjeta-linea {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.ajustes-clientes__tarjeta-etiqueta {
  color: var(--dg-texto-tenue);
  font-weight: 600;
}

.ajustes-clientes__carga {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ajustes-clientes__fila-carga {
  border-radius: 8px;
}

.ajustes-clientes__texto-carga {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.95rem;
}
</style>
