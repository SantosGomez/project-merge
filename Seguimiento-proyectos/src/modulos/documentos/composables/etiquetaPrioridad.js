/**
 * Etiqueta visible de la prioridad de un documento. El valor guardado sigue en
 * mayúsculas (`BAJA`, `MEDIA`, `ALTA`, `URGENTE`); solo cambia cómo se lee.
 * Sin imports de Vue ni de Quasar, para que `node --test` la cargue.
 */

const ETIQUETAS = new Map([
  ['BAJA', 'Baja'],
  ['MEDIA', 'Media'],
  ['ALTA', 'Alta'],
  ['URGENTE', 'Urgente'],
])

/**
 * @param {string} prioridad Valor guardado.
 * @returns {string} Etiqueta visible; un valor desconocido se devuelve tal cual y el vacío da ''.
 */
export const etiquetaDePrioridad = (prioridad) => ETIQUETAS.get(prioridad) ?? prioridad ?? ''
