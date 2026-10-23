// Validaciones puras de los formularios de P-1 y P-4.
// Síncronas, sin Vue, sin navegador y sin efectos secundarios (RF-03, RF-21, RF-22, RF-23).

import { MAX_CLIENT_LENGTH } from './constants.js'

/** Claves de los campos de P-1, las mismas que usa `LoginPage.vue` (RF-03). */
const LOGIN_FIELDS = {
  username: 'username',
  password: 'password',
}

/** Prioridades que acepta el backend, en su forma capitalizada (RF-22). */
const PRIORIDADES_BACKEND = ['Alta', 'Media', 'Baja']

/** Quita los espacios al inicio y al final; cualquier valor que no sea texto cuenta como vacío. */
const normalizar = (valor) => (typeof valor === 'string' ? valor.trim() : '')

/**
 * Comprueba que usuario y contraseña estén completos (RF-03).
 * Señala cada campo faltante por separado y en el orden de P-1.
 */
export const validarCredenciales = (usuario, password) => {
  const faltantes = []

  if (normalizar(usuario).length === 0) {
    faltantes.push(LOGIN_FIELDS.username)
  }

  if (normalizar(password).length === 0) {
    faltantes.push(LOGIN_FIELDS.password)
  }

  return { valido: faltantes.length === 0, faltantes }
}

/**
 * Valida el cliente de un caso nuevo (RF-21, RF-23).
 * Los espacios extremos no cuentan ni para la obligatoriedad ni para el límite de 80.
 */
export const validarCliente = (cliente) => {
  const clienteLimpio = normalizar(cliente)

  if (clienteLimpio.length === 0) {
    return { valido: false, error: 'cliente_requerido' }
  }

  if (clienteLimpio.length > MAX_CLIENT_LENGTH) {
    return { valido: false, error: 'cliente_demasiado_largo' }
  }

  return { valido: true, error: null }
}

/**
 * Valida la prioridad de un caso nuevo (RF-22).
 * Recibe la forma del backend ('Alta', 'Media', 'Baja'): P-4 traduce antes de validar.
 */
export const validarPrioridad = (prioridad) => {
  const prioridadLimpia = normalizar(prioridad)

  if (prioridadLimpia.length === 0) {
    return { valido: false, error: 'prioridad_requerida' }
  }

  if (!PRIORIDADES_BACKEND.includes(prioridadLimpia)) {
    return { valido: false, error: 'prioridad_invalida' }
  }

  return { valido: true, error: null }
}
