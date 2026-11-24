// Servicio de autenticación: login, logout y perfil de la sesión en sessionStorage o, con
// «Mantener sesión iniciada», en localStorage (RF-01 a RF-10, RF-42 a RF-47).
// El token de acceso NO se guarda en ningún almacén: el backend lo entrega en una cookie
// HttpOnly (S8) que el navegador envía solo. Aquí solo vive el perfil no sensible.
// Sin Vue, sin Quasar, sin stores y sin router. El almacén y la api se pueden
// inyectar para probarlo sin navegador y sin red.
//
// Contrato que consume la capa superior (T4/T5/T7):
// - `login` resuelve `{ rol, id, nombre, debeCambiarContrasena, persistente }` y ya dejó el perfil guardado
//   (ignora el `token` del cuerpo: la sesión va en la cookie);
//   si falla, rechaza con el error normalizado de `api.js`.
// - `logout` NUNCA rechaza: resuelve `{ ok: true, mensaje }` o
//   `{ ok: false, error }`. No limpia sessionStorage (4.8: el cierre local lo
//   hace quien llama, para poder fijar el aviso antes de navegar a P-1).

import {
  CLAVES_SESION,
  api as apiPorDefecto,
  crearErrorInesperado,
  obtenerAlmacenPredeterminado,
} from './api.js'

/**
 * Crea el servicio de autenticación con almacén y api inyectables.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @param {Object} [opciones.almacen] - almacén con getItem/setItem/removeItem.
 * @returns {Object} funciones del servicio de autenticación.
 */
/**
 * Deja solo los módulos bien formados: { modulo: texto, rol: texto|null }.
 * @param {unknown} valor - lo que llegó del backend o del almacén.
 * @returns {Array<{ modulo: string, rol: string|null }>}
 */
