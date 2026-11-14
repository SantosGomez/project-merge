// Servicio del cronómetro y los bloques de tiempo de «Mis actividades».
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de tiempo con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de tiempo.
 */
export const crearTiempoService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  const leerBloque = (data) => {
    if (!data?.bloque) throw crearErrorInesperado('el bloque de tiempo')
    return data.bloque
  }

  /**
   * GET /tiempo/activo: cronómetro en marcha (o null) y la hora actual del servidor.
   * @returns {Promise<{ activo: Object|null, ahora: string }>}
   */
  const obtenerActivo = async () => {
    const { data } = await api.get('/tiempo/activo')
    if (typeof data?.ahora !== 'string' || data.activo === undefined) {
      throw crearErrorInesperado('tu cronómetro')
    }
    return { activo: data.activo, ahora: data.ahora }
  }

  /**
   * POST /tiempo/iniciar: inicia el cronómetro de un renglón y detiene el que estuviera en marcha.
   * @param {{ cliente_id: number, tipo_id: number, mes: string }} renglon
   * @returns {Promise<{ activo: Object, detenido: Object|null, ahora: string }>}
   */
  const iniciar = async ({ cliente_id, tipo_id, mes }) => {
    const { data } = await api.post('/tiempo/iniciar', { cliente_id, tipo_id, mes })
    if (!data?.activo || typeof data.ahora !== 'string') throw crearErrorInesperado('tu cronómetro')
    return { activo: data.activo, detenido: data.detenido ?? null, ahora: data.ahora }
  }

  /**
   * POST /tiempo/detener: detiene el cronómetro en marcha y devuelve el bloque guardado.
   * @returns {Promise<Object>}
   */
  const detener = async () => {
    const { data } = await api.post('/tiempo/detener', {})
    return leerBloque(data)
  }

  /**
   * GET /tiempo: bloques terminados de un renglón.
   * @param {{ cliente_id: number, tipo_id: number, mes: string }} renglon
   * @returns {Promise<Array<Object>>}
   */
  const listarBloques = async ({ cliente_id, tipo_id, mes }) => {
    const { data } = await api.get('/tiempo', { params: { cliente_id, tipo_id, mes } })
    if (!Array.isArray(data?.bloques)) throw crearErrorInesperado('el tiempo registrado')
    return data.bloques
  }

  /**
   * POST /tiempo/manual: agrega un bloque de tiempo escrito a mano.
   * @param {{ cliente_id: number, tipo_id: number, mes: string, minutos: number }} datos
   * @returns {Promise<Object>} el bloque creado.
   */
  const agregarManual = async ({ cliente_id, tipo_id, mes, minutos }) => {
    const { data } = await api.post('/tiempo/manual', { cliente_id, tipo_id, mes, minutos })
    return leerBloque(data)
  }

  /**
   * DELETE /tiempo/:id: borra un bloque propio.
   * @param {number} id - Id del bloque.
   * @returns {Promise<void>}
   */
  const borrarBloque = async (id) => {
    await api.delete(`/tiempo/${id}`)
  }

  return { obtenerActivo, iniciar, detener, listarBloques, agregarManual, borrarBloque }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearTiempoService()

export const obtenerActivo = servicioPorDefecto.obtenerActivo
export const iniciar = servicioPorDefecto.iniciar
export const detener = servicioPorDefecto.detener
export const listarBloques = servicioPorDefecto.listarBloques
export const agregarManual = servicioPorDefecto.agregarManual
export const borrarBloque = servicioPorDefecto.borrarBloque
