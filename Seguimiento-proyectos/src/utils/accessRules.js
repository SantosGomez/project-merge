// Reglas puras de acceso: normalizar credenciales, detectar campos faltantes,
// resolver el perfil de una cuenta y decidir el acceso del guard de navegación.
// Sin Vue, sin navegador y sin efectos secundarios.

import { PROFILES, RUTA_PRINCIPAL_POR_ROL } from './constants.js'

/** Nombres de los campos de P-1, tal como los devuelve `validateLoginForm` (RF-3). */
const LOGIN_FIELDS = {
  username: 'username',
  password: 'password',
}

/** Perfiles que la maqueta reconoce; cualquier otro se trata como credenciales no válidas (RF-4). */
const KNOWN_PROFILES = Object.values(PROFILES)

/**
 * Nombre de ruta que corresponde a una ruta de la aplicación.
 * Las rutas siguen la convención `/a/b` → `a-b` (ver `router/index.js`).
 */
const nombreDeRuta = (ruta) => ruta.split('/').filter(Boolean).join('-')

/**
 * Pantalla principal de cada perfil con pantalla, como nombre de ruta (Definiciones).
 * Se deriva de `RUTA_PRINCIPAL_POR_ROL` para no repetir la tabla.
 * Un perfil que no está aquí no tiene pantalla asignada.
 */
export const PANTALLA_PRINCIPAL_POR_ROL = Object.freeze(
  Object.fromEntries(
    Object.entries(RUTA_PRINCIPAL_POR_ROL).map(([rol, ruta]) => [rol, nombreDeRuta(ruta)]),
  ),
)

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

/**
 * Decide qué debe hacer el guard con la dirección solicitada (RF-05, RF-06, RF-10).
 * - Ruta sin requisito de sesión (P-1): se permite siempre; volver a P-1 no cierra la sesión.
 * - Ruta interna sin sesión: se lleva a P-1 con el aviso de que debe iniciar sesión.
 * - Sesión de un perfil sin pantalla asignada: se deniega y se ofrece volver a P-1.
 * - Sesión del perfil correcto: se permite. Perfil incorrecto: se deniega con la
 *   pantalla principal del perfil de la sesión como destino de vuelta.
 * @param {Object} entrada
 * @param {{ requiereSesion?: boolean, perfil?: string|string[]|null }} [entrada.ruta] - `meta` de la ruta.
 * @param {{ autenticado?: boolean, rol?: string|null }} [entrada.sesion] - sesión real.
 * @returns {{ accion: 'permitir' }
 *   | { accion: 'ir_login', aviso: 'sesion' }
 *   | { accion: 'denegar', motivo: 'perfil'|'sin_pantalla', destino: string|null }}
 */
export const decidirAcceso = ({ ruta = {}, sesion = {} } = {}) => {
  const requiereSesion = ruta?.requiereSesion === true
  const perfil = ruta?.perfil ?? null
  const autenticado = sesion?.autenticado === true
  const rol = sesion?.rol ?? null

  // P-1 y cualquier ruta sin requisito se abren aunque haya sesión (RF-10).
  if (!requiereSesion) {
    return { accion: 'permitir' }
  }

  if (!autenticado) {
    return { accion: 'ir_login', aviso: 'sesion' }
  }

  const destino = PANTALLA_PRINCIPAL_POR_ROL[rol] ?? null

  if (destino === null) {
    return { accion: 'denegar', motivo: 'sin_pantalla', destino: null }
  }

  // `perfil` puede ser un perfil o una lista de perfiles que comparten la pantalla.
  const perfilesPermitidos = perfil === null ? null : [perfil].flat()

  if (perfilesPermitidos !== null && !perfilesPermitidos.includes(rol)) {
    return { accion: 'denegar', motivo: 'perfil', destino }
  }

  return { accion: 'permitir' }
}
