<template>
  <q-page class="directory-page">
    <section class="directory-panel" aria-labelledby="directory-title">
      <div class="directory-panel__head">
        <div class="directory-panel__title-row">
          <h2 id="directory-title" class="directory-panel__title">Cuentas del equipo</h2>
          <q-btn
            v-if="session.esUsuarioSistema"
            color="primary"
            icon="person_add"
            label="Nuevo usuario"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            @click="abrirNuevoUsuario"
          >
            <q-tooltip>Abre el formulario para crear una cuenta nueva.</q-tooltip>
          </q-btn>
        </div>
        <p v-if="session.esAdministrador" class="directory-panel__help">
          Todas las cuentas del equipo, con su rol y la fecha de su último acceso. Para ver los casos
          importantes de un contador o de un auxiliar, pulsa «Ver casos importantes» en su fila.
        </p>
        <p v-else-if="session.esUsuarioSistema" class="directory-panel__help">
          Todas las cuentas del equipo, con su rol y la fecha de su último acceso. «Nuevo usuario»
          crea una cuenta y «Restablecer contraseña» le asigna una contraseña nueva.
        </p>
        <p v-else class="directory-panel__help">
          Consulta las cuentas del equipo, con su rol y la fecha de su último acceso.
        </p>
      </div>

      <NewUserDialog
        v-if="session.esUsuarioSistema"
        v-model="dialogoNuevoAbierto"
        :contadores="contadores"
        :cuenta="cuentaEditar"
        @creado="alCrearUsuario"
        @actualizado="alActualizarUsuario"
      />
      <ContadoresDeAuxiliarDialog v-model="dialogoContadoresAbierto" :cuenta="cuentaAuxiliar" :contadores="contadores" />
      <CasosDeAuxiliarDialog
        v-if="session.esAdministrador"
        v-model="dialogoCasosAuxiliarAbierto"
        :cuenta="cuentaCasosAuxiliar"
      />
      <ResetPasswordDialog
        v-if="session.esUsuarioSistema"
        v-model="dialogoRestablecerAbierto"
        :cuenta="cuentaRestablecer"
        @restablecida="alRestablecer"
        @cuenta-inexistente="refrescar"
      />

      <div class="directory-panel__body">
        <!-- Esqueleto con la forma de la tabla; el texto se anuncia a los lectores de pantalla. -->
        <div v-if="screenStateName === SCREEN_STATES.loading" class="directory-carga" role="status">
          <q-skeleton v-for="n in 4" :key="n" type="rect" height="48px" class="directory-carga__fila" />
          <p class="directory-carga__texto">Cargando el directorio de usuarios…</p>
        </div>

        <ErrorState
          v-else-if="screenStateName === SCREEN_STATES.error"
          :detail="error?.mensaje ?? 'el directorio de usuarios.'"
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
          no-data-label="Ninguna cuenta coincide con la búsqueda o el rol elegidos. Prueba con otro texto o pulsa «Limpiar filtros»."
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
                :transition-duration="180"
                emit-value
                map-options
              >
                <template #prepend>
                  <q-icon name="badge" aria-hidden="true" />
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
                  Mostrando {{ filasFiltradas.length }} de {{ filas.length }}
                  {{ filas.length === 1 ? 'cuenta' : 'cuentas' }}
                </p>
                <q-btn
                  v-if="hayFiltros"
                  flat
                  no-caps
                  color="primary"
                  icon="filter_alt_off"
                  label="Limpiar filtros"
                  class="control-touch boton-presionable"
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
                no-caps
                color="primary"
                icon="folder_open"
                label="Ver casos importantes"
                :aria-label="`Ver casos importantes de ${props.row.nombre}`"
                class="control-touch boton-presionable"
                @click="selectCounter(props.row.id)"
              >
                <q-tooltip>Abre en «Resumen del equipo» los casos importantes de este contador.</q-tooltip>
              </q-btn>
              <q-btn
                v-if="props.row.puedeVerCasosDeAuxiliar && session.esAdministrador"
                flat
                no-caps
                color="primary"
                icon="folder_open"
                label="Ver casos importantes"
                aria-haspopup="dialog"
                :aria-label="`Ver casos importantes de ${props.row.nombre}`"
                class="control-touch boton-presionable"
                @click="abrirCasosDeAuxiliar(props.row)"
              >
                <q-tooltip>Abre los casos de este auxiliar que su contador marcó como importantes.</q-tooltip>
              </q-btn>
              <q-btn
                v-if="props.row.rolClave === 'auxiliar' && !session.esRecepcionista"
                flat
                no-caps
                color="primary"
                icon="groups"
                label="Contador que apoya"
                :aria-label="`Contador que apoya ${props.row.nombre}`"
                class="control-touch boton-presionable"
                @click="abrirContadores(props.row)"
              >
                <q-tooltip>Elige a qué contador apoya este auxiliar (solo uno).</q-tooltip>
              </q-btn>
              <q-btn
                v-if="session.esUsuarioSistema"
                flat
                no-caps
                color="primary"
                icon="edit"
                label="Editar"
                aria-haspopup="dialog"
                :aria-label="`Editar la cuenta de ${props.row.nombre}`"
                class="control-touch boton-presionable"
                @click="abrirEditar(props.row)"
              >
                <q-tooltip>Cambia el nombre, el correo o el rol de esta cuenta.</q-tooltip>
              </q-btn>
              <q-btn
                v-if="session.esUsuarioSistema"
                flat
                no-caps
                color="primary"
                icon="lock_reset"
                label="Restablecer contraseña"
                :aria-label="`Restablecer contraseña de ${props.row.nombre}`"
                class="control-touch boton-presionable"
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
                    {{ props.row.ultimoAccesoTexto }}
                  </p>
                </q-card-section>
                <q-card-actions v-if="tieneAccionesTarjeta(props.row)">
                  <q-btn
                    v-if="props.row.puedeVerCasos && session.esAdministrador"
                    flat
                    no-caps
                    color="primary"
                    icon="folder_open"
                    label="Ver casos importantes"
                    :aria-label="`Ver casos importantes de ${props.row.nombre}`"
                    class="control-touch boton-presionable"
                    @click="selectCounter(props.row.id)"
                  >
                    <q-tooltip>Abre en «Resumen del equipo» los casos importantes de este contador.</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="props.row.puedeVerCasosDeAuxiliar && session.esAdministrador"
                    flat
                    no-caps
                    color="primary"
                    icon="folder_open"
                    label="Ver casos importantes"
                    aria-haspopup="dialog"
                    :aria-label="`Ver casos importantes de ${props.row.nombre}`"
                    class="control-touch boton-presionable"
                    @click="abrirCasosDeAuxiliar(props.row)"
                  >
                    <q-tooltip>Abre los casos de este auxiliar que su contador marcó como importantes.</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="props.row.rolClave === 'auxiliar' && !session.esRecepcionista"
                    flat
                    no-caps
                    color="primary"
                    icon="groups"
                    label="Contador que apoya"
                    :aria-label="`Contador que apoya ${props.row.nombre}`"
                    class="control-touch boton-presionable"
                    @click="abrirContadores(props.row)"
                  >
                    <q-tooltip>Elige a qué contador apoya este auxiliar (solo uno).</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="session.esUsuarioSistema"
                    flat
                    no-caps
                    color="primary"
                    icon="edit"
                    label="Editar"
                    aria-haspopup="dialog"
                    :aria-label="`Editar la cuenta de ${props.row.nombre}`"
                    class="control-touch boton-presionable"
                    @click="abrirEditar(props.row)"
                  >
                    <q-tooltip>Cambia el nombre, el correo o el rol de esta cuenta.</q-tooltip>
                  </q-btn>
                  <q-btn
                    v-if="session.esUsuarioSistema"
                    flat
                    no-caps
                    color="primary"
                    icon="lock_reset"
                    label="Restablecer contraseña"
                    :aria-label="`Restablecer contraseña de ${props.row.nombre}`"
                    class="control-touch boton-presionable"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import CasosDeAuxiliarDialog from '../components/CasosDeAuxiliarDialog.vue'
