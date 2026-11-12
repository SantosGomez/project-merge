<template>
  <main class="login-page">
    <div class="login-page__card">
      <!-- Login sencillo por decisión del usuario: logo, bienvenida y formulario. -->
      <div class="login-page__intro">
        <q-img
          class="login-page__logo"
          src="logos/PNG/DELGROW_LOGO-OF.png"
          alt="DelGrow Business Solutions"
          fit="cover"
          width="240px"
          height="52px"
          loading="eager"
          fetchpriority="high"
          no-spinner
        />
        <h1 class="login-page__title">Te damos la bienvenida</h1>
        <p class="login-page__lead">Inicia sesión con tu cuenta para ver tus casos.</p>
      </div>

      <section class="login-page__panel" aria-label="Formulario de inicio de sesión">
        <!-- Error al validar la sesión guardada al arrancar: no se borra la sesión (plan 4.3). -->
        <q-banner v-if="arranqueFallido" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ arranqueFallido.mensaje }}</p>
          <q-btn
            class="notice__action control-touch boton-presionable"
            color="primary"
            no-caps
            unelevated
            icon="refresh"
            label="Reintentar"
            :loading="validandoArranque"
            :disable="validandoArranque"
            @click="reintentarArranque"
          />
        </q-banner>

        <!-- Aviso persistente del cierre voluntario (RF-46) o del cierre local (RF-47). -->
        <q-banner
          v-if="avisoSesion"
          class="notice"
          :class="avisoSesion.tipo === 'revocacion' ? 'notice--invalid' : 'notice--closed'"
          :role="avisoSesion.tipo === 'revocacion' ? 'alert' : 'status'"
        >
          <p class="notice__text">{{ avisoSesion.texto }}</p>
        </q-banner>

        <q-banner v-if="sesionCaducada" class="notice notice--expired" role="alert">
          <p class="notice__text">Tu sesión se cerró. Vuelve a iniciar sesión para continuar.</p>
        </q-banner>

        <q-banner v-if="sesionRequerida" class="notice notice--required" role="status">
          <p class="notice__text">Inicia sesión para abrir esta pantalla.</p>
        </q-banner>

        <q-banner v-if="errorPerfil" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ errorPerfil }}</p>
          <q-btn
            class="notice__action control-touch boton-presionable"
            color="primary"
            no-caps
            unelevated
            icon="arrow_back"
            label="Volver a iniciar sesión"
            @click="volverAlFormulario"
          />
        </q-banner>

        <q-banner v-if="errorCredenciales" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ errorCredenciales }}</p>
        </q-banner>

        <!-- Bloqueo por intentos fallidos: reintentar en el acto no sirve, así que no hay botón. -->
        <q-banner v-if="errorBloqueo" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ errorBloqueo }}</p>
        </q-banner>

        <q-banner v-if="errorConexion" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ errorConexion.mensaje }}</p>
          <q-btn
            class="notice__action control-touch boton-presionable"
            color="primary"
            no-caps
            unelevated
            icon="refresh"
            label="Reintentar"
            :loading="enviando"
            :disable="enviando"
            @click="submit"
          />
        </q-banner>

        <q-form class="login-form" novalidate :aria-busy="enviando" @submit="submit">
          <div class="login-form__field">
            <q-input
              ref="usernameInput"
              v-model="form.username"
              class="login-form__control input-moderno"
              label="Correo"
              type="email"
              autocomplete="email"
              autofocus
              outlined
              :error="missing.username"
              error-message="Falta el correo. Escríbelo para iniciar sesión."
              :aria-invalid="missing.username"
              @update:model-value="alEscribir('username')"
            >
              <template #prepend>
                <q-icon name="mail" aria-hidden="true" />
              </template>
              <template #append>
                <q-icon
                  name="info"
                  class="login-form__help-icon"
                  tabindex="0"
                  role="img"
                  aria-hidden="false"
                  aria-label="Ayuda sobre el campo correo"
                >
                  <q-tooltip>
                    Escribe el correo de tu cuenta. No importan las mayúsculas ni los espacios al inicio y al final.
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <div class="login-form__field">
            <q-input
              ref="passwordInput"
              v-model="form.password"
              class="login-form__control input-moderno"
              label="Contraseña"
              :type="verContrasena ? 'text' : 'password'"
              autocomplete="current-password"
              outlined
              :error="missing.password"
              error-message="Falta la contraseña. Escríbela para iniciar sesión."
              :aria-invalid="missing.password"
              @update:model-value="alEscribir('password')"
            >
              <template #prepend>
                <q-icon name="lock" aria-hidden="true" />
              </template>
              <template #append>
                <q-btn
                  class="login-form__ver-contrasena"
                  flat
                  round
                  :icon="verContrasena ? 'visibility_off' : 'visibility'"
                  :aria-label="verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  :aria-pressed="verContrasena"
                  @click="verContrasena = !verContrasena"
                >
                  <q-tooltip>{{ verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña' }}</q-tooltip>
                </q-btn>
                <q-icon
                  name="info"
                  class="login-form__help-icon"
                  tabindex="0"
                  role="img"
                  aria-label="Ayuda sobre el campo contraseña"
                >
                  <q-tooltip>
                    Escribe la contraseña de tu cuenta. Se ignoran los espacios al inicio y al
                    final.
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <q-checkbox
            v-model="mantenerSesion"
            label="Mantener sesión iniciada"
            class="login-form__mantener"
            :disable="enviando"
          >
            <q-tooltip>
              La sesión sigue abierta aunque cierres la app, hasta 7 días sin usarla. No la marques en
              un equipo compartido.
            </q-tooltip>
          </q-checkbox>

          <q-btn
            type="submit"
            class="login-form__submit control-touch boton-presionable"
            color="primary"
            no-caps
            unelevated
            :icon="enviando ? undefined : 'login'"
            :label="enviando ? 'Iniciando sesión…' : 'Iniciar sesión'"
            :loading="enviando"
            :disable="enviando"
          />
        </q-form>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { arranqueFallido } from '../router/accessState.js'
import { ESTADOS_ERROR } from '../services/api.js'
import { useSessionStore } from '../stores/session.js'
import { MENSAJE_BLOQUEO_LOGIN, errorDeConexionLogin } from '../utils/mensajesInicioSesion.js'
import { validarCredenciales } from '../utils/validators.js'

/*
 * P-1 (RF-01, RF-03 a RF-06, RF-08, RF-10, RF-46, RF-47): inicia sesión contra el
 * backend real y muestra los avisos de sesión. El perfil lo decide la cuenta.
 */
const route = useRoute()
const router = useRouter()
const sesion = useSessionStore()

const form = reactive({ username: '', password: '' })
const missing = reactive({ username: false, password: false })
const errorCredenciales = ref('')
const errorConexion = ref(null)
const errorPerfil = ref('')
/** Bloqueo temporal del login por demasiados intentos fallidos (límite del backend). */
const errorBloqueo = ref('')
const enviando = ref(false)
const validandoArranque = ref(false)
const usernameInput = ref(null)
const passwordInput = ref(null)
/** Botón del ojo: la contraseña empieza oculta. */
const verContrasena = ref(false)
/** «Mantener sesión iniciada»: desmarcada, para no dejar sesiones abiertas en equipos compartidos. */
const mantenerSesion = ref(false)

/** Aviso persistente fijado por el cierre voluntario (RF-46/RF-47). */
const avisoSesion = computed(() => sesion.avisoSesion)

/** La sesión se considera caducada por inactividad, `exp` o un 401 (RF-07, RF-42, RF-43). */
const sesionCaducada = computed(() => sesion.sesionCaducada)

/** RF-05: el guard llegó aquí desde una pantalla interna sin sesión. */
const sesionRequerida = computed(
  () =>
    route.query.aviso === 'sesion' &&
    errorCredenciales.value === '' &&
    errorConexion.value === null &&
    errorBloqueo.value === '' &&
    !errorPerfil.value &&
    !sesionCaducada.value,
)

/** Escribir en el formulario retira el error de ese campo y el aviso de cierre (RF-46/47). */
const alEscribir = (campo) => {
  missing[campo] = false
  errorCredenciales.value = ''
  errorConexion.value = null
  errorPerfil.value = ''
  errorBloqueo.value = ''
  sesion.limpiarAvisoSesion()
}

/*
 * Cada llegada nueva a P-1 (guard, caducidad o cierre) empieza sin los mensajes del
 * intento anterior, para que el aviso de RF-05 no quede tapado por un error viejo.
 */
watch(
  () => route.fullPath,
  () => {
    errorCredenciales.value = ''
    errorConexion.value = null
    errorPerfil.value = ''
    errorBloqueo.value = ''
  },
)

/** Deja el foco en el primer dato que requiere atención (RNF-07). */
const focusFirstProblem = async () => {
  await nextTick()

  if (missing.username) {
    usernameInput.value?.focus()
  } else if (missing.password) {
    passwordInput.value?.focus()
  } else if (errorCredenciales.value !== '' || errorConexion.value !== null || errorBloqueo.value !== '') {
    usernameInput.value?.focus()
  }
}

/** Perfil sin pantalla (usuarios_de_sistema): vuelve al formulario para otra cuenta. */
const volverAlFormulario = async () => {
  errorPerfil.value = ''
  form.username = ''
  form.password = ''
  missing.username = false
  missing.password = false

  await nextTick()
  usernameInput.value?.focus()
}

/** Reintenta la lectura protegida del arranque sin perder la sesión guardada (plan 4.3). */
const reintentarArranque = async () => {
  if (validandoArranque.value) {
    return
  }

  validandoArranque.value = true

  let resultado
  try {
    resultado = await sesion.restaurarSesion()
  } finally {
    validandoArranque.value = false
  }

  if (resultado.estado === 'valida' && resultado.pantallaPrincipal) {
    arranqueFallido.value = null
    router.replace(resultado.pantallaPrincipal)
    return
  }

  if (resultado.estado === 'error') {
    arranqueFallido.value = resultado.error
    return
  }

  arranqueFallido.value = null

  if (resultado.estado === 'acceso_denegado') {
    errorPerfil.value =
      'Este perfil no tiene pantalla asignada en esta aplicación. Inicia sesión con una cuenta de administrador o de contador.'
  }
}

/** Envía las credenciales al backend y abre la pantalla principal del perfil (RF-01 a RF-04). */
const submit = async () => {
  if (enviando.value) {
    return
  }

  sesion.limpiarAvisoSesion()
  arranqueFallido.value = null
  errorCredenciales.value = ''
  errorConexion.value = null
  errorPerfil.value = ''
  errorBloqueo.value = ''

  const revision = validarCredenciales(form.username, form.password)
  missing.username = revision.faltantes.includes('username')
  missing.password = revision.faltantes.includes('password')

  if (!revision.valido) {
    await focusFirstProblem()
    return
  }

  enviando.value = true

  let resultado
  try {
    resultado = await sesion.iniciarSesion(form.username.trim(), form.password.trim(), mantenerSesion.value)
  } finally {
    enviando.value = false
  }

  if (!resultado.ok) {
    if (resultado.error?.estado === ESTADOS_ERROR.CREDENCIALES_INVALIDAS) {
      // Mensaje genérico: no se indica cuál de los dos datos falló (RF-04).
      errorCredenciales.value = 'El correo o la contraseña no son correctos. Revísalos y vuelve a intentarlo.'
    } else if (resultado.error?.estado === ESTADOS_ERROR.DEMASIADOS_INTENTOS) {
      // Mientras dura el bloqueo no se ofrece «Reintentar».
      errorBloqueo.value = MENSAJE_BLOQUEO_LOGIN
    } else {
      // Red o servidor: mensaje de tres partes con la opción de reintentar (RF-36).
      errorConexion.value = errorDeConexionLogin(resultado.error)
    }

    await focusFirstProblem()
    return
  }

  if (resultado.accesoDenegado) {
    errorPerfil.value =
      'Este perfil no tiene pantalla asignada en esta aplicación. Inicia sesión con una cuenta de administrador o de contador.'
    return
  }

  // La cuenta decide el perfil y su pantalla principal (RF-02, RF-08).
  router.replace(resultado.pantallaPrincipal)
}
</script>

<style scoped>
.login-page {
  width: 100%;
  max-width: 440px;
  min-width: 0;
}

.login-page__card {
  width: 100%;
  padding: 24px;
  border-radius: 16px;
  background: var(--dg-superficie);
  box-shadow: var(--dg-sombra-tarjeta);
}

/* El PNG trae margen blanco arriba y abajo: fit="cover" lo recorta. */
.login-page__logo {
  display: block;
  max-width: 100%;
  margin: 0 auto 24px;
}

.login-page__title {
  margin: 0 0 4px;
  color: var(--dg-texto);
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.25;
  text-wrap: balance;
}

/* Con movimiento reducido el botón no cambia de escala (las transiciones de los campos se apagan en app.scss). */

.login-page__lead {
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

.notice__action {
  margin-top: 12px;
}

.notice--expired {
  border-left: 4px solid var(--dg-aviso-borde);
  background: var(--dg-aviso-fondo);
  color: var(--dg-aviso-texto);
}

.notice--required {
  border-left: 4px solid var(--dg-info-borde);
  background: var(--dg-info-fondo);
  color: var(--dg-info-texto);
}

.notice--closed {
  border-left: 4px solid var(--dg-exito-borde);
  background: var(--dg-exito-fondo);
  color: var(--dg-exito-oscuro);
}

.notice--invalid {
  border-left: 4px solid var(--dg-error);
  background: var(--dg-error-fondo);
  color: var(--dg-error-oscuro);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-form__help-icon {
  cursor: help;
  color: var(--dg-acento);
}

.login-form__mantener {
  align-self: flex-start;
  min-height: 44px;
  margin: -8px 0 -8px -10px;
  color: var(--dg-texto);
}

.login-form__submit {
  min-height: 48px;
  margin-top: 4px;
  font-size: 1rem;
}

.control-touch {
  min-width: 44px;
  min-height: 48px;
}

/* Foco visible en todo el formulario (RNF-07). */
.login-form__control :deep(.q-field__control:focus-within) {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

/* Área táctil de 44 px (antes 34 px con `dense`). */
.login-form__ver-contrasena {
  min-width: 44px;
  min-height: 44px;
  color: var(--dg-texto-secundario);
}

.login-form__help-icon:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

/* Quasar no dibuja el foco de la casilla con teclado: lleva el mismo anillo que los demás (WCAG 2.4.7). */
.login-form__mantener:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
  border-radius: 4px;
}

/* El botón de Quasar trae la clase `no-outline`, que anula el contorno; se refuerza a propósito. */
.login-form__submit:focus-visible,
.login-form__ver-contrasena:focus-visible,
.notice__action:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

/* Misma tarjeta de 440 px en todas las pantallas; solo crece el relleno. */
@media (min-width: 600px) {
  .login-page__card {
    padding: 40px;
  }
}
</style>
