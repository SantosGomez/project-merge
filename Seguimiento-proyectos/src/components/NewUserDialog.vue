<template>
  <q-dialog v-model="dialogoAbierto" :persistent="guardando">
    <q-card class="nuevo-usuario" role="dialog" aria-modal="true" aria-labelledby="nuevo-usuario-titulo">
      <form
        class="nuevo-usuario__form"
        novalidate
        aria-label="Formulario de alta de usuario"
        @submit.prevent="darDeAlta"
      >
        <q-card-section>
          <h2 id="nuevo-usuario-titulo" class="nuevo-usuario__title">Nuevo usuario</h2>
          <p class="nuevo-usuario__help">
            La persona entrará con este correo y esta contraseña, y verá las pantallas del rol que
            elijas. Todos los campos son obligatorios.
          </p>
        </q-card-section>

        <q-card-section class="nuevo-usuario__body">
          <div class="form-group">
            <label for="nuevo-nombre" class="form-label"
              >Nombre <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
              for="nuevo-nombre"
              v-model="nombre"
              type="text"
              placeholder="Nombre completo de la persona"
              maxlength="151"
              autocomplete="off"
              outlined
              dense
              aria-required="true"
              aria-describedby="nuevo-nombre-ayuda"
              :error="!!errores.nombre"
              :error-message="errores.nombre"
              @update:model-value="alEditar('nombre')"
            >
              <q-tooltip>Nombre que se verá en el menú y en el directorio; sin títulos como Lic. o Ing.</q-tooltip>
            </q-input>
            <p id="nuevo-nombre-ayuda" class="form-help">Máximo 150 caracteres.</p>
          </div>

          <div class="form-group">
            <label for="nuevo-correo" class="form-label"
              >Correo <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
              for="nuevo-correo"
              v-model="correo"
              type="email"
              placeholder="nombre@delgrow.mx"
              maxlength="151"
              autocomplete="off"
              outlined
              dense
              aria-required="true"
              aria-describedby="nuevo-correo-ayuda"
              :error="!!errores.correo"
              :error-message="errores.correo"
              @update:model-value="alEditar('correo')"
            >
              <q-tooltip>Correo con el que la persona iniciará sesión; no puede repetir uno existente.</q-tooltip>
            </q-input>
            <p id="nuevo-correo-ayuda" class="form-help">Máximo 150 caracteres. No puede estar ya en uso.</p>
          </div>

          <div class="form-group">
            <label for="nuevo-password" class="form-label"
              >Contraseña <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-input
              for="nuevo-password"
              v-model="password"
              type="password"
              placeholder="Al menos 8 caracteres"
              autocomplete="new-password"
              outlined
              dense
              aria-required="true"
              aria-describedby="nuevo-password-ayuda"
              :error="!!errores.password"
              :error-message="errores.password"
              @update:model-value="alEditar('password')"
            >
              <q-tooltip>Contraseña inicial de la cuenta; compártela con la persona por un medio seguro.</q-tooltip>
            </q-input>
            <p id="nuevo-password-ayuda" class="form-help">Al menos 8 caracteres.</p>
          </div>

          <div class="form-group">
            <label for="nuevo-rol" class="form-label"
              >Rol <span aria-label="obligatorio" class="required-mark">*</span></label
            >
            <q-select
              for="nuevo-rol"
              v-model="rol"
              :options="opcionesRol"
              placeholder="Elige un rol"
              outlined
              dense
              emit-value
              map-options
              aria-required="true"
              aria-describedby="nuevo-rol-ayuda"
              :error="!!errores.rol"
              :error-message="errores.rol"
              @update:model-value="alEditar('rol')"
            >
              <q-tooltip>El rol decide qué pantallas verá la persona al iniciar sesión.</q-tooltip>
            </q-select>
            <p id="nuevo-rol-ayuda" class="form-help">
              Administrador ve el dashboard; Contador registra sus casos; Usuario de sistema administra
              las cuentas.
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
            <q-tooltip>Cierra sin crear la cuenta.</q-tooltip>
          </q-btn>
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
        </q-card-actions>
      </form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

import { crearUsuario } from '../services/userService.js'
import { PROFILES } from '../utils/constants.js'
import { formatearRol } from '../utils/formateadores.js'
import { validarAltaUsuario } from '../utils/validators.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const emit = defineEmits(['creado'])

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
const guardando = ref(false)

// Cada apertura empieza con el formulario vacío y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (!abierto) return
  nombre.value = ''
  correo.value = ''
  password.value = ''
  rol.value = null
  for (const campo of Object.keys(errores)) errores[campo] = null
  errorGeneral.value = ''
})

const alEditar = (campo) => {
  errores[campo] = null
}

const darDeAlta = async () => {
  if (guardando.value) return

  errorGeneral.value = ''

  const validacion = validarAltaUsuario(nombre.value, correo.value, password.value, rol.value)
  for (const campo of Object.keys(errores)) {
    const codigo = validacion.errores[campo]
    errores[campo] = codigo ? MENSAJES[codigo] : null
  }
  if (!validacion.valido) return

  guardando.value = true
  try {
    const mensaje = await crearUsuario({
      nombre: nombre.value,
      correo: correo.value,
      password: password.value,
      rol: rol.value,
    })
    dialogoAbierto.value = false
    emit('creado', mensaje)
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
.nuevo-usuario {
  width: 100%;
  max-width: 560px;
  min-width: 0;
}

.nuevo-usuario__form,
.nuevo-usuario__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.nuevo-usuario__title {
  margin: 0 0 6px;
  color: #102a43;
  font-size: 1.15rem;
  line-height: 1.25;
}

.nuevo-usuario__help {
  margin: 0;
  color: #486581;
  font-size: 0.85rem;
  line-height: 1.45;
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

.error-banner {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fde8e8;
  color: #8a1c1c;
  font-size: 0.9rem;
}

.control-touch {
  min-height: 44px;
}
</style>
