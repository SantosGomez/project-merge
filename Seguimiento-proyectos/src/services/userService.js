// Servicio de usuarios: alta de cuentas para el usuario de sistema (historia 9a).
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.
//
// Los errores ya llegan con su mensaje desde api.js y se dejan pasar tal cual:
// la pantalla muestra el texto del backend sin reescribirlo.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Compara los contadores que el diálogo cargó al abrir con los que quedaron elegidos y devuelve
 * solo lo que el despacho cambió. Así no se pisa lo que un contador haya agregado mientras tanto.
 * @param {Array<number>} cargados - ids vinculados cuando se abrió el diálogo.
 * @param {Array<number>} elegidos - ids marcados al guardar.
 * @returns {{ agregar: Array<number>, quitar: Array<number> }}
 */
export const calcularCambiosDeContadores = (cargados, elegidos) => ({
  agregar: elegidos.filter((id) => !cargados.includes(id)),
  quitar: cargados.filter((id) => !elegidos.includes(id)),
})

/**
 * Crea el servicio de usuarios con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de usuarios.
 */
export const crearUserService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * POST /usuarios: da de alta una cuenta con nombre y correo (RF-28 a RF-30).
   * Todo se envía sin espacios extremos y el correo en minúsculas, como en el login: si no,
   * una contraseña con espacios quedaría guardada así y la cuenta no podría entrar.
   * Un auxiliar puede ir ya vinculado con sus contadores (`contadores`: ids).
   * @param {{ nombre: string, correo: string, password: string, rol: string, contadores?: Array<number> }} cuenta
   * @returns {Promise<string>} mensaje de alta del backend.
   */
  const crearUsuario = async ({ nombre, correo, password, rol, contadores }) => {
    const { data } = await api.post('/usuarios', {
      nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(),
      password: password.trim(),
      rol,
      ...(rol === 'auxiliar' && contadores ? { contadores } : {}),
    })
    return data.mensaje
  }

  /**
   * GET /usuarios/:id/contadores: contadores que apoya un auxiliar.
   * @param {number} auxiliarId
   * @returns {Promise<Array<{ id: number, nombre: string }>>}
   */
  const listarContadoresDeAuxiliar = async (auxiliarId) => {
    const { data } = await api.get(`/usuarios/${auxiliarId}/contadores`)
    if (!Array.isArray(data?.contadores)) {
      throw crearErrorInesperado('los contadores del auxiliar')
    }
    return data.contadores
  }

  /**
   * PUT /usuarios/:id/contadores: agrega y quita solo esos contadores; los demás vínculos no se tocan.
   * @param {number} auxiliarId
   * @param {{ agregar: Array<number>, quitar: Array<number> }} cambios - ids de contadores.
   */
  const guardarContadoresDeAuxiliar = async (auxiliarId, { agregar, quitar }) => {
    await api.put(`/usuarios/${auxiliarId}/contadores`, { agregar, quitar })
  }

  /**
   * PATCH /usuarios/restablecer-contrasena: cambia la contraseña de la cuenta con ese correo (historia 9b).
   * El correo va en el cuerpo, recortado y en minúsculas, y la contraseña recortada, como en el login.
   * @param {{ correo: string, password: string }} datos
   * @returns {Promise<{ mensaje: string, cuentaPropia: boolean }>} mensaje del backend y si se
   *   restableció la cuenta de la sesión (su token ya quedó revocado).
   */
  const restablecerContrasena = async ({ correo, password }) => {
    const { data } = await api.patch('/usuarios/restablecer-contrasena', {
      correo: correo.trim().toLowerCase(),
      password: password.trim(),
    })
    return { mensaje: data.mensaje, cuentaPropia: data.cuentaPropia === true }
  }

  /**
   * GET /usuarios: cuentas del directorio, sin datos de acceso.
   * @returns {Promise<Array<{ id: number, nombre: string, correo: string, rol: string, ultimo_acceso_en: string|null }>>}
   */
  const listarUsuarios = async () => {
    const { data } = await api.get('/usuarios')
    if (!Array.isArray(data?.usuarios)) {
      throw crearErrorInesperado('la lista de usuarios')
    }
    return data.usuarios
  }

  return { crearUsuario, restablecerContrasena, listarUsuarios, listarContadoresDeAuxiliar, guardarContadoresDeAuxiliar }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearUserService()

export const crearUsuario = servicioPorDefecto.crearUsuario
export const restablecerContrasena = servicioPorDefecto.restablecerContrasena
export const listarUsuarios = servicioPorDefecto.listarUsuarios
export const listarContadoresDeAuxiliar = servicioPorDefecto.listarContadoresDeAuxiliar
export const guardarContadoresDeAuxiliar = servicioPorDefecto.guardarContadoresDeAuxiliar
