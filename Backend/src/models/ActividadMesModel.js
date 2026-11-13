const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Lista del mes (rebanada 11). Un renglón es un tipo de actividad por cliente. Solo se guarda una fila en
 * `actividades_mes` cuando el renglón se marca como hecho; lo pendiente se calcula con la cartera actual.
 */

/**
 * Renglones de un mes: la cartera actual (solo clientes y tipos activos) más lo ya hecho en ese mes,
 * aunque después el cliente haya salido de la cartera o se haya desactivado él o el tipo.
 * Ordenados por tipo y, dentro, por cliente. Cada renglón trae la regla de vencimiento del tipo y el RFC
 * del cliente para que el controlador calcule la fecha.
 * @param {number} usuarioId - Dueño de la lista.
 * @param {string} mes - Mes en formato AAAA-MM.
 * @returns {Promise<Array<Object>>}
 */
async function listarDelMes(usuarioId, mes) {
  const filas = await query(
    `SELECT c.id AS cliente_id, c.nombre AS cliente, c.activo AS cliente_activo, c.rfc AS rfc,
            t.id AS tipo_id, t.nombre AS tipo, t.activo AS tipo_activo,
            t.regla_vencimiento AS regla_vencimiento, t.dia_del_mes AS dia_del_mes,
            am.estado AS estado, am.hecha_en AS hecha_en
       FROM (
         SELECT ca.cliente_id, ca.tipo_id
           FROM cartera_actividad ca
           JOIN clientes cc ON cc.id = ca.cliente_id AND cc.activo = 1
           JOIN tipos_actividad tt ON tt.id = ca.tipo_id AND tt.activo = 1
          WHERE ca.usuario_id = ?
         UNION
         SELECT cliente_id, tipo_id FROM actividades_mes
          WHERE usuario_id = ? AND mes = ? AND estado = 'hecha'
       ) k
       JOIN clientes c ON c.id = k.cliente_id
       JOIN tipos_actividad t ON t.id = k.tipo_id
       LEFT JOIN actividades_mes am ON am.cliente_id = k.cliente_id AND am.tipo_id = k.tipo_id AND am.mes = ?
      ORDER BY t.nombre ASC, t.id ASC, c.nombre ASC, c.id ASC`,
    [usuarioId, usuarioId, mes, mes]
  );
  return filas.map((fila) => ({
    cliente_id: fila.cliente_id,
    cliente: fila.cliente,
    cliente_activo: Boolean(fila.cliente_activo),
    rfc: fila.rfc,
    tipo_id: fila.tipo_id,
    tipo: fila.tipo,
    tipo_activo: Boolean(fila.tipo_activo),
    regla_vencimiento: fila.regla_vencimiento,
    dia_del_mes: fila.dia_del_mes,
    hecha: fila.estado === 'hecha',
    hecha_en: fila.hecha_en ? formatLocalDate(fila.hecha_en) : null,
  }));
}

/**
 * Indica si el cliente está hoy en la cartera del tipo y ambos siguen activos.
 * @param {number} clienteId - Cliente del usuario.
 * @param {number} tipoId - Tipo del usuario.
 * @returns {Promise<boolean>}
 */
async function estaEnCarteraActiva(clienteId, tipoId) {
  const filas = await query(
    `SELECT 1 FROM cartera_actividad ca
       JOIN clientes c ON c.id = ca.cliente_id AND c.activo = 1
       JOIN tipos_actividad t ON t.id = ca.tipo_id AND t.activo = 1
      WHERE ca.cliente_id = ? AND ca.tipo_id = ?`,
    [clienteId, tipoId]
  );
  return filas.length > 0;
}

/**
 * Marca un renglón como hecho (idempotente: conserva la primera hora) o lo desmarca (borra su fila).
 * @param {number} usuarioId - Dueño.
 * @param {{ cliente_id: number, tipo_id: number, mes: string, hecha: boolean }} datos - Ya validados.
 * @returns {Promise<{ cliente_id: number, tipo_id: number, mes: string, hecha: boolean, hecha_en: string|null }>}
 */
async function guardarEstado(usuarioId, { cliente_id: clienteId, tipo_id: tipoId, mes, hecha }) {
  if (!hecha) {
    await query('DELETE FROM actividades_mes WHERE cliente_id = ? AND tipo_id = ? AND mes = ?', [clienteId, tipoId, mes]);
    return { cliente_id: clienteId, tipo_id: tipoId, mes, hecha: false, hecha_en: null };
  }
  await query(
    `INSERT INTO actividades_mes (usuario_id, cliente_id, tipo_id, mes, estado, hecha_en)
     VALUES (?, ?, ?, ?, 'hecha', ?)
     ON DUPLICATE KEY UPDATE estado = 'hecha'`,
    [usuarioId, clienteId, tipoId, mes, formatLocalDate(nowLocal())]
  );
  const filas = await query(
    'SELECT hecha_en FROM actividades_mes WHERE cliente_id = ? AND tipo_id = ? AND mes = ?',
    [clienteId, tipoId, mes]
  );
  return { cliente_id: clienteId, tipo_id: tipoId, mes, hecha: true, hecha_en: formatLocalDate(filas[0].hecha_en) };
}

module.exports = { listarDelMes, estaEnCarteraActiva, guardarEstado };
