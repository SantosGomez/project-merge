const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Tipos de actividad propios de cada contador o auxiliar («Mi trabajo > Mis actividades»).
 * El nombre es único por usuario sin distinguir mayúsculas ni acentos (colación de la tabla).
 */

// `total_clientes` cuenta los clientes activos de la cartera del tipo (rebanada 11).
const COLUMNAS = `id, nombre, cobrable, activo, creado_en, regla_vencimiento, dia_del_mes,
  (SELECT COUNT(*) FROM cartera_actividad ca
     JOIN clientes c ON c.id = ca.cliente_id
     WHERE ca.tipo_id = tipos_actividad.id AND c.activo = 1) AS total_clientes`;

/**
 * Convierte una fila de la tabla en el tipo que entrega la API.
 * @param {Object} fila - Fila de `tipos_actividad`.
 * @returns {{ id: number, nombre: string, cobrable: boolean, activo: boolean, creado_en: string,
 *   regla_vencimiento: string, dia_del_mes: number|null, total_clientes: number }}
 */
function aTipo(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    cobrable: Boolean(fila.cobrable),
    activo: Boolean(fila.activo),
    creado_en: formatLocalDate(fila.creado_en),
    regla_vencimiento: fila.regla_vencimiento,
    dia_del_mes: fila.dia_del_mes,
    total_clientes: Number(fila.total_clientes),
  };
}

/**
 * Convierte el rechazo de la clave única en un error con código NOMBRE_REPETIDO.
 * @param {Error} error - Error de la base de datos.
 * @throws {Error} NOMBRE_REPETIDO si el nombre ya existe; si no, el error original.
 */
function traducirDuplicado(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    const repetido = new Error('ya existe un tipo de actividad con ese nombre');
    repetido.codigo = 'NOMBRE_REPETIDO';
    throw repetido;
  }
  throw error;
}

/**
 * Tipos de un usuario: primero los activos y luego los desactivados, cada grupo por nombre.
 * @param {number} usuarioId - Dueño de los tipos.
 * @returns {Promise<Array<Object>>}
 */
async function listarDeUsuario(usuarioId) {
  const filas = await query(
    `SELECT ${COLUMNAS} FROM tipos_actividad WHERE usuario_id = ? ORDER BY activo DESC, nombre ASC, id ASC`,
    [usuarioId]
  );
  return filas.map(aTipo);
}

/**
 * Busca un tipo que pertenezca al usuario; los de otros usuarios no existen para él.
 * @param {number} id - Id del tipo.
 * @param {number} usuarioId - Dueño esperado.
 * @returns {Promise<Object|null>}
 */
async function buscarDeUsuario(id, usuarioId) {
  const filas = await query(`SELECT ${COLUMNAS} FROM tipos_actividad WHERE id = ? AND usuario_id = ?`, [id, usuarioId]);
  return filas.length > 0 ? aTipo(filas[0]) : null;
}

/**
 * Crea un tipo activo para el usuario.
 * @param {number} usuarioId - Dueño.
 * @param {{ nombre: string, cobrable: boolean, regla_vencimiento: string, dia_del_mes: number|null }} datos - Datos ya validados.
 * @returns {Promise<Object>} El tipo creado.
 * @throws {Error} NOMBRE_REPETIDO si el usuario ya tiene un tipo con ese nombre.
 */
async function crear(usuarioId, { nombre, cobrable, regla_vencimiento: regla, dia_del_mes: dia }) {
  try {
    const resultado = await query(
      `INSERT INTO tipos_actividad (usuario_id, nombre, cobrable, activo, creado_en, regla_vencimiento, dia_del_mes)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [usuarioId, nombre, cobrable ? 1 : 0, formatLocalDate(nowLocal()), regla, dia]
    );
    return await buscarDeUsuario(resultado.insertId, usuarioId);
  } catch (error) {
    return traducirDuplicado(error);
  }
}

/**
 * Actualiza solo los campos recibidos de un tipo del usuario.
 * @param {number} id - Id del tipo.
 * @param {number} usuarioId - Dueño.
 * @param {{ nombre?: string, cobrable?: boolean, activo?: boolean, regla_vencimiento?: string, dia_del_mes?: number|null }} cambios
 *   Campos ya validados.
 * @returns {Promise<Object|null>} El tipo actualizado, o null si no es del usuario.
 * @throws {Error} NOMBRE_REPETIDO si el nuevo nombre lo tiene otro tipo del usuario.
 */
async function actualizar(id, usuarioId, cambios) {
  const campos = [];
  const valores = [];
  if (cambios.nombre !== undefined) {
    campos.push('nombre = ?');
    valores.push(cambios.nombre);
  }
  for (const campo of ['regla_vencimiento', 'dia_del_mes']) {
    if (cambios[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(cambios[campo]);
    }
  }
  for (const campo of ['cobrable', 'activo']) {
    if (cambios[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(cambios[campo] ? 1 : 0);
    }
  }

  try {
    await query(`UPDATE tipos_actividad SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`, [
      ...valores,
      id,
      usuarioId,
    ]);
  } catch (error) {
    return traducirDuplicado(error);
  }
  return buscarDeUsuario(id, usuarioId);
}

module.exports = { listarDeUsuario, buscarDeUsuario, crear, actualizar };
