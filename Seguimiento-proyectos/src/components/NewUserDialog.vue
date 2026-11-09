<template>
  <q-dialog
    v-model="dialogoAbierto"
    :persistent="guardando || hayDatosSinGuardar"
    transition-show="dialogo-entra"
    transition-hide="dialogo-sale"
    :transition-duration="220"
    aria-labelledby="nuevo-usuario-titulo"
    @show="enfocarPrimerCampo"
    @shake="pedirDescartar"
  >
    <q-card ref="tarjeta" class="nuevo-usuario">
      <q-form
        class="nuevo-usuario__form"
        novalidate
        aria-label="Formulario de alta de usuario"
        @submit="darDeAlta"
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
              >Nombre <span aria-hidden="true" class="required-mark">*</span></label
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
              class="input-moderno"
              aria-required="true"
              aria-describedby="nuevo-nombre-ayuda"
              :error="!!errores.nombre"
              :error-message="errores.nombre"
              @update:model-value="alEditar('nombre')"
            >
              <template #prepend>
                <q-icon name="person" aria-hidden="true" />
              </template>
              <q-tooltip>Nombre que se verá en el menú y en el directorio; sin títulos como Lic. o Ing.</q-tooltip>
            </q-input>
            <p id="nuevo-nombre-ayuda" class="form-help">Máximo 150 caracteres.</p>
          </div>

          <div class="form-group">
            <label for="nuevo-correo" class="form-label"
              >Correo <span aria-hidden="true" class="required-mark">*</span></label
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
              class="input-moderno"
              aria-required="true"
              aria-describedby="nuevo-correo-ayuda"
              :error="!!errores.correo"
              :error-message="errores.correo"
              @update:model-value="alEditar('correo')"
            >
              <template #prepend>
                <q-icon name="email" aria-hidden="true" />
              </template>
              <q-tooltip>Correo con el que la persona iniciará sesión; no puede repetir uno existente.</q-tooltip>
            </q-input>
            <p id="nuevo-correo-ayuda" class="form-help">Máximo 150 caracteres. No puede estar ya en uso.</p>
          </div>

          <div class="form-group">
            <label for="nuevo-password" class="form-label"
              >Contraseña <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-input
              for="nuevo-password"
              v-model="password"
              :type="verPassword ? 'text' : 'password'"
              placeholder="Al menos 8 caracteres"
              autocomplete="new-password"
              outlined
              dense
              class="input-moderno"
              aria-required="true"
              aria-describedby="nuevo-password-ayuda"
              :error="!!errores.password"
              :error-message="errores.password"
              @update:model-value="alEditar('password')"
            >
              <template #prepend>
                <q-icon name="lock" aria-hidden="true" />
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
            <p id="nuevo-password-ayuda" class="form-help">
              Al menos 8 caracteres. Es temporal: al iniciar sesión, la persona tendrá que cambiarla por la suya. Compártela por un medio seguro.
            </p>
          </div>

          <div class="form-group">
            <label for="nuevo-rol" class="form-label"
              >Rol <span aria-hidden="true" class="required-mark">*</span></label
            >
            <q-select
              for="nuevo-rol"
              v-model="rol"
              :options="opcionesRol"
              placeholder="Elige un rol"
              outlined
              dense
              options-dense
              dropdown-icon="expand_more"
              popup-content-class="menu-seleccion-custom"
              transition-show="jump-down"
              transition-hide="jump-up"
              :transition-duration="180"
              class="selector-moderno"
              emit-value
              map-options
              aria-required="true"
              aria-describedby="nuevo-rol-ayuda"
              :error="!!errores.rol"
              :error-message="errores.rol"
              @update:model-value="alEditar('rol')"
            >
              <template #prepend>
                <q-icon name="badge" aria-hidden="true" />
              </template>
              <template #option="{ itemProps, opt, selected }">
                <q-item
                  v-bind="itemProps"
                  :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]"
                >
                  <q-item-section>
                    <q-item-label>{{ opt.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section v-if="selected" side>
                    <q-icon name="check" size="18px" color="primary" />
                  </q-item-section>
                </q-item>
              </template>
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
            class="control-touch boton-presionable"
            :disable="guardando"
            @click="cerrar"
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
            class="control-touch boton-presionable"
            :loading="guardando"
            :disable="guardando"
          >
            <q-tooltip>Crea la cuenta con los datos del formulario.</q-tooltip>
          </q-btn>
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { copyToClipboard, useQuasar } from 'quasar'

import { crearUsuario } from '../services/userService.js'
import { MENSAJES_VALIDACION, PROFILES } from '../utils/constants.js'
import { formatearRol } from '../utils/formateadores.js'
import { validarAltaUsuario } from '../utils/validators.js'

const dialogoAbierto = defineModel({ type: Boolean, default: false })

const emit = defineEmits(['creado'])

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

const hayDatosSinGuardar = computed(
  () => [nombre.value, correo.value, password.value].some((v) => v.trim() !== '') || rol.value !== null,
)

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
  nextTick(() => document.getElementById('nuevo-nombre')?.focus())
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

// Cada apertura empieza con el formulario vacío y sin errores de la vez anterior.
watch(dialogoAbierto, (abierto) => {
  if (abierto) {
    nombre.value = ''
    correo.value = ''
    password.value = ''
    rol.value = null
    for (const campo of Object.keys(errores)) errores[campo] = null
    errorGeneral.value = ''
    verPassword.value = false
  } else {
    password.value = ''
    verPassword.value = false
  }
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
    errores[campo] = codigo ? MENSAJES_VALIDACION[codigo] : null
  }
  if (!validacion.valido) {
    enfocarPrimerError()
    return
  }

  guardando.value = true
  try {
    await crearUsuario({
      nombre: nombre.value,
      correo: correo.value,
      password: password.value,
      rol: rol.value,
    })
    dialogoAbierto.value = false
    emit('creado', nombre.value.trim())
  } catch (error) {
    // Solo el correo repetido va bajo «Correo»; cualquier otro error, al aviso general.
    if (error?.codigoHttp === 400 && /ya existe/i.test(error?.mensaje ?? '')) {
      errores.correo = 'Ese correo ya tiene una cuenta. Usa otro o restablece la contraseña de esa cuenta.'
      enfocarPrimerError()
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
  color: var(--dg-texto);
  font-size: 1.15rem;
  line-height: 1.25;
}

.nuevo-usuario__help {
  margin: 0;
  color: var(--dg-texto-tenue);
  font-size: 0.85rem;
  line-height: 1.45;
}

/* .form-group, .form-label, .required-mark, .form-help y .error-banner viven en app.scss. */

.control-touch {
  min-height: 44px;
}
</style>
