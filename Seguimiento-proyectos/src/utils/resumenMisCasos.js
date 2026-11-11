import { esCasoProximoAVencer, esCasoSinMovimiento, esCasoVencido } from './filtrosCasos.js'

/**
 * Resumen de los casos propios del contador para «Mi resumen»: los mismos campos que el
 * resumen del equipo del administrador, así las tarjetas y la dona se reutilizan tal cual,
 * más los próximos a vencer y los que llevan 7 días o más sin cambios (mismas reglas que los
 * filtros de «Mis casos»).
 * @param {Array<Object>} casos - casos internos del store (`estado`, `prioridad`, `fecha_vencimiento`, `actualizado_en`).
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {{ pendiente: number, en_proceso: number, finalizado: number, abiertos: number, vencidos: number, alta_abiertos: number, proximosAVencer: number, sinMovimiento: number }}
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
    sinMovimiento: 0,
  }

  for (const caso of casos ?? []) {
    if (caso.estado in resumen) resumen[caso.estado] += 1
    if (caso.estado === 'finalizado') continue
    resumen.abiertos += 1
    if (caso.prioridad === 'alta') resumen.alta_abiertos += 1
    if (esCasoVencido(caso, hoy)) resumen.vencidos += 1
    if (esCasoProximoAVencer(caso, hoy)) resumen.proximosAVencer += 1
    if (esCasoSinMovimiento(caso, hoy)) resumen.sinMovimiento += 1
  }

  return resumen
}

/**
 * Resumen del equipo de un contador para la pestaña «Mi equipo»: una fila por auxiliar con sus
 * casos y sus cifras, y el total de todos los auxiliares (sin los casos del propio contador).
 * Las filas van con lo urgente primero: más vencidos, luego más abiertos, luego por nombre.
 * @param {Array<Object>} casos - casos internos del store (los propios y los del equipo).
 * @param {Array<{ id: number|string, nombre: string }>} auxiliares - auxiliares del contador.
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {{ equipo: Object, filas: Array<{ id: number|string, nombre: string, casos: Array<Object>, resumen: Object }> }}
 */
export const resumenDeAuxiliares = (casos, auxiliares, hoy) => {
  const filas = (auxiliares ?? []).map((auxiliar) => {
    const suyos = (casos ?? []).filter((caso) => String(caso.contador_id) === String(auxiliar.id))
    return {
      id: auxiliar.id,
      nombre: auxiliar.nombre ?? '',
      casos: suyos,
      resumen: resumenMisCasos(suyos, hoy),
    }
  })

  filas.sort(
    (a, b) =>
      b.resumen.vencidos - a.resumen.vencidos ||
      b.resumen.abiertos - a.resumen.abiertos ||
      a.nombre.localeCompare(b.nombre, 'es'),
  )

  return {
    equipo: resumenMisCasos(
      filas.flatMap((fila) => fila.casos),
      hoy,
    ),
    filas,
  }
}
