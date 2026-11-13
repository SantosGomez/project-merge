<template>
  <q-card flat bordered class="mis-tipos" aria-labelledby="mis-tipos-titulo">
    <q-card-section class="mis-tipos__cabecera">
      <div class="mis-tipos__texto">
        <h2 id="mis-tipos-titulo" class="mis-tipos__titulo">Mis tipos de actividad</h2>
        <p class="mis-tipos__ayuda">
          Las actividades que repites, como «Revisión de facturas». Solo tú los ves. Si desactivas
          uno, deja de ofrecerse, pero no se borra y puedes reactivarlo.
        </p>
      </div>
      <q-btn
        color="primary"
        no-caps
        unelevated
        icon="playlist_add"
        label="Agregar tipo"
        class="control-touch boton-presionable"
        aria-haspopup="dialog"
        @click="abrirAlta"
      >
        <q-tooltip>Abre el formulario para agregar un tipo de actividad nuevo.</q-tooltip>
      </q-btn>
    </q-card-section>

    <q-separator />

    <q-card-section class="mis-tipos__cuerpo">
      <ScreenLoader
        v-if="estado === SCREEN_STATES.loading"
        text="Cargando tus tipos de actividad…"
      />

      <ErrorState
        v-else-if="estado === SCREEN_STATES.error"
        :detail="error?.mensaje ?? 'la lista de tus tipos de actividad.'"
        @retry="cargar"
      />

      <EmptyState
        v-else-if="estado === SCREEN_STATES.empty"
        title="Todavía no tienes tipos de actividad"
        message="Agrega el primero con «Agregar tipo». Con ellos armarás las actividades que haces cada mes."
        action-label="Agregar tipo"
        @action="abrirAlta"
      />

      <q-list v-else separator class="mis-tipos__lista" aria-label="Tus tipos de actividad">
        <q-item
          v-for="tipo in tipos"
          :key="tipo.id"
          class="mis-tipos__fila"
          :class="{ 'mis-tipos__fila--inactivo': !tipo.activo }"
        >
          <q-item-section class="mis-tipos__principal">
            <q-item-label class="mis-tipos__nombre">{{ tipo.nombre }}</q-item-label>
            <q-item-label class="mis-tipos__etiquetas">
              <q-badge
                v-if="tipo.cobrable"
                color="dg-exito-fondo"
                text-color="dg-exito"
                label="Cobrable"
              >
                <q-tooltip>El tiempo de este tipo se cobra al cliente.</q-tooltip>
              </q-badge>
              <q-badge v-else outline color="dg-texto-tenue" label="No cobrable">
                <q-tooltip>El tiempo de este tipo no se cobra al cliente.</q-tooltip>
              </q-badge>
              <q-badge v-if="!tipo.activo" outline color="dg-texto-tenue" label="Desactivado">
                <q-tooltip>No se ofrece al registrar actividades. Puedes reactivarlo.</q-tooltip>
              </q-badge>
            </q-item-label>
          </q-item-section>

          <q-item-section side class="mis-tipos__acciones">
            <div class="mis-tipos__botones">
              <q-btn
                flat
                no-caps
                color="primary"
                icon="edit"
                label="Editar"
                class="control-touch boton-presionable"
                :aria-label="`Editar el tipo ${tipo.nombre}`"
                :disable="cambiandoId === tipo.id"
                @click="abrirEdicion(tipo)"
              >
                <q-tooltip>Cambia el nombre de este tipo o si es cobrable.</q-tooltip>
              </q-btn>
              <q-btn
                flat
                no-caps
                color="primary"
                :icon="tipo.activo ? 'visibility_off' : 'visibility'"
                :label="tipo.activo ? 'Desactivar' : 'Reactivar'"
                class="control-touch boton-presionable"
                :aria-label="`${tipo.activo ? 'Desactivar' : 'Reactivar'} el tipo ${tipo.nombre}`"
                :loading="cambiandoId === tipo.id"
                :disable="cambiandoId !== null"
                @click="alternarActivo(tipo)"
              >
                <q-tooltip>{{
                  tipo.activo
                    ? 'Deja de ofrecer este tipo. No se borra: puedes reactivarlo.'
                    : 'Vuelve a ofrecer este tipo.'
                }}</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <TipoActividadFormDialog v-model="dialogoAbierto" :tipo="tipoEnEdicion" @guardado="alGuardar" />
  </q-card>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useQuasar } from 'quasar'

