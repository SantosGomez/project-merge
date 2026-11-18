const NotificacionModel = require('../models/NotificacionModel');
const { formatLocalDate } = require('../utils/dateUtils');

/**
 * Avisos de la cuenta que inició sesión, del más reciente al más antiguo,
 * con cuántos siguen sin leer.
 * @param {Object} req - Petición Express (req.user puesto por authenticateToken).
 * @param {Object} res - Respuesta Express.
 */
async function listarMisNotificaciones(req, res) {
  const [filas, noLeidas] = await Promise.all([
    NotificacionModel.listarDeUsuario(req.user.id),
    NotificacionModel.contarNoLeidas(req.user.id),
  ]);

  // La fecha sale en hora local YYYY-MM-DD HH:mm:ss y `leida` como booleano (RNF-2)
  const notificaciones = filas.map((fila) => ({
    id: fila.id,
    caso_id: fila.caso_id,
    junta_id: fila.junta_id,
    junta_inicio: fila.junta_inicio ? formatLocalDate(fila.junta_inicio) : null,
    mensaje: fila.mensaje,
    leida: Boolean(fila.leida),
    creado_en: formatLocalDate(fila.creado_en),
  }));

  return res.status(200).json({ notificaciones, no_leidas: noLeidas });
}

/**
 * Marca como leídos todos los avisos de la cuenta que inició sesión.
 * @param {Object} req - Petición Express (req.user puesto por authenticateToken).
 * @param {Object} res - Respuesta Express.
 */
async function marcarMisNotificacionesLeidas(req, res) {
  await NotificacionModel.marcarLeidas(req.user.id);
  return res.status(200).json({ mensaje: 'Avisos marcados como leídos' });
}

module.exports = { listarMisNotificaciones, marcarMisNotificacionesLeidas };
