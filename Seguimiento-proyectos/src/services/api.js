// Instancia única de axios del frontend y normalización de errores de la API.
// Capa de servicios: sin Vue, sin Quasar, sin stores y sin router.
//
// Decisiones de construcción (T3):
// - `crearApi({ almacen, adaptador })` permite inyectar un almacén falso en lugar
//   de sessionStorage y un adaptador falso de axios en lugar de la red. La
//   instancia por defecto (`api`) vive en este archivo y no en un boot, para no
//   tocar quasar.config.js (decisión 13 del plan).
// - Todos los errores se rechazan con un objeto plano:
//   `{ estado, mensaje, codigoHttp, datos }`, donde `mensaje` ya tiene las tres
//   partes de RNF-01 (`construirError`) o es el `mensaje` literal del backend.
//   El plan llama `estado` a la clasificación del error; los valores son
//   'sin_sesion', 'sin_permiso', 'no_encontrado', 'solicitud_invalida',
//   'servidor' y 'red', más 'credenciales_invalidas' (401 del login),
//   'datos_invalidos' y 'respuesta_inesperada' (errores locales de los servicios).
// - `api.js` NO limpia la sesión ni navega: el contrato reparte esa
//   responsabilidad en la capa superior (stores/router). Solo avisa con los
//   ganchos `registrarOnSesionExpirada` (401 de una ruta protegida, RF-42/43) y
//   `registrarOnActividad` (cada petición reinicia el temporizador, RF-07).
//   El 401 de POST /auth/login es credenciales no válidas (RF-04) y el de
//   POST /auth/logout lo resuelve quien cierra; ninguno dispara el aviso.

import axios from 'axios'
import { QUE_HACER, construirError } from '../utils/mensajes.js'

/** URL del backend real (spec 002). En Docker se compila con API_URL=/api (Nginx la reenvía al backend). */
// Sin `?.`: el compilador solo sustituye la expresión exacta import.meta.env.API_URL
export const URL_BASE_API = (import.meta.env && import.meta.env.API_URL) || 'http://localhost:3000'

/** Límite de espera de cada petición: 15 s (decisión 13 del plan). */
export const TIEMPO_LIMITE_MS = 15000

/**
 * Cabecera personalizada que el backend exige a las escrituras autenticadas por cookie
 * (defensa CSRF): un formulario o una imagen de otro sitio no pueden añadirla.
 */
export const CABECERA_CSRF = Object.freeze({ nombre: 'X-Requested-With', valor: 'SeguimientoProyectos' })

/**
 * Claves de la sesión en el almacén, con prefijo delgrow_ para no mezclarse.
 * Solo guarda el perfil no sensible: el token de acceso vive en una cookie HttpOnly que el
 * JavaScript de la página no puede leer (S8), así que no hay clave de token.
 */
export const CLAVES_SESION = Object.freeze({
  rol: 'delgrow_rol',
  nombre: 'delgrow_nombre',
  id: 'delgrow_id',
  /** '1' mientras la persona deba crear su propia contraseña. */
  cambioPendiente: 'delgrow_cambio_contrasena',
  /** '1' si eligió «Mantener sesión iniciada»: la sesión vive en localStorage. */
  persistente: 'delgrow_sesion_persistente',
  /** '1' si la cuenta tiene el módulo «Mis actividades» (solo ordena la pantalla; el backend decide). */
  actividades: 'delgrow_actividades',
  /** Módulos de la cuenta en JSON: [{ modulo, rol }] (unión con documentos; el backend decide). */
  modulos: 'delgrow_modulos',
})

/** Clasificación de los errores que entregan los servicios a las pantallas. */
export const ESTADOS_ERROR = Object.freeze({
  SIN_SESION: 'sin_sesion',
  SIN_PERMISO: 'sin_permiso',
  NO_ENCONTRADO: 'no_encontrado',
  DEMASIADOS_INTENTOS: 'demasiados_intentos',
  SOLICITUD_INVALIDA: 'solicitud_invalida',
  SERVIDOR: 'servidor',
  RED: 'red',
  CREDENCIALES_INVALIDAS: 'credenciales_invalidas',
  DATOS_INVALIDOS: 'datos_invalidos',
  RESPUESTA_INESPERADA: 'respuesta_inesperada',
})

