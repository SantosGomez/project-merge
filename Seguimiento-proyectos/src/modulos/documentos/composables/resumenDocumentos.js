/**
 * Resumen de los documentos para las cuatro tarjetas del Dashboard, el filtro
 * que aplica cada tarjeta y el texto del plazo de cada documento.
 *
 * Función pura: sin imports de Vue ni de Quasar, para que `node --test` la
 * cargue sin dependencias. Los cancelados solo cuentan en el total.
 *
 * GET /documentos trae lo recibido en el mes elegido MÁS lo que sigue en trámite
 * de meses anteriores. El mes se decide por la fecha de recepción, no por el
 * periodo contable (2026-11-25). Por eso «Recibidos» y «Completados» se cuentan
 * solo del mes de recepción, y «En trámite» y «Vencidos» de todo lo vivo.
 */

/** Estados de un documento que sigue vivo (los mismos que dan ÁMBAR en el semáforo). */
const ESTADOS_EN_TRAMITE = ['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE']

/** Un día en milisegundos, para contar días entre dos fechas. */
const UN_DIA = 24 * 60 * 60 * 1000

/** Día local de una fecha como `AAAA-MM-DD`, para comparar días y no momentos. */
const diaLocal = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`

/** Un `AAAA-MM-DD` como número de días, sin zona horaria de por medio. */
const numeroDeDia = (dia) => {
  const [anio, mes, d] = dia.split('-').map(Number)
  return Date.UTC(anio, mes - 1, d) / UN_DIA
}

// `fechaLimite` llega en hora local sin Z (`AAAA-MM-DDTHH:mm:ss`): sus diez
// primeros caracteres ya son el día, sin conversión de zona horaria.
const enTramite = (d) => ESTADOS_EN_TRAMITE.includes(d.estado)
const vencido = (d, hoyDia) =>
  enTramite(d) && d.fechaLimite != null && d.fechaLimite.slice(0, 10) < hoyDia

/**
 * Dice si un documento entra en lo que cuenta una tarjeta. Es la misma regla
 * para la cifra de la tarjeta y para el filtro de la tabla al pulsarla.
 *
 * @param {{fechaRecepcion?: string, estado: string, fechaLimite: string | null}} documento
 * @param {'recibidos' | 'enTramite' | 'vencidos' | 'completados' | null} tarjeta
 *   La tarjeta elegida; sin tarjeta, todo coincide.
 * @param {Date} hoy Fecha de referencia.
 * @param {string} [periodo] El mes elegido (`AAAA-MM`); sin él, todo cuenta como del mes.
 * @returns {boolean}
 */
export const coincideConTarjeta = (documento, tarjeta, hoy, periodo) => {
  const hoyDia = diaLocal(hoy)
  // `fechaRecepcion` llega local sin Z (`AAAA-MM-DDTHH:mm:ss`): sus siete
  // primeros caracteres ya son el mes, sin conversión de zona horaria.
  const delPeriodo = !periodo || documento.fechaRecepcion?.slice(0, 7) === periodo
  switch (tarjeta) {
    case 'recibidos':
      return delPeriodo
    case 'enTramite':
      return enTramite(documento) && !vencido(documento, hoyDia)
    case 'vencidos':
      return vencido(documento, hoyDia)
    case 'completados':
      return delPeriodo && documento.estado === 'COMPLETADO'
    default:
      return true
  }
}

/**
 * @param {Array<{fechaRecepcion?: string, estado: string, fechaLimite: string | null}>} documentos
 *   Lista de GET /documentos.
 * @param {Date} hoy Fecha de referencia, por parámetro para poder probarla.
 * @param {string} [periodo] El periodo elegido (`AAAA-MM`).
 * @returns {{ total: number, enTramite: number, vencidos: number, completados: number }}
 */
export const resumirDocumentos = (documentos, hoy, periodo) => {
  const cuantos = (tarjeta) =>
    documentos.filter((d) => coincideConTarjeta(d, tarjeta, hoy, periodo)).length
  return {
    total: cuantos('recibidos'),
    enTramite: cuantos('enTramite'),
    vencidos: cuantos('vencidos'),
    completados: cuantos('completados'),
  }
}

/**
 * Cuánto falta para la fecha límite, o cuánto hace que pasó, contado en días
 * de calendario. Lo terminado o cancelado no tiene plazo que contar.
 *
 * @param {{estado: string, fechaLimite: string | null}} documento
 * @param {Date} hoy Fecha de referencia.
 * @returns {string} Por ejemplo «Venció hace 3 días», «Vence hoy» o «Faltan 5 días».
 */
export const textoDelPlazo = (documento, hoy) => {
  if (!enTramite(documento)) return ''
  if (!documento.fechaLimite) return 'Sin fecha límite'
  const dias = numeroDeDia(documento.fechaLimite.slice(0, 10)) - numeroDeDia(diaLocal(hoy))
  if (dias < 0) return `Venció hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'Vence hoy'
  if (dias === 1) return 'Vence mañana'
  return `Faltan ${dias} días`
}
