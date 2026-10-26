<template>
  <q-page class="reset-password-page">
    <div class="reset-password-page__head">
      <p class="reset-password-page__lead">
        Cambia la contraseña de una cuenta que no puede entrar. La persona entrará con la
        contraseña nueva y se cerrarán las sesiones que tenga abiertas.
      </p>
    </div>

    <section class="reset-password-panel" aria-labelledby="reset-password-title">
      <div class="reset-password-panel__head">
        <h2 id="reset-password-title" class="reset-password-panel__title">Datos de la cuenta</h2>
        <p class="reset-password-panel__help">Todos los campos son obligatorios.</p>
      </div>

      <form
        class="reset-password-form"
        novalidate
        aria-label="Formulario para restablecer la contraseña"
        @submit.prevent="restablecer"
      >
        <div class="form-group">
          <label for="email-field" class="form-label"
            >Correo <span aria-label="obligatorio" class="required-mark">*</span></label
          >
          <q-input
            for="email-field"
            v-model="correo"
            type="email"
            placeholder="nombre@delgrow.mx"
            maxlength="151"
            autocomplete="off"
            outlined
            dense
            aria-required="true"
            aria-describedby="email-help"
            :error="!!errores.correo"
            :error-message="errores.correo"
            @update:model-value="alEditar('correo')"
          >
            <q-tooltip>Correo con el que la persona inicia sesión.</q-tooltip>
          </q-input>
          <p id="email-help" class="form-help">Escribe el correo completo de la cuenta.</p>
        </div>

        <div class="form-group">
          <label for="password-field" class="form-label"
            >Contraseña nueva <span aria-label="obligatorio" class="required-mark">*</span></label
          >
          <q-input
            for="password-field"
            v-model="password"
            type="password"
            placeholder="Al menos 8 caracteres"
            autocomplete="new-password"
            outlined
            dense
            aria-required="true"
            aria-describedby="password-help"
            :error="!!errores.password"
            :error-message="errores.password"
            @update:model-value="alEditar('password')"
          >
            <q-tooltip>Reemplaza la contraseña actual; compártela con la persona por un medio seguro.</q-tooltip>
          </q-input>
          <p id="password-help" class="form-help">Al menos 8 caracteres.</p>
        </div>

        <div class="form-actions">
          <q-btn
            type="submit"
            color="primary"
            label="Restablecer contraseña"
            icon="lock_reset"
            no-caps
            unelevated
            class="control-touch"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>Guarda la contraseña nueva para la cuenta con ese correo.</q-tooltip>
          </q-btn>
        </div>
      </form>

      <p v-if="errorGeneral" class="error-banner" role="alert">{{ errorGeneral }}</p>

      <div v-if="mensajeExito" class="success-banner" role="status" aria-live="polite">
        <q-icon name="check_circle" color="positive" size="24px" />
        <div>
          <p class="success-banner__title">{{ mensajeExito }}</p>
          <p class="success-banner__message">El formulario está limpio para otra cuenta.</p>
        </div>
      </div>
    </section>
  </q-page>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { restablecerContrasena } from '../services/userService.js'
import { useSessionStore } from '../stores/session.js'
import { validarRestablecimiento } from '../utils/validators.js'

/** Texto de cada código de `validarRestablecimiento`. */
const MENSAJES = {
  correo_requerido: 'El correo es obligatorio.',
  correo_demasiado_largo: 'El correo supera los 150 caracteres permitidos.',
  correo_invalido: 'Escribe un correo válido, por ejemplo nombre@delgrow.mx.',
  password_requerida: 'La contraseña nueva es obligatoria.',
  password_corta: 'La contraseña nueva debe tener al menos 8 caracteres.',
}

const router = useRouter()
const session = useSessionStore()

const correo = ref('')
const password = ref('')
const errores = reactive({ correo: null, password: null })
const errorGeneral = ref('')
const mensajeExito = ref('')
const guardando = ref(false)

// Al editar un campo se quita su error y el aviso anterior, para no confundirlo con el nuevo intento.
const alEditar = (campo) => {
  errores[campo] = null
  mensajeExito.value = ''
}

const restablecer = async () => {
  if (guardando.value) return

  errorGeneral.value = ''
  mensajeExito.value = ''

  const validacion = validarRestablecimiento(correo.value, password.value)
  for (const campo of Object.keys(errores)) {
    const codigo = validacion.errores[campo]
    errores[campo] = codigo ? MENSAJES[codigo] : null
  }
  if (!validacion.valido) return

  guardando.value = true
  try {
    const { mensaje, cuentaPropia } = await restablecerContrasena({
      correo: correo.value,
      password: password.value,
    })
    // Cuenta propia: el backend ya revocó esta sesión; se cierra aquí y el login muestra el aviso.
    if (cuentaPropia) {
      session.cerrarSesionPorContrasenaNueva()
      await router.replace({ name: 'login' })
      return
    }
    mensajeExito.value = mensaje
    correo.value = ''
    password.value = ''
  } catch (error) {
    // El 404 es un correo sin cuenta: se muestra bajo Correo con el texto del backend.
    if (error?.codigoHttp === 404) {
      errores.correo = error.mensaje
    } else {
      errorGeneral.value = error?.mensaje ?? 'No se pudo restablecer la contraseña. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.reset-password-page {
  padding: 16px;
  min-width: 0;
}

.reset-password-page__head {
  margin-bottom: 16px;
}

.reset-password-page__lead {
  margin: 0;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.reset-password-panel {
  display: flex;
  flex-direction: column;
  max-width: 640px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.reset-password-panel__head {
  margin-bottom: 12px;
}

.reset-password-panel__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.reset-password-panel__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

.reset-password-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #102a43;
}

.required-mark {
  color: #a3231b;
  font-weight: 700;
}

.form-help {
  margin: 0 0 4px;
  color: #486581;
  font-size: 0.85rem;
}

.form-actions {
  margin-top: 4px;
}

.error-banner {
  margin: 16px 0 0;
  padding: 12px 16px;
  border: 1px solid #f5c2c0;
  border-radius: 10px;
  background: #fdecea;
  color: #a3231b;
}

.success-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin-top: 16px;
  border: 1px solid #d4edda;
  border-radius: 10px;
  background: #e8f5e9;
}

.success-banner__title {
  margin: 0 0 2px;
  font-weight: 700;
  color: #1b5e20;
}

.success-banner__message {
  margin: 0;
  color: #2e7d32;
  font-size: 0.95rem;
}

.control-touch {
  min-width: 44px;
  min-height: 44px;
}

@media (min-width: 1024px) {
  .reset-password-page {
    padding: 20px 24px;
  }
}
</style>
