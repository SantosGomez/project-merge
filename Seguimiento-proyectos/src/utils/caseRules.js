// Reglas puras de los casos: validar el registro, contar por estado, dar de alta,
// filtrar por contador y cambiar estado o prioridad.
// Sin Vue, sin navegador, sin efectos secundarios y sin mutar los arreglos que recibe.

import { MAX_CLIENT_LENGTH, PRIORITIES, STATUSES } from './constants.js'

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
