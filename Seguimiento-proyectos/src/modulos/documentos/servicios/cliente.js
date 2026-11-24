/**
 * Cliente HTTP del navegador para hablar con el Backend.
 *
 * Usa `fetch` nativo (sin axios, principio 1 de la constitución).
 * - Añade `credentials: 'include'` automáticamente para que viaje la cookie de sesión.
 * - Tiempo de espera configurable (por defecto 15 segundos).
 * - Traduce cada código de error del contrato §5.1 a un mensaje en español con su remedio.
 * - Nunca expone al usuario el detalle técnico de un 500 (INTERNO).
 * - Maneja errores de red (fetch rechazado) con mensaje accionable.
 */

import {
  CABECERA_CSRF,
  ESTADOS_ERROR,
  avisarActividad,
  avisarSesionExpirada,
} from '../../../services/api.js'

// Unión con status-conta: la sesión es la de la app (cookie HttpOnly). Las escrituras con cookie
// exigen la cabecera anti-CSRF, cada petición cuenta como actividad y un 401 caduca la sesión.
const CABECERAS_APP = Object.freeze({ [CABECERA_CSRF.nombre]: CABECERA_CSRF.valor })

function avisarSiCaduco(status, mensaje) {
  if (status === 401) {
    avisarSesionExpirada({ estado: ESTADOS_ERROR.SIN_SESION, mensaje })
  }
}

// Tiempo de espera por defecto en milisegundos (15 segundos)
const TIEMPO_ESPERA_POR_DEFECTO = 15_000

// Mapeo de códigos de error del §5.1 a mensajes en español con remedio
// El servidor ya envía `mensaje`, pero el cliente puede completarlo/ajustarlo para la UI.
const MENSAJES_ERROR = {
  CREDENCIALES:
    'Usuario o contraseña incorrectos, o la cuenta está desactivada. ' +
    'Verifica tus datos e inténtalo de nuevo. Si el problema persiste, contacta al administrador.',

  SESION: 'Tu sesión ha caducado o no es válida. ' + 'Inicia sesión de nuevo para continuar.',

  SIN_PERMISO:
    'No tienes permiso para realizar esta acción. ' +
    'Tu rol actual no permite esta operación. Contacta al administrador si crees que es un error.',

  VALIDACION:
    'Faltan datos obligatorios o el formato no es válido. ' +
    'Revisa los campos marcados e inténtalo de nuevo.',

  NO_ENCONTRADO:
    'La ruta solicitada no existe. ' +
    'Verifica la dirección o contacta al administrador si el problema persiste.',

  METODO:
    'El método no está permitido para esta ruta. ' +
    'Contacta al administrador: es un error de configuración.',

  SIN_CONEXION:
    'No se pudo conectar con el servidor. ' +
    'Revisa tu conexión de red y que el servidor esté encendido. ' +
    'Si el problema persiste, contacta al administrador.',

  ESQUEMA_NO_APLICADO:
    'El servidor no tiene el esquema de la base de datos aplicado. ' +
    'Falta ejecutar el script schema.sql o las migraciones pendientes. ' +
    'Contacta al administrador.',

  INTERNO:
    'Ocurrió un error interno en el servidor. ' +
    'El equipo técnico ya ha sido notificado. Inténtalo de nuevo en unos minutos.',

  CUERPO_DEMASIADO_GRANDE:
    'La información enviada supera el tamaño permitido (2 MiB). ' +
    'Reduce el tamaño de los adjuntos o la cantidad de datos e inténtalo de nuevo.',

  JSON_INVALIDO:
    'El formato de los datos enviados no es válido. ' +
    'Recarga la página e inténtalo de nuevo. Si persiste, contacta al administrador.',

  CUERPO_INVALIDO:
    'No se pudo leer la información enviada. ' +
    'Inténtalo de nuevo y, si sigue fallando, contacta al administrador.',
}

/**
 * Clase de error tipada para que el resto del Frontend pueda distinguir
 * entre errores de red, errores del servidor y respuestas exitosas.
 */
export class ErrorHTTP extends Error {
  /**
   * @param {string} mensaje - Mensaje en español listo para mostrar al usuario (p. ej. en $q.notify)
   * @param {number} status - Código de estado HTTP
   * @param {string} codigo - Código de error del contrato §5.1 (p. ej. 'CREDENCIALES', 'INTERNO')
   * @param {Object} [detalles] - Datos adicionales (p. ej. `faltantes` en VALIDACION)
   */
  constructor(mensaje, status, codigo, detalles = {}) {
    super(mensaje)
    this.name = 'ErrorHTTP'
    this.status = status
    this.codigo = codigo
    this.detalles = detalles
  }
}

/**
 * Error de red: fetch rechazado (sin respuesta del servidor).
 */
export class ErrorRed extends Error {
  /**
   * @param {string} mensaje - Mensaje en español listo para mostrar al usuario
   * @param {Error} [causa] - Error original de fetch (no se muestra al usuario)
   */
  constructor(mensaje, causa) {
    super(mensaje)
    this.name = 'ErrorRed'
    this.causa = causa
  }
}

