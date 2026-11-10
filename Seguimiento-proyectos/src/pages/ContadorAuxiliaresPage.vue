<template>
  <q-page class="auxiliares-page">
    <div class="auxiliares-page__head">
      <h1 class="auxiliares-page__title">Mis auxiliares</h1>
      <p class="auxiliares-page__lead">
        Aquí están los contadores que te apoyan con tus casos. Pueden cambiar el estado
        de tus casos y tú recibirás un aviso cada vez que lo hagan.
      </p>
    </div>

    <ScreenLoader v-if="screenStateName === SCREEN_STATES.loading" text="Cargando tus auxiliares…" />

    <ErrorState
      v-else-if="screenStateName === SCREEN_STATES.error"
      :detail="mensajeError"
      @retry="retry"
    />

    <div v-else class="auxiliares-page__body">
      <!-- Buscador para asignar un nuevo auxiliar -->
      <section class="auxiliares-page__asignar">
        <q-input
          v-model="textoBusqueda"
          dense
          outlined
          clearable
          debounce="200"
          placeholder="Buscar un contador para asignar como auxiliar"
          aria-label="Buscar contador para auxiliar"
          class="input-moderno"
          @update:model-value="buscarAuxiliaresDisponibles"
        >
          <template #prepend><q-icon name="person_search" aria-hidden="true" /></template>
          <q-tooltip>Busca un contador por nombre para asignarlo como tu auxiliar.</q-tooltip>
        </q-input>

        <q-select
          v-model="auxiliarSeleccionado"
          :options="opcionesAuxiliares"
          option-label="label"
          option-value="value"
          dense
          outlined
          options-dense
          dropdown-icon="expand_more"
          popup-content-class="menu-seleccion-custom"
          transition-show="jump-down"
          transition-hide="jump-up"
          class="selector-moderno"
          :disable="guardando || opcionesAuxiliares.length === 0"
          @update:model-value="asignarAuxiliar"
        >
          <template #prepend><q-icon name="add_circle" /></template>
          <template #no-option>
            <q-item-section class="text-italic">
              No hay contadores disponibles para asignar.
            </q-item-section>
          </template>
          <q-tooltip>Selecciona un contador para que te ayude con tus casos.</q-tooltip>
        </q-select>
      </section>

      <!-- Lista de auxiliares actuales -->
      <section class="auxiliares-page__lista">
        <q-item-label header class="auxiliares-page__lista-titulo">
          Tus auxiliares actuales
        </q-item-label>

        <q-list v-if="auxiliares.length > 0" bordered separator class="auxiliares-page__q-list" aria-label="Tus auxiliares">
          <q-item
            v-for="auxiliar in auxiliares"
            :key="auxiliar.id"
            clickable
            v-ripple
            class="q-item--nav auxiliar-item"
          >
            <q-item-section avatar>
              <q-avatar class="auxiliar-item__avatar">{{ inicialesDe(auxiliar.nombre) }}</q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ auxiliar.nombre }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                no-caps
                dense
                color="dg-error"
                icon="delete"
                :aria-label="`Quitar a ${auxiliar.nombre} como auxiliar`"
                :disable="guardando"
                @click="quitarAuxiliar(auxiliar.id)"
              >
                <q-tooltip>Deja de contar con este contador como tu auxiliar.</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <EmptyState
          v-else
          title="Todavía no tienes auxiliares"
          message="Busca un contador arriba y asígnalo como tu auxiliar para que te ayude con tus casos."
          action-label="Buscar contador"
          @action="textoBusqueda = ''"
        />
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'

import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { SCREEN_STATES } from '../utils/screenState.js'
import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useSessionStore } from '../stores/session.js'

const auxiliares = useAuxiliaresStore()
const session = useSessionStore()
const $q = useQuasar()

const contadorId = computed(() => session.id)
const textoBusqueda = ref('')
const auxiliarSeleccionado = ref(null)
const opcionesAuxiliares = ref([])

const screenStateName = computed(() => {
  if (auxiliares.cargando) return SCREEN_STATES.loading
  if (auxiliares.error) return SCREEN_STATES.error
  return SCREEN_STATES.content
})

const mensajeError = computed(() => auxiliares.error?.mensaje ?? 'tus auxiliares.')
const guardando = computed(() => auxiliares.guardando)

const inicialesDe = (nombre) => {
  return nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const buscarAuxiliaresDisponibles = () => {
  const buscado = (textoBusqueda.value ?? '').toLowerCase().trim()
  if (buscado === '') {
    opcionesAuxiliares.value = []
    return
  }
  // Los contadores disponibles son todos menos el autenticado y los ya asignados.
  const asignados = new Set(auxiliares.auxiliares.map((a) => a.id))
  const idPropio = session.id
  opcionesAuxiliares.value = (
    contadoresDisponibles.value.filter(
      (c) => c.id !== idPropio && !asignados.has(c.id) && c.nombre.toLowerCase().includes(buscado)
    )
  )
}

const contadoresDisponibles = computed(() => {
  // Por ahora devolvemos una lista vacía; el backend aún no tiene endpoint
  // para listar todos los contadores. Se llena al buscar si existe ese endpoint.
  return []
})

const asignarAuxiliar = async (auxiliarId) => {
  if (!auxiliarId || guardando.value) return
  const idNumerico = Number(auxiliarId)
  const idPropio = Number(session.id)
  if (idNumerico === idPropio) return

  const resultado = await auxiliares.asignarAuxiliar(idPropio, idNumerico)
  if (resultado.ok) {
    auxiliarSeleccionado.value = null
    textoBusqueda.value = ''
    opcionesAuxiliares.value = []
    $q.notify({ type: 'positive', message: 'Auxiliar asignado correctamente.' })
  } else {
    $q.notify({
      type: 'negative',
      message: 'No se pudo asignar el auxiliar.',
      caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  }
}

const quitarAuxiliar = async (auxiliarId) => {
  if (guardando.value) return
  const idPropio = Number(session.id)
  const resultado = await auxiliares.quitarAuxiliar(idPropio, auxiliarId)
  if (!resultado.ok) {
    $q.notify({
      type: 'negative',
      message: 'No se pudo quitar el auxiliar.',
      caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  }
}

const retry = () => {
  auxiliares.reintentar()
}

onMounted(async () => {
  const idPropio = Number(session.id)
  await auxiliares.cargarAuxiliares(idPropio)
})
</script>

<style scoped>
.auxiliares-page {
  padding: 16px;
}

.auxiliares-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.auxiliares-page__title {
  margin: 0;
  color: var(--dg-texto);
  font-size: 1.4rem;
  font-weight: 600;
}

.auxiliares-page__lead {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
  flex: 1 1 260px;
  min-width: 0;
}

.auxiliares-page__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auxiliares-page__asignar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
  padding: 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 10px;
  background: var(--dg-fondo-suave);
}

.auxiliares-page__asignar q-input,
.auxiliares-page__asignar q-select {
  min-width: 240px;
}

.auxiliares-page__lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auxiliares-page__lista-titulo {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.auxiliar-item__avatar {
  font-size: 0.85rem;
  font-weight: 600;
}

.auxiliares-page__q-list {
  border-radius: 10px;
  overflow: hidden;
}

@media (min-width: 1024px) {
  .auxiliares-page {
    padding: 20px 24px;
  }
}
</style>