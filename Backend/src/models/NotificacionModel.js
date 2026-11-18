const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/** Máximo de avisos que se devuelven en la lista (los más recientes). */
const LIMITE_LISTA = 30;

/**
 * Crea un aviso sin leer para una cuenta.
 * @param {{ usuarioId: number, casoId: number|null, juntaId?: number|null, mensaje: string }} datos
 *   `juntaId` enlaza el aviso con una junta (y se borra con ella); sin él queda en NULL.
 * @param {Function} [ejecutar] - `query` o la función de una transacción (`conTransaccion`).
 */
async function crear({ usuarioId, casoId, juntaId = null, mensaje }, ejecutar = query) {
  await ejecutar(
    'INSERT INTO notificaciones (usuario_id, caso_id, junta_id, mensaje, leida, creado_en) VALUES (?, ?, ?, ?, 0, ?)',
    [usuarioId, casoId, juntaId, mensaje, formatLocalDate(nowLocal())]
  );
}

/**
 * Avisos de una cuenta, del más reciente al más antiguo.
 * @param {number} usuarioId - cuenta destinataria.
 * @returns {Promise<Array<{ id: number, caso_id: number|null, junta_id: number|null, junta_inicio: Date|null, mensaje: string, leida: number, creado_en: Date }>>}
 *   `junta_id` y `junta_inicio` salen solo si la cuenta organiza la junta o sigue invitada
 *   (quien fue quitado de la junta recibe null y su aviso queda sin enlace).
 */
async function listarDeUsuario(usuarioId) {
  return query(
    `SELECT n.id, n.caso_id, j.id AS junta_id, j.inicio AS junta_inicio, n.mensaje, n.leida, n.creado_en
       FROM notificaciones n
       LEFT JOIN juntas j ON j.id = n.junta_id
        AND (j.creado_por = n.usuario_id
             OR EXISTS (SELECT 1 FROM junta_participantes jp WHERE jp.junta_id = j.id AND jp.usuario_id = n.usuario_id))
      WHERE n.usuario_id = ? ORDER BY n.creado_en DESC, n.id DESC LIMIT ${LIMITE_LISTA}`,
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
