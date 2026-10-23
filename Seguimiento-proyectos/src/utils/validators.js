// Validaciones puras de los formularios de P-1 y P-4.
// Síncronas, sin Vue, sin navegador y sin efectos secundarios (RF-03, RF-21, RF-22, RF-23).

import {
  MAX_CLIENT_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  PROFILES,
} from './constants.js'

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

/**
 * Valida el alta de una cuenta de usuario (historia 9a).
 * Mismas reglas que el backend: usuario de hasta 100 caracteres, contraseña de
 * al menos 8 y uno de los tres roles.
 * @returns {{ valido: boolean, errores: { usuario: string|null, password: string|null, rol: string|null } }}
 */
export const validarAltaUsuario = (usuario, password, rol) => {
  const requeridos = validarCredenciales(usuario, password)

  const errores = {
    usuario: requeridos.faltantes.includes('username') ? 'usuario_requerido' : null,
    password: requeridos.faltantes.includes('password') ? 'password_requerida' : null,
    rol: Object.values(PROFILES).includes(rol) ? null : 'rol_requerido',
  }

  // Igual que en el cliente, los espacios extremos no cuentan para el límite.
  if (errores.usuario === null && normalizar(usuario).length > MAX_USERNAME_LENGTH) {
    errores.usuario = 'usuario_demasiado_largo'
  }

  // El login recorta la contraseña antes de enviarla, así que el mínimo se mide igual.
  if (errores.password === null && normalizar(password).length < MIN_PASSWORD_LENGTH) {
    errores.password = 'password_corta'
  }

  return { valido: Object.values(errores).every((error) => error === null), errores }
}
