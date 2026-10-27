<template>
  <main class="login-page">
    <div class="login-page__card">
      <div class="login-page__intro">
        <p class="login-page__eyebrow">DelGrow · Estado Contadores</p>
        <h1 class="login-page__title">Inicio de sesión</h1>
        <p class="login-page__lead">
          Entra con tu cuenta para ver el estado de los casos que corresponde a tu perfil.
        </p>

        <!-- Ayuda siempre visible: sirve con puntero, teclado y toque (RNF-03). -->
        <section class="login-page__help" aria-labelledby="login-help-title">
          <h2 id="login-help-title" class="login-page__help-title">Cómo funciona el acceso</h2>
          <q-list dense class="login-page__help-list">
            <q-item class="login-page__help-item">
              <q-item-section avatar class="login-page__help-icono">
                <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="login-page__help-texto">El perfil lo determina la cuenta con la que entras: no se elige a mano.</q-item-label>
              </q-item-section>
            </q-item>
            <q-item class="login-page__help-item">
              <q-item-section avatar class="login-page__help-icono">
                <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="login-page__help-texto">La sesión sigue activa mientras la pestaña esté abierta; al recargar se valida de nuevo con el servidor.</q-item-label>
              </q-item-section>
            </q-item>
            <q-item class="login-page__help-item">
              <q-item-section avatar class="login-page__help-icono">
                <q-icon name="info" size="18px" color="dg-acento" aria-hidden="true" />
              </q-item-section>
              <q-item-section>
                <q-item-label class="login-page__help-texto">Si pasas 30 minutos sin actividad, la sesión caduca y hay que iniciar sesión otra vez.</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </section>
      </div>

      <section class="login-page__panel" aria-label="Formulario de inicio de sesión">
        <!-- Error al validar la sesión guardada al arrancar: no se borra la sesión (plan 4.3). -->
        <q-banner v-if="arranqueFallido" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ arranqueFallido.mensaje }}</p>
          <q-btn
            class="notice__action control-touch"
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
          <p class="notice__text">
            Tu sesión caducó. Ya estás en la pantalla de inicio de sesión: vuelve a entrar para
            continuar; mientras tanto no se muestra información de contadores ni de casos.
          </p>
        </q-banner>

        <q-banner v-if="sesionRequerida" class="notice notice--required" role="status">
          <p class="notice__text">Debe iniciar sesión para acceder a esta pantalla.</p>
        </q-banner>

        <q-banner v-if="errorPerfil" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ errorPerfil }}</p>
          <q-btn
            class="notice__action control-touch"
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

        <q-banner v-if="errorConexion" class="notice notice--invalid" role="alert">
          <p class="notice__text">{{ errorConexion.mensaje }}</p>
          <q-btn
            class="notice__action control-touch"
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
              class="login-form__control"
              label="Correo"
              hint="Correo de tu cuenta, por ejemplo nombre@delgrow.mx."
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
              class="login-form__control"
              label="Contraseña"
              hint="Contraseña de tu cuenta."
              type="password"
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

          <q-btn
            type="submit"
            class="login-form__submit control-touch"
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
import { construirError } from '../utils/mensajes.js'
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
const enviando = ref(false)
const validandoArranque = ref(false)
const usernameInput = ref(null)
const passwordInput = ref(null)

/** Aviso persistente fijado por el cierre voluntario (RF-46/RF-47). */
const avisoSesion = computed(() => sesion.avisoSesion)

/** La sesión se considera caducada por inactividad, `exp` o un 401 (RF-07, RF-42, RF-43). */
const sesionCaducada = computed(() => sesion.sesionCaducada)

/** RF-05: el guard llegó aquí desde una pantalla interna sin sesión. */
const sesionRequerida = computed(
  () =>
    route.query.aviso === 'sesion' &&
    errorCredenciales.value === '' &&
    errorConexion.value === null,
)

/** Escribir en el formulario retira el error de ese campo y el aviso de cierre (RF-46/47). */
const alEscribir = (campo) => {
  missing[campo] = false
  errorCredenciales.value = ''
  errorConexion.value = null
  errorPerfil.value = ''
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
  },
)

/** Deja el foco en el primer dato que requiere atención (RNF-07). */
const focusFirstProblem = async () => {
  await nextTick()

  if (missing.username) {
    usernameInput.value?.focus()
  } else if (missing.password) {
    passwordInput.value?.focus()
  } else if (errorCredenciales.value !== '' || errorConexion.value !== null) {
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
    resultado = await sesion.iniciarSesion(form.username.trim(), form.password.trim())
  } finally {
    enviando.value = false
  }

  if (!resultado.ok) {
    if (resultado.error?.estado === ESTADOS_ERROR.CREDENCIALES_INVALIDAS) {
      // Mensaje genérico: no se indica cuál de los dos datos falló (RF-04).
      errorCredenciales.value =
        'Credenciales no válidas. Verifique el correo y la contraseña e intente de nuevo.'
    } else {
      // Red o servidor: mensaje de tres partes con la opción de reintentar (RF-36).
      errorConexion.value =
        resultado.error ??
        construirError(
          'No se pudo iniciar sesión',
          'el inicio de sesión',
          'verifique su conexión e intente de nuevo',
        )
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
  box-shadow: 0 12px 32px rgb(16 42 67 / 12%);
}

.login-page__eyebrow {
  margin: 0 0 8px;
  color: var(--dg-acento);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  overflow-wrap: anywhere;
}

.login-page__title {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: clamp(1.6rem, 6vw, 2rem);
  line-height: 1.2;
  text-wrap: balance;
}

@media (prefers-reduced-motion: reduce) {
  .login-page__card,
  .login-form__control,
  .login-form__submit,
  .notice {
    transition: none !important;
    animation: none !important;
  }
}

.login-page__lead {
  margin: 0 0 20px;
  color: var(--dg-texto-secundario);
  font-size: 1rem;
  line-height: 1.5;
}

.login-page__help {
  margin-bottom: 24px;
  padding: 16px;
  border-left: 4px solid var(--dg-acento);
  border-radius: 8px;
  background: var(--dg-fondo-hover);
}

.login-page__help-title {
  margin: 0 0 8px;
  color: var(--dg-texto);
  font-size: 1rem;
}

.login-page__help-list {
  color: var(--dg-texto-secundario);
  font-size: 0.95rem;
  line-height: 1.5;
}

/* Sin el alto mínimo ni el relleno de q-item: cada punto ocupa lo que su texto. */
.login-page__help-item {
  min-height: 0;
  padding: 0;
}

.login-page__help-item + .login-page__help-item {
  margin-top: 6px;
}

.login-page__help-icono {
  min-width: 26px;
  padding-top: 2px;
  justify-content: flex-start;
}

/* q-item-label trae line-height de 1.2em con !important; se conserva el 1.5 de la ayuda. */
.login-page__help-texto {
  line-height: 1.5 !important;
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

.login-form__help-icon:focus-visible {
  outline: 3px solid var(--dg-foco);
  outline-offset: 2px;
}

/* El botón de Quasar trae la clase `no-outline`, que anula el contorno; se refuerza a propósito. */
.login-form__submit:focus-visible,
.notice__action:focus-visible {
  outline: 3px solid var(--dg-foco) !important;
  outline-offset: 2px;
}

@media (min-width: 600px) {
  .login-page {
    max-width: 720px;
  }

  .login-page__card {
    padding: 32px;
  }
}

@media (min-width: 1024px) {
  .login-page {
    max-width: 960px;
  }

  .login-page__card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 400px);
    gap: 48px;
    padding: 40px;
  }

  .login-page__help {
    margin-bottom: 0;
  }
}
</style>
