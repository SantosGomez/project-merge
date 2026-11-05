<template>
  <q-page class="directory-page">
    <section class="directory-panel" aria-labelledby="directory-title">
      <div class="directory-panel__head">
        <div class="directory-panel__title-row">
          <h2 id="directory-title" class="directory-panel__title">Directorio de usuarios</h2>
          <q-btn
            v-if="session.esUsuarioSistema"
            color="primary"
            icon="person_add"
            label="Nuevo usuario"
            no-caps
            unelevated
            class="control-touch"
            @click="abrirNuevoUsuario"
          >
            <q-tooltip>Abre el formulario para crear una cuenta nueva.</q-tooltip>
          </q-btn>
        </div>
        <p v-if="session.esAdministrador" class="directory-panel__help">
          Todas las cuentas del equipo, con su rol y la fecha de su último acceso. En los contadores,
          «Ver casos» abre el detalle de sus casos. No hay conteos ni casos aquí.
        </p>
        <p v-else class="directory-panel__help">
          Todas las cuentas del equipo, con su rol y la fecha de su último acceso. «Nuevo usuario»
          crea una cuenta y «Restablecer contraseña» le asigna una contraseña nueva.
        </p>
      </div>

      <NewUserDialog v-if="session.esUsuarioSistema" v-model="dialogoNuevoAbierto" @creado="alCrearUsuario" />
      <ResetPasswordDialog
        v-if="session.esUsuarioSistema"
        v-model="dialogoRestablecerAbierto"
        :cuenta="cuentaRestablecer"
        @restablecida="alRestablecer"
      />

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
          :rows="filasFiltradas"
          :columns="columnas"
          row-key="id"
          :grid="$q.screen.lt.sm"
          v-model:pagination="paginacion"
          :rows-per-page-options="[10, 25, 50, 0]"
          no-data-label="Ningún usuario coincide con los filtros."
        >
          <template #top>
            <div class="directory-filtros">
              <q-input
                v-model="filtros.texto"
                class="directory-filtros__buscar input-moderno"
                label="Buscar por nombre o correo"
                outlined
                dense
                clearable
                debounce="300"
              >
                <template #prepend>
                  <q-icon name="search" aria-hidden="true" />
                </template>
                <q-tooltip>Escribe parte del nombre o del correo; no importan mayúsculas ni acentos.</q-tooltip>
              </q-input>
              <q-select
                v-model="filtros.rol"
                class="directory-filtros__rol selector-moderno"
                :options="OPCIONES_ROL"
                label="Rol"
                outlined
                dense
                options-dense
                dropdown-icon="expand_more"
                popup-content-class="menu-seleccion-custom"
                transition-show="jump-down"
                transition-hide="jump-up"
                emit-value
                map-options
              >
                <template #prepend>
                  <q-icon name="badge" />
                </template>
                <template #option="{ itemProps, opt, selected }">
                  <q-item
                    v-bind="itemProps"
                    :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                  >
                    <q-item-section>
                      <q-item-label>{{ opt.label }}</q-item-label>
                    </q-item-section>
                    <q-item-section v-if="selected" side>
                      <q-icon name="check" size="18px" color="primary" />
                    </q-item-section>
                  </q-item>
                </template>
                <q-tooltip>Muestra solo las cuentas del rol elegido.</q-tooltip>
              </q-select>
              <div class="directory-filtros__resumen">
                <p class="directory-filtros__conteo" role="status">
                  Mostrando {{ filasFiltradas.length }} de {{ filas.length }} cuentas
                </p>
                <q-btn
                  v-if="hayFiltros"
                  flat
                  dense
                  no-caps
                  color="primary"
                  icon="filter_alt_off"
                  label="Limpiar filtros"
                  class="control-touch"
                  @click="limpiarFiltros"
                >
                  <q-tooltip>Quita la búsqueda y el rol elegido.</q-tooltip>
                </q-btn>
              </div>
            </div>
          </template>

          <template #body-cell-acciones="props">
            <q-td :props="props">
              <q-btn
                v-if="props.row.puedeVerCasos && session.esAdministrador"
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
              <q-btn
                v-if="session.esUsuarioSistema"
                flat
                dense
                no-caps
                color="primary"
                icon="lock_reset"
                label="Restablecer contraseña"
                :aria-label="`Restablecer la contraseña de ${props.row.nombre}`"
                @click="abrirRestablecer(props.row)"
              >
                <q-tooltip>Asigna una contraseña nueva a esta cuenta.</q-tooltip>
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
                <q-card-actions v-if="tieneAccionesTarjeta(props.row)">
                  <q-btn
                    v-if="props.row.puedeVerCasos && session.esAdministrador"
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
                  <q-btn
                    v-if="session.esUsuarioSistema"
                    flat
                    no-caps
                    color="primary"
                    icon="lock_reset"
                    label="Restablecer contraseña"
                    :aria-label="`Restablecer la contraseña de ${props.row.nombre}`"
                    @click="abrirRestablecer(props.row)"
                  >
                    <q-tooltip>Asigna una contraseña nueva a esta cuenta.</q-tooltip>
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
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import NewUserDialog from '../components/NewUserDialog.vue'
import ResetPasswordDialog from '../components/ResetPasswordDialog.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { listarUsuarios } from '../services/userService.js'
import { useCountersStore } from '../stores/counters.js'
import { useSessionStore } from '../stores/session.js'
import { SCREEN_IDS, useMaquetaStore } from '../stores/maqueta.js'
import { PROFILES } from '../utils/constants.js'
import { compararUltimoAcceso, usuarioAFila } from '../utils/filasVista.js'
import { filtrarUsuarios } from '../utils/filtrosCasos.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const router = useRouter()
const $q = useQuasar()
const maqueta = useMaquetaStore()
const contadoresStore = useCountersStore()
const session = useSessionStore()

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

