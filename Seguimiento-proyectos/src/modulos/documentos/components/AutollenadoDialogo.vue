<template>
  <!--
    Modal de autollenado: elige un cliente con recepciones previas y un tipo de
    recepción. Al aplicar, la vista vuelca la plantilla sobre el formulario, sin
    tocar periodo, archivos ni firmas.
  -->
  <q-dialog
    :model-value="modelValue"
    aria-label="Autollenar la recepción con un cliente frecuente"
    @update:model-value="(abierto) => emit('update:modelValue', abierto)"
  >
    <q-card class="dialogo-autollenado">
      <q-card-section class="row items-center no-wrap q-pb-sm">
        <div class="col">
          <div class="text-h6 text-weight-bold text-primary">Autollenar recepción</div>
          <div class="text-caption text-grey-8">
            Elige un cliente con recepciones previas y el tipo de recepción. Se llenarán los datos
            de clasificación; el periodo, los archivos y las firmas los pones tú.
          </div>
        </div>
        <q-btn icon="close" flat round dense aria-label="Cerrar sin autollenar" v-close-popup>
          <q-tooltip>Cerrar sin autollenar</q-tooltip>
        </q-btn>
      </q-card-section>

      <q-card-section class="q-pt-none column q-gutter-y-md">
        <q-select
          v-model="clienteElegido"
          :options="clientes"
          label="Cliente frecuente *"
          name="cliente-autollenado"
          autocomplete="off"
          outlined
          dense
          options-dense
          emit-value
          map-options
          dropdown-icon="expand_more"
          popup-content-class="menu-seleccion-custom"
          transition-show="jump-down"
          transition-hide="jump-up"
          class="selector-moderno"
        >
          <template #prepend>
            <q-icon name="person_search" color="primary" />
          </template>
          <template #selected-item="scope">
            <span class="text-weight-medium text-primary ellipsis">
              {{ scope.opt?.label ?? scope.opt }}
            </span>
          </template>
          <template #option="{ itemProps, opt, selected }">
            <q-item
              v-bind="itemProps"
              :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
            >
              <q-item-section avatar class="item-seccion-icono">
                <q-icon
                  name="person"
                  size="18px"
                  :class="selected ? 'text-primary' : 'text-grey-8'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ opt?.label ?? opt }}</q-item-label>
              </q-item-section>
              <q-item-section v-if="selected" side>
                <q-icon name="check" size="16px" color="primary" />
              </q-item-section>
            </q-item>
          </template>
          <q-tooltip>Solo aparecen clientes con al menos una recepción registrada</q-tooltip>
        </q-select>

        <q-select
          v-model="tipoElegido"
          :options="tipos"
          label="Tipo de recepción *"
          name="tipo-recepcion-autollenado"
          autocomplete="off"
          outlined
          dense
          options-dense
          dropdown-icon="expand_more"
          popup-content-class="menu-seleccion-custom"
          transition-show="jump-down"
          transition-hide="jump-up"
          class="selector-moderno"
        >
          <template #prepend>
            <q-icon name="event_repeat" color="primary" />
          </template>
          <template #selected-item="scope">
            <span class="text-weight-medium text-primary ellipsis">
              {{ scope.opt?.label ?? scope.opt }}
            </span>
          </template>
          <template #option="{ itemProps, opt, selected }">
            <q-item
              v-bind="itemProps"
              :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
            >
              <q-item-section avatar class="item-seccion-icono">
                <q-icon
                  name="event_repeat"
                  size="18px"
                  :class="selected ? 'text-primary' : 'text-grey-8'"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ opt?.label ?? opt }}</q-item-label>
              </q-item-section>
              <q-item-section v-if="selected" side>
                <q-icon name="check" size="16px" color="primary" />
              </q-item-section>
            </q-item>
          </template>
          <q-tooltip>Frecuencia con la que el cliente entrega la papelería</q-tooltip>
        </q-select>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md q-pt-none">
        <q-btn flat label="Cancelar" color="grey-8" v-close-popup />
        <q-btn
          label="Aplicar"
          color="primary"
          icon-right="auto_awesome"
          :disable="!puedeAplicar"
          @click="confirmar"
        >
          <q-tooltip>Volcar la plantilla en el formulario</q-tooltip>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  // Si el modal está abierto (v-model).
  modelValue: { type: Boolean, default: false },
  // Opciones de `opcionesDeClientes`: { value, label, clave, razonSocial, rfc }.
  clientes: { type: Array, default: () => [] },
  // Tipos de recepción: ['Mensual', 'Trimestral', ...].
  tipos: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'confirmar'])

const clienteElegido = ref(null)
const tipoElegido = ref(null)

const puedeAplicar = computed(() => clienteElegido.value != null && tipoElegido.value != null)

// Cada apertura empieza limpia: no se arrastra la elección anterior.
watch(
  () => props.modelValue,
  (abierto) => {
    if (!abierto) return
    clienteElegido.value = null
    tipoElegido.value = null
  },
)

const confirmar = () => {
  if (!puedeAplicar.value) return
  emit('confirmar', {
    clienteId: clienteElegido.value,
    tipoRecepcion: tipoElegido.value,
  })
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.dialogo-autollenado {
  width: 560px;
  max-width: 92vw;
}
</style>
