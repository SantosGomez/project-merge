const TipoActividadModel = require('../models/TipoActividadModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId, validarCampoTexto } = require('../utils/validationUtils');

/**
 * Controladores de /tipos-actividad: cada contador o auxiliar ve y modifica solo sus tipos.
 */

const LONGITUD_MAX_NOMBRE = 120;

const ERROR_NO_ENCONTRADO = buildError(
  'No se encontró el tipo de actividad',
  'tipo de actividad solicitado',
  'Actualiza la lista y elige uno de tus tipos'
);
const ERROR_ID_INVALIDO = buildError(
  'El identificador no es válido',
  'tipo de actividad solicitado',
  'Actualiza la lista y elige uno de tus tipos'
);
const ERROR_NOMBRE_REPETIDO = buildError(
  'Ya existe un tipo de actividad con ese nombre',
  'nombre del tipo de actividad',
  'Usa otro nombre o edita el tipo que ya tienes con ese nombre'
);
const ERROR_SIN_CAMBIOS = buildError(
  'No se envió ningún dato para cambiar',
  'tipo de actividad solicitado',
  'Envía al menos el nombre, si es cobrable o si está activo'
);
const ERROR_COBRABLE = buildError('El valor no es válido', 'cobrable', 'Envía verdadero o falso');
const ERROR_ACTIVO = buildError('El valor no es válido', 'activo', 'Envía verdadero o falso');

/**
 * Valida el nombre del tipo de actividad.
 * @param {*} valor - Valor recibido.
 * @returns {{ valor?: string, error?: Object }}
 */
function validarNombre(valor) {
  const nombre = validarCampoTexto(valor, 'nombre');
  if (nombre.estado !== 'valido') {
    return {
      error: buildError(
        'Falta el nombre del tipo de actividad o no es texto',
        'nombre',
        'Escribe el nombre del tipo de actividad'
      ),
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
 * GET /tipos-actividad — Tipos de actividad de la cuenta que inició sesión.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarMisTipos(req, res) {
  const tipos = await TipoActividadModel.listarDeUsuario(Number(req.user.id));
  return res.status(200).json({ tipos });
}

/**
 * POST /tipos-actividad — Agrega un tipo de actividad; `cobrable` es falso si no se envía.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function crearTipo(req, res) {
  const cuerpo = req.body || {};
  const nombre = validarNombre(cuerpo.nombre);
  if (nombre.error) return res.status(400).json(nombre.error);
  if (cuerpo.cobrable !== undefined && typeof cuerpo.cobrable !== 'boolean') {
    return res.status(400).json(ERROR_COBRABLE);
  }

  try {
    const tipo = await TipoActividadModel.crear(Number(req.user.id), {
      nombre: nombre.valor,
      cobrable: cuerpo.cobrable === true,
    });
    return res.status(201).json({ tipo });
  } catch (error) {
    return responderErrorDeModelo(error, res);
  }
}

/**
 * PATCH /tipos-actividad/:id — Cambia nombre, cobrable o activo; solo se tocan los campos enviados.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function actualizarTipo(req, res) {
  const id = parseCounterId(req.params.id);
  if (id === null) return res.status(400).json(ERROR_ID_INVALIDO);

  const cuerpo = req.body || {};
  const cambios = {};
  if (cuerpo.nombre !== undefined) {
    const nombre = validarNombre(cuerpo.nombre);
    if (nombre.error) return res.status(400).json(nombre.error);
    cambios.nombre = nombre.valor;
  }
  if (cuerpo.cobrable !== undefined) {
    if (typeof cuerpo.cobrable !== 'boolean') return res.status(400).json(ERROR_COBRABLE);
    cambios.cobrable = cuerpo.cobrable;
  }
  if (cuerpo.activo !== undefined) {
    if (typeof cuerpo.activo !== 'boolean') return res.status(400).json(ERROR_ACTIVO);
    cambios.activo = cuerpo.activo;
  }
  if (Object.keys(cambios).length === 0) return res.status(400).json(ERROR_SIN_CAMBIOS);

  try {
    const tipo = await TipoActividadModel.actualizar(id, Number(req.user.id), cambios);
    if (!tipo) return res.status(404).json(ERROR_NO_ENCONTRADO);
    return res.status(200).json({ tipo });
  } catch (error) {
    return responderErrorDeModelo(error, res);
  }
}

module.exports = { listarMisTipos, crearTipo, actualizarTipo };
