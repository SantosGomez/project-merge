const RegistroTiempoModel = require('../models/RegistroTiempoModel');
const ActividadMesModel = require('../models/ActividadMesModel');
const ClienteModel = require('../models/ClienteModel');
const TipoActividadModel = require('../models/TipoActividadModel');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const { esMesValido, parseCounterId } = require('../utils/validationUtils');

/**
 * Controladores de /tiempo (rebanada 14): cronómetro y bloques de tiempo de cada renglón de la lista del mes.
 * Cada usuario solo ve y modifica lo suyo; lo ajeno responde 404.
 */

const MINUTOS_MAX = 1440;

const ERROR_MES = buildError('El mes no es válido', 'mes', 'Envía el mes con la forma AAAA-MM, por ejemplo 2026-11');
const ERROR_CLIENTE_INVALIDO = buildError(
  'El identificador del cliente no es válido',
  'cliente',
  'Elige uno de tus clientes de la lista'
);
const ERROR_TIPO_INVALIDO = buildError(
  'El identificador del tipo de actividad no es válido',
  'tipo de actividad',
  'Elige uno de tus tipos de la lista'
);
const ERROR_MINUTOS = buildError(
  `Los minutos no son válidos (de 1 a ${MINUTOS_MAX})`,
  'minutos',
  `Escribe un número entero de minutos entre 1 y ${MINUTOS_MAX}`
);
const ERROR_RENGLON_NO_ENCONTRADO = buildError(
  'No se encontró el cliente o el tipo de actividad',
  'renglón de la lista del mes',
  'Actualiza la lista y elige un renglón tuyo'
);
const ERROR_FUERA_DE_CARTERA = buildError(
  'Ese cliente ya no está en tu cartera de ese tipo o está desactivado',
  'renglón de la lista del mes',
  'Actualiza la lista; si lo necesitas, agrega el cliente de nuevo al tipo desde «Clientes y tipos»'
);
const ERROR_SIN_CRONOMETRO = buildError(
  'No tienes ningún cronómetro en marcha',
  'cronómetro',
  'Actualiza la pantalla: puede que ya lo hayas detenido en otro lugar'
);
const ERROR_BLOQUE_INVALIDO = buildError(
  'El identificador del bloque de tiempo no es válido',
  'bloque de tiempo',
  'Actualiza la lista de bloques y elige uno de los tuyos'
);
const ERROR_BLOQUE_NO_ENCONTRADO = buildError(
  'No se encontró el bloque de tiempo',
  'bloque de tiempo',
  'Actualiza la lista de bloques; puede que ya lo hayas borrado'
);

/**
 * Valida el renglón (`cliente_id`, `tipo_id`, `mes`) y comprueba que cliente y tipo sean del usuario.
 * @param {Object} origen - Cuerpo o consulta de la petición.
 * @param {number} usuarioId - Usuario autenticado.
 * @returns {Promise<{ error?: Object, estado?: number, renglon?: Object, tipo?: Object }>}
 */
async function resolverRenglon(origen, usuarioId) {
  const clienteId = parseCounterId(origen.cliente_id);
  if (clienteId === null) return { estado: 400, error: ERROR_CLIENTE_INVALIDO };
  const tipoId = parseCounterId(origen.tipo_id);
  if (tipoId === null) return { estado: 400, error: ERROR_TIPO_INVALIDO };
  if (!esMesValido(origen.mes)) return { estado: 400, error: ERROR_MES };
  const cliente = await ClienteModel.buscarDeUsuario(clienteId, usuarioId);
  const tipo = await TipoActividadModel.buscarDeUsuario(tipoId, usuarioId);
  if (!cliente || !tipo) return { estado: 404, error: ERROR_RENGLON_NO_ENCONTRADO };
  return { renglon: { cliente_id: clienteId, tipo_id: tipoId, mes: origen.mes }, tipo };
}

/**
 * GET /tiempo/activo — Cronómetro en marcha del usuario (o null) y la hora actual del servidor.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function obtenerActivo(req, res) {
  const activo = await RegistroTiempoModel.buscarActivo(Number(req.user.id));
  return res.status(200).json({ activo, ahora: formatLocalDate(nowLocal()) });
}

/**
 * POST /tiempo/iniciar — Inicia el cronómetro de un renglón y detiene el que estuviera en marcha.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function iniciarCronometro(req, res) {
  const usuarioId = Number(req.user.id);
  const { error, estado, renglon, tipo } = await resolverRenglon(req.body || {}, usuarioId);
  if (error) return res.status(estado).json(error);
  if (!(await ActividadMesModel.estaEnCarteraActiva(renglon.cliente_id, renglon.tipo_id))) {
    return res.status(400).json(ERROR_FUERA_DE_CARTERA);
  }
  const { activo, detenido } = await RegistroTiempoModel.iniciar(usuarioId, { ...renglon, cobrable: tipo.cobrable });
  return res.status(200).json({ activo, detenido, ahora: formatLocalDate(nowLocal()) });
}

/**
 * POST /tiempo/detener — Detiene el cronómetro en marcha y guarda su bloque.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function detenerCronometro(req, res) {
  const bloque = await RegistroTiempoModel.detener(Number(req.user.id));
  if (!bloque) return res.status(404).json(ERROR_SIN_CRONOMETRO);
  return res.status(200).json({ bloque });
}

/**
 * GET /tiempo?cliente_id=&tipo_id=&mes= — Bloques terminados de un renglón.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarBloques(req, res) {
  const usuarioId = Number(req.user.id);
  const { error, estado, renglon } = await resolverRenglon(req.query, usuarioId);
  if (error) return res.status(estado).json(error);
  const bloques = await RegistroTiempoModel.listarDeRenglon(usuarioId, renglon);
  return res.status(200).json({ bloques });
}

/**
 * POST /tiempo/manual — Agrega un bloque de tiempo escrito a mano (de 1 a 1440 minutos).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function agregarTiempoManual(req, res) {
  const usuarioId = Number(req.user.id);
  const cuerpo = req.body || {};
  const { error, estado, renglon, tipo } = await resolverRenglon(cuerpo, usuarioId);
  if (error) return res.status(estado).json(error);
  const { minutos } = cuerpo;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > MINUTOS_MAX) {
    return res.status(400).json(ERROR_MINUTOS);
  }
  if (!(await ActividadMesModel.estaEnCarteraActiva(renglon.cliente_id, renglon.tipo_id))) {
    return res.status(400).json(ERROR_FUERA_DE_CARTERA);
  }
  const bloque = await RegistroTiempoModel.crearManual(usuarioId, { ...renglon, minutos, cobrable: tipo.cobrable });
  return res.status(201).json({ bloque });
}

/**
 * DELETE /tiempo/:id — Borra un bloque propio.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function borrarBloque(req, res) {
  const id = parseCounterId(req.params.id);
  if (id === null) return res.status(400).json(ERROR_BLOQUE_INVALIDO);
  const borrado = await RegistroTiempoModel.borrar(id, Number(req.user.id));
  if (!borrado) return res.status(404).json(ERROR_BLOQUE_NO_ENCONTRADO);
  return res.status(200).json({ ok: true });
}

module.exports = {
  obtenerActivo,
  iniciarCronometro,
  detenerCronometro,
  listarBloques,
  agregarTiempoManual,
  borrarBloque,
};
