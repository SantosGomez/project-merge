<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="tipo-form-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="tipo-form">
      <q-form
        class="tipo-form__form"
        novalidate
        aria-label="Formulario de tipo de actividad"
        @submit="guardar"
      >
        <q-card-section>
          <h2 id="tipo-form-titulo" class="tipo-form__title">
            {{ esEdicion ? 'Editar tipo de actividad' : 'Agregar tipo de actividad' }}
          </h2>
          <p class="tipo-form__help">
            Es un tipo tuyo (por ejemplo «Revisión de facturas»): solo tú lo ves. Los campos con *
            son obligatorios.
          </p>
        </q-card-section>

        <q-card-section class="tipo-form__body">
          <div class="form-group">
            <label for="tipo-nombre" class="form-label"
              >Nombre <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="tipo-nombre"
              v-model="form.nombre"
              type="text"
              placeholder="Nombre de la actividad"
              maxlength="121"
              autocomplete="off"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="tipo-nombre-ayuda"
              :error="!!erroresCampo.nombre"
              :error-message="erroresCampo.nombre"
              @update:model-value="erroresCampo.nombre = null"
            >
              <template #prepend><q-icon name="task_alt" aria-hidden="true" /></template>
              <q-tooltip
                >Nombre con el que reconocerás esta actividad cuando la registres.</q-tooltip
              >
            </q-input>
            <p id="tipo-nombre-ayuda" class="form-help">
              Máximo 120 caracteres. No puede repetir el nombre de otro tipo tuyo.
            </p>
          </div>

          <div class="form-group">
            <q-toggle
              v-model="form.cobrable"
              label="Cobrable"
              color="primary"
              class="control-touch"
              aria-describedby="tipo-cobrable-ayuda"
            >
              <q-tooltip>Actívalo si el tiempo de esta actividad se le cobra al cliente.</q-tooltip>
            </q-toggle>
            <p id="tipo-cobrable-ayuda" class="form-help">
              Indica si el tiempo de esta actividad se cobra al cliente. Por defecto no.
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
            :label="esEdicion ? 'Guardar cambios' : 'Agregar tipo'"
            :icon="esEdicion ? 'save' : 'playlist_add'"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>{{
              esEdicion ? 'Guarda los cambios de este tipo.' : 'Agrega el tipo a tu lista.'
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

import { actualizarTipo, crearTipo } from '../services/tipoActividadService.js'
import { validarDatosTipo } from '../utils/actividades.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Tipo que se edita; null para agregar uno nuevo. */
  tipo: { type: Object, default: null },
})

const emit = defineEmits(['guardado'])

const $q = useQuasar()
const tarjeta = ref(null)
const esEdicion = computed(() => props.tipo !== null)

const form = reactive({ nombre: '', cobrable: false })
const erroresCampo = reactive({ nombre: null })
const errorGeneral = ref('')
const guardando = ref(false)

// Lo que había al abrir: sirve para saber si hay algo sin guardar (también al editar).
const inicial = reactive({ nombre: '', cobrable: false })

const hayDatosSinGuardar = computed(
  () => form.nombre.trim() !== inicial.nombre || form.cobrable !== inicial.cobrable,
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
  nextTick(() => document.getElementById('tipo-nombre')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

// Cada apertura empieza con los datos del tipo (o vacía) y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  form.nombre = props.tipo?.nombre ?? ''
  form.cobrable = props.tipo?.cobrable ?? false
  inicial.nombre = form.nombre.trim()
  inicial.cobrable = form.cobrable
  erroresCampo.nombre = null
  errorGeneral.value = ''
})

const guardar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''

  const validacion = validarDatosTipo(form)
  erroresCampo.nombre = validacion.errores.nombre ?? null
  if (!validacion.valido) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    const datos = { nombre: form.nombre, cobrable: form.cobrable }
    const tipo = esEdicion.value
      ? await actualizarTipo(props.tipo.id, datos)
      : await crearTipo(datos)
    dialogoAbierto.value = false
    emit('guardado', tipo, esEdicion.value)
  } catch (error) {
    // El nombre repetido va bajo «Nombre»; cualquier otro error, al aviso general.
    if (error?.codigoHttp === 409 || /ya existe/i.test(error?.mensaje ?? '')) {
      erroresCampo.nombre =
        'Ya existe un tipo tuyo con ese nombre. Usa otro o edita el que ya tienes.'
      enfocarPrimerError()
    } else {
      errorGeneral.value =
        error?.mensaje ?? 'No se pudo guardar el tipo de actividad. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.tipo-form {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.tipo-form__form,
.tipo-form__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.tipo-form__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.tipo-form__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