import ContadoresDeAuxiliarDialog from '../components/ContadoresDeAuxiliarDialog.vue'
import NewUserDialog from '../components/NewUserDialog.vue'
import ResetPasswordDialog from '../components/ResetPasswordDialog.vue'
import { listarUsuarios } from '../services/userService.js'
import { useCountersStore } from '../stores/counters.js'
import { useSessionStore } from '../stores/session.js'
import { PROFILES } from '../utils/constants.js'
import { compararUltimoAcceso, usuarioAFila } from '../utils/filasVista.js'
import { formatearRol } from '../utils/formateadores.js'
import { filtrarUsuarios } from '../utils/filtrosCasos.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const router = useRouter()
const $q = useQuasar()
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
    // Se ordena con el valor crudo y se muestra legible.
    format: (_valor, fila) => fila.ultimoAccesoTexto,
  },
  {
    name: 'acciones',
    label: 'Acciones',
    field: 'id',
    align: 'left',
    classes: 'directory-acciones',
  },
]

const paginacion = ref({ rowsPerPage: 10 })

// q-select no muestra como elegida una opción con valor null: «Todos» usa su propio valor.
const TODOS_LOS_ROLES = 'todos'

const OPCIONES_ROL = [
  { label: 'Todos los roles', value: TODOS_LOS_ROLES },
  // Mismas etiquetas que el resto de la app (y que el alta de usuario).
  ...[PROFILES.administrador, PROFILES.contador, PROFILES.auxiliar, PROFILES.sistema, PROFILES.recepcionista].map((valor) => ({
    label: formatearRol(valor),
    value: valor,
  })),
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
  router.push({ name: 'admin-dashboard' })
}

const retry = () => {
  cargar()
}

const dialogoNuevoAbierto = ref(false)

