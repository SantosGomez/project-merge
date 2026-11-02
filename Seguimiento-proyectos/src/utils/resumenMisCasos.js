import { esCasoProximoAVencer, esCasoVencido } from './filtrosCasos.js'

/**
 * Resumen de los casos propios del contador para «Mi resumen»: los mismos campos que el
 * resumen del equipo del administrador, así las tarjetas y la dona se reutilizan tal cual,
 * más los próximos a vencer (misma regla que el filtro de «Mis casos»).
 * @param {Array<Object>} casos - casos internos del store (`estado`, `prioridad`, `fecha_vencimiento`).
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {{ pendiente: number, en_proceso: number, finalizado: number, abiertos: number, vencidos: number, alta_abiertos: number, proximosAVencer: number }}
 */
export const resumenMisCasos = (casos, hoy) => {
  const resumen = {
    pendiente: 0,
    en_proceso: 0,
    finalizado: 0,
    abiertos: 0,
    vencidos: 0,
    alta_abiertos: 0,
    proximosAVencer: 0,
  }

  for (const caso of casos ?? []) {
    if (caso.estado in resumen) resumen[caso.estado] += 1
    if (caso.estado === 'finalizado') continue
    resumen.abiertos += 1
    if (caso.prioridad === 'alta') resumen.alta_abiertos += 1
    if (esCasoVencido(caso, hoy)) resumen.vencidos += 1
    if (esCasoProximoAVencer(caso, hoy)) resumen.proximosAVencer += 1
  }

  return resumen
}
