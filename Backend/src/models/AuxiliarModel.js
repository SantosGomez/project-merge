const { query } = require('../config/db');
const UserModel = require('./UserModel');

/**
 * Valida que un id corresponda a una cuenta existente con rol contador.
 * Devuelve el objeto { id, nombre, rol } o null si no existe o no es contador.
 * @param {number} id - Id de usuario.
 * @returns {Promise<Object|null>}
 */
async function findUsuarioPorId(id) {
  const filas = await query('SELECT id, nombre, rol FROM usuarios WHERE id = ?', [id]);
  return filas.length > 0 ? filas[0] : null;
}

/**
 * Valida que el id corresponda a un contador existente.
 * Lanza Error con código CONTADOR_NO_EXISTE si no existe o no es contador.
 * @param {number} id - Id de usuario.
 * @param {string} tipo - 'contador' o 'auxiliar' para el mensaje.
 * @returns {Promise<Object>} El contador { id, nombre }.
 */
async function validarContadorExistente(id, tipo) {
  const usuario = await findUsuarioPorId(id);
  if (!usuario) {
    const error = new Error('contador no encontrado');
    error.codigo = `${tipo.toUpperCase()}_NO_EXISTE`;
    throw error;
  }
  if (usuario.rol !== 'contador') {
    const error = new Error(`${tipo} no es un contador válido`);
    error.codigo = `${tipo.toUpperCase()}_NO_ES_CONTADOR`;
    throw error;
  }
  return { id: usuario.id, nombre: usuario.nombre };
}

/**
 * Asigna un auxiliar a un contador.
 * Ambos deben ser contadores existentes, no pueden ser el mismo usuario,
 * y la relación no debe existir ya.
 * @param {number} contadorId - Id del contador que tiene auxiliares.
 * @param {number} auxiliarId - Id del contador auxiliar.
 * @returns {Promise<void>}
 */
async function asignarAuxiliar(contadorId, auxiliarId) {
  if (contadorId === auxiliarId) {
    const error = new Error('no se puede auto-asignar como auxiliar');
    error.codigo = 'AUTO_ASIGNACION';
    throw error;
  }

  await validarContadorExistente(contadorId, 'contador');
  await validarContadorExistente(auxiliarId, 'auxiliar');

  const existente = await query(
    'SELECT 1 FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?',
    [contadorId, auxiliarId]
  );
  if (existente.length > 0) {
    const error = new Error('el auxiliar ya está asignado a este contador');
    error.codigo = 'YA_ASIGNADO';
    throw error;
  }

  await query(
    'INSERT INTO contador_auxiliar (contador_id, auxiliar_id, asignado_en) VALUES (?, ?, NOW())',
    [contadorId, auxiliarId]
  );
}

/**
 * Quita un auxiliar de un contador.
 * @param {number} contadorId - Id del contador.
 * @param {number} auxiliarId - Id del auxiliar a quitar.
 * @returns {Promise<void>}
 */
async function quitarAuxiliar(contadorId, auxiliarId) {
  await query(
    'DELETE FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?',
    [contadorId, auxiliarId]
  );
}

/**
 * Devuelve los auxiliares de un contador.
 * @param {number} contadorId - Id del contador.
 * @returns {Promise<Array<{id: number, nombre: string}>>}
 */
async function listarAuxiliares(contadorId) {
  const filas = await query(
    'SELECT u.id, u.nombre FROM usuarios u ' +
    'JOIN contador_auxiliar ca ON ca.auxiliar_id = u.id ' +
    'WHERE ca.contador_id = ? ORDER BY u.nombre',
    [contadorId]
  );
  return filas;
}

/**
 * Devuelve los contadores que tienen a un usuario como auxiliar.
 * @param {number} auxiliarId - Id del contador auxiliar.
 * @returns {Promise<Array<{id: number, nombre: string}>>}
 */
async function listarContadoresQueMeTienenComoAuxiliar(auxiliarId) {
  const filas = await query(
    'SELECT u.id, u.nombre FROM usuarios u ' +
    'JOIN contador_auxiliar ca ON ca.contador_id = u.id ' +
    'WHERE ca.auxiliar_id = ? ORDER BY u.nombre',
    [auxiliarId]
  );
  return filas;
}

module.exports = {
  asignarAuxiliar,
  quitarAuxiliar,
  listarAuxiliares,
  listarContadoresQueMeTienenComoAuxiliar,
};
