// Servicio de auditorías (rebanada 1 del módulo de auditorías).
// Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.
//
// Traducción: la API usa snake_case y fechas AAAA-MM-DD; las pantallas usan camelCase
// y fechas DD-MM-AAAA. Las fechas solo se reacomodan como texto (nunca `new Date`).

import {
  ESTADOS_ERROR,
  api as apiPorDefecto,
  crearErrorFrontend,
  crearErrorInesperado,
} from './api.js'
import { fechaADominioBackend, fechaParaFormulario } from '../utils/fechasCaso.js'

/**
 * Auditoría de la API en la forma de las pantallas.
 * @param {Object} auditoria - auditoría tal como la devuelve el backend.
 * @returns {Object}
 */
const auditoriaDeBackend = (auditoria) => ({
  id: auditoria.id,
  cliente: auditoria.cliente,
  noExpediente: auditoria.no_expediente,
  dependencia: auditoria.dependencia,
  tipoAud: auditoria.tipo_auditoria,
  estatal: Boolean(auditoria.estatal),
  periodoInicio: fechaParaFormulario(auditoria.periodo_inicio),
  periodoFinal: fechaParaFormulario(auditoria.periodo_final),
  estado: auditoria.estado,
  fechaInicio: fechaParaFormulario(auditoria.fecha_inicio),
  fechaVencimiento: fechaParaFormulario(auditoria.fecha_vencimiento),
  descripcion: auditoria.descripcion ?? '',
  observacion: auditoria.observacion ?? '',
  contadores: Array.isArray(auditoria.contadores) ? auditoria.contadores : [],
  // Seguimiento calculado por el backend desde la bitácora.
  faseActual: auditoria.fase_actual,
  proximoVencimiento: fechaParaFormulario(auditoria.proximo_vencimiento),
  queVence: auditoria.que_vence ?? '',
  diasParaVencer: auditoria.dias_para_vencer ?? null,
  semaforo: auditoria.semaforo,
  actualizadoEn: auditoria.actualizado_en,
})

// Campos de texto y booleanos: [nombre en pantalla, nombre en la API].
const CAMPOS_DIRECTOS = [
  ['cliente', 'cliente'],
  ['noExpediente', 'no_expediente'],
  ['dependencia', 'dependencia'],
  ['tipoAud', 'tipo_auditoria'],
  ['estatal', 'estatal'],
  ['estado', 'estado'],
  ['descripcion', 'descripcion'],
  ['observacion', 'observacion'],
  ['contadores', 'contadores'],
]
// Fechas: [nombre en pantalla, nombre en la API, cómo se nombra en un error].
const CAMPOS_FECHA = [
  ['periodoInicio', 'periodo_inicio', 'el inicio del periodo'],
  ['periodoFinal', 'periodo_final', 'el fin del periodo'],
  ['fechaInicio', 'fecha_inicio', 'la fecha de inicio'],
  ['fechaVencimiento', 'fecha_vencimiento', 'la fecha de vencimiento'],
]

/**
 * Cuerpo para la API con solo los campos presentes en `datos`; las fechas pasan de
 * DD-MM-AAAA a AAAA-MM-DD. Si una fecha no existe lanza el error de tres partes sin
 * llegar a enviar la petición.
 * @param {Object} datos - campos en la forma de las pantallas.
 * @returns {Object}
 */
const cuerpoParaApi = (datos) => {
  const cuerpo = {}
  for (const [pantalla, campoApi] of CAMPOS_DIRECTOS) {
    if (datos[pantalla] !== undefined) cuerpo[campoApi] = datos[pantalla]
  }
  for (const [pantalla, campoApi, nombre] of CAMPOS_FECHA) {
    if (datos[pantalla] === undefined) continue
    const fecha = fechaADominioBackend(datos[pantalla])
    if (fecha === null) {
      throw crearErrorFrontend(
        ESTADOS_ERROR.DATOS_INVALIDOS,
        'La fecha no es válida',
        nombre,
        'Use una fecha real con formato DD-MM-AAAA',
      )
    }
    cuerpo[campoApi] = fecha
  }
  return cuerpo
}