const paginacion = ref({ rowsPerPage: 12 })

// q-select no muestra como elegida una opción con valor null: «Todos» usa su propio valor.
const TODOS_LOS_ROLES = 'todos'

const OPCIONES_ROL = [
  { label: 'Todos los roles', value: TODOS_LOS_ROLES },
  { label: 'Administrador', value: PROFILES.administrador },
  { label: 'Contador', value: PROFILES.contador },
  { label: 'Usuario de sistema', value: PROFILES.sistema },
]

const filtros = ref({ texto: '', rol: TODOS_LOS_ROLES })

/** Filas que coinciden con la búsqueda y el rol elegidos. */
const filasFiltradas = computed(() =>
  filtrarUsuarios(filas.value, {
    texto: filtros.value.texto,
    rol: filtros.value.rol === TODOS_LOS_ROLES ? null : filtros.value.rol,
  }),
)

const hayFiltros = computed(
  () => Boolean(filtros.value.texto?.trim()) || filtros.value.rol !== TODOS_LOS_ROLES,
)

const limpiarFiltros = () => {
  filtros.value = { texto: '', rol: TODOS_LOS_ROLES }
}

// Con otros filtros la página actual puede quedar vacía: se vuelve a la primera.
watch(
  filtros,
  () => {
    paginacion.value.page = 1
  },
  { deep: true },
)

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

const dialogoNuevoAbierto = ref(false)

const abrirNuevoUsuario = () => {
  dialogoNuevoAbierto.value = true
}

const dialogoRestablecerAbierto = ref(false)
const cuentaRestablecer = ref(null)

const abrirRestablecer = (fila) => {
  cuentaRestablecer.value = fila
  dialogoRestablecerAbierto.value = true
}

const alRestablecer = (mensaje) => {
  $q.notify({ type: 'positive', message: mensaje })
}

// En celular la tarjeta solo lleva barra de acciones si tiene algún botón que mostrar.
const tieneAccionesTarjeta = (fila) =>
  (fila.puedeVerCasos && session.esAdministrador) || session.esUsuarioSistema

// La cuenta nueva aparece en la tabla al recargar el directorio.
const alCrearUsuario = (mensaje) => {
  $q.notify({ type: 'positive', message: mensaje })
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

/* El botón baja debajo del título cuando no cabe al lado (celular). */
.directory-panel__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.directory-panel__title-row .directory-panel__title {
  margin: 0;
}

.control-touch {
  min-height: 44px;
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

/* Filtros: apilados en celular y en una sola fila cuando hay espacio. */
.directory-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
}

.directory-filtros__buscar {
  flex: 1 1 260px;
  min-width: 0;
}

.directory-filtros__rol {
  flex: 1 1 180px;
  max-width: 260px;
  min-width: 0;
}

.directory-filtros__resumen {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
}

.directory-filtros__conteo {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.85rem;
}

@media (max-width: 599px) {
  .directory-filtros__rol {
    max-width: none;
  }
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
