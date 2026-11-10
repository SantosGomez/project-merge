// Servicio de auxiliares: un contador puede tener varios auxiliares (otros contadores)
// que le apoyan con sus casos.
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de auxiliares con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de auxiliares.
 */
export const crearAuxiliarService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  const leerLista = (datos, clave, sobreQue) => {
    const lista = datos && datos[clave]
    if (!Array.isArray(lista)) {
      throw crearErrorInesperado(sobreQue)
    }
    return lista
  }

  /**
   * GET /contadores/:id/auxiliares: lista de auxiliares del contador.
   * @param {number} contadorId - Id del contador.
   * @returns {Promise<Array<{id: number, nombre: string}>>}
   */
  const listarAuxiliares = async (contadorId) => {
    const { data } = await api.get(`/contadores/${contadorId}/auxiliares`)
    return leerLista(data, 'auxiliares', 'los auxiliares del contador')
  }

  /**
   * POST /contadores/:contadorId/auxiliares/:auxiliarId: asigna un auxiliar.
   * @param {number} contadorId - Id del contador.
   * @param {number} auxiliarId - Id del auxiliar.
   * @returns {Promise<{mensaje: string}>}
   */
  const asignarAuxiliar = async (contadorId, auxiliarId) => {
    const { data } = await api.post(`/contadores/${contadorId}/auxiliares/${auxiliarId}`)
    return { mensaje: data.mensaje }
  }

  /**
   * DELETE /contadores/:contadorId/auxiliares/:auxiliarId: quita un auxiliar.
   * @param {number} contadorId - Id del contador.
   * @param {number} auxiliarId - Id del auxiliar.
   * @returns {Promise<{mensaje: string}>}
   */
  const quitarAuxiliar = async (contadorId, auxiliarId) => {
    const { data } = await api.delete(`/contadores/${contadorId}/auxiliares/${auxiliarId}`)
    return { mensaje: data.mensaje }
  }

  /**
   * GET /contadores/:id/contadores-que-me-tienen-como-auxiliar: contadores para los que el
   * usuario es auxiliar.
   * @param {number} auxiliarId - Id del contador auxiliar.
   * @returns {Promise<Array<{id: number, nombre: string}>>}
   */
  const listarContadoresQueMeTienenComoAuxiliar = async (auxiliarId) => {
    const { data } = await api.get(`/contadores/${auxiliarId}/contadores-que-me-tienen-como-auxiliar`)
    return leerLista(data, 'contadores', 'los contadores que te tienen como auxiliar')
  }

  /**
   * POST /casos/para-auxiliar: el auxiliar crea un caso a nombre de su contador.
   * @param {number} contadorId - Id del contador dueño del caso.
   * @param {Object} datos - Datos del caso { cliente, prioridad, fecha_inicio, fecha_vencimiento, descripcion, observaciones }.
   * @returns {Promise<{mensaje: string, caso: Object}>}
   */
  const crearCasoComoAuxiliar = async (contadorId, datos) => {
    const { data } = await api.post('/casos/para-auxiliar', { contador_id: contadorId, ...datos })
    return { mensaje: data.mensaje, caso: data.caso }
  }

  return {
    listarAuxiliares,
    asignarAuxiliar,
    quitarAuxiliar,
    listarContadoresQueMeTienenComoAuxiliar,
    crearCasoComoAuxiliar,
  }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearAuxiliarService()

export const listarAuxiliares = servicioPorDefecto.listarAuxiliares
export const asignarAuxiliar = servicioPorDefecto.asignarAuxiliar
export const quitarAuxiliar = servicioPorDefecto.quitarAuxiliar
export const listarContadoresQueMeTienenComoAuxiliar = servicioPorDefecto.listarContadoresQueMeTienenComoAuxiliar
export const crearCasoComoAuxiliar = servicioPorDefecto.crearCasoComoAuxiliar
