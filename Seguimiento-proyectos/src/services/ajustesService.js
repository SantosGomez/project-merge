// Servicio de Ajustes: lectura del catálogo de clientes (solo administrador y sistemas).
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de Ajustes con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de Ajustes.
 */
export const crearAjustesService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /ajustes/clientes: todos los clientes del catálogo, activos primero.
   * @returns {Promise<Array<{ id: number, clave: string|null, nombre: string, rfc: string|null,
   * activo: boolean, contador_id: number|null, contador_nombre: string|null }>>}
   */
  const listarClientes = async () => {
    const { data } = await api.get('/ajustes/clientes')
    if (!Array.isArray(data?.clientes)) throw crearErrorInesperado('la lista de clientes')
    return data.clientes
  }

  return { listarClientes }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearAjustesService()

export const listarClientes = servicioPorDefecto.listarClientes
