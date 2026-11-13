<template>
  <q-card flat bordered class="mis-clientes" aria-labelledby="mis-clientes-titulo">
    <q-card-section class="mis-clientes__cabecera">
      <div class="mis-clientes__texto">
        <h2 id="mis-clientes-titulo" class="mis-clientes__titulo">Mis clientes</h2>
        <p class="mis-clientes__ayuda">
          Los clientes con los que haces actividades. Solo tú los ves. Si desactivas uno, deja de
          ofrecerse, pero no se borra y puedes reactivarlo.
        </p>
      </div>
      <q-btn
        color="primary"
        no-caps
        unelevated
        icon="add_business"
        label="Agregar cliente"
        class="control-touch boton-presionable"
        aria-haspopup="dialog"
        @click="abrirAlta"
      >
        <q-tooltip>Abre el formulario para agregar un cliente nuevo.</q-tooltip>
      </q-btn>
    </q-card-section>

    <q-separator />

    <q-card-section class="mis-clientes__cuerpo">
      <ScreenLoader v-if="estado === SCREEN_STATES.loading" text="Cargando tus clientes…" />

      <ErrorState
        v-else-if="estado === SCREEN_STATES.error"
        :detail="error?.mensaje ?? 'la lista de tus clientes.'"
        @retry="cargar"
      />

      <EmptyState
        v-else-if="estado === SCREEN_STATES.empty"
        title="Todavía no tienes clientes"
        message="Agrega el primero con «Agregar cliente». Cada actividad que registres después será de uno de tus clientes."
        action-label="Agregar cliente"
        @action="abrirAlta"
      />

      <q-list v-else separator class="mis-clientes__lista" aria-label="Tus clientes">
        <q-item
          v-for="cliente in clientes"
          :key="cliente.id"
          class="mis-clientes__fila"
          :class="{ 'mis-clientes__fila--inactivo': !cliente.activo }"
        >
          <q-item-section class="mis-clientes__principal">
            <q-item-label class="mis-clientes__nombre">{{ cliente.nombre }}</q-item-label>
            <q-item-label caption class="mis-clientes__rfc">
              {{ cliente.rfc ? `RFC ${cliente.rfc}` : 'Sin RFC' }}
            </q-item-label>
            <q-item-label v-if="!cliente.activo">
              <q-badge outline color="dg-texto-tenue" label="Desactivado">
                <q-tooltip>No se ofrece al registrar actividades. Puedes reactivarlo.</q-tooltip>
              </q-badge>
            </q-item-label>
          </q-item-section>

          <q-item-section side class="mis-clientes__acciones">
            <div class="mis-clientes__botones">
              <q-btn
                flat
                no-caps
                color="primary"
                icon="edit"
                label="Editar"
                class="control-touch boton-presionable"
                :aria-label="`Editar el cliente ${cliente.nombre}`"
                :disable="cambiandoId === cliente.id"
                @click="abrirEdicion(cliente)"
              >
                <q-tooltip>Cambia el nombre o el RFC de este cliente.</q-tooltip>
              </q-btn>
              <q-btn
                flat
                no-caps
                color="primary"
                :icon="cliente.activo ? 'visibility_off' : 'visibility'"
                :label="cliente.activo ? 'Desactivar' : 'Reactivar'"
                class="control-touch boton-presionable"
                :aria-label="`${cliente.activo ? 'Desactivar' : 'Reactivar'} el cliente ${cliente.nombre}`"
                :loading="cambiandoId === cliente.id"
                :disable="cambiandoId !== null"
                @click="alternarActivo(cliente)"
              >
                <q-tooltip>{{
                  cliente.activo
                    ? 'Deja de ofrecer este cliente. No se borra: puedes reactivarlo.'
                    : 'Vuelve a ofrecer este cliente.'
                }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <ClienteFormDialog v-model="dialogoAbierto" :cliente="clienteEnEdicion" @guardado="alGuardar" />
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import ClienteFormDialog from './ClienteFormDialog.vue'
import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import { actualizarCliente, listarClientes } from '../services/clienteService.js'
import { mezclarEnLista } from '../utils/actividades.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const $q = useQuasar()

const clientes = ref([])
const cargando = ref(true)
const error = ref(null)

const dialogoAbierto = ref(false)
const clienteEnEdicion = ref(null)
// Cliente al que se le está cambiando «activo»; solo esa fila queda ocupada.
const cambiandoId = ref(null)

const estado = computed(() =>
  screenState({ loading: cargando.value, error: error.value, rows: clientes.value }),
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

const abrirAlta = () => {
  clienteEnEdicion.value = null
  dialogoAbierto.value = true
}

const abrirEdicion = (cliente) => {
  clienteEnEdicion.value = cliente
  dialogoAbierto.value = true
}

const alGuardar = (cliente, fueEdicion) => {
  clientes.value = mezclarEnLista(clientes.value, cliente)
  $q.notify({
    type: 'positive',
    message: fueEdicion
      ? 'Cambios del cliente guardados.'
      : `Cliente «${cliente.nombre}» agregado.`,
  })
}

// Desactivar y reactivar son un clic y se pueden deshacer, así que no piden confirmación.
const alternarActivo = async (cliente) => {
  if (cambiandoId.value !== null) return
  const activar = !cliente.activo
  cambiandoId.value = cliente.id
  try {
    const actualizado = await actualizarCliente(cliente.id, { activo: activar })
    clientes.value = mezclarEnLista(clientes.value, actualizado)
    $q.notify({
      type: 'positive',
      message: activar
        ? `Cliente «${cliente.nombre}» reactivado.`
        : `Cliente «${cliente.nombre}» desactivado.`,
    })
  } catch (fallo) {
    $q.notify({
      type: 'negative',
      message: `No se pudo ${activar ? 'reactivar' : 'desactivar'} a ${cliente.nombre}.`,
      caption: fallo?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
      actions: [
        {
          label: 'Reintentar',
          color: 'dg-texto-claro',
          noCaps: true,
          handler: () => alternarActivo(cliente),
        },
      ],
    })
  } finally {
    cambiandoId.value = null
  }
}

onMounted(cargar)
</script>

<style scoped>
.mis-clientes {
  border-radius: 12px;
  border-color: var(--dg-borde);
  min-width: 0;
}

.mis-clientes__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.mis-clientes__texto {
  flex: 1 1 240px;
  min-width: 0;
}

.mis-clientes__titulo {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.3;
}

.mis-clientes__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.mis-clientes__cuerpo {
  padding: 0;
}

/* Los estados vacío, de carga y de error llevan su propio margen. */
.mis-clientes__cuerpo > :not(.mis-clientes__lista) {
  margin: 16px;
}

.mis-clientes__fila {
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 8px 16px;
}

.mis-clientes__principal {
  flex: 1 1 220px;
  min-width: 0;
}

.mis-clientes__fila--inactivo .mis-clientes__nombre {
  color: var(--dg-texto-tenue);
}

.mis-clientes__nombre {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.mis-clientes__rfc {
  color: var(--dg-texto-tenue);
}

.mis-clientes__acciones {
  flex-direction: row;
  padding-left: 0;
}

.mis-clientes__botones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