/**
 * Realiza una petición HTTP con fetch, credenciales, timeout y traducción de errores.
 *
 * @param {string} url - Ruta relativa (p. ej. '/api/sesion') o absoluta
 * @param {Object} [opciones] - Opciones de fetch (method, headers, body, etc.)
 * @param {number} [opciones.timeout] - Tiempo de espera en ms (por defecto 15000)
 * @returns {Promise<any>} Cuerpo de la respuesta parseado como JSON
 * @throws {ErrorHTTP} Si la respuesta tiene status >= 400 (con codigo y mensaje traducidos)
 * @throws {ErrorRed} Si fetch falla por red (sin respuesta del servidor)
 */
export async function peticion(url, opciones = {}) {
  const { timeout = TIEMPO_ESPERA_POR_DEFECTO, ...fetchOpciones } = opciones

  // Controlador de aborto para el timeout
  const controlador = new AbortController()
  const idTimeout = setTimeout(() => controlador.abort(), timeout)

  // Opciones base: credenciales y señal de aborto
  const opcionesFinales = {
    ...fetchOpciones,
    credentials: 'include', // Cookie de sesión HttpOnly
    signal: controlador.signal,
    headers: {
      'Content-Type': 'application/json',
      ...CABECERAS_APP,
      ...(fetchOpciones.headers || {}),
    },
  }

  // Si el body es un objeto, lo serializamos a JSON (salvo que ya sea string/FormData)
  if (
    opcionesFinales.body &&
    typeof opcionesFinales.body === 'object' &&
    !(opcionesFinales.body instanceof FormData)
  ) {
    opcionesFinales.body = JSON.stringify(opcionesFinales.body)
  }

  try {
    avisarActividad()
    const respuesta = await fetch(url, opcionesFinales)
    clearTimeout(idTimeout)

    // Intentar parsear JSON; si falla, tratamos el cuerpo como texto
    let cuerpo = null
    const tipoContenido = respuesta.headers.get('content-type') || ''
    if (tipoContenido.includes('application/json')) {
      try {
        cuerpo = await respuesta.json()
      } catch {
        cuerpo = null
      }
    } else {
      try {
        cuerpo = await respuesta.text()
      } catch {
        cuerpo = null
      }
    }

    // Respuesta exitosa (2xx)
    if (respuesta.ok) {
      return cuerpo
    }

    // Respuesta de error (4xx, 5xx): traducir según el contrato §5.1
    const codigoError = cuerpo?.error || 'INTERNO'
    const mensajeServidor = cuerpo?.mensaje
    const detalles = { ...cuerpo }

    // Mensaje traducido: prioridad al mapeo del cliente, fallback al mensaje del servidor,
    // fallback a mensaje genérico según código HTTP
    const mensajeTraducido =
      MENSAJES_ERROR[codigoError] || mensajeServidor || mensajePorStatus(respuesta.status)

    avisarSiCaduco(respuesta.status, mensajeTraducido)
    throw new ErrorHTTP(mensajeTraducido, respuesta.status, codigoError, detalles)
  } catch (error) {
    clearTimeout(idTimeout)

    // Si ya es un ErrorHTTP nuestro, relanzarlo
    if (error instanceof ErrorHTTP) {
      throw error
    }

    // Error de aborto por timeout
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new ErrorRed(
        'La petición tardó demasiado en responder. ' + 'Revisa tu conexión e inténtalo de nuevo.',
        error,
      )
    }

    // Error de red (fetch rechazado: sin servidor, DNS, CORS, etc.)
    throw new ErrorRed(
      'No se pudo conectar con el servidor. ' +
        'Revisa tu conexión de red y que el servidor esté encendido. ' +
        'Si el problema persiste, contacta al administrador.',
      error,
    )
  }
}

/**
 * Mensaje genérico por código de estado HTTP cuando no hay código de contrato.
 * @param {number} status
 * @returns {string}
 */
function mensajePorStatus(status) {
  if (status === 401) return 'No autorizado. Inicia sesión de nuevo.'
  if (status === 403) return 'Acceso denegado. No tienes permiso para esta acción.'
  if (status === 404) return 'Recurso no encontrado.'
  if (status >= 500) return 'Error del servidor. Inténtalo de nuevo más tarde.'
  return 'Error en la petición. Inténtalo de nuevo.'
}

// Métodos de conveniencia para los verbos más usados

/**
 * @param {string} url
 * @param {Object} [opciones]
 * @returns {Promise<any>}
 */
export async function get(url, opciones = {}) {
  return peticion(url, { ...opciones, method: 'GET' })
}

/**
 * @param {string} url
 * @param {Object} [datos] - Cuerpo de la petición (se serializa a JSON)
 * @param {Object} [opciones]
 * @returns {Promise<any>}
 */
export async function post(url, datos, opciones = {}) {
  return peticion(url, { ...opciones, method: 'POST', body: datos })
}

/**
 * @param {string} url
 * @param {Object} [datos] - Cuerpo de la petición (se serializa a JSON)
 * @param {Object} [opciones]
 * @returns {Promise<any>}
 */
