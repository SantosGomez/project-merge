<template>
  <main class="cambio-page">
    <div class="cambio-page__card">
      <div class="cambio-page__intro">
        <q-img
          class="cambio-page__logo"
          src="logos/PNG/DELGROW_LOGO-OF.png"
          alt="DelGrow Business Solutions"
          fit="cover"
          width="240px"
          height="52px"
          loading="eager"
          fetchpriority="high"
          no-spinner
        />
        <h1 class="cambio-page__title">Crea tu contraseña</h1>
        <p class="cambio-page__lead">
          Entraste con la contraseña que te dio el administrador. Elige una propia para continuar.
        </p>
      </div>

      <q-banner v-if="errorServidor" class="notice notice--invalid" role="alert">
        <p class="notice__text">{{ errorServidor }}</p>
      </q-banner>

      <q-form class="cambio-form" novalidate :aria-busy="guardando" @submit="guardar">
        <q-input
          ref="nuevaInput"
          v-model="form.nueva"
          class="cambio-form__control input-moderno"
          :class="{ 'cambio-form__control--coinciden': coinciden }"
          label="Contraseña nueva"
          :type="verNueva ? 'text' : 'password'"
          autocomplete="new-password"
          autofocus
          outlined
          :color="coinciden ? 'dg-exito-oscuro' : undefined"
          :rules="[reglaNueva]"
          lazy-rules
          hint="Mínimo 8 caracteres, distinta a la que te dio el administrador."
          @update:model-value="alEscribir"
        >
          <template #prepend>
            <q-icon name="lock" aria-hidden="true" />
          </template>
          <template #append>
            <q-icon
              v-if="coinciden"
              name="check_circle"
              color="dg-exito-oscuro"
              role="img"
              aria-label="Las contraseñas coinciden"
            />
            <q-btn
              class="cambio-form__ver"
              flat
              round
              :icon="verNueva ? 'visibility_off' : 'visibility'"
              :aria-label="verNueva ? 'Ocultar contraseña nueva' : 'Mostrar contraseña nueva'"
              :aria-pressed="verNueva"
              @click="verNueva = !verNueva"
            >
              <q-tooltip>{{ verNueva ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
            </q-btn>
          </template>
        </q-input>

        <q-input
          ref="confirmacionInput"
          v-model="form.confirmacion"
          class="cambio-form__control input-moderno"
          :class="{ 'cambio-form__control--coinciden': coinciden }"
          label="Confirmar contraseña"
          :type="verConfirmacion ? 'text' : 'password'"
          autocomplete="new-password"
          outlined
          :color="coinciden ? 'dg-exito-oscuro' : undefined"
          :rules="[reglaConfirmacion]"
          :hint="coinciden ? 'Las contraseñas coinciden.' : undefined"
          @update:model-value="alEscribir"
        >
          <template #prepend>
            <q-icon name="lock" aria-hidden="true" />
          </template>
          <template #append>
            <q-icon
              v-if="coinciden"
              name="check_circle"
              color="dg-exito-oscuro"
              role="img"
              aria-label="Las contraseñas coinciden"
            />
            <q-btn
              class="cambio-form__ver"
              flat
              round
              :icon="verConfirmacion ? 'visibility_off' : 'visibility'"
              :aria-label="verConfirmacion ? 'Ocultar confirmación' : 'Mostrar confirmación'"
              :aria-pressed="verConfirmacion"
              @click="verConfirmacion = !verConfirmacion"
            >
              <q-tooltip>{{ verConfirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
            </q-btn>
          </template>
        </q-input>

        <q-btn
          type="submit"
          class="cambio-form__submit control-touch boton-presionable"
          color="primary"
          no-caps
          unelevated
          :icon="guardando ? undefined : 'check'"
          :label="guardando ? 'Guardando…' : 'Guardar contraseña'"
          :loading="guardando"
          :disable="guardando || cerrando"
        />

        <q-btn
          class="cambio-form__salir control-touch boton-presionable"
          flat
          no-caps
          color="primary"
          icon="logout"
          label="Cerrar sesión"
          :loading="cerrando"
          :disable="guardando || cerrando"
          @click="salir"
        >
          <q-tooltip>Sal sin crear la contraseña; la próxima vez que entres se te pedirá de nuevo.</q-tooltip>
        </q-btn>
      </q-form>
    </div>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

import { useSessionStore } from '../stores/session.js'
import { validarContrasenaNueva } from '../utils/validators.js'

/*
 * La persona entró con la contraseña que le asignó el administrador (alta o
 * restablecimiento) y debe crear la suya antes de usar la aplicación.
 */
const $q = useQuasar()
const router = useRouter()
const sesion = useSessionStore()

const MENSAJES = {
  password_requerida: 'Falta la contraseña nueva. Escríbela para continuar.',
  password_corta: 'La contraseña nueva debe tener al menos 8 caracteres.',
  confirmacion_requerida: 'Falta confirmar la contraseña. Escríbela otra vez.',
  confirmacion_distinta: 'Las contraseñas no coinciden. Escríbelas igual.',
}

/** Espera de la regla asíncrona: deja terminar de escribir antes de comparar. */
const ESPERA_CONFIRMACION_MS = 300

const form = reactive({ nueva: '', confirmacion: '' })
const errorServidor = ref('')
const guardando = ref(false)
const cerrando = ref(false)
const verNueva = ref(false)
const verConfirmacion = ref(false)
const confirmacionInput = ref(null)

/*
 * Reglas de QInput: devuelven true o el mensaje de error, con la misma lógica
 * (validarContrasenaNueva) que se revisa antes de enviar.
 */
const reglaNueva = (valor) =>
  MENSAJES[validarContrasenaNueva(valor, form.confirmacion).errores.nueva] ?? true

// Regla asíncrona: compara cuando se deja de escribir unos milisegundos.
const reglaConfirmacion = (valor) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(MENSAJES[validarContrasenaNueva(form.nueva, valor).errores.confirmacion] ?? true)
    }, ESPERA_CONFIRMACION_MS)
  })

