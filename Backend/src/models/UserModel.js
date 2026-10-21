const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Busca un usuario por su nombre de usuario (distingue mayúsculas/minúsculas).
 * RF-01, RF-03.
 * @param {string} usuario - Nombre de usuario.
 * @returns {Promise<Object|null>} El usuario encontrado o null.
 */
async function findByUsername(usuario) {
  const rows = await query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Crea un nuevo usuario y devuelve el ID insertado.
 * RF-27, RF-28.
 * @param {string} usuario - Nombre de usuario.
 * @param {string} passwordHash - Contraseña hasheada con Argon2id.
 * @param {string} rol - Rol del usuario (administrador, contador, usuarios_de_sistema).
 * @returns {Promise<number>} ID del usuario insertado.
 */
async function create(usuario, passwordHash, rol) {
  const ahora = formatLocalDate(nowLocal());
  const [result] = await query(
    'INSERT INTO usuarios (usuario, password_hash, rol, creado_en) VALUES (?, ?, ?, ?)',
    [usuario, passwordHash, rol, ahora]
  );
  return result.insertId;
}

/**
 * Busca un usuario por su ID.
 * @param {number} id - ID del usuario.
 * @returns {Promise<Object|null>} El usuario encontrado o null.
 */
async function findById(id) {
  const rows = await query('SELECT * FROM usuarios WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Devuelve todos los usuarios, o solo los de un rol si se especifica.
 * RF-12, RF-15.
 * @param {Object} [filtro] - Filtro opcional, ej. { rol: 'contador' }.
 * @returns {Promise<Array>} Lista de usuarios.
 */
async function findAll(filtro) {
  if (filtro && filtro.rol) {
    const rows = await query('SELECT * FROM usuarios WHERE rol = ?', [filtro.rol]);
    return rows;
  }
  const rows = await query('SELECT * FROM usuarios');
  return rows;
}

module.exports = { findByUsername, create, findById, findAll };