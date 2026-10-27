const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/** Máximo de avisos que se devuelven en la lista (los más recientes). */
const LIMITE_LISTA = 30;

/**
 * Crea un aviso sin leer para una cuenta.
 * @param {{ usuarioId: number, casoId: number|null, mensaje: string }} datos
 * @param {Function} [ejecutar] - `query` o la función de una transacción (`conTransaccion`).
 */
async function crear({ usuarioId, casoId, mensaje }, ejecutar = query) {
  await ejecutar('INSERT INTO notificaciones (usuario_id, caso_id, mensaje, leida, creado_en) VALUES (?, ?, ?, 0, ?)', [
    usuarioId,
    casoId,
    mensaje,
    formatLocalDate(nowLocal()),
  ]);
}

/**
 * Avisos de una cuenta, del más reciente al más antiguo.
 * @param {number} usuarioId - cuenta destinataria.
 * @returns {Promise<Array<{ id: number, caso_id: number|null, mensaje: string, leida: number, creado_en: Date }>>}
 */
async function listarDeUsuario(usuarioId) {
  return query(
    `SELECT id, caso_id, mensaje, leida, creado_en FROM notificaciones
     WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC LIMIT ${LIMITE_LISTA}`,
    [usuarioId]
  );
}

/**
 * Cuántos avisos sin leer tiene una cuenta.
 * @param {number} usuarioId - cuenta destinataria.
 * @returns {Promise<number>}
 */
async function contarNoLeidas(usuarioId) {
  const [fila] = await query('SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0', [usuarioId]);
  return Number(fila.total);
}

/**
 * Marca como leídos todos los avisos de una cuenta.
 * @param {number} usuarioId - cuenta destinataria.
 */
async function marcarLeidas(usuarioId) {
  await query('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0', [usuarioId]);
}

module.exports = { crear, listarDeUsuario, contarNoLeidas, marcarLeidas };
