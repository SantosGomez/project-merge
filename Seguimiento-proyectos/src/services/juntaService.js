// Servicio de juntas del calendario: llama a `/juntas` y valida la forma de las respuestas.
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.
// Las fechas viajan como `AAAA-MM-DD HH:mm` (hora local) y los errores ya llegan normalizados.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

/**
 * Crea el servicio de juntas con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de juntas.
 */
export const crearJuntaService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  const leerJunta = (data, sobreQue) => {
    if (!data?.junta || typeof data.junta !== 'object') throw crearErrorInesperado(sobreQue)
    return data.junta
  }

  // Cuerpo completo que piden el alta y el PATCH; texto recortado.
  const cuerpoDeJunta = (datos) => ({
    titulo: String(datos.titulo ?? '').trim(),
    descripcion: String(datos.descripcion ?? '').trim(),
    inicio: datos.inicio,
    fin: datos.fin,
    participantes: datos.participantes,
  })

  /**
   * GET /juntas?desde&hasta: juntas propias que se cruzan con el rango (días AAAA-MM-DD, incluidos).
   * @param {{ desde: string, hasta: string }} rango
   * @returns {Promise<Array<Object>>}
   */
  const listar = async ({ desde, hasta }) => {
    const { data } = await api.get('/juntas', { params: { desde, hasta } })
    if (!Array.isArray(data?.juntas)) throw crearErrorInesperado('tus juntas')
    return data.juntas
  }

  /**
   * GET /juntas/:id: una junta propia.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  const obtener = async (id) => {
    const { data } = await api.get(`/juntas/${id}`)
    return leerJunta(data, 'la junta')
  }

  /**
   * POST /juntas: crea una junta; los invitados quedan en «pendiente».
   * @param {{ titulo: string, descripcion?: string, inicio: string, fin: string, participantes: number[] }} datos
   * @returns {Promise<Object>} la junta creada.
   */
  const crear = async (datos) => {
    const { data } = await api.post('/juntas', cuerpoDeJunta(datos))
    return leerJunta(data, 'la junta guardada')
  }

  /**
   * PATCH /juntas/:id: reemplaza los datos de la junta (la API pide el cuerpo completo).
   * @param {number} id
   * @param {{ titulo: string, descripcion?: string, inicio: string, fin: string, participantes: number[] }} datos
   * @returns {Promise<Object>} la junta actualizada.
   */
  const actualizar = async (id, datos) => {
    const { data } = await api.patch(`/juntas/${id}`, cuerpoDeJunta(datos))
    return leerJunta(data, 'la junta guardada')
  }

  /**
   * PATCH /juntas/:id/respuesta: un invitado acepta o rechaza (y puede cambiarlo después).
   * @param {number} id
   * @param {'aceptada'|'rechazada'} respuesta
   * @returns {Promise<Object>} la junta actualizada, con su estado.
   */
  const responder = async (id, respuesta) => {
    const { data } = await api.patch(`/juntas/${id}/respuesta`, { respuesta })
    return leerJunta(data, 'tu respuesta')
  }

  /**
   * DELETE /juntas/:id: borra la junta y sus invitaciones.
   * @param {number} id
   * @returns {Promise<void>}
   */
  const borrar = async (id) => {
    const { data } = await api.delete(`/juntas/${id}`)
    if (data?.ok !== true) throw crearErrorInesperado('el borrado de la junta')
  }

  /**
   * GET /juntas/participantes-disponibles: cuentas que se pueden invitar, sin quien pide.
   * @returns {Promise<Array<{ id: number, nombre: string, rol: string }>>}
   */
  const participantesDisponibles = async () => {
    const { data } = await api.get('/juntas/participantes-disponibles')
    if (!Array.isArray(data?.usuarios))
      throw crearErrorInesperado('las personas que puedes invitar')
    return data.usuarios
  }

  return { listar, obtener, crear, actualizar, responder, borrar, participantesDisponibles }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearJuntaService()

export const listar = servicioPorDefecto.listar
export const obtener = servicioPorDefecto.obtener
export const crear = servicioPorDefecto.crear
export const actualizar = servicioPorDefecto.actualizar
export const responder = servicioPorDefecto.responder
export const borrar = servicioPorDefecto.borrar
export const participantesDisponibles = servicioPorDefecto.participantesDisponibles