// El mismo diálogo da de alta (sin cuenta) o edita la cuenta elegida.
const cuentaEditar = ref(null)

const abrirNuevoUsuario = () => {
  cuentaEditar.value = null
  dialogoNuevoAbierto.value = true
}

const abrirEditar = (fila) => {
  cuentaEditar.value = { id: fila.id, nombre: fila.nombre, correo: fila.correo, rol: fila.rolClave }
  dialogoNuevoAbierto.value = true
}

const alActualizarUsuario = ({ usuario, cambioRol }) => {
  $q.notify({
    type: 'positive',
    message: cambioRol
      ? `Cuenta de ${usuario.nombre} actualizada; tendrá que volver a iniciar sesión con su nuevo rol.`
      : `Cuenta de ${usuario.nombre} actualizada.`,
  })
  // La fila cambia al instante; la recarga trae además lo que otros hayan cambiado.
  usuarios.value = usuarios.value.map((u) => (u.id === usuario.id ? { ...u, ...usuario } : u))
  refrescar({
    avisarFallo: true,
    mensajeFallo: 'Los cambios se guardaron, pero no se pudo actualizar el directorio.',
  })
}

const dialogoRestablecerAbierto = ref(false)
const cuentaRestablecer = ref(null)

const abrirRestablecer = (fila) => {
  cuentaRestablecer.value = fila
  dialogoRestablecerAbierto.value = true
}

const alRestablecer = (nombre) => {
  $q.notify({ type: 'positive', message: `Contraseña de ${nombre} restablecida; sus sesiones abiertas se cerraron.` })
}

// Contadores del directorio: opciones para vincular a un auxiliar (alta y «Contador que apoya»).
const contadores = computed(() =>
  usuarios.value.filter((u) => u.rol === PROFILES.contador).map((u) => ({ id: u.id, nombre: u.nombre })),
)

const dialogoContadoresAbierto = ref(false)
const cuentaAuxiliar = ref(null)

const abrirContadores = (fila) => {
  cuentaAuxiliar.value = fila
  dialogoContadoresAbierto.value = true
}

// Casos importantes de un auxiliar (los que escaló su contador): se abren aquí, no en «Resumen del equipo».
const dialogoCasosAuxiliarAbierto = ref(false)
const cuentaCasosAuxiliar = ref(null)

const abrirCasosDeAuxiliar = (fila) => {
  cuentaCasosAuxiliar.value = fila
  dialogoCasosAuxiliarAbierto.value = true
}

// En celular la tarjeta solo lleva barra de acciones si tiene algún botón que mostrar.
const tieneAccionesTarjeta = (fila) =>
  (fila.puedeVerCasos && session.esAdministrador) ||
  session.esUsuarioSistema ||
  (fila.rolClave === 'auxiliar' && !session.esRecepcionista)

/*
 * Recarga sin cargador: la tabla no parpadea. Si falla tras crear una cuenta, se conserva la
 * lista y se ofrece reintentar; al volver a la ventana, un fallo se ignora en silencio.
 */
const refrescar = async ({
  avisarFallo = false,
  mensajeFallo = 'La cuenta se creó, pero no se pudo actualizar el directorio.',
} = {}) => {
  if (cargando.value || error.value) return
  try {
    usuarios.value = await listarUsuarios()
  } catch {
    if (avisarFallo) {
      $q.notify({
        type: 'negative',
        message: mensajeFallo,
        actions: [
          {
            label: 'Reintentar',
            color: 'dg-texto-claro',
            noCaps: true,
            handler: () => refrescar({ avisarFallo: true, mensajeFallo }),
          },
        ],
      })
    }
  }
}

// La cuenta nueva aparece en la tabla al refrescar el directorio.
const alCrearUsuario = (nombre) => {
  $q.notify({
    type: 'positive',
    message: `Cuenta de ${nombre} creada. Comparte la contraseña temporal por un medio seguro.`,
  })
  refrescar({ avisarFallo: true })
}

// Al volver a la ventana se refresca, para que «Último acceso» no quede viejo.
const alVolver = () => {
  if (document.visibilityState === 'visible') refrescar()
}

onMounted(() => {
  cargar()
  document.addEventListener('visibilitychange', alVolver)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', alVolver))
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
  border: 1px solid var(--dg-borde);
  border-radius: 12px;
  background: var(--dg-fondo-panel);
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


.directory-panel__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.directory-panel__help {
  margin: 0;
  color: var(--dg-texto-tenue);
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

/* Con varios botones (un auxiliar tiene tres), bajan de línea en vez de ensanchar la tabla. */
.directory-table :deep(.directory-acciones) {
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
  color: var(--dg-texto);
  font-weight: 600;
}

.directory-card__line {
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
}

.directory-card__label {
  color: var(--dg-texto-tenue);
  font-weight: 600;
}

@media (min-width: 1024px) {
  .directory-page {
    padding: 20px 24px;
  }
}

.directory-carga {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.directory-carga__fila {
  border-radius: 8px;
}

.directory-carga__texto {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.95rem;
}
</style>