// Lee la auditoría de la respuesta o lanza el error de tres partes.
const leerAuditoria = (data, sobreQue) => {
  if (!data?.auditoria || typeof data.auditoria !== 'object') {
    throw crearErrorInesperado(sobreQue)
  }
  return auditoriaDeBackend(data.auditoria)
}

/**
 * Evento de la bitácora de la API en la forma de las pantallas (fechas DD-MM-AAAA).
 * @param {Object} evento - evento tal como lo devuelve el backend.
 * @returns {Object}
 */
const eventoDeBackend = (evento) => ({
  id: evento.id,
  evento: evento.evento,
  fase: evento.fase,
  fecha: fechaParaFormulario(evento.fecha),
  fechaLimite: fechaParaFormulario(evento.fecha_limite),
  fechaEntrega: fechaParaFormulario(evento.fecha_entrega),
  folio: evento.folio ?? '',
  descripcion: evento.descripcion ?? '',
  estado: evento.estado,
  observaciones: evento.observaciones ?? '',
  registradoPor: evento.registrado_por,
})

// Campos del evento: [nombre en pantalla, nombre en la API].
const CAMPOS_EVENTO = [
  ['evento', 'evento'],
  ['faseId', 'fase_id'],
  ['folio', 'folio'],
  ['descripcion', 'descripcion'],
  ['estado', 'estado'],
  ['observaciones', 'observaciones'],
]
const FECHAS_EVENTO = [
  ['fecha', 'fecha', 'la fecha del evento'],
  ['fechaLimite', 'fecha_limite', 'la fecha límite'],
  ['fechaEntrega', 'fecha_entrega', 'la fecha de entrega'],
]

/**
 * Cuerpo de un evento para la API. Las fechas opcionales vacías se envían como null.
 * @param {Object} datos - campos en la forma de las pantallas.
 * @returns {Object}
 */
const cuerpoDeEvento = (datos) => {
  const cuerpo = {}
  for (const [pantalla, campoApi] of CAMPOS_EVENTO) {
    if (datos[pantalla] !== undefined) cuerpo[campoApi] = datos[pantalla]
  }
  for (const [pantalla, campoApi, nombre] of FECHAS_EVENTO) {
    const valor = datos[pantalla]
    if (valor === undefined) continue
    if (valor === '' || valor === null) {
      cuerpo[campoApi] = null
      continue
    }
    const fecha = fechaADominioBackend(valor)
    if (fecha === null) {
      throw crearErrorFrontend(
        ESTADOS_ERROR.DATOS_INVALIDOS,
        'La fecha no es válida',
        nombre,
        'Use una fecha real con formato DD-MM-AAAA',
      )
    }
    cuerpo[campoApi] = fecha
  }
  return cuerpo
}

const leerEvento = (data, sobreQue) => {
  if (!data?.evento || typeof data.evento !== 'object') {
    throw crearErrorInesperado(sobreQue)
  }
  return eventoDeBackend(data.evento)
}

/**
 * Crea el servicio de auditorías con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de auditorías.
 */