// --- almacén ---------------------------------------------------------------

// Almacén en memoria equivalente a sessionStorage, para Node (pruebas) o si el
// navegador no expone sessionStorage.
const crearAlmacenMemoria = () => {
  const datos = new Map()
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => {
      datos.set(clave, String(valor))
    },
    removeItem: (clave) => {
      datos.delete(clave)
    },
  }
}

let almacenMemoria = null

/**
 * Une el almacén temporal (sessionStorage: se borra al cerrar la app) y el persistente
 * (localStorage). La marca CLAVES_SESION.persistente siempre vive en el persistente y decide
 * dónde se escribe lo demás; se lee de donde esté y al borrar se quita de los dos.
 * @param {Object} temporal - almacén con getItem/setItem/removeItem.
 * @param {Object} persistente - almacén con getItem/setItem/removeItem.
 * @returns {{ getItem: Function, setItem: Function, removeItem: Function }}
 */
export const crearAlmacenSesion = (temporal, persistente) => {
  const destino = (clave) =>
    clave === CLAVES_SESION.persistente || persistente.getItem(CLAVES_SESION.persistente) === '1'
      ? persistente
      : temporal
  return {
    getItem: (clave) => temporal.getItem(clave) ?? persistente.getItem(clave),
    setItem: (clave, valor) => destino(clave).setItem(clave, valor),
    removeItem: (clave) => {
      temporal.removeItem(clave)
      persistente.removeItem(clave)
    },
  }
}

// localStorage puede no existir (Node) o lanzar si el navegador bloquea el almacenamiento.
const obtenerLocalStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * Devuelve el almacén de la sesión: sessionStorage (independiente por pestaña, RF-44) unido a
 * localStorage para «Mantener sesión iniciada». Sin localStorage, solo sessionStorage; sin
 * ninguno (Node), un almacén en memoria compartido.
 * @returns {{ getItem: Function, setItem: Function, removeItem: Function }}
 */
export const obtenerAlmacenPredeterminado = () => {
  if (globalThis.sessionStorage) {
    const local = obtenerLocalStorage()
    return local ? crearAlmacenSesion(globalThis.sessionStorage, local) : globalThis.sessionStorage
  }
  if (!almacenMemoria) {
    almacenMemoria = crearAlmacenMemoria()
  }
  return almacenMemoria
}

// --- errores normalizados --------------------------------------------------

/**
 * Construye un error del frontend de tres partes (RNF-01) sin respuesta del
 * backend: datos inválidos detectados antes de enviar o respuesta inesperada.
 * @param {string} estado - clasificación del error (ESTADOS_ERROR).
 * @param {string} queOcurrio - qué ocurrió.
 * @param {string} sobreQue - sobre qué dato o acción.
 * @param {string} queHacer - qué debe hacer el usuario.
 * @returns {{ estado: string, mensaje: string, codigoHttp: null, datos: null }}
 */
export const crearErrorFrontend = (estado, queOcurrio, sobreQue, queHacer) => ({
  estado,
  mensaje: construirError(queOcurrio, sobreQue, queHacer).mensaje,
  codigoHttp: null,
  datos: null,
})

/**
 * Error para una respuesta del backend que no tiene el formato del contrato.
 * @param {string} sobreQue - sobre qué dato o acción.
 * @returns {{ estado: string, mensaje: string, codigoHttp: null, datos: null }}
 */
export const crearErrorInesperado = (sobreQue) =>
  crearErrorFrontend(
    ESTADOS_ERROR.RESPUESTA_INESPERADA,
    'La respuesta del servidor no tiene el formato esperado',
    sobreQue,
    QUE_HACER.reintentar,
  )

/*
 * Parte "sobre qué" de RNF-01: el dato que falló, dicho como lo entiende la persona, en vez de
 * la petición técnica («GET /casos/mis-casos»). Va de lo más específico a lo más general.
 */
