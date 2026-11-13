<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="clientes-tipo-titulo"
    @before-show="alAbrir"
    @shake="pedirDescartar"
  >
    <q-card class="clientes-tipo">
      <q-card-section>
        <h2 id="clientes-tipo-titulo" class="clientes-tipo__title">
          Clientes de «{{ tipo?.nombre }}»
        </h2>
        <p class="clientes-tipo__help">
          Marca los clientes a los que les haces esta actividad cada mes. Con ellos se arma tu lista
          del mes. Solo aparecen tus clientes activos.
        </p>
      </q-card-section>

      <q-card-section class="clientes-tipo__body">
        <!-- Cargando: reserva el lugar de la lista para que el diálogo no salte -->
        <div v-if="cargando" class="clientes-tipo__cargando" aria-busy="true">
          <q-skeleton v-for="n in 3" :key="n" type="rect" height="44px" />
        </div>

        <div v-else-if="errorCarga" class="error-banner clientes-tipo__error" role="alert">
          <span>{{ errorCarga.mensaje ?? 'No se pudieron cargar tus clientes.' }}</span>
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

        <p v-else-if="activos.length === 0" class="clientes-tipo__vacio">
          Todavía no tienes clientes activos. Agrégalos en «Clientes y tipos», en la sección «Mis
          clientes», y vuelve aquí para asignarlos a este tipo.
        </p>

        <template v-else>
          <q-input
            v-model="filtro"
            dense
            outlined
            clearable
            placeholder="Filtrar por nombre"
            aria-label="Filtrar clientes por nombre"
            class="input-moderno"
          >
            <template #prepend><q-icon name="search" aria-hidden="true" /></template>
            <q-tooltip>Escribe parte del nombre para acortar la lista. Es opcional.</q-tooltip>
          </q-input>

          <q-list
            v-if="visibles.length > 0"
            bordered
            separator
            class="clientes-tipo__lista"
            aria-label="Tus clientes activos"
          >
            <q-item v-for="cliente in visibles" :key="cliente.id" tag="label" v-ripple>
              <q-item-section avatar>
                <q-checkbox
                  v-model="seleccionados"
                  :val="cliente.id"
                  :disable="guardando"
                  :aria-label="`Llevar a ${cliente.nombre} en este tipo`"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="clientes-tipo__nombre">{{ cliente.nombre }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <p v-else class="clientes-tipo__vacio">Ningún cliente coincide con «{{ filtro }}».</p>

          <p class="clientes-tipo__contador" aria-live="polite">
            {{ seleccionados.length }} de {{ activos.length }} clientes marcados
          </p>
        </template>

        <p v-if="errorGeneral" class="error-banner" role="alert">{{ errorGeneral }}</p>
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
        >
          <q-tooltip>Cierra sin guardar.</q-tooltip>
        </q-btn>
        <q-btn
          unelevated
          no-caps
          icon="save"
          color="primary"
          label="Guardar clientes"
          class="control-touch boton-presionable"
          :disable="cargando || !!errorCarga || guardando || !hayDatosSinGuardar"
          :loading="guardando"
          @click="guardar"
        >
          <q-tooltip>Guarda los clientes marcados para este tipo de actividad.</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'

import { listarClientes } from '../services/clienteService.js'
import { guardarClientesDeTipo, listarClientesDeTipo } from '../services/tipoActividadService.js'
import { calcularCambiosDeCartera } from '../utils/actividades.js'
import { filtrarContadores } from '../utils/filtrosCasos.js'

/*
 * Diálogo «Clientes» de un tipo de actividad: muestra los clientes activos en casillas (con filtro
 * por nombre sin acentos) y al guardar envía solo la diferencia (`{ agregar, quitar }`).
 * Emite `guardado` con el id del tipo y cuántos clientes quedaron marcados.
 */
const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Tipo de actividad (propio y activo) cuya cartera se edita. */
  tipo: { type: Object, default: null },
})

const emit = defineEmits(['guardado'])

const $q = useQuasar()

const clientes = ref([])
const cargados = ref([])
const seleccionados = ref([])
const filtro = ref('')
const cargando = ref(true)
const errorCarga = ref(null)
const errorGeneral = ref('')
const guardando = ref(false)

const activos = computed(() => clientes.value.filter((cliente) => cliente.activo))
const visibles = computed(() => filtrarContadores(activos.value, filtro.value ?? ''))

const cambios = computed(() => calcularCambiosDeCartera(cargados.value, seleccionados.value))
const hayDatosSinGuardar = computed(
  () => cambios.value.agregar.length > 0 || cambios.value.quitar.length > 0,
)

const DIALOGO = {
  transitionShow: 'dialogo-entra',
  transitionHide: 'dialogo-sale',
  transitionDuration: 220,
}

// Esc, clic fuera o «Cancelar» con cambios: se pregunta antes de perderlos.
const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Los clientes que marcaste o desmarcaste no se guardarán.',
    cancel: {
      label: 'Seguir editando',
      flat: true,
      noCaps: true,
      class: 'control-touch boton-presionable',
    },
    ok: {
      label: 'Descartar',
      color: 'dg-error',
      noCaps: true,
      unelevated: true,
      class: 'control-touch boton-presionable',
    },
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

// Lee los clientes y la cartera actual del tipo. Solo se marcan los clientes activos: los desactivados
// no salen en la lista y su asignación no se toca al guardar.
const cargar = async () => {
  cargando.value = true
  errorCarga.value = null
  try {
    const [listaClientes, idsDelTipo] = await Promise.all([
      listarClientes(),
      listarClientesDeTipo(props.tipo.id),
    ])
    clientes.value = listaClientes
    const idsActivos = new Set(listaClientes.filter((c) => c.activo).map((c) => c.id))
    cargados.value = idsDelTipo.filter((id) => idsActivos.has(id))
    seleccionados.value = [...cargados.value]
  } catch (error) {
    errorCarga.value = error
  } finally {
    cargando.value = false
  }
}

// Cada apertura empieza limpia y relee los datos por si cambiaron. Se lanza antes de mostrar el diálogo
// para que no aparezca un instante el aviso de «sin clientes» mientras llegan los datos.
const alAbrir = () => {
  filtro.value = ''
  errorGeneral.value = ''
  clientes.value = []
  cargados.value = []
  seleccionados.value = []
  cargar()
}

const guardar = async () => {
  if (guardando.value || !hayDatosSinGuardar.value) return
  errorGeneral.value = ''
  guardando.value = true
  try {
    await guardarClientesDeTipo(props.tipo.id, cambios.value)
    const total = seleccionados.value.length
    dialogoAbierto.value = false
    emit('guardado', { tipoId: props.tipo.id, total })
  } catch (error) {
    errorGeneral.value = error?.mensaje ?? 'No se pudieron guardar los clientes. Intenta de nuevo.'
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.clientes-tipo {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.clientes-tipo__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.clientes-tipo__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.clientes-tipo__body,
.clientes-tipo__cargando {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.clientes-tipo__lista {
  max-height: min(320px, 45vh);
  overflow-y: auto;
  border-color: var(--dg-borde);
  border-radius: 8px;
}

.clientes-tipo__nombre {
  color: var(--dg-texto);
  overflow-wrap: anywhere;
}

.clientes-tipo__vacio {
  margin: 0;
  color: var(--dg-texto-secundario);
  font-size: 0.9rem;
  line-height: 1.45;
}

.clientes-tipo__contador {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.clientes-tipo__error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
