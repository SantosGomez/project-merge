/**
 * Resumen de los documentos pendientes de entrega para las tres tarjetas de
 * Direccionamiento. Función pura: sin imports de Vue ni de Quasar, para que
 * `node --test` la cargue sin dependencias.
 */

/** Día local de una fecha como `AAAA-MM-DD`, para comparar días y no momentos. */
const diaLocal = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`

/**
 * @param {Array<{prioridad: string, fechaLimite: string | null}>} pendientes
 *   Documentos de GET /documentos/direccionamiento.
 * @param {Date} hoy Fecha de referencia, por parámetro para poder probarla.
 * @returns {{ porEntregar: number, urgentes: number, vencidos: number }}
 */
export const resumirPendientes = (pendientes, hoy) => {
  const hoyDia = diaLocal(hoy)
  // `fechaLimite` llega en hora local sin Z (`AAAA-MM-DDTHH:mm:ss`): sus diez
  // primeros caracteres ya son el día, sin conversión de zona horaria. La fecha
  // límite de hoy todavía está en plazo; solo vence la de un día anterior.
  const vencido = (d) => d.fechaLimite != null && d.fechaLimite.slice(0, 10) < hoyDia

  return {
    porEntregar: pendientes.length,
    urgentes: pendientes.filter((d) => d.prioridad === 'URGENTE').length,
    vencidos: pendientes.filter(vencido).length,
  }
}
