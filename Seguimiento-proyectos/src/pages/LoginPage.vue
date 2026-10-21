<template>
  <main class="login-page">
    <div class="login-page__card">
      <div class="login-page__intro">
        <p class="login-page__eyebrow">DelGrow · Estado Contadores</p>
        <h1 class="login-page__title">Inicio de sesión</h1>
        <p class="login-page__lead">
          Entra con una cuenta de ejemplo para recorrer las pantallas que corresponden a tu perfil.
        </p>

        <!-- Ayuda siempre visible: sirve con puntero, teclado y toque (RNF-3). -->
        <section class="login-page__help" aria-labelledby="login-help-title">
          <h2 id="login-help-title" class="login-page__help-title">Cómo funciona la maqueta</h2>
          <ul class="login-page__help-list">
            <li>Los datos son ficticios y solo existen mientras la maqueta está abierta.</li>
            <li>El perfil se determina por la cuenta: no se elige a mano.</li>
            <li>Al recargar la página, la sesión se cierra y vuelven los datos de ejemplo.</li>
          </ul>
        </section>
      </div>

      <section class="login-page__panel" aria-label="Formulario de inicio de sesión">
        <q-banner v-if="sessionExpired" class="notice notice--expired" role="alert">
          Tu sesión de simulación caducó. Inicia sesión de nuevo para continuar.
        </q-banner>

        <q-banner v-else-if="sessionRequired" class="notice notice--required" role="status">
          Debes iniciar sesión para abrir una pantalla interna. Escribe una cuenta de ejemplo para
          continuar.
        </q-banner>

        <q-banner v-if="invalidCredentials" class="notice notice--invalid" role="alert">
          Credenciales no válidas. El usuario o la contraseña no coinciden con ninguna cuenta de
          ejemplo; revisa ambos datos e inténtalo de nuevo.
        </q-banner>

        <form class="login-form" novalidate @submit.prevent="submit">
          <div class="login-form__field">
            <q-input
              ref="usernameInput"
              v-model="form.username"
              class="login-form__control"
              label="Usuario"
              hint="Cuenta de ejemplo: distingue mayúsculas y minúsculas."
              autocomplete="username"
              autofocus
              outlined
              :error="missing.username"
              :aria-invalid="missing.username"
              @update:model-value="clearFieldError('username')"
            >
              <template #prepend>
                <q-icon name="person" aria-hidden="true" />
              </template>
            </q-input>

            <p v-if="missing.username" class="login-form__error" role="alert">
              Falta el usuario. Escribe tu cuenta de ejemplo para iniciar sesión.
            </p>
          </div>

          <div class="login-form__field">
            <q-input
              ref="passwordInput"
              v-model="form.password"
              class="login-form__control"
              label="Contraseña"
              hint="Contraseña de la cuenta de ejemplo; distingue mayúsculas y minúsculas."
              type="password"
              autocomplete="current-password"
              outlined
              :error="missing.password"
              :aria-invalid="missing.password"
              @update:model-value="clearFieldError('password')"
            >
              <template #prepend>
                <q-icon name="lock" aria-hidden="true" />
              </template>
            </q-input>

            <p v-if="missing.password" class="login-form__error" role="alert">
              Falta la contraseña. Escríbela para iniciar sesión.
            </p>
          </div>

          <q-btn
            type="submit"
            class="login-form__submit control-touch"
            color="primary"
            no-caps
            unelevated
            label="Iniciar sesión"
            icon="login"
          />
        </form>
      </section>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { STORE_ERROR_CODES, useMaquetaStore } from '../stores/maqueta.js'
import { PROFILES } from '../utils/constants.js'

const route = useRoute()
const router = useRouter()
const maqueta = useMaquetaStore()

const form = reactive({ username: '', password: '' })
const missing = reactive({ username: false, password: false })
const invalidCredentials = ref(false)
const usernameInput = ref(null)
const passwordInput = ref(null)

