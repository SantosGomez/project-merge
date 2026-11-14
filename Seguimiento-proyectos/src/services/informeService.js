// Servicio de los informes de horas de «Mis actividades».
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de informes con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de informes.
 */
export const crearInformeService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /informes/tiempo: horas propias del periodo, agregadas por el servidor.
   * @param {{ desde: string, hasta: string, cliente_id?: number|null, tipo_id?: number|null }} filtros -
   *   Fechas en AAAA-MM-DD; el cliente y el tipo son opcionales.
   * @returns {Promise<{ resumen: Object, por_cliente: Array, por_tipo: Array, bloques: Array, jornadas: Array }>}
   */
  const obtenerTiempo = async ({ desde, hasta, cliente_id, tipo_id }) => {
    const params = { desde, hasta }
    if (cliente_id !== undefined && cliente_id !== null) params.cliente_id = cliente_id
    if (tipo_id !== undefined && tipo_id !== null) params.tipo_id = tipo_id
    const { data } = await api.get('/informes/tiempo', { params })
    if (
      !data?.resumen ||
      !Array.isArray(data.por_cliente) ||
      !Array.isArray(data.por_tipo) ||
      !Array.isArray(data.bloques) ||
      !Array.isArray(data.jornadas)
    ) {
      throw crearErrorInesperado('tu informe de horas')
    }
    return data
  }

  return { obtenerTiempo }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearInformeService()

export const obtenerTiempo = servicioPorDefecto.obtenerTiempo
