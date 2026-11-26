const ClienteModel = require('../models/ClienteModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId, validarCampoTexto } = require('../utils/validationUtils');
const bitacora = require('../utils/bitacoraSeguridad');

/**
 * Controladores de /clientes: cada contador o auxiliar ve y modifica solo sus clientes.
 */

const LONGITUD_MAX_NOMBRE = 150;
// RFC de persona moral (12) o física (13): 3-4 letras, fecha AAMMDD y homoclave de 3 caracteres.
const FORMA_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

const ERROR_NO_ENCONTRADO = buildError(
  'No se encontró el cliente',
  'cliente solicitado',
  'Actualiza la lista y elige uno de tus clientes'
);
const ERROR_ID_INVALIDO = buildError(
  'El identificador no es válido',
  'cliente solicitado',
  'Actualiza la lista y elige uno de tus clientes'
);
const ERROR_NOMBRE_REPETIDO = buildError(
  'Ya existe un cliente con ese nombre',
  'nombre del cliente',
  'Usa otro nombre o edita el cliente que ya tienes con ese nombre'
);
const ERROR_SIN_CAMBIOS = buildError(
  'No se envió ningún dato para cambiar',
  'cliente solicitado',
  'Envía al menos el nombre, el RFC o si está activo'
);
const ERROR_ACTIVO = buildError('El valor no es válido', 'activo', 'Envía verdadero o falso');

/**
 * Valida el nombre del cliente.
 * @param {*} valor - Valor recibido.
 * @returns {{ valor?: string, error?: Object }}
 */
function validarNombre(valor) {
  const nombre = validarCampoTexto(valor, 'nombre');
  if (nombre.estado !== 'valido') {
    return {
      error: buildError('Falta el nombre del cliente o no es texto', 'nombre', 'Escribe el nombre del cliente'),
    };
  }
  if (nombre.valor.length > LONGITUD_MAX_NOMBRE) {
    return {
      error: buildError(
        `El nombre supera los ${LONGITUD_MAX_NOMBRE} caracteres`,
        'nombre',
        'Escribe un nombre más corto'
      ),
    };
  }
  return { valor: nombre.valor };
}

/**
 * Valida el RFC opcional: vacío o null se guarda como null; si viene, se pasa a mayúsculas.
 * @param {*} valor - Valor recibido.
 * @returns {{ valor?: string|null, error?: Object }}
 */
function validarRfc(valor) {
  const error = {
    error: buildError(
      'El RFC no tiene la forma de un RFC',
      'rfc',
      'Escribe 12 caracteres (empresa) o 13 (persona física), por ejemplo ABC010101XY1, o déjalo vacío'
    ),
  };
  if (valor === null || valor === undefined) return { valor: null };
  if (typeof valor !== 'string') return error;
  const rfc = valor.trim().toUpperCase();
  if (rfc === '') return { valor: null };
  return FORMA_RFC.test(rfc) ? { valor: rfc } : error;
}

/**
 * Responde el error del modelo cuando el nombre ya existe; cualquier otro se propaga.
 * @param {Error} error - Error lanzado por el modelo.
 * @param {Object} res - Respuesta Express.
 * @returns {Object} Respuesta 409.
 */
function responderErrorDeModelo(error, res) {
  if (error.codigo === 'NOMBRE_REPETIDO') {
    return res.status(409).json(ERROR_NOMBRE_REPETIDO);
  }
  throw error;
}

/**
 * GET /clientes — Clientes de la cuenta que inició sesión.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarMisClientes(req, res) {
  const clientes = await ClienteModel.listarDeUsuario(Number(req.user.id));
  return res.status(200).json({ clientes });
}

/**
 * POST /clientes — Agrega un cliente a la cartera de la cuenta.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function crearCliente(req, res) {
  const cuerpo = req.body || {};
  const nombre = validarNombre(cuerpo.nombre);
  if (nombre.error) return res.status(400).json(nombre.error);
  const rfc = validarRfc(cuerpo.rfc);
  if (rfc.error) return res.status(400).json(rfc.error);

  try {
    const cliente = await ClienteModel.crear(Number(req.user.id), { nombre: nombre.valor, rfc: rfc.valor });
    return res.status(201).json({ cliente });
  } catch (error) {
    return responderErrorDeModelo(error, res);
  }
}

/**
 * PATCH /clientes/:id — Cambia nombre, RFC o si está activo; solo se tocan los campos enviados.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function actualizarCliente(req, res) {
  const id = parseCounterId(req.params.id);
  if (id === null) return res.status(400).json(ERROR_ID_INVALIDO);

  const cuerpo = req.body || {};
  const cambios = {};
  if (cuerpo.nombre !== undefined) {
    const nombre = validarNombre(cuerpo.nombre);
    if (nombre.error) return res.status(400).json(nombre.error);
    cambios.nombre = nombre.valor;
  }
  if (cuerpo.rfc !== undefined) {
    const rfc = validarRfc(cuerpo.rfc);
    if (rfc.error) return res.status(400).json(rfc.error);
    cambios.rfc = rfc.valor;
  }
  if (cuerpo.activo !== undefined) {
    if (typeof cuerpo.activo !== 'boolean') return res.status(400).json(ERROR_ACTIVO);
    cambios.activo = cuerpo.activo;
  }
  if (Object.keys(cambios).length === 0) return res.status(400).json(ERROR_SIN_CAMBIOS);

  try {
    const cliente = await ClienteModel.actualizar(id, Number(req.user.id), cambios);
    if (!cliente) return res.status(404).json(ERROR_NO_ENCONTRADO);
    return res.status(200).json({ cliente });
  } catch (error) {
    return responderErrorDeModelo(error, res);
  }
}

const MAX_CLIENTES_POR_VINCULO = 50;
const LIMITE_POR_OMISION = 25;
const LONGITUD_MAX_BUSQUEDA = 150;

const ERROR_LIMITE = buildError('El límite no es válido', 'límite', `Envía un número entero de 1 a ${MAX_CLIENTES_POR_VINCULO}`);
const ERROR_BUSQUEDA = buildError(
  'El texto buscado es demasiado largo',
  'búsqueda',
  `Escribe como máximo ${LONGITUD_MAX_BUSQUEDA} caracteres`
);
const ERROR_LISTA_CLIENTES = buildError(
  'La lista de clientes no es válida',
  'clienteIds',
  `Envía de 1 a ${MAX_CLIENTES_POR_VINCULO} ids de clientes, números enteros y sin repetir`
);
const ERROR_CLIENTES_NO_VALIDOS = buildError(
  'No se vinculó ningún cliente porque alguno no existe o está inactivo',
  'clienteIds',
  'Actualiza la búsqueda y elige solo clientes activos del catálogo'
);
const ERROR_NO_EN_CARTERA = buildError(
  'Ese cliente no está en tu cartera',
  'cliente solicitado',
  'Actualiza tu cartera y elige uno de tus clientes'
);

/**
 * Lee la lista de ids a vincular: de 1 a 50 enteros positivos, sin repetir.
 * @param {*} valor - `clienteIds` del cuerpo.
 * @returns {number[]|null} Los ids, o null si la lista no es válida.
 */
function leerClienteIds(valor) {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > MAX_CLIENTES_POR_VINCULO) return null;
  const ids = valor.map((id) => (typeof id === 'number' || typeof id === 'string' ? parseCounterId(id) : null));
  if (ids.includes(null) || new Set(ids).size !== ids.length) return null;
  return ids;
}

