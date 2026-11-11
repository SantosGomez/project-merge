<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="agregar-auxiliares-titulo"
    @show="alAbrir"
  >
    <q-card class="agregar-auxiliares">
      <q-card-section>
        <h2 id="agregar-auxiliares-titulo" class="agregar-auxiliares__title">Agregar auxiliares</h2>
        <p class="agregar-auxiliares__help">
          Marca a quienes te ayudarán. Verán tus casos y podrán cambiar su estado; tú recibirás un
          aviso cada vez que lo hagan. A cada persona que asignes se le avisará, y también a los
          administradores.
        </p>
      </q-card-section>

      <q-card-section class="agregar-auxiliares__body">
        <!-- Cargando: reserva el lugar de la lista para que el diálogo no salte -->
        <div v-if="auxiliares.cargandoDisponibles" class="agregar-auxiliares__cargando" aria-busy="true">
          <q-skeleton v-for="n in 3" :key="n" type="rect" height="44px" />
        </div>

        <div v-else-if="auxiliares.errorDisponibles" class="error-banner agregar-auxiliares__error" role="alert">
          <span>{{ auxiliares.errorDisponibles.mensaje ?? 'No se pudieron cargar los auxiliares disponibles.' }}</span>
          <q-btn
            flat
            no-caps
            dense
            icon="refresh"
            label="Reintentar"
            color="primary"
            class="control-touch boton-presionable"
            @click="cargar"
          />
        </div>

        <p v-else-if="auxiliares.disponibles.length === 0" class="agregar-auxiliares__vacio">
          No hay auxiliares disponibles. Las cuentas con rol de auxiliar las da de alta el
          usuario de sistema en el directorio; pídele que cree la de la persona que te apoyará.
        </p>

        <template v-else>
          <q-input
            v-model="filtro"
            dense
            outlined
            clearable
            placeholder="Filtrar por nombre"
            aria-label="Filtrar auxiliares por nombre"
            class="input-moderno"
          >
            <template #prepend><q-icon name="search" aria-hidden="true" /></template>
            <q-tooltip>Escribe parte del nombre para acortar la lista. Es opcional.</q-tooltip>
          </q-input>

          <q-list
            v-if="visibles.length > 0"
            bordered
            separator
            class="agregar-auxiliares__lista"
            aria-label="Auxiliares disponibles"
          >
            <q-item v-for="auxiliar in visibles" :key="auxiliar.id" tag="label" v-ripple>
              <q-item-section avatar>
                <q-checkbox v-model="seleccionados" :val="auxiliar.id" :disable="guardando" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="agregar-auxiliares__nombre">{{ auxiliar.nombre }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <p v-else class="agregar-auxiliares__vacio">Ningún auxiliar coincide con «{{ filtro }}».</p>
        </template>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn
          flat
          no-caps
          label="Cancelar"
          color="primary"
          class="control-touch boton-presionable"
          :disable="guardando"
          @click="dialogoAbierto = false"
        />
        <q-btn
          unelevated
          no-caps
          icon="person_add"
          color="primary"
          class="control-touch boton-presionable"
          :label="`Asignar (${seleccionados.length})`"
          :disable="seleccionados.length === 0 || guardando"
          :loading="guardando"
          @click="asignar"
        >
          <q-tooltip>Asigna como tus auxiliares a las personas marcadas.</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'

import { useAuxiliaresStore } from '../stores/auxiliares.js'
import { useSessionStore } from '../stores/session.js'
import { filtrarContadores } from '../utils/filtrosCasos.js'

/*
 * Diálogo «Agregar auxiliares» de «Mis auxiliares»: muestra a todos los auxiliares disponibles
 * (cuentas con rol de auxiliar que aún no son tuyos), con filtro opcional por nombre; se marcan
 * uno o varios y se asignan juntos. Emite `asignados` con el resultado para que la pantalla avise.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })
const emit = defineEmits(['asignados'])

const auxiliares = useAuxiliaresStore()
const session = useSessionStore()

const filtro = ref('')
const seleccionados = ref([])
const guardando = computed(() => auxiliares.guardando)
const visibles = computed(() => filtrarContadores(auxiliares.disponibles, filtro.value ?? ''))

const cargar = () => auxiliares.cargarDisponibles(Number(session.id))

// Cada vez que se abre: empieza limpio y relee los disponibles por si alguien dio de alta uno nuevo.
const alAbrir = () => {
  filtro.value = ''
  seleccionados.value = []
  cargar()
}

const asignar = async () => {
  const resultado = await auxiliares.asignarVarios(Number(session.id), [...seleccionados.value])
  dialogoAbierto.value = false
  emit('asignados', resultado)
}
</script>

<style scoped>
.agregar-auxiliares {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.agregar-auxiliares__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.agregar-auxiliares__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.agregar-auxiliares__body,
.agregar-auxiliares__cargando {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.agregar-auxiliares__lista {
  max-height: min(320px, 45vh);
  overflow-y: auto;
  border-color: var(--dg-borde);
  border-radius: 8px;
}

.agregar-auxiliares__nombre {
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.agregar-auxiliares__vacio {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  line-height: 1.45;
}

.agregar-auxiliares__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