export const crearAuditoriaService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  /**
   * GET /auditorias: el administrador recibe todas; el contador, solo donde está asignado.
   * @returns {Promise<Array<Object>>}
   */
  const listarAuditorias = async () => {
    const { data } = await api.get('/auditorias')
    if (!Array.isArray(data?.auditorias)) {
      throw crearErrorInesperado('la lista de auditorías')
    }
    return data.auditorias.map(auditoriaDeBackend)
  }

  /**
   * POST /auditorias: registra una auditoría. El administrador manda `contadores` (IDs);
   * al contador que registra el backend lo asigna solo.
   * @param {Object} datos - campos del formulario (fechas DD-MM-AAAA).
   * @returns {Promise<Object>} auditoría registrada, ya traducida.
   */
  const registrarAuditoria = async (datos) => {
    const { data } = await api.post('/auditorias', cuerpoParaApi(datos))
    return leerAuditoria(data, 'la auditoría registrada')
  }

  /**
   * PATCH /auditorias/:id: envía solo los campos presentes en `cambios`.
   * @param {number|string} id - identificador de la auditoría.
   * @param {Object} cambios - campos en la forma de las pantallas (fechas DD-MM-AAAA).
   * @returns {Promise<Object>} auditoría actualizada, ya traducida.
   */
  const actualizarAuditoria = async (id, cambios) => {
    const { data } = await api.patch(`/auditorias/${id}`, cuerpoParaApi(cambios))
    return leerAuditoria(data, 'la auditoría actualizada')
  }

  /**
   * GET /auditorias/fases: catálogo de fases { id, nombre, descripcion }.
   * @returns {Promise<Array<Object>>}
   */
  const listarFases = async () => {
    const { data } = await api.get('/auditorias/fases')
    if (!Array.isArray(data?.fases)) {
      throw crearErrorInesperado('el catálogo de fases')
    }
    return data.fases
  }

  /**
   * GET /auditorias/:id/eventos: bitácora en orden cronológico.
   * @param {number|string} auditoriaId
   * @returns {Promise<Array<Object>>}
   */
  const listarEventos = async (auditoriaId) => {
    const { data } = await api.get(`/auditorias/${auditoriaId}/eventos`)
    if (!Array.isArray(data?.eventos)) {
      throw crearErrorInesperado('la bitácora de la auditoría')
    }
    return data.eventos.map(eventoDeBackend)
  }

  /**
   * POST /auditorias/:id/eventos: registra un evento en la bitácora.
   * @param {number|string} auditoriaId
   * @param {Object} datos - campos del formulario (fechas DD-MM-AAAA).
   * @returns {Promise<Object>} evento registrado, ya traducido.
   */
  const registrarEvento = async (auditoriaId, datos) => {
    const { data } = await api.post(`/auditorias/${auditoriaId}/eventos`, cuerpoDeEvento(datos))
    return leerEvento(data, 'el evento registrado')
  }

  /**
   * PATCH /auditorias/:id/eventos/:eventoId: edita un evento con los campos presentes.
   * @returns {Promise<Object>} evento actualizado, ya traducido.
   */
  const actualizarEvento = async (auditoriaId, eventoId, cambios) => {
    const { data } = await api.patch(`/auditorias/${auditoriaId}/eventos/${eventoId}`, cuerpoDeEvento(cambios))
    return leerEvento(data, 'el evento actualizado')
  }

  /**
   * DELETE /auditorias/:id/eventos/:eventoId: borra un evento capturado por error.
   * @returns {Promise<void>}
   */
  const borrarEvento = async (auditoriaId, eventoId) => {
    await api.delete(`/auditorias/${auditoriaId}/eventos/${eventoId}`)
  }

  return {
    listarAuditorias,
    registrarAuditoria,
    actualizarAuditoria,
    listarFases,
    listarEventos,
    registrarEvento,
    actualizarEvento,
    borrarEvento,
  }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearAuditoriaService()

export const listarAuditorias = servicioPorDefecto.listarAuditorias
export const registrarAuditoria = servicioPorDefecto.registrarAuditoria
export const actualizarAuditoria = servicioPorDefecto.actualizarAuditoria
export const listarFases = servicioPorDefecto.listarFases
export const listarEventos = servicioPorDefecto.listarEventos
export const registrarEvento = servicioPorDefecto.registrarEvento
export const actualizarEvento = servicioPorDefecto.actualizarEvento
export const borrarEvento = servicioPorDefecto.borrarEvento
