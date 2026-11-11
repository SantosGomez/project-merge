// Reglas puras de los casos: validar el registro, contar por estado, dar de alta,
// filtrar por contador y cambiar estado o prioridad.
// Sin Vue, sin navegador, sin efectos secundarios y sin mutar los arreglos que recibe.

import { MAX_CLIENT_LENGTH, PRIORITIES, STATUSES } from './constants.js'
import { fechaParaFormulario } from './fechasCaso.js'

/** Estado inicial de todo caso nuevo: el primero de la lista, Pendiente (RF-26). */
const INITIAL_STATUS = STATUSES[0]

/** Códigos de error del registro, en el orden en que se comprueban (RF-22, RF-23, RF-24). */
export const CASE_ERROR_CODES = {
  clientRequired: 'client_required',
  clientTooLong: 'client_too_long',
  priorityRequired: 'priority_required',
}

/** Quita los espacios al inicio y al final: no cuentan para el límite del cliente. */
const normalizeClient = (client) => (typeof client === 'string' ? client.trim() : '')

/**
 * Comprueba el registro de un caso nuevo (RF-22, RF-23, RF-24).
 * Devuelve el primer motivo por el que no se puede registrar, o `null` si es válido.
 */
export const validateNewCase = ({ client, priority } = {}) => {
  const normalizedClient = normalizeClient(client)

  if (normalizedClient.length === 0) {
    return { valid: false, errorCode: CASE_ERROR_CODES.clientRequired }
  }

  if (normalizedClient.length > MAX_CLIENT_LENGTH) {
    return { valid: false, errorCode: CASE_ERROR_CODES.clientTooLong }
  }

  if (!PRIORITIES.includes(priority)) {
    return { valid: false, errorCode: CASE_ERROR_CODES.priorityRequired }
  }

  return { valid: true, errorCode: null }
}

/**
 * Construye un caso nuevo asignado a un contador (RF-19, RF-26).
 * El estado no se recibe: todo caso nuevo nace en Pendiente.
 */
export const buildCase = ({ client, priority, counterId, nextId }) => ({
  id: nextId,
  client: normalizeClient(client),
  status: INITIAL_STATUS,
  priority,
  counterId,
})

/**
 * Da de alta un caso sobre un arreglo de casos y devuelve uno nuevo (RF-21).
 * La validación previa es responsabilidad de `validateNewCase`.
 */
export const addCase = (cases, newCaseData) => [...cases, buildCase(newCaseData)]

/** Cuenta los casos de cada estado; siempre devuelve las tres claves, con 0 donde no haya (RF-12). */
export const countByStatus = (cases = []) => {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]))

  for (const oneCase of cases) {
    if (STATUSES.includes(oneCase.status)) {
      counts[oneCase.status] += 1
    }
  }

  return counts
}

/** Casos asignados a un contador (RF-33, RNF-6): un arreglo nuevo, sin tocar el original. */
export const casesByCounter = (cases = [], counterId) =>
  cases.filter((oneCase) => oneCase.counterId === counterId)

/** Cambia un campo del caso indicado y devuelve un arreglo nuevo (RF-30, RF-31, RF-32). */
const changeCaseField = (cases, caseId, field, value, allowedValues) => {
  const isAllowedValue = allowedValues.includes(value)

  return cases.map((oneCase) =>
    isAllowedValue && oneCase.id === caseId ? { ...oneCase, [field]: value } : oneCase,
  )
}

/** Cambia el estado de un caso en cualquier momento, también si estaba Finalizado (RF-32). */
export const changeStatus = (cases = [], caseId, status) =>
  changeCaseField(cases, caseId, 'status', status, STATUSES)

/** Cambia la prioridad de un caso; es independiente del estado (RF-31, RF-32). */
export const changePriority = (cases = [], caseId, priority) =>
  changeCaseField(cases, caseId, 'priority', priority, PRIORITIES)

/** Texto recortado; null o undefined cuentan como texto vacío. */
const textoLimpio = (valor) => (typeof valor === 'string' ? valor.trim() : '')

/**
 * Compara el caso guardado con lo escrito en el formulario de edición y devuelve
 * solo lo que cambió, listo para `actualizarCaso`. Los espacios en los extremos no
 * cuentan como cambio; un texto vaciado se envía como '' para borrarlo.
 * @param {Object} caso - caso interno del store (`cliente`, `estado`, `prioridad`, `fecha_inicio`...).
 * @param {{ cliente: string, estado: string, prioridad: string, fechaInicio: string,
 *   fechaVencimiento: string, descripcion: string, observaciones: string, importante: boolean }} formulario - valores del formulario (fecha en DD-MM-AAAA).
 * @returns {Object} campos cambiados: cliente, estado, prioridad, fecha_inicio, fecha_vencimiento, descripcion, observaciones, importante.
 */
export const cambiosDelCaso = (caso, formulario) => {
  const cambios = {}
  const comparar = [
    ['cliente', textoLimpio(caso.cliente), textoLimpio(formulario.cliente)],
    ['estado', caso.estado, formulario.estado],
    ['prioridad', caso.prioridad, formulario.prioridad],
    ['fecha_inicio', fechaParaFormulario(caso.fecha_inicio), textoLimpio(formulario.fechaInicio)],
    [
      'fecha_vencimiento',
      fechaParaFormulario(caso.fecha_vencimiento),
      textoLimpio(formulario.fechaVencimiento),
    ],
    ['descripcion', textoLimpio(caso.descripcion), textoLimpio(formulario.descripcion)],
    ['observaciones', textoLimpio(caso.observaciones), textoLimpio(formulario.observaciones)],
  ]

  for (const [campo, guardado, escrito] of comparar) {
    if (guardado !== escrito) {
      cambios[campo] = escrito
    }
  }

  if (Boolean(caso.importante) !== Boolean(formulario.importante)) {
    cambios.importante = Boolean(formulario.importante)
  }

  return cambios
}

// Campos que muestra la ficha «Ver», en su orden, y cómo se compara cada uno.
const dia = (fecha) => (typeof fecha === 'string' ? fecha.slice(0, 10) : '')
const texto = (valor) => (valor === null || valor === undefined ? '' : String(valor).trim())
const COMPARADORES_FICHA = Object.freeze({
  cliente: texto,
  prioridad: texto,
  estado: texto,
  importante: Boolean,
  contador_id: texto,
  fecha_inicio: dia,
  fecha_vencimiento: dia,
  en_proceso_en: dia,
  descripcion: texto,
  observaciones: texto,
})

/**
 * Campos de la ficha «Ver» que cambiaron entre dos versiones del mismo caso (por ejemplo,
 * cuando otra persona lo actualiza mientras la ficha está abierta).
 * Las fechas se comparan por día y los vacíos (null, '', undefined) cuentan como iguales.
 * @param {Object|null} anterior - caso que se estaba mostrando.
 * @param {Object|null} nuevo - caso recién recibido del store.
 * @returns {Array<string>} claves cambiadas, en el orden de la ficha.
 */
export const camposActualizadosDelCaso = (anterior, nuevo) => {
  if (!anterior || !nuevo) return []
  return Object.keys(COMPARADORES_FICHA).filter(
    (campo) =>
      COMPARADORES_FICHA[campo](anterior[campo]) !== COMPARADORES_FICHA[campo](nuevo[campo]),
  )
}
