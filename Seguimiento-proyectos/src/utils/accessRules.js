// Reglas puras de acceso: normalizar credenciales, detectar campos faltantes
// y resolver el perfil de una cuenta.
// Sin Vue, sin navegador y sin efectos secundarios.

import { PROFILES } from './constants.js'

/** Nombres de los campos de P-1, tal como los devuelve `validateLoginForm` (RF-3). */
const LOGIN_FIELDS = {
  username: 'username',
  password: 'password',
}

/** Perfiles que la maqueta reconoce; cualquier otro se trata como credenciales no válidas (RF-4). */
const KNOWN_PROFILES = Object.values(PROFILES)

/** Quita los espacios al inicio y al final: un valor formado solo por espacios queda vacío (RF-3). */
export const normalizeCredential = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Comprueba que usuario y contraseña estén completos (RF-3).
 * Señala cada campo faltante por separado, en el orden de P-1.
 */
export const validateLoginForm = (username, password) => {
  const missing = []

  if (normalizeCredential(username).length === 0) {
    missing.push(LOGIN_FIELDS.username)
  }

  if (normalizeCredential(password).length === 0) {
    missing.push(LOGIN_FIELDS.password)
  }

  return { valid: missing.length === 0, missing }
}

/**
 * Resuelve el perfil de una cuenta de ejemplo (RF-2, RF-4, RF-8).
 * Ignora los espacios extremos y distingue mayúsculas y minúsculas.
 * Devuelve `null` si no coincide ninguna cuenta o el perfil no es administrador ni contador.
 */
export const resolveProfile = (username, password, accounts) => {
  if (!Array.isArray(accounts)) {
    return null
  }

  const normalizedUsername = normalizeCredential(username)
  const normalizedPassword = normalizeCredential(password)

  if (normalizedUsername.length === 0 || normalizedPassword.length === 0) {
    return null
  }

  const account = accounts.find(
    (oneAccount) =>
      oneAccount.username === normalizedUsername &&
      oneAccount.password === normalizedPassword &&
      KNOWN_PROFILES.includes(oneAccount.profile),
  )

  return account ? account.profile : null
}
