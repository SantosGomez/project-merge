<template>
  <q-dialog v-model="dialogoAbierto" :persistent="guardando" aria-labelledby="restablecer-titulo">
    <q-card class="restablecer">
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
              >Contraseña nueva <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
              for="restablecer-password"
              v-model="password"
              type="password"
              placeholder="Al menos 8 caracteres"
              autocomplete="new-password"
              outlined
              dense
              aria-required="true"
              aria-describedby="restablecer-password-ayuda"
              :error="!!errores.password"
              :error-message="errores.password"
              @update:model-value="errores.password = null"
            >
              <q-tooltip>Contraseña nueva de la cuenta; compártela con la persona por un medio seguro.</q-tooltip>
            </q-input>
            <p id="restablecer-password-ayuda" class="form-help">
              Al menos 8 caracteres. La persona creará su propia contraseña al entrar.
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
            class="control-touch"
            :disable="guardando"
            @click="dialogoAbierto = false"
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
            class="control-touch"
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
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { restablecerContrasena } from '../services/userService.js'
import { useSessionStore } from '../stores/session.js'
import { validarRestablecimiento } from '../utils/validators.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const props = defineProps({
  /** Fila del directorio: `{ nombre, correo }`. */
  cuenta: { type: Object, default: null },
})

const emit = defineEmits(['restablecida'])

/** Texto de cada código de `validarRestablecimiento`. */
const MENSAJES = {
  password_requerida: 'La contraseña nueva es obligatoria.',
  password_corta: 'La contraseña nueva debe tener al menos 8 caracteres.',
}

const router = useRouter()
const session = useSessionStore()

const password = ref('')
const errores = reactive({ password: null })
const errorGeneral = ref('')
const guardando = ref(false)

// Cada apertura empieza sin contraseña ni errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  password.value = ''
  errores.password = null
  errorGeneral.value = ''
})

const restablecer = async () => {
  if (guardando.value) return

  errorGeneral.value = ''

  // Solo se valida la contraseña: el correo ya está guardado y lo revisa el backend, así una
  // cuenta con un correo atípico no queda sin poder restablecerse.
  const validacion = validarRestablecimiento(props.cuenta.correo, password.value)
  const codigo = validacion.errores.password
  errores.password = codigo ? MENSAJES[codigo] : null
  if (validacion.errores.password) return

  guardando.value = true
  try {
    const { mensaje, cuentaPropia } = await restablecerContrasena({
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
    emit('restablecida', mensaje)
  } catch (error) {
    // El 404 es una cuenta que ya no existe (se borró después de cargar el directorio).
    errorGeneral.value = error?.mensaje ?? 'No se pudo restablecer la contraseña. Intenta de nuevo.'
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

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--dg-texto);
}

.required-mark {
  color: var(--dg-error);
  font-weight: 700;
}

.form-help {
  margin: 0 0 4px;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
}

.error-banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--dg-error-aviso-fondo);
  color: var(--dg-error-aviso-texto);
  font-size: 0.9rem;
}

.control-touch {
  min-height: 44px;
}
</style>
