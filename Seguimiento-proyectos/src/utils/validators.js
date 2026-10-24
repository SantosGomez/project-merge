// Validaciones puras de los formularios de P-1 y P-4.
// Síncronas, sin Vue, sin navegador y sin efectos secundarios (RF-03, RF-21, RF-22, RF-23).

import {
  MAX_CLIENT_LENGTH,
  MAX_NOMBRE_CORREO_LENGTH,
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

/** Forma de un correo: algo@dominio.ext, sin espacios (la misma regla que el backend). */
const FORMA_DE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Error de un texto obligatorio con máximo, o null si es válido. Los espacios extremos no cuentan.
 * @returns {string|null} `<campo>_requerido`, `<campo>_demasiado_largo` o null.
 */
const errorDeTextoObligatorio = (valor, campo) => {
  const limpio = normalizar(valor)
  if (limpio.length === 0) return `${campo}_requerido`
  if (limpio.length > MAX_NOMBRE_CORREO_LENGTH) return `${campo}_demasiado_largo`
  return null
}

/**
 * Valida el alta de una cuenta (historia 9a, con nombre y correo).
 * Mismas reglas que el backend: nombre y correo de hasta 150 caracteres, correo con forma
 * de correo, contraseña de al menos 8 y uno de los tres roles.
 * @returns {{ valido: boolean, errores: { nombre: string|null, correo: string|null, password: string|null, rol: string|null } }}
 */
export const validarAltaUsuario = (nombre, correo, password, rol) => {
  const errores = {
    nombre: errorDeTextoObligatorio(nombre, 'nombre'),
    correo: errorDeTextoObligatorio(correo, 'correo'),
    password: normalizar(password).length === 0 ? 'password_requerida' : null,
    rol: Object.values(PROFILES).includes(rol) ? null : 'rol_requerido',
  }

  if (errores.correo === null && !FORMA_DE_CORREO.test(normalizar(correo))) {
    errores.correo = 'correo_invalido'
  }

  // El login recorta la contraseña antes de enviarla, así que el mínimo se mide igual.
  if (errores.password === null && normalizar(password).length < MIN_PASSWORD_LENGTH) {
    errores.password = 'password_corta'
  }

  return { valido: Object.values(errores).every((error) => error === null), errores }
}