/**
 * GET /clientes/mi-cartera — Clientes vinculados a la cuenta (activos e inactivos), por nombre.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function miCartera(req, res) {
  const clientes = await ClienteModel.listarCartera(Number(req.user.id));
  return res.status(200).json({ clientes });
}

/**
 * GET /clientes/catalogo?q=&limite= — Busca clientes activos del catálogo para vincularlos.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function buscarCatalogo(req, res) {
  const texto = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (texto.length > LONGITUD_MAX_BUSQUEDA) return res.status(400).json(ERROR_BUSQUEDA);

  let limite = LIMITE_POR_OMISION;
  if (req.query.limite !== undefined) {
    const pedido = typeof req.query.limite === 'string' ? parseCounterId(req.query.limite) : null;
    if (pedido === null) return res.status(400).json(ERROR_LIMITE);
    limite = Math.min(pedido, MAX_CLIENTES_POR_VINCULO);
  }

  const clientes = await ClienteModel.buscarParaCartera(Number(req.user.id), texto, limite);
  return res.status(200).json({ clientes });
}

/**
 * POST /clientes/vinculos — Vincula a la cuenta como contador de clientes activos del catálogo.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function vincularClientes(req, res) {
  const clienteIds = leerClienteIds((req.body || {}).clienteIds);
  if (clienteIds === null) return res.status(400).json(ERROR_LISTA_CLIENTES);

  try {
    const resultado = await ClienteModel.vincularACartera(Number(req.user.id), clienteIds);
    bitacora.registrar('cliente_vinculado', req, { ...resultado, clienteIds: clienteIds.join(',') });
    return res.status(200).json(resultado);
  } catch (error) {
    if (error.codigo === 'CLIENTES_NO_VALIDOS') return res.status(400).json(ERROR_CLIENTES_NO_VALIDOS);
    throw error;
  }
}

/**
 * DELETE /clientes/vinculos/:clienteId — Quita solo el vínculo de la cuenta con el cliente.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function desvincularCliente(req, res) {
  const clienteId = parseCounterId(req.params.clienteId);
  if (clienteId === null) return res.status(400).json(ERROR_ID_INVALIDO);

  const quitado = await ClienteModel.desvincularDeCartera(Number(req.user.id), clienteId);
  if (!quitado) return res.status(404).json(ERROR_NO_EN_CARTERA);
  bitacora.registrar('cliente_desvinculado', req, { clienteId });
  return res.status(200).json({ desvinculado: true });
}

module.exports = {
  listarMisClientes,
  crearCliente,
  actualizarCliente,
  miCartera,
  buscarCatalogo,
  vincularClientes,
  desvincularCliente,
};
