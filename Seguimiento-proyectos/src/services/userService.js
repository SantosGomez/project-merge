// Servicio de usuarios: alta de cuentas para el usuario de sistema (historia 9a).
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.
//
// Los errores ya llegan con su mensaje desde api.js y se dejan pasar tal cual:
// la pantalla muestra el texto del backend sin reescribirlo.

import { api as apiPorDefecto } from './api.js'

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
   * @param {{ nombre: string, correo: string, password: string, rol: string }} cuenta
   * @returns {Promise<string>} mensaje de alta del backend.
   */
  const crearUsuario = async ({ nombre, correo, password, rol }) => {
    const { data } = await api.post('/usuarios', {
      nombre: nombre.trim(),
      correo: correo.trim().toLowerCase(),
      password: password.trim(),
      rol,
    })
    return data.mensaje
  }

  return { crearUsuario }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearUserService()

export const crearUsuario = servicioPorDefecto.crearUsuario
