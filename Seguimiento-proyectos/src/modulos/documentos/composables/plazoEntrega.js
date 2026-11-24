/**
 * Regla del plazo de entrega (lado cliente).
 * Días hábiles por prioridad. Función pura con `hoy` como parámetro.
 */

import { aFechaLocal, esDiaHabil } from './fechas.js'

/** Días hábiles por prioridad. */
const DIAS_POR_PRIORIDAD = {
  BAJA: 15,
  MEDIA: 8,
  ALTA: 4,
  URGENTE: 2,
}

/**
 * Calcula la fecha límite sumando días hábiles a partir de mañana.
 *
 * @param {string} prioridad — 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
 * @param {Date|string} hoy — Fecha base (se ancla a mediodía local)
 * @returns {Date} Fecha límite (mediodía local)
 * @throws {Error} Si la prioridad no está en DIAS_POR_PRIORIDAD
 */
export const plazoDeEntrega = (prioridad, hoy) => {
  const dias = DIAS_POR_PRIORIDAD[prioridad]
  if (!dias) {
    throw new Error(`Prioridad desconocida: ${prioridad}`)
  }

  let fecha = aFechaLocal(hoy)
  let restantes = dias

  while (restantes > 0) {
    fecha = new Date(fecha)
    fecha.setDate(fecha.getDate() + 1)
    if (esDiaHabil(fecha)) {
      restantes--
    }
  }

  return fecha
}
