const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Busca un usuario por su nombre de usuario (distingue mayúsculas/minúsculas).
 * RF-01, RF-03, RF-36.
 * @param {string} usuario - Nombre de usuario.
 * @returns {Promise<Object|null>} El usuario encontrado o null.
 */
async function findByUsername(usuario) {
  const rows = await query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  // La colación de la tabla no distingue mayúsculas: la coincidencia exacta se exige aquí (RF-36)
  return rows.find((fila) => fila.usuario === usuario) || null;
}

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
 * Indica si ya existe un usuario con ese nombre sin distinguir mayúsculas (RF-45).
 * @param {string} usuario - Nombre de usuario.
 * @returns {Promise<boolean>} true si existe una cuenta con ese nombre.
 */
async function usuarioExisteIgnoreCase(usuario) {
  const rows = await query('SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER(?) LIMIT 1', [usuario]);
  return rows.length > 0;
}

/**
 * Correo de acceso de una cuenta mientras el alta todavía pide «usuario»: el mismo
 * texto en minúsculas si ya es un correo, o `usuario@prueba.local` si no lo es.
 * Es la misma regla que aplica la migración a las cuentas existentes.
 * @param {string} usuario - Nombre de usuario.
 * @returns {string} correo en minúsculas.
 */
function correoDeTransicion(usuario) {
  const minusculas = usuario.toLowerCase();
  return minusculas.includes('@') ? minusculas : `${minusculas}@prueba.local`;
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
  const result = await query(
    `INSERT INTO usuarios (usuario, nombre, correo, password_hash, rol, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [usuario, usuario, correoDeTransicion(usuario), passwordHash, rol, ahora, ahora]
  );
  return result.insertId;
}

/**
 * Crea una cuenta con nombre y correo propios (login por correo) y devuelve su ID.
 * Mientras exista la columna `usuario`, guarda en ella el mismo correo.
 * @param {{ nombre: string, correo: string, passwordHash: string, rol: string }} datos
 * @returns {Promise<number>} ID del usuario insertado.
 */
async function createConCorreo({ nombre, correo, passwordHash, rol }) {
  const ahora = formatLocalDate(nowLocal());
  const result = await query(
    `INSERT INTO usuarios (usuario, nombre, correo, password_hash, rol, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [correo, nombre, correo, passwordHash, rol, ahora, ahora]
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
 * Devuelve solo id y usuario de los usuarios con rol contador, ordenados por id.
 * Se usa para la lista de contadores administrador (RF-32).
 * @returns {Promise<Array>} Lista de { id, usuario } de los contadores.
 */
async function findCountersPublic() {
  const rows = await query('SELECT id, usuario FROM usuarios WHERE rol = ? ORDER BY id', ['contador']);
  return rows;
}

/**
 * Busca un contador por su ID: solo devuelve usuarios con rol 'contador'.
 * Trae únicamente id y usuario, nunca el hash de la contraseña.
 * RF-35, RF-16.
 * @param {number} id - ID del contador.
 * @returns {Promise<Object|null>} El contador encontrado o null si no existe o no es contador.
 */
async function findCounterById(id) {
  const rows = await query("SELECT id, usuario FROM usuarios WHERE id = ? AND rol = 'contador'", [id]);
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
  correoDeTransicion,
  createConCorreo,
  findByCorreo,
  registrarUltimoAcceso,
  findByUsername,
  usuarioExisteIgnoreCase,
  updatePassword,
  create,
  findById,
  findAll,
  findCountersPublic,
  findCounterById,
};