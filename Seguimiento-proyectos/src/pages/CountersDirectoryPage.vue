<template>
  <q-page class="directory-page">
    <section class="directory-panel" aria-labelledby="directory-title">
      <div class="directory-panel__head">
        <h2 id="directory-title" class="directory-panel__title">Directorio de usuarios</h2>
        <p class="directory-panel__help">
          Todas las cuentas del equipo, con su rol y la fecha de su último acceso. En los contadores,
          «Ver casos» abre el detalle de sus casos. No hay conteos ni casos aquí.
        </p>
      </div>

      <div class="directory-panel__body">
        <ScreenLoader
          v-if="screenStateName === SCREEN_STATES.loading"
          text="Cargando el directorio de usuarios…"
        />

        <ErrorState
          v-else-if="screenStateName === SCREEN_STATES.error"
          detail="el directorio de usuarios."
          @retry="retry"
        />

        <EmptyState
          v-else-if="screenStateName === SCREEN_STATES.empty"
          title="No hay usuarios"
          message="No hay cuentas registradas en el equipo."
        />

        <q-table
          v-else
          class="directory-table"
          flat
          bordered
          aria-label="Cuentas del equipo"
          :rows="filas"
          :columns="columnas"
          row-key="id"
          :grid="$q.screen.lt.sm"
          v-model:pagination="paginacion"
          :rows-per-page-options="[10, 25, 50, 0]"
          no-data-label="No hay cuentas que mostrar"
        >
          <template #body-cell-acciones="props">
            <q-td :props="props">
              <q-btn
                v-if="props.row.puedeVerCasos"
                flat
                dense
                no-caps
                color="primary"
                icon="folder_open"
                label="Ver casos"
                :aria-label="`Ver los casos de ${props.row.nombre}`"
                @click="selectCounter(props.row.id)"
              >
                <q-tooltip>Abre el detalle de casos de este contador.</q-tooltip>
              </q-btn>
            </q-td>
          </template>

          <template #item="props">
            <div class="col-12 directory-card-wrap">
              <q-card flat bordered class="directory-card">
                <q-card-section>
                  <p class="directory-cell directory-card__name">{{ props.row.nombre }}</p>
                  <p class="directory-cell directory-card__line">{{ props.row.correo }}</p>
                  <p class="directory-card__line">
                    <span class="directory-card__label">Rol:</span> {{ props.row.rol }}
                  </p>
                  <p class="directory-card__line">
                    <span class="directory-card__label">Último acceso:</span>
                    {{ props.row.ultimoAcceso }}
                  </p>
                </q-card-section>
                <q-card-actions v-if="props.row.puedeVerCasos">
                  <q-btn
                    flat
                    no-caps
                    color="primary"
                    icon="folder_open"
                    label="Ver casos"
                    :aria-label="`Ver los casos de ${props.row.nombre}`"
                    @click="selectCounter(props.row.id)"
                  >
                    <q-tooltip>Abre el detalle de casos de este contador.</q-tooltip>
                  </q-btn>
                </q-card-actions>
              </q-card>
            </div>
          </template>
        </q-table>
      </div>
    </section>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listarUsuarios } from '../services/userService.js'
import { useCountersStore } from '../stores/counters.js'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { compararUltimoAcceso, usuarioAFila } from '../utils/filasVista.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const router = useRouter()
const maqueta = useMaquetaStore()
const contadoresStore = useCountersStore()

const usuarios = ref([])
const cargando = ref(true)
const error = ref(null)

/** Cuentas adaptadas a filas con rol legible y último acceso (RNF-08). */
const filas = computed(() => usuarios.value.map(usuarioAFila).filter((fila) => fila !== null))

// Columnas de la tabla; el texto largo se parte en varias líneas, nunca se recorta (RNF-9, RNF-10).
const columnas = [
  { name: 'nombre', label: 'Nombre', field: 'nombre', align: 'left', sortable: true, classes: 'directory-cell' },
  { name: 'correo', label: 'Correo', field: 'correo', align: 'left', sortable: true, classes: 'directory-cell' },
  { name: 'rol', label: 'Rol', field: 'rol', align: 'left', sortable: true },
  {
    name: 'ultimoAcceso',
    label: 'Último acceso',
    field: 'ultimoAcceso',
    align: 'left',
    sortable: true,
    sort: compararUltimoAcceso,
  },
  { name: 'acciones', label: 'Acciones', field: 'id', align: 'left' },
]

const paginacion = ref({ rowsPerPage: 25 })

const screenStateName = computed(() =>
  screenState({
    loading: cargando.value,
    error: error.value,
    rows: filas.value,
  }),
)

const cargar = async () => {
  cargando.value = true
  error.value = null
  try {
    usuarios.value = await listarUsuarios()
  } catch (fallo) {
    error.value = fallo
  } finally {
    cargando.value = false
  }
}

const selectCounter = (counterId) => {
  if (cargando.value || error.value) return
  // RF-17: se deja el contador elegido en el store para que P-2 lo muestre seleccionado.
  contadoresStore.contadorSeleccionadoId = counterId
  // Compatibilidad con la maqueta 001: se mantiene la selección sincronizada.
  maqueta.selectCounter(counterId)
  router.push({ name: 'admin-dashboard' })
}

const retry = () => {
  cargar()
}

onMounted(() => {
  // Compatibilidad con el flujo anterior (carga inicial de la pantalla en la maqueta).
  maqueta.startScreenLoad(SCREEN_IDS.directory)
  cargar()
})
</script>

<style scoped>
.directory-page {
  padding: 16px;
}

.directory-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.directory-panel__head {
  margin-bottom: 12px;
}

.directory-panel__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.directory-panel__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

.directory-panel__body {
  min-width: 0;
}

/* Nombres y correos completos: se parten en varias líneas, sin puntos suspensivos. */
.directory-cell {
  overflow-wrap: anywhere;
  white-space: normal;
}

.directory-table :deep(.directory-cell) {
  overflow-wrap: anywhere;
  white-space: normal;
}

.directory-card-wrap {
  padding: 4px 0;
}

.directory-card p {
  margin: 0 0 4px;
}

.directory-card__name {
  color: #102a43;
  font-weight: 600;
}

.directory-card__line {
  color: #334e68;
  font-size: 0.9rem;
}

.directory-card__label {
  color: #486581;
  font-weight: 600;
}

@media (min-width: 1024px) {
  .directory-page {
    padding: 20px 24px;
  }
}
</style>
