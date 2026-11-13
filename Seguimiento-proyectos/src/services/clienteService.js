// Servicio de clientes propios de «Mis actividades».
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'
import { normalizarRfc } from '../utils/actividades.js'

/**
 * Crea el servicio de clientes con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de clientes.
 */
export const crearClienteService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  const leerCliente = (data) => {
    if (!data?.cliente) throw crearErrorInesperado('el cliente guardado')
    return data.cliente
  }

  /**
   * GET /clientes: clientes de la cuenta, activos primero.
   * @returns {Promise<Array<{ id: number, nombre: string, rfc: string|null, activo: boolean, creado_en: string }>>}
   */
  const listarClientes = async () => {
    const { data } = await api.get('/clientes')
    if (!Array.isArray(data?.clientes)) throw crearErrorInesperado('la lista de tus clientes')
    return data.clientes
  }

  /**
   * POST /clientes: agrega un cliente. El nombre va recortado y el RFC en mayúsculas (null si va vacío).
   * @param {{ nombre: string, rfc: string }} datos
   * @returns {Promise<Object>} el cliente creado.
   */
  const crearCliente = async ({ nombre, rfc }) => {
    const { data } = await api.post('/clientes', { nombre: nombre.trim(), rfc: normalizarRfc(rfc) })
    return leerCliente(data)
  }

  /**
   * PATCH /clientes/:id: cambia solo los campos recibidos (nombre, rfc o activo).
   * @param {number} id - Id del cliente.
   * @param {{ nombre?: string, rfc?: string, activo?: boolean }} cambios
   * @returns {Promise<Object>} el cliente actualizado.
   */
  const actualizarCliente = async (id, cambios) => {
    const cuerpo = {}
    if (cambios.nombre !== undefined) cuerpo.nombre = cambios.nombre.trim()
    if (cambios.rfc !== undefined) cuerpo.rfc = normalizarRfc(cambios.rfc)
    if (cambios.activo !== undefined) cuerpo.activo = cambios.activo
    const { data } = await api.patch(`/clientes/${id}`, cuerpo)
    return leerCliente(data)
  }

  return { listarClientes, crearCliente, actualizarCliente }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearClienteService()

export const listarClientes = servicioPorDefecto.listarClientes
export const crearCliente = servicioPorDefecto.crearCliente
export const actualizarCliente = servicioPorDefecto.actualizarCliente
