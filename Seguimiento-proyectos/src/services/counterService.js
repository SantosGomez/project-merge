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
// El dashboard del administrador pide solo los casos importantes.
const filtroImportantes = (opciones = {}) => (opciones.soloImportantes ? '?importantes=true' : '')

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
   * @param {{ soloImportantes?: boolean }} [opciones] - contar solo los casos importantes.
   * @returns {Promise<{ pendiente: number, en_proceso: number, finalizado: number }>}
   */
  const getConteosPorEstado = async (id, opciones) => {
    const { data } = await api.get(`/contadores/${id}/conteos${filtroImportantes(opciones)}`)
    return {
      pendiente: Number(data?.pendiente) || 0,
      en_proceso: Number(data?.en_proceso) || 0,
      finalizado: Number(data?.finalizado) || 0,
    }
  }

  /**
   * GET /contadores/:id/casos: casos del contador ya traducidos (RF-14, RF-15).
   * @param {number|string} id - identificador del contador.
   * @param {{ soloImportantes?: boolean }} [opciones] - devolver solo los casos importantes.
   * @returns {Promise<Array<Object>>}
   */
  const getCasosPorContador = async (id, opciones) => {
    const { data } = await api.get(`/contadores/${id}/casos${filtroImportantes(opciones)}`)
    const casos = leerLista(data, 'casos', 'los casos del contador')
    return traducirCasos(casos, 'los casos del contador')
  }

  /**
   * GET /contadores/resumen: total de casos del equipo para los KPIs del dashboard y las
   * mismas cifras de cada contador (`porContador`, por su id), para filtrar la lista.
   * @param {{ soloImportantes?: boolean }} [opciones] - devolver solo los casos importantes.
   * @returns {Promise<{ pendiente: number, en_proceso: number, finalizado: number, abiertos: number, vencidos: number, alta_abiertos: number, porContador: Object<number, Object> }>}
   */
  const getResumenEquipo = async (opciones) => {
    const { data } = await api.get(`/contadores/resumen${filtroImportantes(opciones)}`)
    const equipo = data?.equipo
    if (equipo === null || typeof equipo !== 'object') {
      throw crearErrorInesperado('el resumen de casos del equipo')
    }
    const cifras = (fila) => ({
      pendiente: Number(fila.pendiente) || 0,
      en_proceso: Number(fila.en_proceso) || 0,
      finalizado: Number(fila.finalizado) || 0,
      abiertos: Number(fila.abiertos) || 0,
      vencidos: Number(fila.vencidos) || 0,
      alta_abiertos: Number(fila.alta_abiertos) || 0,
    })
    const filas = Array.isArray(data.por_contador) ? data.por_contador : []
    return {
      ...cifras(equipo),
      porContador: Object.fromEntries(filas.map((fila) => [fila.contador_id, cifras(fila)])),
    }
  }

  /**
   * GET /contadores/casos-importantes: casos importantes de todos los contadores y los escalados
   * de sus auxiliares, ya traducidos, para el calendario del administrador.
   * @returns {Promise<Array<Object>>}
   */
  const getCasosImportantesCalendario = async () => {
    const { data } = await api.get('/contadores/casos-importantes')
    const casos = leerLista(data, 'casos', 'los casos importantes del calendario')
    return traducirCasos(casos, 'los casos importantes del calendario')
  }

  return {
    listCounters,
    getConteosPorEstado,
    getCasosPorContador,
    getResumenEquipo,
    getCasosImportantesCalendario,
  }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearCounterService()

export const listCounters = servicioPorDefecto.listCounters
export const getConteosPorEstado = servicioPorDefecto.getConteosPorEstado
export const getCasosPorContador = servicioPorDefecto.getCasosPorContador
export const getResumenEquipo = servicioPorDefecto.getResumenEquipo
export const getCasosImportantesCalendario = servicioPorDefecto.getCasosImportantesCalendario
