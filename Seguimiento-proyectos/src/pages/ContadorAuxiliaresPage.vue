<template>
  <q-page class="auxiliares-page">
    <div class="auxiliares-page__head">
      <h1 class="auxiliares-page__title">Mis auxiliares</h1>
      <p class="auxiliares-page__lead">
        Aquí están los auxiliares que te apoyan con tus casos. Pueden cambiar el estado
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
          placeholder="Buscar un auxiliar para asignarlo"
          aria-label="Buscar un auxiliar para asignarlo"
          class="input-moderno auxiliares-page__campo"
          @update:model-value="buscarAuxiliaresDisponibles"
        >
          <template #prepend><q-icon name="person_search" aria-hidden="true" /></template>
          <q-tooltip>Busca por nombre una cuenta con rol de auxiliar para que te apoye.</q-tooltip>
        </q-input>

        <q-select
          v-model="auxiliarSeleccionado"
          :options="opcionesAuxiliares"
          option-label="label"
          option-value="value"
          emit-value
          map-options
          dense
          outlined
          options-dense
          dropdown-icon="expand_more"
          popup-content-class="menu-seleccion-custom"
          transition-show="jump-down"
          transition-hide="jump-up"
          :transition-duration="180"
          class="selector-moderno auxiliares-page__campo"
          :disable="guardando || opcionesAuxiliares.length === 0"
          @update:model-value="asignarAuxiliar"
        >
          <template #prepend><q-icon name="add_circle" /></template>
          <template #no-option>
            <q-item-section class="text-italic">
              {{ textoNoDisponibles }}
            </q-item-section>
          </template>
          <q-tooltip>Selecciona al auxiliar que te ayudará con tus casos.</q-tooltip>
        </q-select>
      </section>

      <!-- Lista de auxiliares actuales -->
      <section class="auxiliares-page__lista">
        <q-item-label header class="auxiliares-page__lista-titulo">
          Tus auxiliares actuales
        </q-item-label>

        <q-list v-if="auxiliares.auxiliares.length > 0" bordered separator class="auxiliares-page__q-list" aria-label="Tus auxiliares">
          <q-item
            v-for="auxiliar in auxiliares.auxiliares"
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
                <q-tooltip>Deja de contar con esta persona como tu auxiliar.</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <EmptyState
          v-else
          title="Todavía no tienes auxiliares"
          message="Busca un auxiliar arriba y asígnalo para que te ayude con tus casos."
          action-label="Buscar auxiliar"
          @action="textoBusqueda = ''"
        />
      </section>
    </div>
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
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
const textoNoDisponibles = computed(() =>
  auxiliares.errorDisponibles
    ? 'No se pudieron cargar los auxiliares disponibles. Revisa tu conexión y vuelve a intentarlo.'
    : 'No hay auxiliares disponibles. El administrador da de alta las cuentas con rol de auxiliar.'
)

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
  // Los disponibles ya vienen solo con cuentas de rol auxiliar sin asignar; aquí solo se filtra por nombre.
  opcionesAuxiliares.value = auxiliares.disponibles
    .filter((c) => c.nombre.toLowerCase().includes(buscado))
    .map((c) => ({ label: c.nombre, value: c.id }))
}

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
  if (resultado.ok) {
    buscarAuxiliaresDisponibles()
  } else {
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
  await Promise.all([
    auxiliares.cargarAuxiliares(idPropio),
    auxiliares.cargarDisponibles(idPropio),
  ])
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

.auxiliares-page__campo {
  min-width: 240px;
  flex: 1 1 240px;
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