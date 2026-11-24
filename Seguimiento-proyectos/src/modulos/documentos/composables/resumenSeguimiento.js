/**
 * Resumen y orden de los expedientes del portal de seguimiento.
 *
 * Módulo de presentación puro (sin Vue ni Quasar) para que `node --test` lo
 * cargue sin dependencias. Los cancelados y los estados desconocidos no
 * cuentan en ningún grupo: no piden nada al cliente ni siguen avanzando.
 */

const EN_PROCESO = new Set(['RECEPCIONADO', 'EN_PROCESO'])

/**
 * @param {Array<{ estado: string }>} expedientes
 * @returns {{ necesitanAlgo: number, enProceso: number, completados: number }}
 */
export const resumirSeguimiento = (expedientes) => ({
  necesitanAlgo: expedientes.filter((e) => e.estado === 'PENDIENTE_CLIENTE').length,
  enProceso: expedientes.filter((e) => EN_PROCESO.has(e.estado)).length,
  completados: expedientes.filter((e) => e.estado === 'COMPLETADO').length,
})

/**
 * Lo que necesita al cliente va primero; el resto conserva el orden del
 * servidor (del más reciente al más antiguo). Devuelve un arreglo nuevo.
 *
 * @param {Array<{ estado: string }>} expedientes
 * @returns {Array<{ estado: string }>}
 */
export const ordenarPorAtencion = (expedientes) => [
  ...expedientes.filter((e) => e.estado === 'PENDIENTE_CLIENTE'),
  ...expedientes.filter((e) => e.estado !== 'PENDIENTE_CLIENTE'),
]
