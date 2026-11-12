<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="cambiar-contrasena-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="cambiar-contrasena">
      <q-form
        class="cambiar-contrasena__form"
        novalidate
        aria-label="Formulario para cambiar tu contraseña"
        @submit="guardar"
      >
        <q-card-section>
          <h2 id="cambiar-contrasena-titulo" class="cambiar-contrasena__title">Cambiar contraseña</h2>
          <p class="cambiar-contrasena__help">
            Escribe tu contraseña actual y elige una nueva. Tu sesión seguirá abierta.
          </p>
        </q-card-section>

        <q-card-section class="cambiar-contrasena__body">
          <div class="form-group">
            <label for="cambiar-actual" class="form-label"
              >Contraseña actual <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="cambiar-actual"
              v-model="form.actual"
              :type="ver.actual ? 'text' : 'password'"
              autocomplete="current-password"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              :error="!!erroresCampo.actual"
              :error-message="erroresCampo.actual"
              @update:model-value="erroresCampo.actual = null"
            >
              <template #prepend>
                <q-icon name="lock" aria-hidden="true" />
              </template>
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  :icon="ver.actual ? 'visibility_off' : 'visibility'"
                  :aria-label="ver.actual ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'"
                  :aria-pressed="ver.actual ? 'true' : 'false'"
                  class="control-touch"
                  @click="ver.actual = !ver.actual"
                >
                  <q-tooltip>{{ ver.actual ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
          </div>

          <div class="form-group">
            <label for="cambiar-nueva" class="form-label"
              >Contraseña nueva <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="cambiar-nueva"
              v-model="form.nueva"
              :type="ver.nueva ? 'text' : 'password'"
              placeholder="Al menos 8 caracteres"
              autocomplete="new-password"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="cambiar-nueva-ayuda"
              :error="!!erroresCampo.nueva"
              :error-message="erroresCampo.nueva"
              @update:model-value="erroresCampo.nueva = null"
            >
              <template #prepend>
                <q-icon name="lock_reset" aria-hidden="true" />
              </template>
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  :icon="ver.nueva ? 'visibility_off' : 'visibility'"
                  :aria-label="ver.nueva ? 'Ocultar contraseña nueva' : 'Mostrar contraseña nueva'"
                  :aria-pressed="ver.nueva ? 'true' : 'false'"
                  class="control-touch"
                  @click="ver.nueva = !ver.nueva"
                >
                  <q-tooltip>{{ ver.nueva ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
            <p id="cambiar-nueva-ayuda" class="form-help">Al menos 8 caracteres y distinta a la actual.</p>
          </div>

          <div class="form-group">
            <label for="cambiar-confirmacion" class="form-label"
              >Confirma la contraseña nueva <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="cambiar-confirmacion"
              v-model="form.confirmacion"
              :type="ver.confirmacion ? 'text' : 'password'"
              autocomplete="new-password"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              :error="!!erroresCampo.confirmacion"
              :error-message="erroresCampo.confirmacion"
              @update:model-value="erroresCampo.confirmacion = null"
            >
              <template #prepend>
                <q-icon name="lock_reset" aria-hidden="true" />
              </template>
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  :icon="ver.confirmacion ? 'visibility_off' : 'visibility'"
                  :aria-label="ver.confirmacion ? 'Ocultar confirmación' : 'Mostrar confirmación'"
                  :aria-pressed="ver.confirmacion ? 'true' : 'false'"
                  class="control-touch"
                  @click="ver.confirmacion = !ver.confirmacion"
                >
                  <q-tooltip>{{ ver.confirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
                </q-btn>
              </template>
            </q-input>
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
            <q-tooltip>Cierra sin cambiar la contraseña.</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            label="Guardar contraseña"
            icon="check"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>Guarda tu contraseña nueva.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

import { cambiarMiContrasena } from '../services/authService.js'
import { validarCambioContrasenaPropia } from '../utils/validators.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const $q = useQuasar()
const tarjeta = ref(null)

const MENSAJES = {
  actual_requerida: 'Falta la contraseña actual. Escríbela para continuar.',
  password_requerida: 'Falta la contraseña nueva. Escríbela para continuar.',
  password_corta: 'La contraseña nueva debe tener al menos 8 caracteres.',
  nueva_igual_actual: 'La contraseña nueva debe ser distinta a la actual.',
  confirmacion_requerida: 'Falta confirmar la contraseña nueva. Escríbela otra vez.',
  confirmacion_distinta: 'Las contraseñas nuevas no coinciden. Escríbelas igual.',
}

const form = reactive({ actual: '', nueva: '', confirmacion: '' })
const erroresCampo = reactive({ actual: null, nueva: null, confirmacion: null })
const ver = reactive({ actual: false, nueva: false, confirmacion: false })
const errorGeneral = ref('')
const guardando = ref(false)

const hayDatosSinGuardar = computed(() => form.actual !== '' || form.nueva !== '' || form.confirmacion !== '')

const DIALOGO = { transitionShow: 'dialogo-entra', transitionHide: 'dialogo-sale', transitionDuration: 220 }

// Esc, clic fuera o «Cancelar» con datos escritos: se pregunta antes de perderlos.
const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Lo que escribiste en este formulario se perderá.',
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

const enfocarPrimerCampo = () => {
  nextTick(() => document.getElementById('cambiar-actual')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

/** Campo al que se refiere un error del servidor («… sobre contraseña actual: …»), o null. */
const campoDelError = (mensaje) => {
  const sobre = /sobre\s+(.+?):/i.exec(String(mensaje ?? ''))
  const nombre = sobre?.[1].trim().toLowerCase()
  if (nombre === 'contraseña actual') return 'actual'
  if (nombre === 'contraseña') return 'nueva'
  return null
}

// Cada apertura empieza vacía y sin errores de la vez anterior.
watch(dialogoAbierto, () => {
  form.actual = ''
  form.nueva = ''
  form.confirmacion = ''
  erroresCampo.actual = null
  erroresCampo.nueva = null
  erroresCampo.confirmacion = null
  ver.actual = false
  ver.nueva = false
  ver.confirmacion = false
  errorGeneral.value = ''
})

const guardar = async () => {
  if (guardando.value) return
  errorGeneral.value = ''

  // Se valida y se envía lo mismo y recortado, como hace el inicio de sesión.
  const actual = form.actual.trim()
  const nueva = form.nueva.trim()
  const confirmacion = form.confirmacion.trim()

  const validacion = validarCambioContrasenaPropia(actual, nueva, confirmacion)
  for (const campo of ['actual', 'nueva', 'confirmacion']) {
    erroresCampo[campo] = validacion.errores[campo] ? MENSAJES[validacion.errores[campo]] : null
  }
  if (!validacion.valido) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    await cambiarMiContrasena({ passwordActual: actual, password: nueva })
    dialogoAbierto.value = false
    $q.notify({ type: 'positive', message: 'Contraseña actualizada.' })
  } catch (error) {
    // Si el error nombra un campo se muestra junto a él; lo escrito se conserva.
    const campo = campoDelError(error?.mensaje)
    if (campo) {
      erroresCampo[campo] = error.mensaje
      enfocarPrimerError()
    } else {
      errorGeneral.value = error?.mensaje ?? 'No se pudo cambiar la contraseña. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.cambiar-contrasena {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.cambiar-contrasena__form,
.cambiar-contrasena__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.cambiar-contrasena__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.cambiar-contrasena__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */
</style>