import EmptyState from './EmptyState.vue'
import ErrorState from './ErrorState.vue'
import ScreenLoader from './ScreenLoader.vue'
import TipoActividadFormDialog from './TipoActividadFormDialog.vue'
import { actualizarTipo, listarTipos } from '../services/tipoActividadService.js'
import { mezclarEnLista } from '../utils/actividades.js'
import { SCREEN_STATES, screenState } from '../utils/screenState.js'

const $q = useQuasar()

const tipos = ref([])
const cargando = ref(true)
const error = ref(null)

const dialogoAbierto = ref(false)
const tipoEnEdicion = ref(null)
// Tipo al que se le está cambiando «activo»; solo esa fila queda ocupada.
const cambiandoId = ref(null)

const estado = computed(() =>
  screenState({ loading: cargando.value, error: error.value, rows: tipos.value }),
)

const cargar = async () => {
  cargando.value = true
  error.value = null
  try {
    tipos.value = await listarTipos()
  } catch (fallo) {
    error.value = fallo
  } finally {
    cargando.value = false
  }
}

const abrirAlta = () => {
  tipoEnEdicion.value = null
  dialogoAbierto.value = true
}

const abrirEdicion = (tipo) => {
  tipoEnEdicion.value = tipo
  dialogoAbierto.value = true
}

const alGuardar = (tipo, fueEdicion) => {
  tipos.value = mezclarEnLista(tipos.value, tipo)
  $q.notify({
    type: 'positive',
    message: fueEdicion ? 'Cambios del tipo guardados.' : `Tipo «${tipo.nombre}» agregado.`,
  })
}

// Desactivar y reactivar son un clic y se pueden deshacer, así que no piden confirmación.
const alternarActivo = async (tipo) => {
  if (cambiandoId.value !== null) return
  const activar = !tipo.activo
  cambiandoId.value = tipo.id
  try {
    const actualizado = await actualizarTipo(tipo.id, { activo: activar })
    tipos.value = mezclarEnLista(tipos.value, actualizado)
    $q.notify({
      type: 'positive',
      message: activar ? `Tipo «${tipo.nombre}» reactivado.` : `Tipo «${tipo.nombre}» desactivado.`,
    })
  } catch (fallo) {
    $q.notify({
      type: 'negative',
      message: `No se pudo ${activar ? 'reactivar' : 'desactivar'} el tipo ${tipo.nombre}.`,
      caption: fallo?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
      actions: [
        {
          label: 'Reintentar',
          color: 'dg-texto-claro',
          noCaps: true,
          handler: () => alternarActivo(tipo),
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
.mis-tipos {
  border-radius: 12px;
  border-color: var(--dg-borde);
  min-width: 0;
}

.mis-tipos__cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
}

.mis-tipos__texto {
  flex: 1 1 240px;
  min-width: 0;
}

.mis-tipos__titulo {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.3;
}

.mis-tipos__ayuda {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.mis-tipos__cuerpo {
  padding: 0;
}

/* Los estados vacío, de carga y de error llevan su propio margen. */
.mis-tipos__cuerpo > :not(.mis-tipos__lista) {
  margin: 16px;
}

.mis-tipos__fila {
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 8px 16px;
}

.mis-tipos__principal {
  flex: 1 1 220px;
  min-width: 0;
}

.mis-tipos__fila--inactivo .mis-tipos__nombre {
  color: var(--dg-texto-tenue);
}

.mis-tipos__nombre {
  color: var(--dg-texto);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.mis-tipos__etiquetas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.mis-tipos__acciones {
  flex-direction: row;
  padding-left: 0;
}

.mis-tipos__botones {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
