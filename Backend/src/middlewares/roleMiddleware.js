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
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión con una cuenta de administrador')
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
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión para hacer esta acción')
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
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión para hacer esta acción')
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
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión con una cuenta de contador')
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

/**
 * Middleware para el trabajo con casos: permite a contadores y auxiliares.
 * El auxiliar trabaja casos como un contador (propios y los de su contador, ahí solo el estado),
 * pero no gestiona auxiliares ni entra a auditorías (esas rutas siguen con requireContador).
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireContadorOAuxiliar(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión con una cuenta de contador o auxiliar')
    );
    return;
  }

  if (!['contador', 'auxiliar'].includes(req.user.rol)) {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de contador o auxiliar para trabajar casos')
    );
    return;
  }

  next();
}

/**
 * Middleware del directorio de cuentas en solo consulta: permite a administrador, usuarios_de_sistema
 * y recepcionista. Las escrituras de /usuarios siguen con requireAdminOrSistema.
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireConsultaDirectorio(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión para consultar el directorio')
    );
    return;
  }

  if (!['administrador', 'usuarios_de_sistema', 'recepcionista'].includes(req.user.rol)) {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de administrador, usuario de sistema o recepcionista para consultar el directorio')
    );
    return;
  }

  next();
}

/**
 * Middleware del alta de clientes del catálogo (Ajustes): permite a administrador, usuarios_de_sistema
 * y recepcionista. Editar clientes y cambiar sus contadores sigue con requireAdminOrSistema.
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireAltaClientes(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión para dar de alta clientes')
    );
    return;
  }

  if (!['administrador', 'usuarios_de_sistema', 'recepcionista'].includes(req.user.rol)) {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de administrador, usuario de sistema o recepcionista para dar de alta clientes')
    );
    return;
  }

  next();
}

/**
 * Middleware de la cartera propia de clientes: permite a quien puede llevar clientes (rol contador o
 * auxiliar, o rol Contador en Documentos; ver `ClienteContadorModel.idsQueNoPuedenLlevarClientes`).
 * No exige el módulo «Mis actividades»: «Mi perfil» lo ve todo el que trabaja casos.
 * @param {Object} req - Objeto de petición (debe contener req.user con id).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireLlevaClientes(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión con una cuenta de contador o auxiliar')
    );
    return;
  }

  const { puedeLlevarClientes } = require('../models/ClienteContadorModel');
  let puede;
  try {
    puede = await puedeLlevarClientes(req.user.id);
  } catch (error) {
    next(error);
    return;
  }
  if (!puede) {
    res.status(403).json(
      buildError(
        'Tu cuenta no lleva clientes',
        'cartera de clientes',
        'Pide a un administrador que te dé rol de contador o auxiliar, o el rol Contador en Documentos'
      )
    );
    return;
  }

  next();
}

/**
 * Middleware del calendario de juntas: permite a administrador, contador, auxiliar y recepcionista.
 * usuarios_de_sistema no usa el calendario.
 * @param {Object} req - Objeto de petición (debe contener req.user con rol).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function requireCalendario(req, res, next) {
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión para usar el calendario')
    );
    return;
  }

  if (!['administrador', 'contador', 'auxiliar', 'recepcionista'].includes(req.user.rol)) {
    res.status(403).json(
      buildError('Rol insuficiente', 'usuario autenticado', 'Se requiere rol de administrador, contador, auxiliar o recepcionista para usar el calendario')
    );
    return;
  }

  next();
}

module.exports = {
  requireAdmin,
  requireAdminOrSistema,
  requireAdminOrContador,
  requireContador,
  requireContadorOAuxiliar,
  requireConsultaDirectorio,
  requireAltaClientes,
  requireLlevaClientes,
  requireCalendario,
};
