/**
 * Capa de API del Frontend: una función por endpoint del Backend.
 *
 * Todas las funciones delegan en `cliente.js` (get, post, del).
 * Ninguna escribe `fetch` a mano.
 */

import { get, post, put, subirArchivoCrudo } from './cliente.js'
import { URL_BASE_API } from '../../../services/api.js'

/** Rutas del módulo de documentos en el backend unido (unión con status-conta, fase 4). */
const BASE_DOC = `${URL_BASE_API}/doc`

/**
 * Obtiene los cinco catálogos en una sola llamada.
 * @returns {Promise<Object>} Respuesta del endpoint `/catalogos`
 */
export async function obtenerCatalogos() {
  return get(`${BASE_DOC}/catalogos`)
}

/**
 * Registra un documento con sus adjuntos y firmas.
 * @param {Object} datos - Incluye firmas (base64), adjuntos (metadata), etc.
 * @returns {Promise<Object>} Respuesta del endpoint `/documentos` (POST)
 */
export async function crearDocumento(datos) {
  return post(`${BASE_DOC}/documentos`, datos)
}

/**
 * Obtiene el directorio de clientes con búsqueda, periodo y semáforo.
 * @param {Object} [filtros] - { periodo, busqueda, incluirBaja }
 * @returns {Promise<Object>} Respuesta del endpoint `/clientes`
 */
export async function obtenerDirectorio(filtros = {}) {
  const params = new URLSearchParams()

  if (filtros.periodo) {
    params.append('periodo', filtros.periodo)
  }
  if (filtros.busqueda) {
    params.append('busqueda', filtros.busqueda)
  }
  if (filtros.incluirBaja) {
    params.append('incluirBaja', 'true')
  }

  const query = params.toString()
  const url = query ? `${BASE_DOC}/clientes?${query}` : `${BASE_DOC}/clientes`

  return get(url)
}

/**
 * Registra un nuevo cliente en el catálogo único (POST /doc/clientes).
 * @param {Object} datos - { razonSocial, clave?, rfc?, email?, telefono?, contadorId? }
 * @returns {Promise<Object>} Respuesta: { cliente }
 */
export async function crearClienteDocumento(datos) {
  return post(`${BASE_DOC}/clientes`, datos)
}

/**
 * Obtiene los documentos recibidos en un periodo, para la tabla del Dashboard.
 * @param {string} periodo - 'YYYY-MM'
 * @param {Object} [opciones={}] - { misDocumentos?: boolean }
 * @returns {Promise<Object>} Respuesta del endpoint `/documentos`: { periodo, documentos }
 */
export async function obtenerDocumentos(periodo, opciones = {}) {
  let url = `${BASE_DOC}/documentos?periodo=${encodeURIComponent(periodo)}`
  if (opciones.misDocumentos) {
    url += '&misDocumentos=1'
  }
  return get(url)
}

/**
 * Obtiene los documentos pendientes de entregar al contador (Direccionamiento).
 * @returns {Promise<Object>} Respuesta del endpoint: { documentos }
 */
export async function obtenerDireccionamiento() {
  return get(`${BASE_DOC}/documentos/direccionamiento`)
}

/**
 * Obtiene los documentos entregados al contador en un mes (pestaña «Entregados»).
 * @param {string} mes - Mes de entrega, 'YYYY-MM'
 * @returns {Promise<Object>} Respuesta del endpoint: { documentos }
 */
export async function obtenerEntregados(mes) {
  return get(`${BASE_DOC}/documentos/entregados?mes=${encodeURIComponent(mes)}`)
}

/**
 * Formaliza la entrega de un documento al contador: guarda las dos firmas y lo
 * pasa a En proceso.
 * @param {number} id - ID del documento
 * @param {Object} datos - { contadorId, firmaEntrega, firmaRecepcion, observaciones? }
 * @returns {Promise<Object>} Respuesta del endpoint: { id, estado, contadorId, contador }
 */
export async function entregarDocumento(id, datos) {
  return post(`${BASE_DOC}/documentos/${id}/entrega`, datos)
}

