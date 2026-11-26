<template>
  <section class="ajustes-clientes" aria-labelledby="ajustes-clientes-titulo">
    <div class="ajustes-clientes__cabecera">
      <h2 id="ajustes-clientes-titulo" class="ajustes-clientes__titulo">Clientes del despacho</h2>
      <p class="ajustes-clientes__ayuda">{{ textoAyuda }}</p>
    </div>

    <div v-if="puedeAgregar" class="ajustes-clientes__barra">
      <q-btn
        id="cliente-nuevo"
        color="primary"
        no-caps
        unelevated
        icon="add_business"
        label="Nuevo cliente"
        class="control-touch boton-presionable"
        aria-haspopup="dialog"
        @click="abrirAlta"
      >
        <q-tooltip>Abre el formulario para dar de alta un cliente del despacho.</q-tooltip>
      </q-btn>
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
      @retry="cargar()"
    />

    <EmptyState
      v-else-if="estado === SCREEN_STATES.empty"
      title="Todavía no hay clientes"
      message="Cuando el despacho registre un cliente, aparecerá en esta lista. Si ya registraste uno, vuelve a cargar la lista."
      action-label="Actualizar lista"
      @action="cargar()"
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
              >Escribe parte de la clave, la razón social, el RFC o el nombre de un contador; no
              importan mayúsculas ni acentos.</q-tooltip
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
        <q-td :props="props">
          <q-tooltip>{{ props.row.contadoresTexto }}</q-tooltip>
          <div class="ajustes-clientes__contador">
            <span class="ajustes-clientes__celda-texto">{{ props.value }}</span>
            <q-badge
              v-if="props.row.otrosContadores > 0"
              outline
              color="dg-texto-secundario"
              :label="`+${props.row.otrosContadores}`"
              class="ajustes-clientes__mas"
            />
          </div>
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

      <template #body-cell-acciones="props">
        <q-td :props="props" auto-width>
          <!-- En pantallas medianas y chicas las tres acciones van en un menú para que la tabla no desborde. -->
          <q-btn
            v-if="$q.screen.lt.md"
            :id="`cliente-menu-${props.row.id}`"
            flat
            round
            icon="more_vert"
            color="primary"
            class="control-touch boton-presionable"
            :aria-label="`Acciones de ${props.row.nombre}`"
            :disable="cambiandoId !== null"
          >
            <q-tooltip>Acciones de este cliente</q-tooltip>
            <q-menu transition-show="jump-down" transition-hide="jump-up" auto-close>
              <q-list class="ajustes-clientes__menu">
                <q-item clickable class="control-touch" @click="abrirEdicion(props.row)">
                  <q-item-section avatar><q-icon name="edit" aria-hidden="true" /></q-item-section>
                  <q-item-section>Editar datos</q-item-section>
                </q-item>
                <q-item clickable class="control-touch" @click="abrirContadores(props.row)">
                  <q-item-section avatar>
                    <q-icon name="groups" aria-hidden="true" />
                  </q-item-section>
                  <q-item-section>Contadores</q-item-section>
                </q-item>
                <q-item clickable class="control-touch" @click="confirmarCambioDeEstado(props.row)">
                  <q-item-section avatar>
                    <q-icon
                      :name="props.row.activo ? 'toggle_off' : 'toggle_on'"
                      aria-hidden="true"
                    />
                  </q-item-section>
                  <q-item-section>{{ props.row.activo ? 'Desactivar' : 'Activar' }}</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
          <div v-else class="ajustes-clientes__acciones">
            <q-btn
              :id="`cliente-editar-${props.row.id}`"
              flat
              round
              icon="edit"
              color="primary"
              class="control-touch boton-presionable"
              :aria-label="`Editar datos de ${props.row.nombre}`"
              :disable="cambiandoId !== null"
              @click="abrirEdicion(props.row)"
            >
              <q-tooltip>Editar datos de este cliente</q-tooltip>
            </q-btn>
            <q-btn
              :id="`cliente-contadores-${props.row.id}`"
              flat
              round
              icon="groups"
              color="primary"
              class="control-touch boton-presionable"
              :aria-label="`Contadores de ${props.row.nombre}`"
              :disable="cambiandoId !== null"
              @click="abrirContadores(props.row)"
            >
              <q-tooltip>Contadores: elige quién lleva a este cliente</q-tooltip>
            </q-btn>
            <q-btn
              :id="`cliente-estado-${props.row.id}`"
              flat
              round
              :icon="props.row.activo ? 'toggle_off' : 'toggle_on'"
              color="primary"
              class="control-touch boton-presionable"
              :aria-label="`${props.row.activo ? 'Desactivar' : 'Activar'} a ${props.row.nombre}`"
              :loading="cambiandoId === props.row.id"
              :disable="cambiandoId !== null"
              @click="confirmarCambioDeEstado(props.row)"
            >
              <q-tooltip>{{
                props.row.activo
                  ? 'Desactivar: ya no admitirá documentos nuevos en Recepción'
                  : 'Activar: volverá a admitir documentos nuevos en Recepción'
              }}</q-tooltip>
            </q-btn>
          </div>
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
                <span class="ajustes-clientes__tarjeta-etiqueta">Contadores:</span>
                {{ props.row.contadoresTexto }}
              </p>
              <q-chip
                dense
                square
                :color="props.row.activo ? 'dg-exito-fondo' : 'dg-neutro-fondo'"
                :text-color="props.row.activo ? 'dg-exito' : 'dg-texto-secundario'"
                :label="props.row.estado"
              />
            </q-card-section>
            <q-card-actions v-if="puedeEditar" class="ajustes-clientes__tarjeta-acciones">
              <q-btn
                :id="`cliente-editar-${props.row.id}`"
                flat
                no-caps
                icon="edit"
                label="Editar datos"
                color="primary"
                class="control-touch boton-presionable"
                :aria-label="`Editar datos de ${props.row.nombre}`"
                :disable="cambiandoId !== null"
                @click="abrirEdicion(props.row)"
              />
              <q-btn
                :id="`cliente-contadores-${props.row.id}`"
                flat
                no-caps
                icon="groups"
                label="Contadores"
                color="primary"
                class="control-touch boton-presionable"
                :aria-label="`Contadores de ${props.row.nombre}`"
                :disable="cambiandoId !== null"
                @click="abrirContadores(props.row)"
              />
              <q-btn
                :id="`cliente-estado-${props.row.id}`"
                flat
                no-caps
                :icon="props.row.activo ? 'toggle_off' : 'toggle_on'"
                :label="props.row.activo ? 'Desactivar' : 'Activar'"
                color="primary"
                class="control-touch boton-presionable"
                :aria-label="`${props.row.activo ? 'Desactivar' : 'Activar'} a ${props.row.nombre}`"
                :loading="cambiandoId === props.row.id"
                :disable="cambiandoId !== null"
                @click="confirmarCambioDeEstado(props.row)"
              />
            </q-card-actions>
          </q-card>
        </div>
      </template>
    </q-table>

    <ClienteCatalogoDialog
      v-model="dialogoClienteAbierto"
      :cliente="clienteEnDialogo"
      @guardado="alGuardarCliente"
    />
    <ContadoresClienteDialog
      v-model="dialogoContadoresAbierto"
      :cliente="clienteEnDialogo"
      @guardado="alGuardarContadores"
    />
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import ClienteCatalogoDialog from './ClienteCatalogoDialog.vue'
import ContadoresClienteDialog from './ContadoresClienteDialog.vue'
import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import { editarCliente, listarClientes } from '../services/ajustesService.js'
import { useSessionStore } from '../stores/session.js'
import { puedeAgregarClientes, puedeEditarClientes } from '../utils/modulos.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

