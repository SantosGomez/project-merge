<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="contadores-auxiliar-titulo"
    @show="cargar"
    @shake="pedirDescartar"
  >
    <q-card class="contadores-auxiliar">
      <q-card-section>
        <h2 id="contadores-auxiliar-titulo" class="contadores-auxiliar__title">Contador que apoya</h2>
        <p class="contadores-auxiliar__help">
          {{ cuenta?.nombre }} verá los casos de este contador y podrá cambiar su estado. Un auxiliar solo puede apoyar a un contador.
          Al guardar se avisa a {{ cuenta?.nombre }} y al contador que agregues o quites.
          Cada contador también puede cambiar su equipo desde «Mi perfil».
        </p>
      </q-card-section>

      <q-card-section>
        <q-skeleton v-if="cargando" type="rect" height="40px" />
        <div v-else-if="error" class="error-banner contadores-auxiliar__error" role="alert">
          <span>{{ error }}</span>
          <q-btn flat no-caps dense icon="refresh" label="Reintentar" color="primary" @click="cargar" />
        </div>
        <!-- Vínculos anteriores a la regla de un solo contador: se avisa antes de dejar solo uno. -->
        <p v-if="!cargando && !error && cargados.length > 1" class="contadores-auxiliar__aviso" role="status">
          Hoy apoya a {{ cargados.length }} contadores. Al guardar quedará solo con el que elijas.
        </p>
        <q-select
          v-if="!cargando && !error"
          v-model="elegido"
          :options="opciones"
          :placeholder="elegido === null ? 'Elige un contador' : ''"
          aria-label="Contador que apoya"
          clearable
          emit-value
          map-options
          outlined
          dense
          options-dense
          dropdown-icon="expand_more"
          popup-content-class="menu-seleccion-custom"
          transition-show="jump-down"
          transition-hide="jump-up"
          :transition-duration="180"
          class="selector-moderno"
          :disable="guardando"
        >
          <template #prepend><q-icon name="groups" aria-hidden="true" /></template>
          <q-tooltip>Déjalo vacío si por ahora no apoya a nadie.</q-tooltip>
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
          @click="cerrar"
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
 * Directorio: el despacho fija a qué contador apoya un auxiliar (uno solo). Carga lo actual al
 * abrir y guarda solo la diferencia: para cambiarlo de contador envía el nuevo y quita el anterior.
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
/** Id del contador elegido, o null si no apoya a nadie. */
const elegido = ref(null)
const elegidos = computed(() => (elegido.value === null ? [] : [elegido.value]))
/** Ids vinculados cuando se abrió el diálogo: contra ellos se calcula qué cambió. */
const cargados = ref([])
const cargando = ref(false)
const guardando = ref(false)
const error = ref('')

const DIALOGO = { transitionShow: 'dialogo-entra', transitionHide: 'dialogo-sale', transitionDuration: 220 }

// Si se eligió otro contador, Esc, clic fuera o «Cancelar» preguntan antes de perder el cambio.
const hayDatosSinGuardar = computed(() => {
  if (cargando.value || error.value) return false
  const cambios = calcularCambiosDeContadores(cargados.value, elegidos.value)
  return cambios.agregar.length > 0 || cambios.quitar.length > 0
})

const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'El contador que elegiste no se guardará.',
    cancel: { label: 'Seguir editando', flat: true, noCaps: true, class: 'control-touch boton-presionable' },
    ok: { label: 'Descartar', color: 'dg-error', noCaps: true, unelevated: true, class: 'control-touch boton-presionable' },
    focus: 'cancel',
  }).onOk(() => {
    dialogoAbierto.value = false
  })
}

const cerrar = () => {
  if (guardando.value) return
  if (hayDatosSinGuardar.value) pedirDescartar()
  else dialogoAbierto.value = false
}

// Número de la última carga: una respuesta vieja (de otro auxiliar) no pisa a la actual.
let peticion = 0

const cargar = async () => {
  const actual = ++peticion
  cargando.value = true
  error.value = ''
  try {
    const ids = (await listarContadoresDeAuxiliar(props.cuenta.id)).map((c) => c.id)
    if (actual !== peticion) return
    cargados.value = ids
    elegido.value = ids[0] ?? null
  } catch (fallo) {
    if (actual !== peticion) return
    error.value = fallo?.mensaje ?? 'No se pudieron cargar los contadores de este auxiliar.'
  } finally {
    if (actual === peticion) cargando.value = false
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
    $q.notify({ type: 'positive', message: `Contador de ${props.cuenta.nombre} actualizado.` })
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

.contadores-auxiliar__aviso {
  margin: 0 0 8px;
  padding: 8px 12px;
  border: 1px solid var(--dg-aviso-borde);
  border-radius: 8px;
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
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
