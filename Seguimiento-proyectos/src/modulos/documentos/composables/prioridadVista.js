/**
 * Píldora de la prioridad de un documento (lado cliente).
 *
 * Una sola función para todas las pantallas del módulo. Devuelve las clases de la píldora,
 * que se definen en `css/documentos.scss`: URGENTE va sólida y el resto en píldora clara con
 * texto y borde del color. Sin imports de Vue ni de Quasar, para que `node --test` la cargue.
 */

const CHIP_POR_PRIORIDAD = new Map([
  ['URGENTE', 'chip-doc chip-doc--urgente'],
  ['ALTA', 'chip-doc chip-doc--alta'],
  ['MEDIA', 'chip-doc chip-doc--media'],
  ['BAJA', 'chip-doc chip-doc--baja'],
])

/**
 * @param {string} prioridad Valor de `documentos.prioridad` devuelto por el servidor.
 * @returns {{ chip: string }} Clases de la píldora; un valor desconocido sale neutro.
 */
export const estiloDePrioridadDocumento = (prioridad) => ({
  chip: CHIP_POR_PRIORIDAD.get(prioridad) ?? 'chip-doc chip-doc--neutro',
})
