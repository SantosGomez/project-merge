import { aMedianoche } from "./fechas.mjs";

/**
 * Evalúa el estado de cumplimiento de los documentos requeridos de un cliente.
 *
 * @param {Array<object>} requeridos - Lista de requeridos para el periodo.
 *   Cada elemento puede tener: { entregado, documentoId, fechaLimite }
 * @param {Date | string} hoy - Fecha de referencia (normalmente hoy en el servidor).
 * @returns {{
 *   total: number,
 *   entregados: number,
 *   pendientes: number,
 *   vencidos: number,
 *   porcentaje: number,
 *   alDia: boolean
 * }}
 */
export function evaluarCumplimiento(requeridos = [], hoy = new Date()) {
  const lista = Array.isArray(requeridos) ? requeridos : [];
  const total = lista.length;

  if (total === 0) {
    return {
      total: 0,
      entregados: 0,
      pendientes: 0,
      vencidos: 0,
      porcentaje: 100,
      alDia: true,
    };
  }

  const hoyMedianoche = aMedianoche(hoy);
  let entregados = 0;
  let vencidos = 0;

  for (const item of lista) {
    const estaEntregado = Boolean(item.entregado) || item.documentoId != null;
    if (estaEntregado) {
      entregados++;
    } else if (item.fechaLimite) {
      const limiteMedianoche = aMedianoche(item.fechaLimite);
      // Vencido solo si la fecha límite es estrictamente anterior a hoy
      if (limiteMedianoche < hoyMedianoche) {
        vencidos++;
      }
    }
  }

  const pendientes = total - entregados;
  const porcentaje = Math.round((entregados / total) * 100);
  const alDia = pendientes === 0;

  return {
    total,
    entregados,
    pendientes,
    vencidos,
    porcentaje,
    alDia,
  };
}