export async function put(url, datos, opciones = {}) {
  return peticion(url, { ...opciones, method: 'PUT', body: datos })
}

/**
 * @param {string} url
 * @param {Object} [opciones]
 * @returns {Promise<any>}
 */
export async function del(url, opciones = {}) {
  return peticion(url, { ...opciones, method: 'DELETE' })
}

/**
 * Cambia el tiempo de espera por defecto para todas las peticiones posteriores.
 * Útil si alguna operación (p. ej. subida de archivos) necesita más tiempo.
 * @param {number} ms - Nuevo tiempo de espera en milisegundos
 */
export function establecerTimeoutPorDefecto(ms) {
  if (typeof ms !== 'number' || ms <= 0) {
    throw new Error('El tiempo de espera debe ser un número positivo en milisegundos.')
  }
  // Nota: en JS no podemos reasignar una const, así que esta función
  // serviría si TIEMPO_ESPERA_POR_DEFECTO fuera una variable de módulo mutable.
  // Como está declarada como const, la forma correcta es pasar `timeout`
  // en cada llamada a `peticion` o en los métodos de conveniencia.
  // Se deja la función documentada por si se refactoriza a let en el futuro.
  console.warn('establecerTimeoutPorDefecto: usa el parámetro `timeout` en cada llamada.')
}

/**
 * Verifica si un error es de red (sin respuesta del servidor).
 * @param {unknown} error
 * @returns {boolean}
 */
export function esErrorRed(error) {
  return error instanceof ErrorRed
}

/**
 * Verifica si un error es HTTP (respuesta del servidor con status >= 400).
 * @param {unknown} error
 * @returns {boolean}
 */
export function esErrorHTTP(error) {
  return error instanceof ErrorHTTP
}

/**
 * El texto que se le enseña a la persona cuando una petición falla.
 *
 * Va primero la explicación del servidor (`detalles.mensaje`), porque es la que
 * dice el motivo concreto; el mapeo por código de `peticion` es genérico.
 * ⚠️ El texto traducido vive en `err.message`: `err.mensaje` no existe.
 * @param {unknown} err Error lanzado por `peticion` (ErrorHTTP o ErrorRed)
 * @param {string} respaldo Texto si el error no trae ninguno
 * @returns {string}
 */
export function mensajeParaUsuario(err, respaldo) {
  return err?.detalles?.mensaje || err?.message || respaldo
}

/**
 * Extrae el código de error del contrato (§5.1) de un ErrorHTTP.
 * @param {unknown} error
 * @returns {string | null}
 */
export function codigoDeError(error) {
  return error instanceof ErrorHTTP ? error.codigo : null
}

/**
 * Extrae los detalles (p. ej. `faltantes` en VALIDACION) de un ErrorHTTP.
 * @param {unknown} error
 * @returns {Object | null}
 */
export function detallesDeError(error) {
  return error instanceof ErrorHTTP ? error.detalles : null
}

/**
 * Sube un archivo en crudo (binario) a una URL del Backend.
 *
 * No serializa a JSON ni fuerza `Content-Type: application/json`; envía el
 * Blob/File tal cual y pone el tipo MIME que se le indique. El nombre del
 * archivo va en la URL (`?nombreOriginal=`), nunca en una cabecera: las cabeceras
 * no admiten caracteres fuera de Latin-1 como el guion largo «–».
 *
 * @param {string} url - Ruta relativa o absoluta
 * @param {Blob|File|ArrayBuffer} contenido - Bytes a enviar
 * @param {string} [mimeType] - Tipo MIME
 * @param {number} [timeout] - Tiempo de espera en ms
 * @returns {Promise<any>} Cuerpo JSON de la respuesta
 */
export async function subirArchivoCrudo(url, contenido, mimeType, timeout = 60_000) {
  const controlador = new AbortController()
  const idTimeout = setTimeout(() => controlador.abort(), timeout)

  try {
    avisarActividad()
    const respuesta = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      signal: controlador.signal,
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        ...CABECERAS_APP,
      },
      body: contenido,
    })
    clearTimeout(idTimeout)

    let cuerpo = null
    const tipoContenido = respuesta.headers.get('content-type') || ''
    if (tipoContenido.includes('application/json')) {
      try {
        cuerpo = await respuesta.json()
      } catch {
        cuerpo = null
      }
    }

    if (respuesta.ok) {
      return cuerpo
    }

    const codigoError = cuerpo?.error || 'INTERNO'
    const mensajeServidor = cuerpo?.mensaje
    const detalles = { ...cuerpo }
    const mensajeTraducido =
      MENSAJES_ERROR[codigoError] || mensajeServidor || mensajePorStatus(respuesta.status)

    avisarSiCaduco(respuesta.status, mensajeTraducido)
    throw new ErrorHTTP(mensajeTraducido, respuesta.status, codigoError, detalles)
  } catch (error) {
    clearTimeout(idTimeout)
    if (error instanceof ErrorHTTP) throw error
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new ErrorRed('La subida tardó demasiado. Inténtalo de nuevo.', error)
    }
    throw new ErrorRed('No se pudo conectar con el servidor. Revisa tu conexión.', error)
  }
}