export const normalizarModulos = (valor) =>
  Array.isArray(valor)
    ? valor
        .filter((m) => m && typeof m.modulo === 'string' && m.modulo !== '')
        .map((m) => ({ modulo: m.modulo, rol: typeof m.rol === 'string' ? m.rol : null }))
    : []

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

  const getRol = () => leer(CLAVES_SESION.rol)
  const getNombre = () => leer(CLAVES_SESION.nombre)
  const getId = () => leer(CLAVES_SESION.id)
  /** true si la persona entró con la contraseña que le asignó el administrador. */
  const getCambioPendiente = () => leer(CLAVES_SESION.cambioPendiente) === '1'
  /** true si eligió «Mantener sesión iniciada» (la sesión sobrevive al cerrar la app). */
  const getPersistente = () => leer(CLAVES_SESION.persistente) === '1'
  /** true si la cuenta tiene habilitado el módulo «Mis actividades». */
  const getActividades = () => leer(CLAVES_SESION.actividades) === '1'
  // Módulos (unión con documentos): JSON con [{ modulo, rol }]; un valor roto cuenta como ninguno.
  const getModulos = () => normalizarModulos(leerJson(CLAVES_SESION.modulos))
  const leerJson = (clave) => {
    try {
      return JSON.parse(leer(clave) ?? 'null')
    } catch {
      return null
    }
  }

  const setRol = (rol) => escribir(CLAVES_SESION.rol, rol)
  const setNombre = (nombre) => escribir(CLAVES_SESION.nombre, nombre)
  const setId = (id) => escribir(CLAVES_SESION.id, id)
  const setCambioPendiente = (pendiente) =>
    escribir(CLAVES_SESION.cambioPendiente, pendiente ? '1' : null)
  const setActividades = (habilitado) => escribir(CLAVES_SESION.actividades, habilitado ? '1' : null)
  const setModulos = (modulos) => {
    const lista = normalizarModulos(modulos)
    escribir(CLAVES_SESION.modulos, lista.length > 0 ? JSON.stringify(lista) : null)
  }

  /**
   * Guarda la sesión completa (RF-02, RF-42). Primero borra la anterior y fija la marca de
   * sesión persistente, que decide si se guarda en sessionStorage o en localStorage.
   * @param {{ rol: string, id?: number|string, nombre?: string|null,
   *   debeCambiarContrasena?: boolean, persistente?: boolean, actividades?: boolean }} sesion
   */
  const setSesion = (sesion) => {
    limpiarSesion()
    escribir(CLAVES_SESION.persistente, sesion.persistente ? '1' : null)
    setRol(sesion.rol)
    setNombre(sesion.nombre)
    setId(sesion.id)
    setCambioPendiente(sesion.debeCambiarContrasena)
    setActividades(sesion.actividades)
    setModulos(sesion.modulos)
  }

  /**
   * Elimina el perfil de la sesión del almacén (RF-07, RF-43).
   * No llama al backend: la caducidad y el cierre de pestaña no revocan (RF-44).
   */
  function limpiarSesion() {
    for (const clave of Object.values(CLAVES_SESION)) {
      almacen.removeItem(clave)
    }
  }

  /**
   * Inicia sesión con correo contra POST /auth/login y guarda la sesión (RF-01 a RF-04).
   * @param {string} correo
   * @param {string} password
   * @param {boolean} [mantenerSesion] - casilla «Mantener sesión iniciada».
   * @returns {Promise<{ rol: string, id: number, nombre: string|null, persistente: boolean,
   *   administradoresAtendidos: Array<{ id: number, nombre: string }> }>}
   */
  const login = async (correo, password, mantenerSesion = false) => {
    const cuerpo = mantenerSesion ? { correo, password, mantener_sesion: true } : { correo, password }
    const { data } = await api.post('/auth/login', cuerpo)

    if (!data || typeof data.rol !== 'string' || data.rol.trim() === '') {
      throw crearErrorInesperado('el inicio de sesión')
    }

    const sesion = {
      rol: data.rol,
      id: data.id,
      nombre: data.nombre ?? null,
      debeCambiarContrasena: data.debe_cambiar_contrasena === true,
      persistente: data.sesion_persistente === true,
      actividades: data.actividades_habilitadas === true,
      modulos: normalizarModulos(data.modulos),
    }
    setSesion(sesion)
    // Solo la recepcionista la recibe; vive en memoria (store), no en el almacén.
    return {
      ...sesion,
      administradoresAtendidos: Array.isArray(data.administradores_atendidos)
        ? data.administradores_atendidos
        : [],
    }
  }

  /**
   * Reemplaza la contraseña asignada por el administrador (PATCH /auth/contrasena)
   * y quita la marca guardada. Si falla, rechaza con el error normalizado y la marca sigue.
   * @param {string} password - contraseña nueva.
   */
  const cambiarContrasena = async (password) => {
    await api.patch('/auth/contrasena', { password })
    setCambioPendiente(false)
  }

  /**
   * Cambio voluntario de la contraseña propia (PATCH /auth/mi-contrasena), escribiendo la actual.
   * La sesión sigue abierta. Si falla, rechaza con el error normalizado de api.js.
   * @param {{ passwordActual: string, password: string }} datos
   */
  const cambiarMiContrasena = async ({ passwordActual, password }) => {
    await api.patch('/auth/mi-contrasena', { password_actual: passwordActual, password })
  }

  /**
   * Datos de la cuenta de la sesión (GET /auth/perfil) para «Mi perfil».
   * Si falla, rechaza con el error normalizado de api.js.
   * @returns {Promise<{ id: number, nombre: string, correo: string, rol: string,
   *   actividades_habilitadas: boolean, administradores_atendidos?: Array<{ id: number, nombre: string }>,
   *   creado_en: string|null, ultimo_acceso_en: string|null }>}
   */
  const obtenerPerfil = async () => {
    const { data } = await api.get('/auth/perfil')
    return data
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
    cambiarContrasena,
    cambiarMiContrasena,
    obtenerPerfil,
    getRol,
    getNombre,
    getId,
    getCambioPendiente,
    getPersistente,
    getActividades,
    setActividades,
    getModulos,
    setModulos,
    setSesion,
    setRol,
    setNombre,
    setId,
    limpiarSesion,
  }
}

// Servicio por defecto con la instancia de axios y sessionStorage reales.
const servicioPorDefecto = crearAuthService()

export const login = servicioPorDefecto.login
export const logout = servicioPorDefecto.logout
export const cambiarContrasena = servicioPorDefecto.cambiarContrasena
export const cambiarMiContrasena = servicioPorDefecto.cambiarMiContrasena
export const obtenerPerfil = servicioPorDefecto.obtenerPerfil
export const getCambioPendiente = servicioPorDefecto.getCambioPendiente
export const getPersistente = servicioPorDefecto.getPersistente
export const getActividades = servicioPorDefecto.getActividades
export const setActividades = servicioPorDefecto.setActividades
export const getModulos = servicioPorDefecto.getModulos
export const setModulos = servicioPorDefecto.setModulos
export const getRol = servicioPorDefecto.getRol
export const getNombre = servicioPorDefecto.getNombre
export const getId = servicioPorDefecto.getId
export const setSesion = servicioPorDefecto.setSesion
export const setRol = servicioPorDefecto.setRol
export const setNombre = servicioPorDefecto.setNombre
export const setId = servicioPorDefecto.setId
export const limpiarSesion = servicioPorDefecto.limpiarSesion
