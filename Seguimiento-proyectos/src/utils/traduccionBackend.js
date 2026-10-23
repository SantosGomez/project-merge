// Traducción entre la forma del backend y los códigos internos del frontend.
// El backend usa 'Pendiente'/'En proceso'/'Finalizado' y 'Alta'/'Media'/'Baja';
// las pantallas usan 'pendiente'/'en_proceso'/'finalizado' y 'alta'/'media'/'baja'.
// Funciones puras, síncronas y sin efectos secundarios.
// Un valor desconocido se traduce a `null` y nunca se lanza una excepción:
// quien llama trata `null` como respuesta inesperada y construye el error de tres partes.

/** Pares [forma del backend, código interno] de los estados, en el orden de la spec. */
const ESTADOS = [
  ['Pendiente', 'pendiente'],
  ['En proceso', 'en_proceso'],
  ['Finalizado', 'finalizado'],
]

/** Pares [forma del backend, código interno] de las prioridades, de mayor a menor urgencia. */
const PRIORIDADES = [
  ['Alta', 'alta'],
  ['Media', 'media'],
  ['Baja', 'baja'],
]

/** Convierte los pares [backend, interno] en un mapa backend → interno. */
const mapaDeBackend = (pares) => new Map(pares)

/** Convierte los pares [backend, interno] en un mapa interno → backend. */
const mapaABackend = (pares) => new Map(pares.map(([backend, interno]) => [interno, backend]))

const ESTADO_DE_BACKEND = mapaDeBackend(ESTADOS)
const ESTADO_A_BACKEND = mapaABackend(ESTADOS)
const PRIORIDAD_DE_BACKEND = mapaDeBackend(PRIORIDADES)
const PRIORIDAD_A_BACKEND = mapaABackend(PRIORIDADES)

/** 'En proceso' → 'en_proceso'; cualquier otro valor → null. */
export const estadoDeBackend = (estadoBackend) => ESTADO_DE_BACKEND.get(estadoBackend) ?? null

/** 'en_proceso' → 'En proceso'; cualquier otro valor → null. */
export const estadoABackend = (estadoInterno) => ESTADO_A_BACKEND.get(estadoInterno) ?? null

/** 'Alta' → 'alta'; cualquier otro valor → null. */
export const prioridadDeBackend = (prioridadBackend) =>
  PRIORIDAD_DE_BACKEND.get(prioridadBackend) ?? null

/** 'alta' → 'Alta'; cualquier otro valor → null. */
export const prioridadABackend = (prioridadInterna) =>
  PRIORIDAD_A_BACKEND.get(prioridadInterna) ?? null

/**
 * Copia de un caso del backend con `estado` y `prioridad` en código interno.
 * No modifica el caso recibido. Devuelve `null` si el caso no es un objeto o
 * si el estado o la prioridad no son válidos.
 */
export const casoDeBackend = (casoBackend) => {
  if (casoBackend === null || typeof casoBackend !== 'object') {
    return null
  }

  const estado = estadoDeBackend(casoBackend.estado)
  const prioridad = prioridadDeBackend(casoBackend.prioridad)

  if (estado === null || prioridad === null) {
    return null
  }

  return { ...casoBackend, estado, prioridad }
}
