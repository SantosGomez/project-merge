/**
 * Conteo por estado para las cuatro tarjetas del Dashboard, la marca de
 * «vencido» de la tabla y el texto del plazo de cada documento.
 *
 * Función pura: sin imports de Vue ni de Quasar, para que `node --test` la
 * cargue sin dependencias.
 *
 * GET /documentos trae lo recibido en el mes elegido MÁS lo que sigue en trámite
 * de meses anteriores. El mes se decide por la fecha de recepción, no por el
 * periodo contable (2026-11-25).
 */

/** Estados de un documento que sigue vivo (los mismos que dan ÁMBAR en el semáforo). */
const ESTADOS_EN_TRAMITE = ['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE']

/** Los cinco valores del ENUM `documentos.estado`. */
const ESTADOS = [...ESTADOS_EN_TRAMITE, 'COMPLETADO', 'CANCELADO']

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

/**
 * Dice si un documento sigue en trámite y ya pasó su fecha límite.
 *
 * @param {{estado: string, fechaLimite: string | null}} documento
 * @param {Date} hoy Fecha de referencia.
 * @returns {boolean}
 */
export const esVencido = (documento, hoy) =>
  enTramite(documento) &&
  documento.fechaLimite != null &&
  documento.fechaLimite.slice(0, 10) < diaLocal(hoy)

/**
 * Cuántos documentos hay en cada estado: es la cifra de cada tarjeta y coincide
 * con lo que muestra la tabla al elegir ese estado.
 *
 * @param {Array<{estado: string}>} documentos Lista de GET /documentos.
 * @returns {Record<string, number>} Una cuenta por cada estado del ENUM.
 */
export const contarPorEstado = (documentos) => {
  const cuentas = Object.fromEntries(ESTADOS.map((estado) => [estado, 0]))
  for (const d of documentos) if (d.estado in cuentas) cuentas[d.estado] += 1
  return cuentas
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
