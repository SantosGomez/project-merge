const { buildError } = require('../utils/errorUtils');
const { usuarioTieneActividades } = require('../config/modulos');

/**
 * Middleware que deja pasar solo a las cuentas con el módulo «Mis actividades» habilitado.
 * Va después de `authenticateToken` y del middleware de rol.
 * @param {Object} req - Petición Express con req.user (id, rol).
 * @param {Object} res - Respuesta Express.
 * @param {Function} next - Siguiente middleware.
 */
async function requireModuloActividades(req, res, next) {
  if (req.user && usuarioTieneActividades(req.user.id)) {
    next();
    return;
  }
  res.status(403).json(
    buildError(
      'Módulo no habilitado',
      'Mis actividades',
      'Este módulo está en pruebas y aún no está disponible para tu cuenta'
    )
  );
}

module.exports = { requireModuloActividades };
