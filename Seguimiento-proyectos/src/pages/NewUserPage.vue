<template>
  <q-page class="new-user-page">
    <div class="new-user-page__head">
      <p class="new-user-page__lead">
        Da de alta una cuenta nueva. La persona entrará con este correo y esta contraseña, y verá
        las pantallas del rol que elijas.
      </p>
    </div>

    <section class="new-user-panel" aria-labelledby="new-user-title">
      <div class="new-user-panel__head">
        <h2 id="new-user-title" class="new-user-panel__title">Datos de la cuenta</h2>
        <p class="new-user-panel__help">Todos los campos son obligatorios.</p>
      </div>

      <form
        class="new-user-form"
        novalidate
        aria-label="Formulario de alta de usuario"
        @submit.prevent="darDeAlta"
      >
        <div class="form-group">
          <label for="name-field" class="form-label"
            >Nombre <span aria-label="obligatorio" class="required-mark">*</span></label
          >
          <q-input
            for="name-field"
            v-model="nombre"
            type="text"
            placeholder="Nombre completo de la persona"
            maxlength="151"
            autocomplete="off"
            outlined
            dense
            aria-required="true"
            aria-describedby="name-help"
            :error="!!errores.nombre"
            :error-message="errores.nombre"
            @update:model-value="alEditar('nombre')"
          >
            <q-tooltip>Nombre que se verá en el menú y en el directorio; sin títulos como Lic. o Ing.</q-tooltip>
          </q-input>
          <p id="name-help" class="form-help">Máximo 150 caracteres.</p>
        </div>

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
            <q-tooltip>Correo con el que la persona iniciará sesión; no puede repetir uno existente.</q-tooltip>
          </q-input>
          <p id="email-help" class="form-help">Máximo 150 caracteres. No puede estar ya en uso.</p>
        </div>

        <div class="form-group">
          <label for="password-field" class="form-label"
            >Contraseña <span aria-label="obligatorio" class="required-mark">*</span></label
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
            <q-tooltip>Contraseña inicial de la cuenta; compártela con la persona por un medio seguro.</q-tooltip>
          </q-input>
          <p id="password-help" class="form-help">Al menos 8 caracteres.</p>
        </div>

        <div class="form-group">
          <label for="role-field" class="form-label"
            >Rol <span aria-label="obligatorio" class="required-mark">*</span></label
          >
          <q-select
            for="role-field"
            v-model="rol"
            :options="opcionesRol"
            placeholder="Elige un rol"
            outlined
            dense
            emit-value
            map-options
            aria-required="true"
            aria-describedby="role-help"
            :error="!!errores.rol"
            :error-message="errores.rol"
            @update:model-value="alEditar('rol')"
          >
            <q-tooltip>El rol decide qué pantallas verá la persona al iniciar sesión.</q-tooltip>
          </q-select>
          <p id="role-help" class="form-help">
            Administrador ve el dashboard; Contador registra sus casos; Usuario de sistema da de
            alta cuentas.
          </p>
        </div>

        <div class="form-actions">
          <q-btn
            type="submit"
            color="primary"
            label="Dar de alta"
            icon="person_add"
            no-caps
            unelevated
            class="control-touch"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>Crea la cuenta con los datos del formulario.</q-tooltip>
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

import { crearUsuario } from '../services/userService.js'
import { PROFILES } from '../utils/constants.js'
import { formatearRol } from '../utils/formateadores.js'
import { validarAltaUsuario } from '../utils/validators.js'

/** Texto de cada código de `validarAltaUsuario`. */
const MENSAJES = {
  nombre_requerido: 'El nombre es obligatorio.',
  nombre_demasiado_largo: 'El nombre supera los 150 caracteres permitidos.',
  correo_requerido: 'El correo es obligatorio.',
  correo_demasiado_largo: 'El correo supera los 150 caracteres permitidos.',
  correo_invalido: 'Escribe un correo válido, por ejemplo nombre@delgrow.mx.',
  password_requerida: 'La contraseña es obligatoria.',
  password_corta: 'La contraseña debe tener al menos 8 caracteres.',
  rol_requerido: 'Elige el rol de la cuenta.',
}

const opcionesRol = Object.values(PROFILES).map((valor) => ({
  label: formatearRol(valor),
  value: valor,
}))

const nombre = ref('')
const correo = ref('')
const password = ref('')
const rol = ref(null)
const errores = reactive({ nombre: null, correo: null, password: null, rol: null })
const errorGeneral = ref('')
const mensajeExito = ref('')
const guardando = ref(false)

// Al editar un campo se quita su error y el aviso de la alta anterior, para no confundirla con la nueva.
const alEditar = (campo) => {
  errores[campo] = null
  mensajeExito.value = ''
}

const darDeAlta = async () => {
  if (guardando.value) return

  errorGeneral.value = ''
  mensajeExito.value = ''

  const validacion = validarAltaUsuario(nombre.value, correo.value, password.value, rol.value)
  for (const campo of Object.keys(errores)) {
    const codigo = validacion.errores[campo]
    errores[campo] = codigo ? MENSAJES[codigo] : null
  }
  if (!validacion.valido) return

  guardando.value = true
  try {
    mensajeExito.value = await crearUsuario({
      nombre: nombre.value,
      correo: correo.value,
      password: password.value,
      rol: rol.value,
    })
    nombre.value = ''
    correo.value = ''
    password.value = ''
    rol.value = null
  } catch (error) {
    // Con las validaciones previas, el único 400 posible es el correo repetido.
    if (error?.codigoHttp === 400) {
      errores.correo = error.mensaje
    } else {
      errorGeneral.value = error?.mensaje ?? 'No se pudo dar de alta la cuenta. Intenta de nuevo.'
    }
  } finally {
    guardando.value = false
  }
}
</script>

<style scoped>
.new-user-page {
  padding: 16px;
  min-width: 0;
}

.new-user-page__head {
  margin-bottom: 16px;
}

.new-user-page__lead {
  margin: 0;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.new-user-panel {
  display: flex;
  flex-direction: column;
  max-width: 640px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbe4ee;
  border-radius: 12px;
  background: #f7f9fc;
}

.new-user-panel__head {
  margin-bottom: 12px;
}

.new-user-panel__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.new-user-panel__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
}

.new-user-form {
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
  .new-user-page {
    padding: 20px 24px;
  }
}
</style>