// Avisos previstos por el layout y el guard (RF-5, RF-7).
const sessionExpired = computed(() => maqueta.sessionExpired)
const sessionRequired = computed(() => route.query.aviso === 'sesion')

/** Al corregir un campo se retira su aviso y el de credenciales no válidas (RF-3, RF-4). */
const clearFieldError = (field) => {
  missing[field] = false
  invalidCredentials.value = false
}

/** Deja el foco en el primer dato que requiere atención (RNF-8). */
const focusFirstProblem = async () => {
  await nextTick()

  if (missing.username) {
    usernameInput.value?.focus()
  } else if (missing.password) {
    passwordInput.value?.focus()
  } else if (invalidCredentials.value) {
    usernameInput.value?.focus()
  }
}

const submit = () => {
  const result = maqueta.login(form.username, form.password)

  missing.username = result.missing.includes('username')
  missing.password = result.missing.includes('password')
  invalidCredentials.value = result.errorCode === STORE_ERROR_CODES.invalidCredentials

  if (!result.valid) {
    focusFirstProblem()
    return
  }

  // La cuenta decide el perfil y su pantalla principal (RF-2, RF-8).
  const destination =
    result.profile === PROFILES.administrador ? 'admin-dashboard' : 'contador-casos'

  router.replace({ name: destination })
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px 16px;
  background: linear-gradient(135deg, #eef4fb 0%, #f7f9fc 45%, #e8f0f7 100%);
}

.login-page__card {
  width: 100%;
  max-width: 440px;
  padding: 24px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 12px 32px rgb(16 42 67 / 12%);
}

.login-page__eyebrow {
  margin: 0 0 8px;
  color: #1f5f99;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.login-page__title {
  margin: 0 0 8px;
  color: #102a43;
  font-size: clamp(1.6rem, 6vw, 2rem);
  line-height: 1.2;
}

.login-page__lead {
  margin: 0 0 20px;
  color: #334e68;
  font-size: 1rem;
  line-height: 1.5;
}

.login-page__help {
  margin-bottom: 24px;
  padding: 16px;
  border-left: 4px solid #1f5f99;
  border-radius: 8px;
  background: #f0f6fc;
}

.login-page__help-title {
  margin: 0 0 8px;
  color: #102a43;
  font-size: 1rem;
}

.login-page__help-list {
  margin: 0;
  padding-left: 20px;
  color: #334e68;
  font-size: 0.95rem;
  line-height: 1.5;
}

.login-page__help-list li + li {
  margin-top: 6px;
}

.notice {
  margin-bottom: 16px;
  border-radius: 8px;
  font-size: 0.95rem;
  line-height: 1.45;
}

.notice--expired {
  border-left: 4px solid #8a5800;
  background: #fff4d6;
  color: #4a3300;
}

.notice--required {
  border-left: 4px solid #1a5f9e;
  background: #e6f0fb;
  color: #0d3c61;
}

.notice--invalid {
  border-left: 4px solid #a3231b;
  background: #fdecea;
  color: #7a1f1a;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.login-form__error {
  margin: 4px 0 0;
  color: #8c1d18;
  font-size: 0.9rem;
  line-height: 1.4;
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

/* Foco visible en todo el formulario (RNF-8). */
.login-form__control :deep(.q-field__control:focus-within) {
  outline: 3px solid #0b5cad;
  outline-offset: 2px;
}

/* El botón de Quasar trae la clase `no-outline`, que anula el contorno; se refuerza a propósito. */
.login-form__submit:focus-visible {
  outline: 3px solid #0b5cad !important;
  outline-offset: 2px;
}

@media (min-width: 600px) {
  .login-page__card {
    max-width: 720px;
    padding: 32px;
  }
}

@media (min-width: 1024px) {
  .login-page__card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 400px);
    gap: 48px;
    max-width: 960px;
    padding: 40px;
  }

  .login-page__help {
    margin-bottom: 0;
  }
}
</style>
