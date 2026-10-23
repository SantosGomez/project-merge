// Servicio de autenticación: login, logout y sesión en sessionStorage
// (RF-01 a RF-10, RF-42 a RF-47).
// Sin Vue, sin Quasar, sin stores y sin router. El almacén y la api se pueden
// inyectar para probarlo sin navegador y sin red.
//
// Contrato que consume la capa superior (T4/T5/T7):
// - `login` resuelve `{ token, rol, id, usuario }` y ya dejó la sesión guardada;
//   si falla, rechaza con el error normalizado de `api.js`.
// - `logout` NUNCA rechaza: resuelve `{ ok: true, mensaje }` o
//   `{ ok: false, error }`. No limpia sessionStorage (4.8: el cierre local lo
//   hace quien llama, para poder fijar el aviso antes de navegar a P-1).
// - `isTokenExpirado(token, ahora)` decodifica `exp` sin librerías; un token
//   mal formado, sin `exp` o que no es texto se trata como expirado (seguro).

import {
  CLAVES_SESION,
  api as apiPorDefecto,
  crearErrorInesperado,
  obtenerAlmacenPredeterminado,
} from './api.js'

// Decodifica un segmento base64url a texto UTF-8 (JWT), en navegador y en Node.
const decodificarBase64Url = (segmento) => {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/')
  const conRelleno = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const BufferGlobal = globalThis.Buffer
  if (typeof BufferGlobal === 'function') {
    return BufferGlobal.from(conRelleno, 'base64').toString('utf8')
  }
  const binario = globalThis.atob(conRelleno)
  return new globalThis.TextDecoder().decode(
    Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0)),
  )
}

/**
 * Indica si el token ya expiró por su campo `exp` (RF-42, RF-43).
 * Token nulo, mal formado, sin `exp` numérico o con `ahora` inválida → true.
 * @param {string} token - JWT guardado en sessionStorage.
 * @param {Date} [ahora] - momento de comparación (inyectable en pruebas).
 * @returns {boolean}
 */
export const isTokenExpirado = (token, ahora = new Date()) => {
  if (typeof token !== 'string') {
    return true
  }

  const partes = token.split('.')
  if (partes.length !== 3 || partes[1] === '') {
    return true
  }

  let carga
  try {
    carga = JSON.parse(decodificarBase64Url(partes[1]))
  } catch {
    return true
  }

  const expirado =
    !carga ||
    typeof carga !== 'object' ||
    typeof carga.exp !== 'number' ||
    !Number.isFinite(carga.exp)
  if (expirado) {
    return true
  }

  const momento = ahora instanceof Date ? ahora.getTime() : new Date(ahora).getTime()
  if (Number.isNaN(momento)) {
    return true
  }

  return carga.exp * 1000 <= momento
}

/**
 * Crea el servicio de autenticación con almacén y api inyectables.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @param {Object} [opciones.almacen] - almacén con getItem/setItem/removeItem.
 * @returns {Object} funciones del servicio de autenticación.
 */
export const crearAuthService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto
  const almacen = opciones.almacen ?? obtenerAlmacenPredeterminado()

  // sessionStorage solo guarda cadenas; null/undefined elimina la clave.
  const escribir = (clave, valor) => {
    if (valor === null || valor === undefined) {
      almacen.removeItem(clave)
      return
    }
    almacen.setItem(clave, String(valor))
  }

  const leer = (clave) => {
    const valor = almacen.getItem(clave)
    return valor === null || valor === undefined ? null : valor
  }

  const getToken = () => leer(CLAVES_SESION.token)
  const getRol = () => leer(CLAVES_SESION.rol)
  const getUsuario = () => leer(CLAVES_SESION.usuario)
  const getId = () => leer(CLAVES_SESION.id)

  const setToken = (token) => escribir(CLAVES_SESION.token, token)
  const setRol = (rol) => escribir(CLAVES_SESION.rol, rol)
  const setUsuario = (usuario) => escribir(CLAVES_SESION.usuario, usuario)
  const setId = (id) => escribir(CLAVES_SESION.id, id)

  /**
   * Guarda la sesión completa (RF-02, RF-42).
   * @param {{ token: string, rol: string, id?: number|string, usuario: string }} sesion
   */
  const setSesion = (sesion) => {
    setToken(sesion.token)
    setRol(sesion.rol)
    setUsuario(sesion.usuario)
    setId(sesion.id)
  }

  /**
   * Elimina el token y los datos de sesión de sessionStorage (RF-07, RF-43).
   * No llama al backend: la caducidad y el cierre de pestaña no revocan (RF-44).
   */
  const limpiarSesion = () => {
    for (const clave of Object.values(CLAVES_SESION)) {
      almacen.removeItem(clave)
    }
  }

  /**
   * Inicia sesión contra POST /auth/login y guarda la sesión (RF-01 a RF-04).
   * @param {string} usuario
   * @param {string} password
   * @returns {Promise<{ token: string, rol: string, id: number, usuario: string }>}
   */
  const login = async (usuario, password) => {
    const { data } = await api.post('/auth/login', { usuario, password })

    if (!data || typeof data.token !== 'string' || data.token.trim() === '') {
      throw crearErrorInesperado('el inicio de sesión')
    }

    const sesion = { token: data.token, rol: data.rol, id: data.id, usuario: data.usuario }
    setSesion(sesion)
    return sesion
  }

  /**
   * Revoca la sesión en el backend (POST /auth/logout) sin lanzar nunca.
   * Resuelve `{ ok: true, mensaje }` si el backend confirma la revocación o
   * `{ ok: false, error }` con el error normalizado si falla (RF-47).
   * El cierre local y el aviso los decide quien llama (4.8).
   * @returns {Promise<{ ok: true, mensaje: string } | { ok: false, error: Object }>}
   */
  const logout = async () => {
    try {
      const { data } = await api.post('/auth/logout')
      const mensaje =
        data && typeof data.mensaje === 'string' && data.mensaje.trim() !== ''
          ? data.mensaje
          : 'Sesión cerrada correctamente'
      return { ok: true, mensaje }
    } catch (error) {
      return { ok: false, error }
    }
  }

  return {
    login,
    logout,
    getToken,
    getRol,
    getUsuario,
    getId,
    setSesion,
    setToken,
    setRol,
    setUsuario,
    setId,
    limpiarSesion,
    isTokenExpirado,
  }
}

// Servicio por defecto con la instancia de axios y sessionStorage reales.
const servicioPorDefecto = crearAuthService()

export const login = servicioPorDefecto.login
export const logout = servicioPorDefecto.logout
export const getToken = servicioPorDefecto.getToken
export const getRol = servicioPorDefecto.getRol
export const getUsuario = servicioPorDefecto.getUsuario
export const getId = servicioPorDefecto.getId
export const setSesion = servicioPorDefecto.setSesion
export const setToken = servicioPorDefecto.setToken
export const setRol = servicioPorDefecto.setRol
export const setUsuario = servicioPorDefecto.setUsuario
export const setId = servicioPorDefecto.setId
export const limpiarSesion = servicioPorDefecto.limpiarSesion
