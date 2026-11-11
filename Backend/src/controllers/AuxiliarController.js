const AuxiliarModel = require('../models/AuxiliarModel');
const NotificacionModel = require('../models/NotificacionModel');
const UserModel = require('../models/UserModel');
const { buildError } = require('../utils/errorUtils');
const { eventos } = require('../utils/eventos');
const { parseCounterId, parseListaDeIds } = require('../utils/validationUtils');

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
  AUXILIAR_NO_ES_AUXILIAR: [
    400,
    buildError('La cuenta no es un auxiliar', 'auxiliar solicitado', 'Elige una cuenta con rol de auxiliar'),
  ],
  CAMBIO_CONTRADICTORIO: [
    400,
    buildError(
      'Un contador no puede agregarse y quitarse a la vez',
      'contadores',
      'Deja cada contador en una sola lista: la de agregar o la de quitar'
    ),
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

  const contador = await UserModel.findById(contadorId);
  const quitadoDeVerdad = await AuxiliarModel.quitarAuxiliar(contadorId, auxiliarId);

  if (quitadoDeVerdad) {
    await avisarAuxiliarDeBaja(auxiliarId, contador.nombre);
  }

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

const ERROR_LISTA_CONTADORES = buildError(
  'Lista de contadores no válida',
  'contadores',
  'Envía una lista con los ids de los contadores, por ejemplo [3, 7]'
);

const ERROR_CAMBIOS_CONTADORES = buildError(
  'Cambios de contadores no válidos',
  'contadores',
  'Envía los contadores que agregas y los que quitas, por ejemplo { "agregar": [3], "quitar": [7] }'
);

/**
 * Avisa a cada contador recién vinculado y al auxiliar (campana y tiempo real).
 * @param {number} auxiliarId - Id de la cuenta auxiliar.
 * @param {Array<number>} nuevos - Ids de los contadores recién vinculados.
 */
async function avisarNuevosVinculos(auxiliarId, nuevos) {
  if (nuevos.length === 0) return;
  const auxiliar = await UserModel.findById(auxiliarId);
  const contadores = await AuxiliarModel.listarContadoresQueMeTienenComoAuxiliar(auxiliarId);
  for (const contador of contadores.filter((c) => nuevos.includes(c.id))) {
    await NotificacionModel.crear({ usuarioId: contador.id, casoId: null, mensaje: `${auxiliar.nombre} ahora es tu auxiliar.` });
    await NotificacionModel.crear({ usuarioId: auxiliarId, casoId: null, mensaje: `Ahora apoyas a ${contador.nombre} con sus casos.` });
    eventos.enviarAUsuario(contador.id, 'aviso-nuevo', {});
  }
  eventos.enviarAUsuario(auxiliarId, 'aviso-nuevo', {});
}

/**
 * Avisa al auxiliar y a cada contador cuyo vínculo se quitó de verdad
 * (vía despacho: ambos reciben el aviso y el evento aviso-nuevo, caso_id nulo).
 * @param {number} auxiliarId - Id de la cuenta auxiliar.
 * @param {Array<number>} quitados - Ids de contadores cuyo vínculo se quitó.
 */
async function avisarVinculosQuitados(auxiliarId, quitados) {
  if (quitados.length === 0) return;
  const auxiliar = await UserModel.findById(auxiliarId);
  for (const contadorId of quitados) {
    const contador = await UserModel.findById(contadorId);
    if (!contador) continue;
    await NotificacionModel.crear({ usuarioId: auxiliarId, casoId: null, mensaje: `Ya no apoyas a ${contador.nombre} con sus casos.` });
    await NotificacionModel.crear({ usuarioId: contador.id, casoId: null, mensaje: `${auxiliar.nombre} ya no es tu auxiliar.` });
    eventos.enviarAUsuario(auxiliarId, 'aviso-nuevo', {});
    eventos.enviarAUsuario(contador.id, 'aviso-nuevo', {});
  }
}

/**
 * Avisa solo al auxiliar de que dejó de apoyar a un contador
 * (vía contador: el contador no recibe aviso, caso_id nulo).
 * @param {number} auxiliarId - Id de la cuenta auxiliar.
 * @param {string} nombreContador - Nombre del contador al que dejó de apoyar.
 */
async function avisarAuxiliarDeBaja(auxiliarId, nombreContador) {
  await NotificacionModel.crear({ usuarioId: auxiliarId, casoId: null, mensaje: `Ya no apoyas a ${nombreContador} con sus casos.` });
  eventos.enviarAUsuario(auxiliarId, 'aviso-nuevo', {});
}

/**
 * GET /usuarios/:id/contadores — contadores que apoya un auxiliar (administrador o sistema).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarContadoresDeAuxiliar(req, res) {
  const auxiliarId = parseCounterId(req.params.id);
  if (!auxiliarId) return res.status(404).json(ERROR_AUXILIAR_NO_VALIDO);

  const contadores = await AuxiliarModel.listarContadoresQueMeTienenComoAuxiliar(auxiliarId);
  return res.status(200).json({ contadores });
}

/**
 * PUT /usuarios/:id/contadores — aplica solo los cambios del despacho al equipo de un auxiliar
 * (administrador o sistema). Cuerpo: { agregar: [ids], quitar: [ids] }; los demás vínculos no se tocan.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function ajustarContadoresDeAuxiliar(req, res) {
  const auxiliarId = parseCounterId(req.params.id);
  if (!auxiliarId) return res.status(404).json(ERROR_AUXILIAR_NO_VALIDO);

  const agregar = parseListaDeIds(req.body.agregar);
  const quitar = parseListaDeIds(req.body.quitar);
  if (!agregar || !quitar) return res.status(400).json(ERROR_CAMBIOS_CONTADORES);

  let cambios;
  try {
    cambios = await AuxiliarModel.ajustarContadoresDeAuxiliar(auxiliarId, { agregar, quitar });
  } catch (error) {
    return responderErrorDelModelo(res, error);
  }
  await avisarNuevosVinculos(auxiliarId, cambios.agregados);
  await avisarVinculosQuitados(auxiliarId, cambios.quitados);

  const contadores = await AuxiliarModel.listarContadoresQueMeTienenComoAuxiliar(auxiliarId);
  return res.status(200).json({ mensaje: 'Contadores del auxiliar actualizados', contadores });
}

module.exports = {
  listarContadoresDeAuxiliar,
  ajustarContadoresDeAuxiliar,
  avisarNuevosVinculos,
  ERROR_LISTA_CONTADORES,
  listarAuxiliares,
  asignarAuxiliar,
  quitarAuxiliar,
  listarContadoresQueMeTienenComoAuxiliar,
  listarDisponiblesParaAuxiliar,
};