/**
 * Las dos contraseñas son iguales y válidas: los campos se marcan en verde.
 * Exige que todo sea válido para que el verde nunca aparezca junto a un error.
 */
const coinciden = computed(
  () => form.confirmacion.trim() !== '' && validarContrasenaNueva(form.nueva, form.confirmacion).valido,
)

// Si cambia la nueva después de confirmar, la confirmación se vuelve a revisar.
watch(
  () => form.nueva,
  () => {
    if (form.confirmacion !== '') {
      confirmacionInput.value?.validate()
    }
  },
)

/** Escribir retira el error del servidor. */
const alEscribir = () => {
  errorServidor.value = ''
}

/**
 * Guarda la contraseña nueva y abre la pantalla principal del perfil. QForm solo
 * llama aquí si las reglas pasaron; se revisa otra vez por si cambió algo.
 */
const guardar = async () => {
  if (guardando.value || !validarContrasenaNueva(form.nueva, form.confirmacion).valido) {
    return
  }
  errorServidor.value = ''

  guardando.value = true
  let resultado
  try {
    // Se recorta igual que en el login, que es como se volverá a escribir.
    resultado = await sesion.crearContrasenaPropia(form.nueva.trim())
  } finally {
    guardando.value = false
  }

  if (!resultado.ok) {
    errorServidor.value = resultado.error?.mensaje ?? 'No se pudo guardar la contraseña. Inténtalo de nuevo.'
    return
  }

  $q.notify({ type: 'positive', message: 'Contraseña actualizada. Ya puedes usar la aplicación.' })
  router.replace(resultado.pantallaPrincipal)
}

/** Cierra la sesión sin crear la contraseña; se pedirá en el próximo inicio de sesión. */
const salir = async () => {
  cerrando.value = true
  try {
    await sesion.cerrarSesionVoluntaria()
  } finally {
    cerrando.value = false
  }
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.cambio-page {
  width: 100%;
  max-width: 440px;
  min-width: 0;
}

.cambio-page__card {
  width: 100%;
  padding: 24px;
  border-radius: 16px;
  background: var(--dg-superficie);
  box-shadow: 0 12px 32px rgb(16 42 67 / 12%);
}

/* El PNG trae margen blanco arriba y abajo: fit="cover" lo recorta. */
.cambio-page__logo {
  display: block;
  max-width: 100%;
  margin: 0 auto 24px;
}

.cambio-page__title {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  text-wrap: balance;
}

.cambio-page__lead {
  margin: 0 0 24px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
}

.notice {
  margin-bottom: 16px;
  border-radius: 8px;
  font-size: 0.95rem;
  line-height: 1.45;
}

.notice__text {
  margin: 0;
  overflow-wrap: anywhere;
}

.notice--invalid {
  border-left: 4px solid var(--dg-error);
  background: var(--dg-error-fondo);
  color: var(--dg-error-oscuro);
}

.cambio-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Área táctil de 44 px (antes 34 px con `dense`). */
.cambio-form__ver {
  min-width: 44px;
  min-height: 44px;
  color: var(--dg-texto-secundario);
}

/* Contraseñas iguales y válidas: borde y texto de ayuda en verde. */
.cambio-form__control--coinciden :deep(.q-field__control::before) {
  border-color: var(--dg-exito-oscuro);
}

.cambio-form__control--coinciden :deep(.q-field__bottom) {
  color: var(--dg-exito-oscuro);
}

.cambio-form__submit {
  margin-top: 4px;
  font-size: 1rem;
}

.control-touch {
  min-width: 44px;
  min-height: 48px;
}

/* Foco visible en todo el formulario (RNF-07). */
.cambio-form__control :deep(.q-field__control:focus-within) {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

/* El botón de Quasar trae la clase `no-outline`, que anula el contorno; se refuerza a propósito. */
.cambio-form__submit:focus-visible,
.cambio-form__salir:focus-visible,
.cambio-form__ver:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/* Con movimiento reducido el botón no cambia de escala (las transiciones de los campos se apagan en app.scss). */

@media (min-width: 600px) {
  .cambio-page__card {
    padding: 40px;
  }
}
</style>
