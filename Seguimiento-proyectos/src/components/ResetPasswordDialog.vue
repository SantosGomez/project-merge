<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="restablecer-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="restablecer">
      <q-form
        class="restablecer__form"
        novalidate
        aria-label="Formulario para restablecer la contraseña"
        @submit="restablecer"
      >
        <q-card-section>
          <h2 id="restablecer-titulo" class="restablecer__title">Restablecer contraseña</h2>
          <p class="restablecer__help">
            La cuenta tendrá esta contraseña nueva y se cerrarán todas sus sesiones abiertas.
          </p>
          <p v-if="esCuentaPropia" class="restablecer__propia" role="note">
            Es tu propia cuenta: al guardar se cerrará tu sesión y tendrás que entrar con la
            contraseña nueva.
          </p>
        </q-card-section>

        <q-card-section class="restablecer__body">
          <dl class="restablecer__cuenta">
            <div class="restablecer__dato">
              <dt>Cuenta</dt>
              <dd>{{ cuenta?.nombre }}</dd>
            </div>
            <div class="restablecer__dato">
              <dt>Correo</dt>
              <dd>{{ cuenta?.correo }}</dd>
            </div>
          </dl>

          <div class="form-group">
            <label for="restablecer-password" class="form-label"
              >Contraseña nueva <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="restablecer-password"
              v-model="password"
              :type="verPassword ? 'text' : 'password'"
              placeholder="Al menos 8 caracteres"
              autocomplete="new-password"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="restablecer-password-ayuda"
              :error="!!errores.password"
              :error-message="errores.password"
              @update:model-value="errores.password = null"
            >
              <template #prepend>
                <q-icon name="lock_reset" aria-hidden="true" />
              </template>
              <template #append>
                <q-btn
                  flat
                  round
                  dense
                  :icon="verPassword ? 'visibility_off' : 'visibility'"
                  :aria-label="verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  :aria-pressed="verPassword ? 'true' : 'false'"
                  class="control-touch"
                  @click="verPassword = !verPassword"
                >
                  <q-tooltip>{{ verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="verPassword && password"
                  flat
                  round
                  dense
                  icon="content_copy"
                  aria-label="Copiar contraseña"
                  class="control-touch"
                  @click="copiarPassword"
                >
                  <q-tooltip>Copia la contraseña para compartirla.</q-tooltip>
                </q-btn>
              </template>
            </q-input>
            <p id="restablecer-password-ayuda" class="form-help">
              Al menos 8 caracteres. Es temporal: al iniciar sesión, la persona tendrá que cambiarla por la suya. Compártela por un medio seguro.
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
            <q-tooltip>Cierra sin cambiar la contraseña.</q-tooltip>
          </q-btn>
          <q-btn
            type="submit"
            color="primary"
            label="Restablecer"
            icon="lock_reset"
            no-caps
            unelevated
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>Guarda la contraseña nueva de esta cuenta.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

import { restablecerContrasena } from '../services/userService.js'
import { useSessionStore } from '../stores/session.js'
import { MENSAJES_VALIDACION } from '../utils/constants.js'
import { validarRestablecimiento } from '../utils/validators.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Fila del directorio: `{ nombre, correo }`. */
  cuenta: { type: Object, default: null },
})

const emit = defineEmits(['restablecida', 'cuenta-inexistente'])

const router = useRouter()
const session = useSessionStore()

const password = ref('')
const errores = reactive({ password: null })
const errorGeneral = ref('')
const guardando = ref(false)

const hayDatosSinGuardar = computed(() => password.value.trim() !== '')
const esCuentaPropia = computed(() => props.cuenta && String(props.cuenta.id) === String(session.id))

const $q = useQuasar()
const tarjeta = ref(null)
const verPassword = ref(false)

const DIALOGO = { transitionShow: 'dialogo-entra', transitionHide: 'dialogo-sale', transitionDuration: 220 }

// Esc, clic fuera o «Cancelar» con datos escritos: se pregunta antes de perderlos.
const pedirDescartar = () => {
  if (guardando.value) return
  $q.dialog({
    ...DIALOGO,
    title: '¿Descartar los cambios?',
    message: 'Lo que escribiste en este formulario se perderá.',
    cancel: { label: 'Seguir editando', flat: true, noCaps: true },
    ok: { label: 'Descartar', color: 'dg-error', noCaps: true, unelevated: true },
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
  nextTick(() => document.getElementById('restablecer-password')?.focus())
}

/** Lleva la vista y el foco al primer campo con error (en celular puede estar fuera de la pantalla). */
const enfocarPrimerError = () =>
  nextTick(() => {
    const campo = tarjeta.value?.$el?.querySelector('.q-field--error')
    if (!campo) return
    campo.scrollIntoView({ block: 'center' })
    campo.querySelector('input, textarea, [tabindex="0"]')?.focus({ preventScroll: true })
  })

const copiarPassword = () =>
  copyToClipboard(password.value)
    .then(() => $q.notify({ type: 'positive', message: 'Contraseña copiada.' }))
    .catch(() => $q.notify({ type: 'negative', message: 'No se pudo copiar; selecciónala y cópiala a mano.' }))

// Cada apertura empieza sin contraseña ni errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (abierto) {
    password.value = ''
    errores.password = null
    errorGeneral.value = ''
    verPassword.value = false
  } else {
    password.value = ''
    verPassword.value = false
  }
})

const restablecer = async () => {
  if (guardando.value) return

  errorGeneral.value = ''

  // Solo se valida la contraseña: el correo ya está guardado y lo revisa el backend, así una
  // cuenta con un correo atípico no queda sin poder restablecerse.
  const validacion = validarRestablecimiento(props.cuenta.correo, password.value)
  const codigo = validacion.errores.password
  errores.password = codigo ? MENSAJES_VALIDACION[codigo] : null
  if (validacion.errores.password) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    const { cuentaPropia } = await restablecerContrasena({
      correo: props.cuenta.correo,
      password: password.value,
    })
    // Cuenta propia: el backend ya revocó esta sesión; se cierra aquí y el login muestra el aviso.
    if (cuentaPropia) {
      session.cerrarSesionPorContrasenaNueva()
      await router.replace({ name: 'login' })
      return
    }
    dialogoAbierto.value = false
    emit('restablecida', props.cuenta.nombre)
  } catch (error) {
    // El 404 es una cuenta que ya no existe (se borró después de cargar el directorio).
    if (error?.codigoHttp === 404) {
      errorGeneral.value =
        'Esta cuenta ya no existe; puede que otra persona la haya borrado. Cierra este formulario; el directorio ya se actualizó.'
      emit('cuenta-inexistente')
    } else {
      errorGeneral.value = error?.mensaje ?? 'No se pudo restablecer la contraseña. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.restablecer {
  width: 100%;
  max-width: 480px;
  min-width: 0;
}

.restablecer__form,
.restablecer__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.restablecer__propia {
  margin: 8px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
  font-size: 0.9rem;
}

.restablecer__title {
  margin: 0 0 6px;
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.restablecer__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

.restablecer__cuenta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--dg-borde);
  border-radius: 8px;
  background: var(--dg-fondo-panel);
}

/* Correos y nombres largos se parten en varias líneas en lugar de desbordar. */
.restablecer__dato {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}

.restablecer__dato dt {
  font-weight: 600;
  color: var(--dg-texto);
}

.restablecer__dato dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--dg-texto-secundario);
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */

</style>
