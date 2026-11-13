const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Clientes propios de cada contador o auxiliar («Mi trabajo > Mis actividades»).
 * El nombre es único por usuario sin distinguir mayúsculas ni acentos (colación de la tabla).
 */

const COLUMNAS = 'id, nombre, rfc, activo, creado_en';

/**
 * Convierte una fila de la tabla en el cliente que entrega la API.
 * @param {Object} fila - Fila de `clientes`.
 * @returns {{ id: number, nombre: string, rfc: string|null, activo: boolean, creado_en: string }}
 */
function aCliente(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rfc: fila.rfc,
    activo: Boolean(fila.activo),
    creado_en: formatLocalDate(fila.creado_en),
  };
}

/**
 * Convierte el rechazo de la clave única en un error con código NOMBRE_REPETIDO.
 * @param {Error} error - Error de la base de datos.
 * @throws {Error} NOMBRE_REPETIDO si el nombre ya existe; si no, el error original.
 */
function traducirDuplicado(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    const repetido = new Error('ya existe un cliente con ese nombre');
    repetido.codigo = 'NOMBRE_REPETIDO';
    throw repetido;
  }
  throw error;
}

/**
 * Clientes de un usuario: primero los activos y luego los desactivados, cada grupo por nombre.
 * @param {number} usuarioId - Dueño de los clientes.
 * @returns {Promise<Array<Object>>}
 */
async function listarDeUsuario(usuarioId) {
  const filas = await query(
    `SELECT ${COLUMNAS} FROM clientes WHERE usuario_id = ? ORDER BY activo DESC, nombre ASC, id ASC`,
    [usuarioId]
  );
  return filas.map(aCliente);
}

/**
 * Busca un cliente que pertenezca al usuario; los de otros usuarios no existen para él.
 * @param {number} id - Id del cliente.
 * @param {number} usuarioId - Dueño esperado.
 * @returns {Promise<Object|null>}
 */
async function buscarDeUsuario(id, usuarioId) {
  const filas = await query(`SELECT ${COLUMNAS} FROM clientes WHERE id = ? AND usuario_id = ?`, [id, usuarioId]);
  return filas.length > 0 ? aCliente(filas[0]) : null;
}

/**
 * Crea un cliente activo para el usuario.
 * @param {number} usuarioId - Dueño.
 * @param {{ nombre: string, rfc: string|null }} datos - Datos ya validados.
 * @returns {Promise<Object>} El cliente creado.
 * @throws {Error} NOMBRE_REPETIDO si el usuario ya tiene un cliente con ese nombre.
 */
async function crear(usuarioId, { nombre, rfc }) {
  try {
    const resultado = await query(
      'INSERT INTO clientes (usuario_id, nombre, rfc, activo, creado_en) VALUES (?, ?, ?, 1, ?)',
      [usuarioId, nombre, rfc, formatLocalDate(nowLocal())]
    );
    return await buscarDeUsuario(resultado.insertId, usuarioId);
  } catch (error) {
    return traducirDuplicado(error);
  }
}

/**
 * Actualiza solo los campos recibidos de un cliente del usuario.
 * @param {number} id - Id del cliente.
 * @param {number} usuarioId - Dueño.
 * @param {{ nombre?: string, rfc?: string|null, activo?: boolean }} cambios - Campos ya validados.
 * @returns {Promise<Object|null>} El cliente actualizado, o null si no es del usuario.
 * @throws {Error} NOMBRE_REPETIDO si el nuevo nombre lo tiene otro cliente del usuario.
 */
async function actualizar(id, usuarioId, cambios) {
  const campos = [];
  const valores = [];
  for (const campo of ['nombre', 'rfc']) {
    if (cambios[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(cambios[campo]);
    }
  }
  if (cambios.activo !== undefined) {
    campos.push('activo = ?');
    valores.push(cambios.activo ? 1 : 0);
  }

  try {
    await query(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`, [...valores, id, usuarioId]);
  } catch (error) {
    return traducirDuplicado(error);
  }
  return buscarDeUsuario(id, usuarioId);
}

module.exports = { listarDeUsuario, buscarDeUsuario, crear, actualizar };
