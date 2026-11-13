const ActividadMesModel = require('../models/ActividadMesModel');
const ClienteModel = require('../models/ClienteModel');
const TipoActividadModel = require('../models/TipoActividadModel');
const { nowLocal } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const { esMesValido, parseCounterId } = require('../utils/validationUtils');

/**
 * Controladores de la lista del mes: `GET /actividades` y `PUT /actividades/estado`.
 * Cada usuario solo ve y marca lo suyo.
 */

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
const ERROR_HECHA = buildError('El valor no es válido', 'hecha', 'Envía verdadero o falso');
const ERROR_NO_ENCONTRADO = buildError(
  'No se encontró el cliente o el tipo de actividad',
  'renglón de la lista del mes',
  'Actualiza la lista y elige un renglón tuyo'
);
const ERROR_FUERA_DE_CARTERA = buildError(
  'Ese cliente ya no está en tu cartera de ese tipo o está desactivado',
  'renglón de la lista del mes',
  'Actualiza la lista; si lo necesitas, agrega el cliente de nuevo al tipo desde «Clientes y tipos»'
);

/**
 * Mes actual del servidor con la forma AAAA-MM (hora local).
 * @returns {string}
 */
function mesActual() {
  const hoy = nowLocal();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * GET /actividades?mes=AAAA-MM — Renglones del mes; sin `mes` usa el mes actual.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarActividadesDelMes(req, res) {
  const mes = req.query.mes === undefined ? mesActual() : req.query.mes;
  if (!esMesValido(mes)) return res.status(400).json(ERROR_MES);
  const actividades = await ActividadMesModel.listarDelMes(Number(req.user.id), mes);
  return res.status(200).json({ mes, actividades });
}

/**
 * PUT /actividades/estado — Marca o desmarca como hecho un renglón (`{ cliente_id, tipo_id, mes, hecha }`).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function guardarEstadoDeActividad(req, res) {
  const cuerpo = req.body || {};
  const clienteId = parseCounterId(cuerpo.cliente_id);
  if (clienteId === null) return res.status(400).json(ERROR_CLIENTE_INVALIDO);
  const tipoId = parseCounterId(cuerpo.tipo_id);
  if (tipoId === null) return res.status(400).json(ERROR_TIPO_INVALIDO);
  if (!esMesValido(cuerpo.mes)) return res.status(400).json(ERROR_MES);
  if (typeof cuerpo.hecha !== 'boolean') return res.status(400).json(ERROR_HECHA);

  const usuarioId = Number(req.user.id);
  const cliente = await ClienteModel.buscarDeUsuario(clienteId, usuarioId);
  const tipo = await TipoActividadModel.buscarDeUsuario(tipoId, usuarioId);
  if (!cliente || !tipo) return res.status(404).json(ERROR_NO_ENCONTRADO);

  if (cuerpo.hecha && !(await ActividadMesModel.estaEnCarteraActiva(clienteId, tipoId))) {
    return res.status(400).json(ERROR_FUERA_DE_CARTERA);
  }

  const actividad = await ActividadMesModel.guardarEstado(usuarioId, {
    cliente_id: clienteId,
    tipo_id: tipoId,
    mes: cuerpo.mes,
    hecha: cuerpo.hecha,
  });
  return res.status(200).json({ actividad });
}

module.exports = { listarActividadesDelMes, guardarEstadoDeActividad };
