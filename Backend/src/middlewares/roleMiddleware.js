const { buildError } = require('../utils/errorUtils');

/**
 * Middleware que permite el paso solo a usuarios con rol 'administrador'.
 * RF-08.
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicie sesión con una cuenta de administrador')
    );
    return;
  }

  if (req.user.rol !== 'administrador') {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de administrador para esta acción')
    );
    return;
  }

  next();
}

/**
 * Middleware que permite el paso a usuarios con rol 'administrador'
 * o 'usuarios_de_sistema'. RF-28, RF-29.
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireAdminOrSistema(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicie sesión para realizar esta acción')
    );
    return;
  }

  const rolesPermitidos = ['administrador', 'usuarios_de_sistema'];
  if (!rolesPermitidos.includes(req.user.rol)) {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de administrador o usuario de sistema para esta acción')
    );
    return;
  }

  next();
}

/**
 * Middleware que permite el paso a administradores y contadores (módulo de auditorías).
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireAdminOrContador(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicie sesión para realizar esta acción')
    );
    return;
  }

  if (!['administrador', 'contador'].includes(req.user.rol)) {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de administrador o contador para esta acción')
    );
    return;
  }

  next();
}

/**
 * Middleware que permite el paso solo a usuarios con rol 'contador'.
 * RF-09: el administrador es solo consulta y no puede registrar casos.
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireContador(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicie sesión con una cuenta de contador')
    );
    return;
  }

  if (req.user.rol !== 'contador') {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de contador para registrar casos')
    );
    return;
  }

  next();
}

module.exports = { requireAdmin, requireAdminOrSistema, requireAdminOrContador, requireContador };
