const AuxiliarModel = require('../models/AuxiliarModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId } = require('../utils/validationUtils');

/**
 * Controladores de las rutas de auxiliares: un contador gestiona a otros contadores
 * que le apoyan con sus casos. Solo el contador dueño puede ver o cambiar sus auxiliares.
 */

const ERROR_ACCESO = buildError(
  'Acceso denegado',
  'auxiliares de otro contador',
  'Gestiona solo tus propios auxiliares'
);

const ERROR_CONTADOR_NO_ENCONTRADO = buildError(
  'No se encontró el contador',
  'contador solicitado',
  'Revisa que el contador exista y actualiza la lista'
);

const ERROR_AUXILIAR_NO_VALIDO = buildError(
  'No se encontró el contador auxiliar',
  'auxiliar solicitado',
  'Revisa que el contador exista y actualiza la lista'
);

// Traducción de los errores del modelo a respuestas HTTP claras.
const RESPUESTAS_POR_CODIGO = {
  AUTO_ASIGNACION: [
    400,
    buildError('No puedes asignarte a ti mismo', 'auxiliar', 'Elige a otro contador como auxiliar'),
  ],
  CONTADOR_NO_EXISTE: [404, ERROR_CONTADOR_NO_ENCONTRADO],
  AUXILIAR_NO_EXISTE: [404, ERROR_AUXILIAR_NO_VALIDO],
  CONTADOR_NO_ES_CONTADOR: [
    400,
    buildError('La cuenta no es un contador', 'contador solicitado', 'Usa una cuenta con rol de contador'),
  ],
  AUXILIAR_NO_ES_CONTADOR: [
    400,
    buildError('La cuenta no es un contador', 'auxiliar solicitado', 'Elige a otro contador como auxiliar'),
  ],
  YA_ASIGNADO: [
    409,
    buildError('El auxiliar ya está asignado', 'auxiliar', 'Elige a otro contador o quita la asignación actual'),
  ],
};

/**
 * Valida que el id de la ruta sea el del contador autenticado.
 * Responde el error y devuelve null cuando no lo es.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @returns {number|null} Id del contador dueño, o null si ya se respondió el error.
 */
function idDelContadorPropietario(req, res) {
  const contadorId = parseCounterId(req.params.id);
  if (!contadorId) {
    res.status(404).json(ERROR_CONTADOR_NO_ENCONTRADO);
    return null;
  }
  if (Number(req.user.id) !== contadorId) {
    res.status(403).json(ERROR_ACCESO);
    return null;
  }
  return contadorId;
}

/**
 * Responde con el estado y el mensaje que corresponden al error del modelo.
 * @param {Object} res - Respuesta Express.
 * @param {Error} error - Error lanzado por AuxiliarModel.
 * @returns {Object} Respuesta Express.
 */
function responderErrorDelModelo(res, error) {
  const respuesta = RESPUESTAS_POR_CODIGO[error.codigo];
  if (respuesta) {
    return res.status(respuesta[0]).json(respuesta[1]);
  }
  throw error;
}

/**
 * GET /contadores/:id/auxiliares — auxiliares del contador autenticado.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarAuxiliares(req, res) {
  const contadorId = idDelContadorPropietario(req, res);
  if (contadorId === null) return;

  const auxiliares = await AuxiliarModel.listarAuxiliares(contadorId);
  return res.status(200).json({ auxiliares });
}

/**
 * POST /contadores/:id/auxiliares/:auxiliarId — asigna un contador como auxiliar.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function asignarAuxiliar(req, res) {
  const contadorId = idDelContadorPropietario(req, res);
  if (contadorId === null) return;

  const auxiliarId = parseCounterId(req.params.auxiliarId);
  if (!auxiliarId) {
    return res.status(404).json(ERROR_AUXILIAR_NO_VALIDO);
  }

  try {
    await AuxiliarModel.asignarAuxiliar(contadorId, auxiliarId);
  } catch (error) {
    return responderErrorDelModelo(res, error);
  }

  const auxiliares = await AuxiliarModel.listarAuxiliares(contadorId);
  return res.status(201).json({
    mensaje: 'Auxiliar asignado correctamente',
    auxiliares,
  });
}

/**
 * DELETE /contadores/:id/auxiliares/:auxiliarId — quita un auxiliar del contador.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function quitarAuxiliar(req, res) {
  const contadorId = idDelContadorPropietario(req, res);
  if (contadorId === null) return;

  const auxiliarId = parseCounterId(req.params.auxiliarId);
  if (!auxiliarId) {
    return res.status(404).json(ERROR_AUXILIAR_NO_VALIDO);
  }

  await AuxiliarModel.quitarAuxiliar(contadorId, auxiliarId);

  const auxiliares = await AuxiliarModel.listarAuxiliares(contadorId);
  return res.status(200).json({
    mensaje: 'Auxiliar quitado correctamente',
    auxiliares,
  });
}

/**
 * GET /contadores/:id/contadores-que-me-tienen-como-auxiliar — contadores para los que
 * el contador autenticado trabaja como auxiliar.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarContadoresQueMeTienenComoAuxiliar(req, res) {
  const contadorId = idDelContadorPropietario(req, res);
  if (contadorId === null) return;

  const contadores = await AuxiliarModel.listarContadoresQueMeTienenComoAuxiliar(contadorId);
  return res.status(200).json({ contadores });
}

/**
 * GET /contadores/:id/auxiliares-disponibles — contadores que puede asignar como auxiliares.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarDisponiblesParaAuxiliar(req, res) {
  const contadorId = idDelContadorPropietario(req, res);
  if (contadorId === null) return;

  const contadores = await AuxiliarModel.listarDisponiblesParaAuxiliar(contadorId);
  return res.status(200).json({ contadores });
}

module.exports = {
  listarAuxiliares,
  asignarAuxiliar,
  quitarAuxiliar,
  listarContadoresQueMeTienenComoAuxiliar,
  listarDisponiblesParaAuxiliar,
};
