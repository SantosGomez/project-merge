const ClienteModel = require('../models/ClienteModel');
const ClienteContadorModel = require('../models/ClienteContadorModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId } = require('../utils/validationUtils');
const bitacora = require('../utils/bitacoraSeguridad');
// Las reglas de los datos del cliente son las del alta de Documentos (ESM; Node lo carga con require()).
const { validarDatosNuevoCliente } = require('../modulos/documentos/rutas/clientes.mjs');

/**
 * Controladores de /ajustes: consulta y administración del catálogo de clientes del despacho.
 */

// Nombre del dato (la parte «sobre X» del mensaje) según el campo que rechazó la validación.
const NOMBRE_DE_CAMPO = {
  nombre: 'nombre',
  clave: 'clave',
  rfc: 'rfc',
  email: 'correo',
  telefono: 'teléfono',
};
const CAMPOS_EDITABLES = ['nombre', 'clave', 'rfc', 'email', 'telefono'];

const ERROR_NO_ENCONTRADO = buildError(
  'No se encontró el cliente',
  'cliente solicitado',
  'Actualiza la lista y elige un cliente que exista'
);
const ERROR_ID_INVALIDO = buildError(
  'El identificador no es válido',
  'cliente solicitado',
  'Actualiza la lista y elige un cliente de ella'
);
const ERROR_CLAVE_OBLIGATORIA = buildError(
  'Falta la clave de carpeta del cliente',
  'clave',
  'Escribe una clave de 1 a 4 caracteres sin espacios'
);
const ERROR_ACTIVO = buildError('El valor no es válido', 'activo', 'Envía verdadero o falso');
const ERROR_SIN_CAMBIOS = buildError(
  'No se envió ningún dato para cambiar',
  'cliente solicitado',
  'Envía al menos el nombre, la clave, el RFC, el correo, el teléfono o si está activo'
);
const ERROR_LISTA_CONTADORES = buildError(
  'La lista de contadores no es válida',
  'contadores',
  'Envía una lista de ids de cuentas, sin repetir (puede ir vacía)'
);
const ERROR_CONTADOR_SIN_ROL = buildError(
  'Hay cuentas que no pueden ser contador de un cliente',
  'contadores',
  'Elige solo cuentas de contador o auxiliar, o con rol de Contador en Documentos (se asigna en «Acceso a módulos»)'
);
const ERROR_NOMBRE_REPETIDO = buildError(
  'Ya existe un cliente con ese nombre',
  'nombre',
  'Usa otro nombre o edita el cliente que ya existe con ese nombre'
);
const ERROR_CLAVE_REPETIDA = buildError(
  'Ya existe un cliente con esa clave',
  'clave',
  'Usa otra clave de carpeta o edita el cliente que ya la tiene'
);

/** Error 400 con la regla de datos que rechazó la validación del alta de Documentos. */
function errorDeDato(resultado) {
  return buildError(
    'No se guardó el cliente porque un dato no es válido',
    NOMBRE_DE_CAMPO[resultado.campo] || 'datos del cliente',
    resultado.error
  );
}

/**
 * Convierte la lista de contadores recibida en ids. Una lista con repetidos o con ids que no son
 * enteros positivos no es válida.
 * @param {*} valor - Valor recibido en el cuerpo.
 * @returns {number[]|null} Los ids, o null si la lista no es válida.
 */
function leerListaDeContadores(valor) {
  if (!Array.isArray(valor)) return null;
  const ids = valor.map(parseCounterId);
  if (ids.includes(null) || new Set(ids).size !== ids.length) return null;
  return ids;
}

/**
 * Responde el error del modelo cuando el nombre o la clave ya existen; cualquier otro se propaga.
 * @param {Error} error - Error lanzado por el modelo.
 * @param {Object} res - Respuesta Express.
 * @returns {Object} Respuesta 409.
 */
function responderErrorDeModelo(error, res) {
  if (error.codigo === 'NOMBRE_REPETIDO') return res.status(409).json(ERROR_NOMBRE_REPETIDO);
  if (error.codigo === 'CLAVE_REPETIDA') return res.status(409).json(ERROR_CLAVE_REPETIDA);
  throw error;
}

/**
 * GET /ajustes/clientes — Catálogo completo de clientes, con su contador y su estado.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarClientes(req, res) {
  const clientes = await ClienteModel.listarTodos();
  return res.status(200).json({ clientes });
}

/**
 * GET /ajustes/contadores — Cuentas que pueden llevar clientes, para elegirlas al dar de alta o asignar.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarContadores(req, res) {
  const contadores = await ClienteContadorModel.listarQuePuedenLlevarClientes();
  return res.status(200).json({ contadores });
}

/**
 * POST /ajustes/clientes — Da de alta un cliente del catálogo con sus contadores (opcional).
 * La clave de carpeta es obligatoria; el primer contador de la lista queda como principal.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function crearCliente(req, res) {
  const cuerpo = req.body || {};
  const validacion = validarDatosNuevoCliente({
    nombre: cuerpo.nombre,
    clave: cuerpo.clave,
    rfc: cuerpo.rfc,
    email: cuerpo.email,
    telefono: cuerpo.telefono,
  });
  if (validacion.error) return res.status(400).json(errorDeDato(validacion));
  const { razonSocial, clave, rfc, email, telefono } = validacion.datos;
  if (clave === null) return res.status(400).json(ERROR_CLAVE_OBLIGATORIA);

  const contadores = cuerpo.contadores === undefined ? [] : leerListaDeContadores(cuerpo.contadores);
  if (contadores === null) return res.status(400).json(ERROR_LISTA_CONTADORES);
  if ((await ClienteContadorModel.idsQueNoPuedenLlevarClientes(contadores)).length > 0) {
    return res.status(400).json(ERROR_CONTADOR_SIN_ROL);
  }

  try {
    const cliente = await ClienteModel.crearEnCatalogo({ clave, nombre: razonSocial, rfc, email, telefono }, contadores);
    bitacora.registrar('cliente_catalogo_creado', req, { clienteId: cliente.id, contadores: contadores.length });
    return res.status(201).json({ cliente });
  } catch (error) {
    return responderErrorDeModelo(error, res);
  }
}

/**
 * PATCH /ajustes/clientes/:id — Cambia nombre, clave, RFC, correo, teléfono o estado; solo se tocan los
 * campos enviados y nunca los contadores.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function actualizarCliente(req, res) {
  const id = parseCounterId(req.params.id);
  if (id === null) return res.status(400).json(ERROR_ID_INVALIDO);

  const cuerpo = req.body || {};
  const enviados = CAMPOS_EDITABLES.filter((campo) => cuerpo[campo] !== undefined);
  if (cuerpo.activo !== undefined && typeof cuerpo.activo !== 'boolean') return res.status(400).json(ERROR_ACTIVO);
  if (enviados.length === 0 && cuerpo.activo === undefined) return res.status(400).json(ERROR_SIN_CAMBIOS);

  const actual = await ClienteModel.buscarDelCatalogo(id);
  if (!actual) return res.status(404).json(ERROR_NO_ENCONTRADO);

  // Se validan solo los datos enviados: el nombre actual hace de relleno cuando no se envía.
  const validacion = validarDatosNuevoCliente({
    nombre: cuerpo.nombre !== undefined ? cuerpo.nombre : actual.nombre,
    clave: cuerpo.clave,
    rfc: cuerpo.rfc,
    email: cuerpo.email,
    telefono: cuerpo.telefono,
  });
  if (validacion.error) return res.status(400).json(errorDeDato(validacion));
  if (cuerpo.clave !== undefined && validacion.datos.clave === null) return res.status(400).json(ERROR_CLAVE_OBLIGATORIA);

  const cambios = {};
  for (const campo of enviados) {
    cambios[campo] = validacion.datos[campo === 'nombre' ? 'razonSocial' : campo];
  }
  if (cuerpo.activo !== undefined) cambios.activo = cuerpo.activo;

  try {
    const cliente = await ClienteModel.actualizarEnCatalogo(id, cambios);
    if (!cliente) return res.status(404).json(ERROR_NO_ENCONTRADO);
    bitacora.registrar('cliente_catalogo_editado', req, { clienteId: id, campos: Object.keys(cambios).join(',') });
    return res.status(200).json({ cliente });
  } catch (error) {
    return responderErrorDeModelo(error, res);
  }
}

/**
 * PUT /ajustes/clientes/:id/contadores — Reemplaza la lista completa de contadores del cliente (puede ir
 * vacía). El primero de la lista queda como principal.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function reemplazarContadoresDelCliente(req, res) {
  const id = parseCounterId(req.params.id);
  if (id === null) return res.status(400).json(ERROR_ID_INVALIDO);

  const contadores = leerListaDeContadores((req.body || {}).contadores);
  if (contadores === null) return res.status(400).json(ERROR_LISTA_CONTADORES);

  if (!(await ClienteModel.buscarDelCatalogo(id))) return res.status(404).json(ERROR_NO_ENCONTRADO);
  if ((await ClienteContadorModel.idsQueNoPuedenLlevarClientes(contadores)).length > 0) {
    return res.status(400).json(ERROR_CONTADOR_SIN_ROL);
  }

  await ClienteContadorModel.reemplazarContadores(id, contadores);
  bitacora.registrar('cliente_catalogo_contadores', req, { clienteId: id, cantidad: contadores.length });
  return res.status(200).json({ cliente: await ClienteModel.buscarDelCatalogo(id) });
}

module.exports = { listarClientes, listarContadores, crearCliente, actualizarCliente, reemplazarContadoresDelCliente };
