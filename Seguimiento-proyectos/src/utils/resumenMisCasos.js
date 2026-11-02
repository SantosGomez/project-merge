import { esCasoVencido } from './filtrosCasos.js'

/**
 * Resumen de los casos propios del contador para «Mi resumen»: los mismos campos que el
 * resumen del equipo del administrador, así las tarjetas y la dona se reutilizan tal cual.
 * @param {Array<Object>} casos - casos internos del store (`estado`, `prioridad`, `fecha_vencimiento`).
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {{ pendiente: number, en_proceso: number, finalizado: number, abiertos: number, vencidos: number, alta_abiertos: number, proximosAVencer: number, sinVencimiento: number }}
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
    sinVencimiento: 0,
  }

  // Fecha límite para "próximos a vencer": hoy + 3 días (calendario), sin usar Date para evitar zona horaria
  const [ay, am, ad] = hoy.split('-').map(Number)
  let ly = ay, lm = am, ld = ad + 3
  const diasMes = [31, 28 + (ly % 4 === 0 && (ly % 100 !== 0 || ly % 400 === 0) ? 1 : 0), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  while (ld > diasMes[lm - 1]) {
    ld -= diasMes[lm - 1]
    lm++
    if (lm > 12) { lm = 1; ly++ }
  }
  const limiteStr = `${ly}-${String(lm).padStart(2, '0')}-${String(ld).padStart(2, '0')}`

  for (const caso of casos ?? []) {
    if (caso.estado in resumen) resumen[caso.estado] += 1

    if (caso.estado === 'finalizado') continue

    resumen.abiertos += 1

    if (caso.prioridad === 'alta') resumen.alta_abiertos += 1

    if (esCasoVencido(caso, hoy)) {
      resumen.vencidos += 1
    } else {
      const vence = typeof caso.fecha_vencimiento === 'string' ? caso.fecha_vencimiento.slice(0, 10) : ''
      if (vence === '') {
        resumen.sinVencimiento += 1
      } else if (vence <= limiteStr) {
        // Vence en ≤ 3 días y no está vencido (ya pasó el filtro de esCasoVencido)
        resumen.proximosAVencer += 1
      }
    }
  }

  return resumen
}
