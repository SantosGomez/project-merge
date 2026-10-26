// Servicio de contadores: lectura exclusiva para administrador
// (RF-11 a RF-16, RF-24, RF-36).
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.
//
// Los casos se devuelven con estado y prioridad en código interno del frontend
// (`pendiente`/`en_proceso`/`finalizado`, `alta`/`media`/`baja`) para que los
// componentes no cambien. Las listas se devuelven como arreglos; el mensaje de
// vacío del backend es informativo y las pantallas usan sus propios textos.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'
import { casoDeBackend } from '../utils/traduccionBackend.js'

// Lee una lista del cuerpo de la respuesta o lanza el error de tres partes.
const leerLista = (datos, clave, sobreQue) => {
  const lista = datos && datos[clave]
  if (!Array.isArray(lista)) {
    throw crearErrorInesperado(sobreQue)
  }
  return lista
}

// Traduce cada caso con casoDeBackend; si alguno no se puede, error de tres partes.
const traducirCasos = (casos, sobreQue) =>
  casos.map((caso) => {
    const traducido = casoDeBackend(caso)
    if (traducido === null) {
      throw crearErrorInesperado(sobreQue)
    }
    return traducido
  })

/**
 * Crea el servicio de contadores con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de contadores.
 */
export const crearCounterService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /contadores: lista de contadores `{ id, nombre }` (RF-11, RF-16).
   * @returns {Promise<Array<{ id: number, nombre: string }>>}
   */
  const listCounters = async () => {
    const { data } = await api.get('/contadores')
    return leerLista(data, 'contadores', 'la lista de contadores')
  }

  /**
   * GET /contadores/:id/conteos: conteos por estado con ceros incluidos (RF-12).
   * Las claves del backend ya coinciden con los códigos internos.
   * @param {number|string} id - identificador del contador.
   * @returns {Promise<{ pendiente: number, en_proceso: number, finalizado: number }>}
   */
  const getConteosPorEstado = async (id) => {
    const { data } = await api.get(`/contadores/${id}/conteos`)
    return {
      pendiente: Number(data?.pendiente) || 0,
      en_proceso: Number(data?.en_proceso) || 0,
      finalizado: Number(data?.finalizado) || 0,
    }
  }

  /**
   * GET /contadores/:id/casos: casos del contador ya traducidos (RF-14, RF-15).
   * @param {number|string} id - identificador del contador.
   * @returns {Promise<Array<Object>>}
   */
  const getCasosPorContador = async (id) => {
    const { data } = await api.get(`/contadores/${id}/casos`)
    const casos = leerLista(data, 'casos', 'los casos del contador')
    return traducirCasos(casos, 'los casos del contador')
  }

  return { listCounters, getConteosPorEstado, getCasosPorContador }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearCounterService()

export const listCounters = servicioPorDefecto.listCounters
export const getConteosPorEstado = servicioPorDefecto.getConteosPorEstado
export const getCasosPorContador = servicioPorDefecto.getCasosPorContador
