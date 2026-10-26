const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Busca una cuenta por su correo de acceso, sin distinguir mayúsculas ni espacios extremos.
 * @param {string} correo - Correo con el que se inicia sesión.
 * @returns {Promise<Object|null>} La cuenta encontrada o null.
 */
async function findByCorreo(correo) {
  const rows = await query('SELECT * FROM usuarios WHERE correo = ? LIMIT 1', [correo.trim().toLowerCase()]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Guarda la fecha del último inicio de sesión exitoso de la cuenta.
 * @param {number} id - ID del usuario.
 * @param {Date} momento - Momento del inicio de sesión.
 */
async function registrarUltimoAcceso(id, momento) {
  await query('UPDATE usuarios SET ultimo_acceso_en = ? WHERE id = ?', [formatLocalDate(momento), id]);
}

/**
 * Crea una cuenta con nombre y correo propios (login por correo) y devuelve su ID.
 * RF-27, RF-28.
 * @param {{ nombre: string, correo: string, passwordHash: string, rol: string }} datos
 * @returns {Promise<number>} ID del usuario insertado.
 */
async function create({ nombre, correo, passwordHash, rol }) {
  const ahora = formatLocalDate(nowLocal());
  const result = await query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nombre, correo, passwordHash, rol, ahora, ahora]
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

/**
 * Devuelve las cuentas con solo sus datos públicos (sin hash de contraseña), ordenadas por id.
 * Se usa para el directorio de usuarios.
 * @returns {Promise<Array>} Lista de { id, nombre, correo, rol, ultimo_acceso_en }.
 */
async function findAllPublic() {
  return await query('SELECT id, nombre, correo, rol, ultimo_acceso_en FROM usuarios ORDER BY id');
}

/**
 * Devuelve solo id y nombre de los usuarios con rol contador, ordenados por id.
 * Se usa para la lista de contadores administrador (RF-32).
 * @returns {Promise<Array>} Lista de { id, nombre } de los contadores.
 */
async function findCountersPublic() {
  const rows = await query('SELECT id, nombre FROM usuarios WHERE rol = ? ORDER BY id', ['contador']);
  return rows;
}

/**
 * Busca un contador por su ID: solo devuelve usuarios con rol 'contador'.
 * Trae únicamente id y nombre, nunca el hash de la contraseña.
 * RF-35, RF-16.
 * @param {number} id - ID del contador.
 * @returns {Promise<Object|null>} El contador encontrado o null si no existe o no es contador.
 */
async function findCounterById(id) {
  const rows = await query("SELECT id, nombre FROM usuarios WHERE id = ? AND rol = 'contador'", [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Guarda la contraseña nueva (ya hasheada) de un usuario (RF-42).
 * @param {number} id - ID del usuario.
 * @param {string} hash - Contraseña hasheada con Argon2id.
 */
async function updatePassword(id, hash) {
  await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, id]);
}

module.exports = {
  findByCorreo,
  registrarUltimoAcceso,
  updatePassword,
  create,
  findById,
  findAll,
  findAllPublic,
  findCountersPublic,
  findCounterById,
};