/**
 * Cambia el estado de un documento y deja la fila en su historial.
 * @param {number} id - ID del documento
 * @param {Object} datos - { estado, comentario? }
 * @returns {Promise<Object>} Respuesta del endpoint: { id, estadoAnterior, estado }
 */
export async function cambiarEstadoDocumento(id, datos) {
  return post(`${BASE_DOC}/documentos/${id}/estado`, datos)
}

/**
 * Obtiene los expedientes para el portal de seguimiento.
 * @param {string} [q] - Término de búsqueda (folio o RFC)
 * @returns {Promise<Object>} Respuesta del endpoint: { expedientes: [...], aviso?: string }
 */
export async function obtenerSeguimiento(q = '') {
  const params = new URLSearchParams()
  if (q) params.append('q', q)
  const query = params.toString()
  const url = query ? `${BASE_DOC}/seguimiento?${query}` : `${BASE_DOC}/seguimiento`
  return get(url)
}

/**
 * Sube un archivo adjunto en crudo a un documento ya registrado.
 * @param {number} documentoId - ID del documento
 * @param {File} file - Archivo a subir
 * @returns {Promise<Object>} Respuesta del endpoint: { id, nombreOriginal, rutaStorage, tamanoBytes }
 */
export async function subirArchivo(documentoId, file) {
  const params = new URLSearchParams()
  params.append('nombreOriginal', file.name)
  if (file.type) params.append('mimeType', file.type)
  const url = `${BASE_DOC}/documentos/${documentoId}/archivos?${params.toString()}`
  return subirArchivoCrudo(url, file, file.type || 'application/octet-stream')
}

/**
 * Sube el acuse en PDF a un documento ya registrado.
 * @param {number} documentoId - ID del documento
 * @param {Blob} blob - PDF del acuse
 * @param {string} folio - Folio del documento (para el nombre)
 * @returns {Promise<Object>}
 */
export async function subirAcuse(documentoId, blob, folio) {
  const nombre = `acuse-${folio || 'dca'}.pdf`
  const params = new URLSearchParams()
  params.append('nombreOriginal', nombre)
  params.append('mimeType', 'application/pdf')
  const url = `${BASE_DOC}/documentos/${documentoId}/archivos?${params.toString()}`
  return subirArchivoCrudo(url, blob, 'application/pdf')
}

/**
 * Obtiene los clientes que ya tienen al menos una recepción registrada.
 * Alimenta el autollenado del formulario de recepción.
 * @returns {Promise<Object>} Respuesta del endpoint: { clientes: [...] }
 */
export async function obtenerClientesFrecuentes() {
  return get(`${BASE_DOC}/clientes/frecuentes`)
}

/**
 * Obtiene los documentos requeridos de un cliente para un periodo.
 * @param {number} clienteId - ID del cliente
 * @param {string} [periodo] - 'YYYY-MM'
 * @returns {Promise<Object>} Respuesta del endpoint: { clienteId, periodo, resumen, requeridos }
 */
export async function obtenerRequeridosCliente(clienteId, periodo) {
  const query = periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''
  return get(`${BASE_DOC}/clientes/${clienteId}/requeridos${query}`)
}

/**
 * Configura un documento requerido para un cliente.
 * @param {number} clienteId - ID del cliente
 * @param {{ tipoDocId: number, periodo: string, fechaLimite: string }} datos
 * @returns {Promise<Object>}
 */
export async function crearRequeridoCliente(clienteId, datos) {
  return post(`${BASE_DOC}/clientes/${clienteId}/requeridos`, datos)
}

/**
 * Cuentas de la app con su rol en documentos (GET /doc/usuarios). Solo Administrador y Sistemas.
 * @returns {Promise<{ usuarios: Array, roles: string[] }>}
 */
export async function obtenerAccesosDocumentos() {
  return get(`${BASE_DOC}/usuarios`)
}

/**
 * Da, cambia o quita (rol null) el acceso de una cuenta al módulo (PUT /doc/usuarios/:id/rol).
 * @param {number} usuarioId
 * @param {string|null} rol
 */
export async function cambiarAccesoDocumentos(usuarioId, rol) {
  return put(`${BASE_DOC}/usuarios/${usuarioId}/rol`, { rol })
}
