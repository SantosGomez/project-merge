// Servicio de la lista del mes de «Mis actividades».
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de la lista del mes con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de actividades del mes.
 */
export const crearActividadService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /actividades?mes=AAAA-MM: renglones del mes (tipo por cliente), por tipo y cliente.
   * @param {string} mes - Mes AAAA-MM.
   * @returns {Promise<{ mes: string, actividades: Array<Object> }>}
   */
  const listarActividades = async (mes) => {
    const { data } = await api.get('/actividades', { params: { mes } })
    if (!Array.isArray(data?.actividades)) throw crearErrorInesperado('la lista del mes')
    return { mes: data.mes, actividades: data.actividades }
  }

  /**
   * PUT /actividades/estado: marca o desmarca como hecho un renglón del mes.
   * @param {{ cliente_id: number, tipo_id: number, mes: string, hecha: boolean }} datos
   * @returns {Promise<{ cliente_id: number, tipo_id: number, mes: string, hecha: boolean, hecha_en: string|null }>}
   */
  const guardarEstado = async ({ cliente_id, tipo_id, mes, hecha }) => {
    const { data } = await api.put('/actividades/estado', { cliente_id, tipo_id, mes, hecha })
    if (!data?.actividad) throw crearErrorInesperado('la actividad guardada')
    return data.actividad
  }

  return { listarActividades, guardarEstado }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearActividadService()

export const listarActividades = servicioPorDefecto.listarActividades
export const guardarEstado = servicioPorDefecto.guardarEstado
