<template>
  <!--
    Selector de cliente de la recepción: barra de búsqueda y cuadrícula de 20
    tarjetas por página. Las columnas se adaptan al ancho: 4 en escritorio, 3 en
    tablet horizontal, 2 en tablet y 1 en móvil, donde el modal ocupa la pantalla.
  -->
  <q-dialog
    :model-value="modelValue"
    :maximized="$q.screen.lt.sm"
    aria-label="Elegir cliente"
    @update:model-value="(abierto) => emit('update:modelValue', abierto)"
  >
    <q-card class="dialogo-selector column no-wrap">
      <q-card-section class="row items-center no-wrap q-pb-sm">
        <div class="col">
          <div class="text-h6 text-weight-bold text-primary">Elegir cliente</div>
          <div class="text-caption text-grey-8">
            Busca por clave, razón social o RFC y haz clic en la tarjeta del cliente.
          </div>
        </div>
        <q-btn icon="close" flat round dense aria-label="Cerrar sin elegir cliente" v-close-popup>
          <q-tooltip>Cerrar sin elegir cliente</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-input
          v-model="termino"
          label="Buscar cliente"
          name="buscar-cliente"
          autocomplete="off"
          outlined
          dense
          clearable
          autofocus
          class="input-busqueda-moderno"
          @keydown.enter.prevent="elegirUnico"
        >
          <template #prepend>
            <q-icon name="search" color="primary" />
          </template>
        </q-input>
        <div class="text-caption text-grey-8 q-mt-xs" aria-live="polite">{{ textoConteo }}</div>
      </q-card-section>

      <q-card-section class="col scroll q-pt-none">
        <div v-if="filtradas.length === 0" class="text-body2 text-grey-8 q-pa-md text-center">
          Ningún cliente coincide con esa clave, razón social o RFC.
        </div>

        <div v-else class="row q-col-gutter-sm">
          <div
            v-for="cliente in pagina.elementos"
            :key="cliente.value"
            class="col-12 col-sm-6 col-md-4 col-lg-3"
          >
            <button
              type="button"
              class="tarjeta-cliente full-width full-height"
              :class="{ 'tarjeta-elegida': cliente.value === seleccionado }"
              :aria-pressed="cliente.value === seleccionado"
              @click="elegir(cliente.value)"
            >
              <div class="row items-center no-wrap">
                <span class="clave-cliente">{{ cliente.clave || 'Sin clave' }}</span>
                <q-space />
                <span v-if="cliente.value === seleccionado" class="text-caption text-primary">
                  <q-icon name="check_circle" size="16px" /> Elegido
                </span>
              </div>
              <div class="razon-social text-body2 text-grey-9">{{ cliente.razonSocial }}</div>
              <div class="text-caption text-grey-8">RFC: {{ textoRfc(cliente.rfc) }}</div>
              <q-tooltip :delay="600">{{ cliente.razonSocial }}</q-tooltip>
            </button>
          </div>
        </div>
      </q-card-section>

      <q-card-section v-if="pagina.totalPaginas > 1" class="row justify-center q-pt-none">
        <q-pagination
          v-model="paginaActual"
          :max="pagina.totalPaginas"
          :max-pages="5"
          direction-links
          boundary-links
          color="primary"
          aria-label="Páginas de clientes"
        />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import {
  filtrarOpcionesClientes,
  paginarClientes,
  textoRfc,
  CLIENTES_POR_PAGINA,
} from '@/modulos/documentos/composables/clientesVista.js'

const props = defineProps({
  // Si el modal está abierto (v-model).
  modelValue: { type: Boolean, default: false },
  // Opciones de `opcionesDeClientes`: { value, label, clave, razonSocial, rfc }.
  clientes: { type: Array, default: () => [] },
  // Id del cliente ya elegido, para marcar su tarjeta.
  seleccionado: { type: Number, default: null },
})

const emit = defineEmits(['update:modelValue', 'elegir'])

const $q = useQuasar()

const termino = ref('')
const paginaActual = ref(1)

const filtradas = computed(() => filtrarOpcionesClientes(props.clientes, termino.value ?? ''))
const pagina = computed(() => paginarClientes(filtradas.value, paginaActual.value))

const textoConteo = computed(() => {
  const total = filtradas.value.length
  if (total === 0) return 'Sin resultados'
  const desde = (pagina.value.pagina - 1) * CLIENTES_POR_PAGINA + 1
  const hasta = desde + pagina.value.elementos.length - 1
  return `Mostrando ${desde}–${hasta} de ${total} ${total === 1 ? 'cliente' : 'clientes'}`
})

// Cada búsqueda empieza en la primera página.
watch(termino, () => {
  paginaActual.value = 1
})

// Al abrir, la búsqueda se vacía y la cuadrícula va a la página del cliente
// ya elegido, para que se vea marcado.
watch(
  () => props.modelValue,
  (abierto) => {
    if (!abierto) return
    termino.value = ''
    const indice = props.clientes.findIndex((c) => c.value === props.seleccionado)
    paginaActual.value = indice >= 0 ? Math.floor(indice / CLIENTES_POR_PAGINA) + 1 : 1
  },
)

const elegir = (id) => {
  emit('elegir', id)
  emit('update:modelValue', false)
}

// Enter en la búsqueda elige el cliente si solo queda uno: «0031» + Enter.
const elegirUnico = () => {
  if (filtradas.value.length === 1) elegir(filtradas.value[0].value)
}
</script>

<style scoped lang="scss">
.dialogo-selector {
  width: 1100px;
  max-width: 92vw;
  max-height: 90vh;
}

// En móvil el modal ocupa toda la pantalla (`maximized`).
.q-dialog__inner--maximized .dialogo-selector {
  max-width: 100vw;
  max-height: 100vh;
}

.tarjeta-cliente {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 104px;
  padding: 10px 12px;
  text-align: left;
  font: inherit;
  color: inherit;
  background: #fff;
  border: 1px solid $secondary-white;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.15s,
    border-color 0.15s;

  &:hover {
    background-color: $secondary-white-alternative;
  }

  &:focus-visible {
    outline: 2px solid $primary;
    outline-offset: 2px;
  }
}

.tarjeta-elegida {
  border: 2px solid $primary;
}

.clave-cliente {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: $primary;
}

// Dos líneas como máximo; el nombre completo está en el tooltip.
.razon-social {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