/*
 * Pestaña «Clientes» de Ajustes: catálogo completo con búsqueda. Administrador y sistemas dan de
 * alta, editan, activan o desactivan y asignan contadores; la recepcionista ve la lista y da de alta.
 * Cada escritura se hace en su diálogo; al guardar, la lista se recarga en silencio y el foco vuelve
 * al botón que abrió el diálogo.
 */
const $q = useQuasar()
const session = useSessionStore()

const puedeAgregar = computed(() => puedeAgregarClientes(session.rol))
const puedeEditar = computed(() => puedeEditarClientes(session.rol))

const textoAyuda = computed(() =>
  puedeEditar.value
    ? 'Consulta los clientes con su clave, razón social, RFC, contadores y estado. Aquí puedes dar de alta clientes, editar sus datos, asignarles contadores y desactivarlos o activarlos.'
    : 'Consulta los clientes con su clave, razón social, RFC, contadores y estado. Puedes dar de alta un cliente nuevo; para cambiar uno ya registrado, pídelo a un administrador.',
)

const clientes = ref([])
const cargando = ref(true)
const error = ref(null)
const texto = ref('')
const paginacion = ref({ rowsPerPage: 10 })
// Cliente al que se le está cambiando «activo»; mientras tanto no se acepta otra acción.
const cambiandoId = ref(null)

