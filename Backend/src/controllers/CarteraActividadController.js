const TipoActividadModel = require('../models/TipoActividadModel');
const CarteraActividadModel = require('../models/CarteraActividadModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId, parseListaDeIds } = require('../utils/validationUtils');

/**
 * Controladores de la cartera por tipo: `GET/PUT /tipos-actividad/:id/clientes`.
 * Cada usuario solo ve y cambia la cartera de sus propios tipos y con sus propios clientes.
 */

const ERROR_TIPO_NO_ENCONTRADO = buildError(
  'No se encontró el tipo de actividad',
  'tipo de actividad solicitado',
  'Actualiza la lista y elige uno de tus tipos'
);
const ERROR_ID_INVALIDO = buildError(
  'El identificador no es válido',
  'tipo de actividad solicitado',
  'Actualiza la lista y elige uno de tus tipos'
);
const ERROR_LISTA_INVALIDA = buildError(
  'Las listas de clientes no son válidas',
  'clientes a agregar o quitar',
  'Envía agregar y quitar como listas de identificadores de tus clientes'
);
const ERROR_CLIENTE_EN_AMBAS = buildError(
  'Un cliente no puede agregarse y quitarse a la vez',
  'clientes a agregar o quitar',
  'Quita el cliente repetido de una de las dos listas'
);
const ERROR_CLIENTE_NO_ENCONTRADO = buildError(
  'No se encontró alguno de los clientes',
  'clientes a agregar o quitar',
  'Actualiza la lista y elige solo clientes tuyos'
);
const ERROR_CLIENTE_DESACTIVADO = buildError(
  'Alguno de los clientes a agregar está desactivado',
  'clientes a agregar',
  'Reactiva el cliente en «Mis clientes» o desmárcalo'
);
const ERROR_TIPO_DESACTIVADO = buildError(
  'El tipo de actividad está desactivado',
  'tipo de actividad solicitado',
  'Reactiva el tipo en «Mis tipos de actividad» antes de agregarle clientes'
);

/**
 * Busca el tipo del usuario a partir del id de la ruta.
 * @param {Object} req - Petición Express.
 * @returns {Promise<{ tipo?: Object, error?: { estado: number, cuerpo: Object } }>}
 */
async function tipoDeLaRuta(req) {
  const id = parseCounterId(req.params.id);
  if (id === null) return { error: { estado: 400, cuerpo: ERROR_ID_INVALIDO } };
  const tipo = await TipoActividadModel.buscarDeUsuario(id, Number(req.user.id));
  if (!tipo) return { error: { estado: 404, cuerpo: ERROR_TIPO_NO_ENCONTRADO } };
  return { tipo };
}

/**
 * GET /tipos-actividad/:id/clientes — Ids de los clientes que el usuario lleva en ese tipo.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarClientesDelTipo(req, res) {
  const { tipo, error } = await tipoDeLaRuta(req);
  if (error) return res.status(error.estado).json(error.cuerpo);
  const clienteIds = await CarteraActividadModel.listarClienteIds(tipo.id);
  return res.status(200).json({ cliente_ids: clienteIds });
}

/**
 * PUT /tipos-actividad/:id/clientes — Aplica `{ agregar, quitar }` a la cartera del tipo en una transacción.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function guardarClientesDelTipo(req, res) {
  const { tipo, error } = await tipoDeLaRuta(req);
  if (error) return res.status(error.estado).json(error.cuerpo);

  const cuerpo = req.body || {};
  const agregar = cuerpo.agregar === undefined ? [] : parseListaDeIds(cuerpo.agregar);
  const quitar = cuerpo.quitar === undefined ? [] : parseListaDeIds(cuerpo.quitar);
  if (agregar === null || quitar === null) return res.status(400).json(ERROR_LISTA_INVALIDA);
  if (agregar.some((id) => quitar.includes(id))) return res.status(400).json(ERROR_CLIENTE_EN_AMBAS);

  const usuarioId = Number(req.user.id);
  const propios = await CarteraActividadModel.clientesDeUsuario(usuarioId, [...agregar, ...quitar]);
  if (propios.length !== agregar.length + quitar.length) return res.status(404).json(ERROR_CLIENTE_NO_ENCONTRADO);
  if (agregar.length > 0) {
    if (!tipo.activo) return res.status(400).json(ERROR_TIPO_DESACTIVADO);
    if (propios.some((cliente) => agregar.includes(cliente.id) && !cliente.activo)) {
      return res.status(400).json(ERROR_CLIENTE_DESACTIVADO);
    }
  }

  const clienteIds = await CarteraActividadModel.aplicarCambios(usuarioId, tipo.id, agregar, quitar);
  return res.status(200).json({ cliente_ids: clienteIds });
}

module.exports = { listarClientesDelTipo, guardarClientesDelTipo };