const DATO_POR_RUTA = [
  [/^\/auth\/login/, 'el inicio de sesión'],
  [/^\/auth\/logout/, 'el cierre de sesión'],
  [/^\/auth\/contrasena/, 'el cambio de contraseña'],
  [/^\/auth/, 'tu sesión'],
  [/^\/casos\/mis-casos/, 'tus casos'],
  [/^\/casos\/[^/]+\/prioridad/, 'la prioridad del caso'],
  [/^\/casos/, 'los casos'],
  [/^\/contadores\/resumen/, 'el resumen del equipo'],
  [/^\/contadores/, 'los contadores y sus casos'],
  [/^\/auditorias\/fases/, 'las fases de auditoría'],
  [/^\/auditorias\/[^/]+\/eventos/, 'la bitácora de la auditoría'],
  [/^\/auditorias/, 'las auditorías'],
  [/^\/notificaciones/, 'tus avisos'],
  [/^\/eventos/, 'los avisos en tiempo real'],
  [/^\/usuarios\/restablecer-contrasena/, 'el restablecimiento de contraseña'],
  [/^\/usuarios/, 'las cuentas de usuario'],
]

const describirPeticion = (config) => {
  const ruta = typeof config?.url === 'string' ? config.url.split('?')[0] : ''
  return DATO_POR_RUTA.find(([patron]) => patron.test(ruta))?.[1] ?? 'la información de esta pantalla'
}

// Indica si la petición va a una ruta concreta (ignora la cadena de consulta).
const esRuta = (config, ruta) => {
  const url = typeof config?.url === 'string' ? config.url.split('?')[0] : ''
  return url.endsWith(ruta)
}

// `mensaje` del backend cuando trae cuerpo JSON con texto (se muestra tal cual).
const mensajeDeBackend = (datos) =>
  datos &&
  typeof datos === 'object' &&
  typeof datos.mensaje === 'string' &&
  datos.mensaje.trim() !== ''
    ? datos.mensaje
    : null

// axios rechaza con ECONNABORTED/ETIMEDOUT cuando vence el límite de 15 s.
const esTiempoAgotado = (error) => error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT'

// Clasificación por código HTTP (plan, «Tratamiento por api.js»).
const clasificarRespuesta = (error, respuesta) => {
  if (!respuesta) {
    return ESTADOS_ERROR.RED
  }

  const codigo = respuesta.status
  if (codigo === 401) {
    // El 401 del login son credenciales no válidas (RF-04), no sesión caducada.
    return esRuta(error?.config, '/auth/login')
      ? ESTADOS_ERROR.CREDENCIALES_INVALIDAS
      : ESTADOS_ERROR.SIN_SESION
  }
  if (codigo === 403) {
    return ESTADOS_ERROR.SIN_PERMISO
  }
  if (codigo === 404) {
    return ESTADOS_ERROR.NO_ENCONTRADO
  }
  if (codigo === 429) {
    // Límite de intentos (p. ej. 10 logins fallidos en 15 min): reintentar en el acto no sirve.
    return ESTADOS_ERROR.DEMASIADOS_INTENTOS
  }
  if (codigo >= 500) {
    return ESTADOS_ERROR.SERVIDOR
  }
  return ESTADOS_ERROR.SOLICITUD_INVALIDA
}

// Mensaje de tres partes cuando no hay `mensaje` del backend.
const construirMensaje = (estado, contexto, tiempoAgotado) => {
  if (estado === ESTADOS_ERROR.RED) {
    return tiempoAgotado
      ? construirError('El servidor no respondió a tiempo', contexto, QUE_HACER.reintentar).mensaje
      : construirError('No se pudo conectar con el servidor', contexto, QUE_HACER.revisarConexion).mensaje
  }
  return construirError('El servidor no pudo completar la operación', contexto, QUE_HACER.esperar).mensaje
}

/**
 * Normaliza cualquier rechazo de axios al error del frontend.
 * Si el backend trae `{ mensaje }`, ese texto se usa literal; si no, se
 * construye con las tres partes de RNF-01.
 * @param {Object} error - error de axios.
 * @returns {{ estado: string, mensaje: string, codigoHttp: number|null, datos: Object|null }}
 */