const dialogoClienteAbierto = ref(false)
const dialogoContadoresAbierto = ref(false)
// Cliente que se edita en el diálogo abierto (null en el alta).
const clienteEnDialogo = ref(null)
// Id del botón que abrió el diálogo, para devolverle el foco al cerrarlo.
let disparadorId = null

/** Texto sin mayúsculas ni acentos, para que la búsqueda los ignore. */
const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Cliente de la API adaptado a una fila con textos legibles. */
const aFila = (cliente) => {
  const contadores = cliente.contadores ?? []
  return {
    id: cliente.id,
    claveTexto: cliente.clave || 'Sin clave',
    nombre: cliente.nombre,
    rfcTexto: cliente.rfc || 'Sin RFC',
    contador: cliente.contador_nombre || 'Sin contador',
    otrosContadores: Math.max(contadores.length - 1, 0),
    contadoresTexto:
      contadores.length === 0
        ? 'Sin contador'
        : contadores
            .map((cuenta, indice) =>
              indice === 0 && contadores.length > 1
                ? `${cuenta.nombre} (principal)`
                : cuenta.nombre,
            )
            .join(', '),
    activo: Boolean(cliente.activo),
    estado: cliente.activo ? 'Activo' : 'Inactivo',
    cliente,
  }
}

const filas = computed(() => clientes.value.map(aFila))

const filasFiltradas = computed(() => {
  const buscado = normalizar(texto.value)
  if (buscado === '') return filas.value
  return filas.value.filter((fila) =>
    [fila.claveTexto, fila.nombre, fila.rfcTexto, fila.contadoresTexto].some((campo) =>
      normalizar(campo).includes(buscado),
    ),
  )
})

// Cada columna conserva su texto completo; la razón social y el contador se recortan con puntos
// suspensivos y su texto completo sale en el tooltip.
const columnas = computed(() => [
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
  ...(puedeEditar.value
    ? [{ name: 'acciones', label: 'Acciones', field: 'id', align: 'center' }]
    : []),
])

// Con otra búsqueda la página actual puede quedar vacía: se vuelve a la primera.
watch(texto, () => {
  paginacion.value.page = 1
})

const estado = computed(() =>
  screenState({ loading: cargando.value, error: error.value, rows: filas.value }),
)

/**
 * Carga la lista. Con `silencioso` no muestra el esqueleto ni el estado de error: se usa tras guardar,
 * y un fallo al releer no se presenta como fallo del guardado.
 */
const cargar = async ({ silencioso = false } = {}) => {
  if (!silencioso) {
    cargando.value = true
    error.value = null
  }
  try {
    clientes.value = await listarClientes()
    error.value = null
  } catch (fallo) {
    if (silencioso) {
      $q.notify({
        type: 'warning',
        message: 'Se guardó, pero no se pudo actualizar la lista.',
        caption: 'Recarga la página para ver los datos al día.',
      })
    } else {
      error.value = fallo
    }
  } finally {
    cargando.value = false
  }
}

/** Devuelve el foco al botón que abrió el diálogo (o, si ya no existe, a «Nuevo cliente»). */
const devolverFoco = async () => {
  await nextTick()
  const destino =
    (disparadorId && document.getElementById(disparadorId)) ||
    document.getElementById('cliente-nuevo')
  destino?.focus()
}

