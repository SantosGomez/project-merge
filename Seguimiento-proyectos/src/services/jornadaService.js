// Servicio de la jornada (entrada, descanso y salida) de «Mis actividades».
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de jornada con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de jornada.
 */
export const crearJornadaService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /jornadas/hoy: jornada de hoy, minutos trabajados, minutos de actividades, jornada base y hora del servidor.
   * @returns {Promise<{ jornada: Object|null, minutos_trabajados: number, minutos_actividades: number, jornada_base_minutos: number, ahora: string }>}
   */
  const obtenerHoy = async () => {
    const { data } = await api.get('/jornadas/hoy')
    if (
      data?.jornada === undefined ||
      !Number.isFinite(data.minutos_trabajados) ||
      !Number.isFinite(data.minutos_actividades) ||
      !Number.isFinite(data.jornada_base_minutos) ||
      typeof data.ahora !== 'string'
    ) {
      throw crearErrorInesperado('tu jornada de hoy')
    }
    return data
  }

  /**
   * POST /jornadas/hoy/marcar: registra un paso con la hora del servidor.
   * @param {string} paso - `entrada`, `salida_descanso`, `regreso_descanso` o `salida`.
   * @returns {Promise<Object>} la jornada de hoy.
   */
  const marcarPaso = async (paso) => {
    const { data } = await api.post('/jornadas/hoy/marcar', { paso })
    if (!data?.jornada) throw crearErrorInesperado('tu jornada de hoy')
    return data.jornada
  }

  /**
   * GET /jornadas?mes=: jornadas propias de un mes.
   * @param {string} mes - AAAA-MM.
   * @returns {Promise<Array<Object>>}
   */
  const listarMes = async (mes) => {
    const { data } = await api.get('/jornadas', { params: { mes } })
    if (!Array.isArray(data?.jornadas)) throw crearErrorInesperado('tus jornadas del mes')
    return data.jornadas
  }

  /**
   * PUT /jornadas/:fecha: corrige las cuatro horas de un día (todo vacío borra la jornada).
   * @param {string} fecha - AAAA-MM-DD.
   * @param {{ entrada, salida_descanso, regreso_descanso, salida }} horas - `HH:MM` o null.
   * @returns {Promise<Object|null>} la jornada guardada, o null si quedó vacía y se borró.
   */
  const corregir = async (fecha, horas) => {
    const respuesta = await api.put(`/jornadas/${fecha}`, horas)
    if (respuesta.status === 204) return null
    if (!respuesta.data?.jornada) throw crearErrorInesperado('tu jornada')
    return respuesta.data.jornada
  }

  /**
   * PUT /jornadas/ajustes: cambia la jornada base.
   * @param {number} minutos - De 60 a 960, en medias horas.
   * @returns {Promise<number>} la jornada base guardada.
   */
  const guardarAjustes = async (minutos) => {
    const { data } = await api.put('/jornadas/ajustes', { jornada_base_minutos: minutos })
    if (!Number.isFinite(data?.jornada_base_minutos)) throw crearErrorInesperado('tu jornada base')
    return data.jornada_base_minutos
  }

  return { obtenerHoy, marcarPaso, listarMes, corregir, guardarAjustes }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearJornadaService()

export const obtenerHoy = servicioPorDefecto.obtenerHoy
export const marcarPaso = servicioPorDefecto.marcarPaso
export const listarMes = servicioPorDefecto.listarMes
export const corregir = servicioPorDefecto.corregir
export const guardarAjustes = servicioPorDefecto.guardarAjustes