const normalizarError = (error) => {
  const config = error?.config
  const respuesta = error?.response ?? null
  const datos = respuesta?.data ?? null
  const estado = clasificarRespuesta(error, respuesta)
  const mensaje =
    mensajeDeBackend(datos) ??
    construirMensaje(estado, describirPeticion(config), esTiempoAgotado(error))

  return {
    estado,
    mensaje,
    codigoHttp: respuesta?.status ?? null,
    datos,
  }
}

// --- instancia de axios ----------------------------------------------------

/**
 * Crea una instancia de axios que envía la cookie de sesión (`withCredentials`) y la cabecera
 * anti-CSRF, y normaliza los errores. No lee ni envía el token: no es accesible desde JavaScript.
 * Los ganchos son opcionales y propios de cada instancia.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Function} [opciones.adaptador] - adaptador de axios (en lugar de la red).
 * @returns {Object} `{ api, registrarOnActividad, registrarOnSesionExpirada }`.
 */
export const crearApi = (opciones = {}) => {
  const configuracion = {
    baseURL: URL_BASE_API,
    timeout: TIEMPO_LIMITE_MS,
    withCredentials: true,
    headers: { [CABECERA_CSRF.nombre]: CABECERA_CSRF.valor },
  }
  if (typeof opciones.adaptador === 'function') {
    configuracion.adapter = opciones.adaptador
  }

  const instancia = axios.create(configuracion)

  let alActividad = null
  let alSesionExpirada = null

  // Reinicio del temporizador de inactividad al iniciar cada petición válida (RF-07, 4.2 del plan).
  instancia.interceptors.request.use((config) => {
    if (typeof alActividad === 'function') {
      alActividad()
    }
    return config
  })

  // Normalización de errores y aviso de sesión expirada (RF-42, RF-43).
  instancia.interceptors.response.use(
    (respuesta) => respuesta,
    (error) => {
      const normalizado = normalizarError(error)
      // El 401 de logout lo resuelve el cierre (RF-45 a RF-47), no este aviso.
      const esCierreDeSesion = esRuta(error?.config, '/auth/logout')
      if (
        normalizado.estado === ESTADOS_ERROR.SIN_SESION &&
        !esCierreDeSesion &&
        typeof alSesionExpirada === 'function'
      ) {
        alSesionExpirada(normalizado)
      }
      return Promise.reject(normalizado)
    },
  )

  return {
    api: instancia,
    /** Registra el aviso de cada petición (o null para quitarlo). */
    registrarOnActividad: (callback) => {
      alActividad = typeof callback === 'function' ? callback : null
    },
    /** Registra el aviso de sesión expirada (o null para quitarlo). */
    registrarOnSesionExpirada: (callback) => {
      alSesionExpirada = typeof callback === 'function' ? callback : null
    },
    /** Para clientes HTTP que no usan axios (módulo de documentos): cuenta como actividad. */
    avisarActividad: () => {
      if (typeof alActividad === 'function') alActividad()
    },
    /** Para clientes HTTP que no usan axios (módulo de documentos): un 401 caduca la sesión. */
    avisarSesionExpirada: (error) => {
      if (typeof alSesionExpirada === 'function') alSesionExpirada(error)
    },
  }
}

const servicioPorDefecto = crearApi()

/** Instancia única de axios que consumen todos los servicios. */
export const api = servicioPorDefecto.api

/** Gancho global de actividad; el store de sesión lo conecta en T4 (RF-07). */
export const registrarOnActividad = servicioPorDefecto.registrarOnActividad

/** Gancho global de sesión expirada; el store de sesión lo conecta en T4 (RF-42/43). */
export const registrarOnSesionExpirada = servicioPorDefecto.registrarOnSesionExpirada

/** Avisos para el cliente fetch del módulo de documentos (mismos ganchos que axios). */
export const avisarActividad = servicioPorDefecto.avisarActividad
export const avisarSesionExpirada = servicioPorDefecto.avisarSesionExpirada