const alCerrarDialogo = (abierto) => {
  if (!abierto) devolverFoco()
}
watch(dialogoClienteAbierto, alCerrarDialogo)
watch(dialogoContadoresAbierto, alCerrarDialogo)

/** Id del botón que dispara una acción: en pantallas medianas es el menú «⋮» de la fila. */
const idDisparador = (accion, id) =>
  $q.screen.lt.md && !$q.screen.lt.sm ? `cliente-menu-${id}` : `cliente-${accion}-${id}`

const abrirAlta = () => {
  disparadorId = 'cliente-nuevo'
  clienteEnDialogo.value = null
  dialogoClienteAbierto.value = true
}

const abrirEdicion = (fila) => {
  disparadorId = idDisparador('editar', fila.id)
  clienteEnDialogo.value = fila.cliente
  dialogoClienteAbierto.value = true
}

const abrirContadores = (fila) => {
  disparadorId = idDisparador('contadores', fila.id)
  clienteEnDialogo.value = fila.cliente
  dialogoContadoresAbierto.value = true
}

const alGuardarCliente = (cliente, fueEdicion) => {
  $q.notify({
    type: 'positive',
    message: fueEdicion ? 'Cambios guardados' : 'Cliente agregado',
    caption: cliente?.nombre,
  })
  cargar({ silencioso: true })
}

const alGuardarContadores = (cliente) => {
  $q.notify({ type: 'positive', message: 'Contadores actualizados', caption: cliente?.nombre })
  cargar({ silencioso: true })
}

const DIALOGO = {
  transitionShow: 'dialogo-entra',
  transitionHide: 'dialogo-sale',
  transitionDuration: 220,
}

/** Cambia el estado del cliente: aquí sí se envía solo `activo`. */
const cambiarEstado = async (fila) => {
  if (cambiandoId.value !== null) return
  cambiandoId.value = fila.id
  try {
    await editarCliente(fila.id, { activo: !fila.activo })
    $q.notify({
      type: 'positive',
      message: fila.activo ? 'Cliente desactivado' : 'Cliente activado',
      caption: fila.nombre,
    })
    cargar({ silencioso: true })
  } catch (fallo) {
    $q.notify({
      type: 'negative',
      message: `No se pudo ${fila.activo ? 'desactivar' : 'activar'} a ${fila.nombre}.`,
      caption: fallo?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  } finally {
    cambiandoId.value = null
    devolverFoco()
  }
}

/** Pide confirmación antes de desactivar o activar; desactivar avisa qué pasa en Recepción. */
const confirmarCambioDeEstado = (fila) => {
  if (cambiandoId.value !== null) return
  disparadorId = idDisparador('estado', fila.id)
  const desactivar = fila.activo
  $q.dialog({
    ...DIALOGO,
    title: desactivar ? `¿Desactivar a «${fila.nombre}»?` : `¿Activar a «${fila.nombre}»?`,
    message: desactivar
      ? 'Este cliente ya no admitirá documentos nuevos en Recepción. No se borra nada: puedes activarlo de nuevo cuando quieras.'
      : 'Este cliente volverá a admitir documentos nuevos en Recepción.',
    cancel: {
      label: 'Cancelar',
      flat: true,
      noCaps: true,
      class: 'control-touch boton-presionable',
    },
    ok: {
      label: desactivar ? 'Desactivar' : 'Activar',
      color: desactivar ? 'dg-error' : 'primary',
      noCaps: true,
      unelevated: true,
      class: 'control-touch boton-presionable',
    },
    focus: 'cancel',
  })
    .onOk(() => cambiarEstado(fila))
    .onCancel(devolverFoco)
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

.ajustes-clientes__barra {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 12px;
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
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ajustes-clientes__contador {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ajustes-clientes__contador .ajustes-clientes__celda-texto {
  min-width: 0;
  max-width: 160px;
}

.ajustes-clientes__mas {
  flex: none;
}

.ajustes-clientes__acciones {
  display: flex;
  justify-content: center;
  gap: 2px;
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

.ajustes-clientes__tarjeta-acciones {
  flex-wrap: wrap;
  gap: 4px;
  border-top: 1px solid var(--dg-borde);
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
