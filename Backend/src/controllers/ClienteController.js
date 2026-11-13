const ClienteModel = require('../models/ClienteModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId, validarCampoTexto } = require('../utils/validationUtils');

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

module.exports = { listarMisClientes, crearCliente, actualizarCliente };
