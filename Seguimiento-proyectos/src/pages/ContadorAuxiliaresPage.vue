<template>
  <q-page class="auxiliares-page">
    <div class="auxiliares-page__head">
      <h1 class="auxiliares-page__title">Mis auxiliares</h1>
      <p class="auxiliares-page__lead">
        Aquí están los auxiliares que te apoyan con tus casos. Pueden cambiar el estado
        de tus casos y tú recibirás un aviso cada vez que lo hagan.
      </p>
      <q-btn
        unelevated
        no-caps
        color="primary"
        icon="person_add"
        label="Agregar auxiliar"
        class="control-touch boton-presionable auxiliares-page__agregar"
        @click="dialogoAgregarAbierto = true"
      >
        <q-tooltip>Elige de la lista a quienes te ayudarán con tus casos.</q-tooltip>
      </q-btn>
    </div>

    <ScreenLoader v-if="screenStateName === SCREEN_STATES.loading" text="Cargando tus auxiliares…" />

    <ErrorState
      v-else-if="screenStateName === SCREEN_STATES.error"
      :detail="mensajeError"
      @retry="retry"
    />

    <section v-else class="auxiliares-page__lista">
      <q-item-label header class="auxiliares-page__lista-titulo">
        Tus auxiliares actuales
      </q-item-label>

      <q-list
        v-if="auxiliares.auxiliares.length > 0"
        bordered
        separator
        class="auxiliares-page__q-list"
        aria-label="Tus auxiliares"
      >
        <q-item v-for="auxiliar in auxiliares.auxiliares" :key="auxiliar.id" class="auxiliar-item">
          <q-item-section avatar>
            <q-avatar class="auxiliar-item__avatar" aria-hidden="true">{{ inicialesDe(auxiliar.nombre) }}</q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label class="auxiliar-item__nombre">{{ auxiliar.nombre }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              no-caps
              dense
              color="dg-error"
              icon="person_remove"
              label="Quitar"
              class="control-touch boton-presionable"
              :aria-label="`Quitar a ${auxiliar.nombre} como auxiliar`"
              :disable="guardando"
              @click="confirmarQuitar(auxiliar)"
            >
              <q-tooltip>Deja de contar con esta persona como tu auxiliar.</q-tooltip>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>

      <EmptyState
        v-else
        title="Todavía no tienes auxiliares"
        message="Agrega a quienes te ayudarán: verán tus casos y podrán cambiar su estado."
        action-label="Agregar auxiliar"
        @action="dialogoAgregarAbierto = true"
      />
    </section>

    <AgregarAuxiliaresDialog v-model="dialogoAgregarAbierto" @asignados="alAsignar" />
  </q-page>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'

import AgregarAuxiliaresDialog from '../components/AgregarAuxiliaresDialog.vue'
import EmptyState from '../components/EmptyState.vue'
import ErrorState from '../components/ErrorState.vue'
import ScreenLoader from '../components/ScreenLoader.vue'
import { SCREEN_STATES } from '../utils/screenState.js'
import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useSessionStore } from '../stores/session.js'

const auxiliares = useAuxiliaresStore()
const session = useSessionStore()
const $q = useQuasar()

const dialogoAgregarAbierto = ref(false)

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
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Resultado del diálogo «Agregar auxiliares»: si alguno falló, se dice cuál y por qué.
const alAsignar = ({ asignados, fallidos }) => {
  if (asignados > 0) {
    $q.notify({
      type: 'positive',
      message: asignados === 1 ? 'Auxiliar asignado.' : `${asignados} auxiliares asignados.`,
    })
  }
  if (fallidos.length > 0) {
    $q.notify({
      type: 'negative',
      message: fallidos.length === 1 ? 'No se pudo asignar a un auxiliar.' : `No se pudo asignar a ${fallidos.length} auxiliares.`,
      caption: fallidos[0].error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
      timeout: 8000,
    })
  }
}

const DIALOGO = { transitionShow: 'dialogo-entra', transitionHide: 'dialogo-sale', transitionDuration: 220 }

// Quitar se confirma: un toque basta y el auxiliar deja de ver tus casos.
const confirmarQuitar = (auxiliar) => {
  $q.dialog({
    ...DIALOGO,
    title: '¿Quitar auxiliar?',
    message: `${auxiliar.nombre} dejará de ver tus casos y de poder cambiar su estado.`,
    cancel: { label: 'Cancelar', flat: true, noCaps: true },
    ok: { label: 'Quitar', color: 'dg-error', noCaps: true, unelevated: true },
  }).onOk(async () => {
    const resultado = await auxiliares.quitarAuxiliar(Number(session.id), auxiliar.id)
    if (resultado.ok) {
      $q.notify({ type: 'positive', message: `${auxiliar.nombre} ya no es tu auxiliar.` })
    } else {
      $q.notify({
        type: 'negative',
        message: 'No se pudo quitar el auxiliar.',
        caption: resultado.error?.mensaje ?? 'Revisa tu conexión y vuelve a intentarlo.',
        timeout: 8000,
      })
    }
  })
}

const retry = () => {
  auxiliares.reintentar()
}

onMounted(() => {
  auxiliares.cargarAuxiliares(Number(session.id))
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
  flex: 1 0 100%;
}

.auxiliares-page__lead {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
  flex: 1 1 260px;
  min-width: 0;
}

.auxiliares-page__agregar {
  flex: 0 0 auto;
}

.auxiliares-page__lista {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.auxiliares-page__lista-titulo {
  margin: 0;
  padding: 0;
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

.auxiliar-item__nombre {
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.auxiliares-page__q-list {
  border-color: var(--dg-borde);
  border-radius: 10px;
  overflow: hidden;
}

/* En el celular el botón ocupa todo el ancho, bajo el texto */
@media (max-width: 599px) {
  .auxiliares-page__agregar {
    flex: 1 1 100%;
  }
}

@media (min-width: 1024px) {
  .auxiliares-page {
    padding: 20px 24px;
  }
}
</style>
