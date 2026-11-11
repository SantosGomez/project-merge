<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="contadores-auxiliar-titulo"
    @show="cargar"
  >
    <q-card class="contadores-auxiliar">
      <q-card-section>
        <h2 id="contadores-auxiliar-titulo" class="contadores-auxiliar__title">Contadores que apoya</h2>
        <p class="contadores-auxiliar__help">
          {{ cuenta?.nombre }} verá los casos de estos contadores y podrá cambiar su estado. Al guardar se avisa a {{ cuenta?.nombre }} y a cada contador que agregues o quites.
          Cada contador también puede cambiar su equipo desde «Mis auxiliares».
        </p>
      </q-card-section>

      <q-card-section>
        <q-skeleton v-if="cargando" type="rect" height="40px" />
        <div v-else-if="error" class="error-banner contadores-auxiliar__error" role="alert">
          <span>{{ error }}</span>
          <q-btn flat no-caps dense icon="refresh" label="Reintentar" color="primary" @click="cargar" />
        </div>
        <q-select
          v-else
          v-model="elegidos"
          :options="opciones"
          :placeholder="elegidos.length === 0 ? 'Elige uno o varios' : ''"
          aria-label="Contadores que apoya"
          multiple
          use-chips
          emit-value
          map-options
          outlined
          dense
          options-dense
          dropdown-icon="expand_more"
          popup-content-class="menu-seleccion-custom"
          class="selector-moderno"
          :disable="guardando"
        >
          <template #prepend><q-icon name="groups" aria-hidden="true" /></template>
          <q-tooltip>Deja la lista vacía si por ahora no apoya a nadie.</q-tooltip>
        </q-select>
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
          label="Guardar"
          color="primary"
          class="control-touch boton-presionable"
          :disable="cargando || Boolean(error)"
          :loading="guardando"
          @click="guardar"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'

import {
  calcularCambiosDeContadores,
  guardarContadoresDeAuxiliar,
  listarContadoresDeAuxiliar,
} from '../services/userService.js'

/*
 * Directorio: el despacho fija a qué contadores apoya un auxiliar. Carga lo actual al abrir
 * y guarda solo lo que se marcó o desmarcó, para no pisar lo que un contador agregó mientras tanto.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })
const props = defineProps({
  /** Fila del directorio del auxiliar `{ id, nombre }`. */
  cuenta: { type: Object, default: null },
  /** Contadores del directorio `{ id, nombre }`. */
  contadores: { type: Array, default: () => [] },
})

const $q = useQuasar()
const opciones = computed(() => props.contadores.map((c) => ({ label: c.nombre, value: c.id })))
const elegidos = ref([])
/** Ids vinculados cuando se abrió el diálogo: contra ellos se calcula qué cambió. */
const cargados = ref([])
const cargando = ref(false)
const guardando = ref(false)
const error = ref('')

const cargar = async () => {
  cargando.value = true
  error.value = ''
  try {
    cargados.value = (await listarContadoresDeAuxiliar(props.cuenta.id)).map((c) => c.id)
    elegidos.value = [...cargados.value]
  } catch (fallo) {
    error.value = fallo?.mensaje ?? 'No se pudieron cargar los contadores de este auxiliar.'
  } finally {
    cargando.value = false
  }
}

const guardar = async () => {
  const cambios = calcularCambiosDeContadores(cargados.value, elegidos.value)
  const sinCambios = cambios.agregar.length === 0 && cambios.quitar.length === 0
  if (sinCambios) {
    dialogoAbierto.value = false
    return
  }

  guardando.value = true
  try {
    await guardarContadoresDeAuxiliar(props.cuenta.id, cambios)
    dialogoAbierto.value = false
    $q.notify({ type: 'positive', message: `Contadores de ${props.cuenta.nombre} actualizados.` })
  } catch (fallo) {
    $q.notify({ type: 'negative', message: 'No se guardaron los cambios.', caption: fallo?.mensaje, timeout: 8000 })
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.contadores-auxiliar {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.contadores-auxiliar__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.contadores-auxiliar__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.contadores-auxiliar__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
