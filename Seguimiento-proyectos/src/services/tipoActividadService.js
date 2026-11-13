// Servicio de tipos de actividad propios de «Mis actividades».
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de tipos de actividad con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de tipos de actividad.
 */
export const crearTipoActividadService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  const leerTipo = (data) => {
    if (!data?.tipo) throw crearErrorInesperado('el tipo de actividad guardado')
    return data.tipo
  }

  /**
   * GET /tipos-actividad: tipos de la cuenta, activos primero.
   * @returns {Promise<Array<{ id: number, nombre: string, cobrable: boolean, activo: boolean, creado_en: string, total_clientes: number, regla_vencimiento: string, dia_del_mes: number|null }>>}
   */
  const listarTipos = async () => {
    const { data } = await api.get('/tipos-actividad')
    if (!Array.isArray(data?.tipos))
      throw crearErrorInesperado('la lista de tus tipos de actividad')
    return data.tipos
  }

  /**
   * POST /tipos-actividad: agrega un tipo. El nombre va recortado; la regla de vencimiento y su día
   * se envían solo si se reciben.
   * @param {{ nombre: string, cobrable: boolean, regla_vencimiento?: string, dia_del_mes?: number }} datos
   * @returns {Promise<Object>} el tipo creado.
   */
  const crearTipo = async ({ nombre, cobrable, regla_vencimiento, dia_del_mes }) => {
    const cuerpo = { nombre: nombre.trim(), cobrable }
    if (regla_vencimiento !== undefined) cuerpo.regla_vencimiento = regla_vencimiento
    if (dia_del_mes !== undefined) cuerpo.dia_del_mes = dia_del_mes
    const { data } = await api.post('/tipos-actividad', cuerpo)
    return leerTipo(data)
  }

  /**
   * PATCH /tipos-actividad/:id: cambia solo los campos recibidos (nombre, cobrable, activo o vencimiento).
   * @param {number} id - Id del tipo.
   * @param {{ nombre?: string, cobrable?: boolean, activo?: boolean, regla_vencimiento?: string, dia_del_mes?: number }} cambios
   * @returns {Promise<Object>} el tipo actualizado.
   */
  const actualizarTipo = async (id, cambios) => {
    const cuerpo = {}
    if (cambios.nombre !== undefined) cuerpo.nombre = cambios.nombre.trim()
    if (cambios.cobrable !== undefined) cuerpo.cobrable = cambios.cobrable
    if (cambios.activo !== undefined) cuerpo.activo = cambios.activo
    if (cambios.regla_vencimiento !== undefined)
      cuerpo.regla_vencimiento = cambios.regla_vencimiento
    if (cambios.dia_del_mes !== undefined) cuerpo.dia_del_mes = cambios.dia_del_mes
    const { data } = await api.patch(`/tipos-actividad/${id}`, cuerpo)
    return leerTipo(data)
  }

  /**
   * GET /tipos-actividad/:id/clientes: ids de los clientes que llevas en ese tipo.
   * @param {number} id - Id del tipo.
   * @returns {Promise<Array<number>>}
   */
  const listarClientesDeTipo = async (id) => {
    const { data } = await api.get(`/tipos-actividad/${id}/clientes`)
    if (!Array.isArray(data?.cliente_ids)) throw crearErrorInesperado('los clientes del tipo')
    return data.cliente_ids
  }

  /**
   * PUT /tipos-actividad/:id/clientes: guarda solo la diferencia de la cartera del tipo.
   * @param {number} id - Id del tipo.
   * @param {{ agregar: Array<number>, quitar: Array<number> }} cambios
   * @returns {Promise<Array<number>>} ids de cliente que quedan en el tipo.
   */
  const guardarClientesDeTipo = async (id, { agregar, quitar }) => {
    const { data } = await api.put(`/tipos-actividad/${id}/clientes`, { agregar, quitar })
    if (!Array.isArray(data?.cliente_ids)) throw crearErrorInesperado('los clientes del tipo')
    return data.cliente_ids
  }

  return { listarTipos, crearTipo, actualizarTipo, listarClientesDeTipo, guardarClientesDeTipo }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearTipoActividadService()

export const listarTipos = servicioPorDefecto.listarTipos
export const crearTipo = servicioPorDefecto.crearTipo
export const actualizarTipo = servicioPorDefecto.actualizarTipo
export const listarClientesDeTipo = servicioPorDefecto.listarClientesDeTipo
export const guardarClientesDeTipo = servicioPorDefecto.guardarClientesDeTipo
