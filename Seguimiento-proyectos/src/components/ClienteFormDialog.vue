<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="cliente-form-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="cliente-form">
      <q-form
        class="cliente-form__form"
        novalidate
        aria-label="Formulario de cliente"
        @submit="guardar"
      >
        <q-card-section>
          <h2 id="cliente-form-titulo" class="cliente-form__title">
            {{ esEdicion ? 'Editar cliente' : 'Agregar cliente' }}
          </h2>
          <p class="cliente-form__help">
            Es un cliente tuyo: solo tú lo ves. Los campos con * son obligatorios.
          </p>
        </q-card-section>

        <q-card-section class="cliente-form__body">
          <div class="form-group">
            <label for="cliente-nombre" class="form-label"
              >Nombre <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="cliente-nombre"
              v-model="form.nombre"
              type="text"
              placeholder="Nombre del cliente o de la empresa"
              maxlength="151"
              autocomplete="off"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="cliente-nombre-ayuda"
              :error="!!erroresCampo.nombre"
              :error-message="erroresCampo.nombre"
              @update:model-value="erroresCampo.nombre = null"
            >
              <template #prepend><q-icon name="business" aria-hidden="true" /></template>
              <q-tooltip
                >Nombre con el que reconocerás a este cliente en tus actividades.</q-tooltip
              >
            </q-input>
            <p id="cliente-nombre-ayuda" class="form-help">
              Máximo 150 caracteres. No puede repetir el nombre de otro cliente tuyo.
            </p>
          </div>

          <div class="form-group">
            <label for="cliente-rfc" class="form-label">RFC (opcional)</label>
            <q-input
              for="cliente-rfc"
              v-model="form.rfc"
              type="text"
              placeholder="ABC010101XY1"
              maxlength="14"
              autocomplete="off"
              outlined
              dense
              class="input-moderno"
              input-class="cliente-form__rfc"
              aria-describedby="cliente-rfc-ayuda"
              :error="!!erroresCampo.rfc"
              :error-message="erroresCampo.rfc"
              @update:model-value="erroresCampo.rfc = null"
            >
              <template #prepend><q-icon name="badge" aria-hidden="true" /></template>
              <q-tooltip
                >RFC del cliente: 12 caracteres si es empresa o 13 si es persona física.</q-tooltip
              >
            </q-input>
            <p id="cliente-rfc-ayuda" class="form-help">
              12 caracteres (empresa) o 13 (persona física). Se guarda en mayúsculas.
            </p>
          </div>

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
            type="submit"
            color="primary"
            :label="esEdicion ? 'Guardar cambios' : 'Agregar cliente'"
            :icon="esEdicion ? 'save' : 'add_business'"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>{{
              esEdicion ? 'Guarda los cambios de este cliente.' : 'Agrega el cliente a tu lista.'
            }}</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import { actualizarCliente, crearCliente } from '../services/clienteService.js'
import { normalizarRfc, validarDatosCliente } from '../utils/actividades.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Cliente que se edita; null para agregar uno nuevo. */
  cliente: { type: Object, default: null },
})

const emit = defineEmits(['guardado'])

const $q = useQuasar()
const tarjeta = ref(null)
const esEdicion = computed(() => props.cliente !== null)

const form = reactive({ nombre: '', rfc: '' })
const erroresCampo = reactive({ nombre: null, rfc: null })
const errorGeneral = ref('')
const guardando = ref(false)

// Lo que había al abrir: sirve para saber si hay algo sin guardar (también al editar).
const inicial = reactive({ nombre: '', rfc: '' })

const hayDatosSinGuardar = computed(
  () => form.nombre.trim() !== inicial.nombre || (normalizarRfc(form.rfc) ?? '') !== inicial.rfc,
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
    message: 'Lo que escribiste en este formulario se perderá.',
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

const enfocarPrimerCampo = () => {
  nextTick(() => document.getElementById('cliente-nombre')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

// Cada apertura empieza con los datos del cliente (o vacía) y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  form.nombre = props.cliente?.nombre ?? ''
  form.rfc = props.cliente?.rfc ?? ''
  inicial.nombre = form.nombre.trim()
  inicial.rfc = form.rfc
  erroresCampo.nombre = null
  erroresCampo.rfc = null
  errorGeneral.value = ''
})

const guardar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''

  const validacion = validarDatosCliente(form)
  erroresCampo.nombre = validacion.errores.nombre ?? null
  erroresCampo.rfc = validacion.errores.rfc ?? null
  if (!validacion.valido) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    const cliente = esEdicion.value
      ? await actualizarCliente(props.cliente.id, { nombre: form.nombre, rfc: form.rfc })
      : await crearCliente({ nombre: form.nombre, rfc: form.rfc })
    dialogoAbierto.value = false
    emit('guardado', cliente, esEdicion.value)
  } catch (error) {
    // El nombre repetido va bajo «Nombre»; cualquier otro error, al aviso general.
    if (error?.codigoHttp === 409 || /ya existe/i.test(error?.mensaje ?? '')) {
      erroresCampo.nombre =
        'Ya existe un cliente tuyo con ese nombre. Usa otro o edita el que ya tienes.'
      enfocarPrimerError()
    } else {
      errorGeneral.value = error?.mensaje ?? 'No se pudo guardar el cliente. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.cliente-form {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.cliente-form__form,
.cliente-form__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.cliente-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.cliente-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.cliente-form :deep(.cliente-form__rfc) {
  text-transform: uppercase;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
