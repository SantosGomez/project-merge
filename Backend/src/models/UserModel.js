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
 * @param {{ nombre: string, correo: string, passwordHash: string, rol: string, debeCambiarContrasena?: boolean }} datos
 *   debeCambiarContrasena: la persona crea su propia contraseña tras el primer inicio de sesión.
 * @returns {Promise<number>} ID del usuario insertado.
 */
async function create({ nombre, correo, passwordHash, rol, debeCambiarContrasena = false }) {
  const ahora = formatLocalDate(nowLocal());
  const result = await query(
    `INSERT INTO usuarios (nombre, correo, password_hash, rol, creado_en, actualizado_en, debe_cambiar_contrasena)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nombre, correo, passwordHash, rol, ahora, ahora, debeCambiarContrasena ? 1 : 0]
  );
  // Toda cuenta nueva entra al módulo de seguimiento (unión con documentos, fase 2)
  await query("INSERT IGNORE INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'seguimiento', NULL)", [
    result.insertId,
  ]);
  return result.insertId;
}

/**
 * Busca la cuenta con la que se inicia sesión: por correo si lleva @, si no por el alias
 * que se usaba en documentos. Sin distinguir mayúsculas ni espacios al inicio y al final.
 * @param {string} identificador - Correo o alias.
 * @returns {Promise<Object|null>} La cuenta o null.
 */
async function findByCorreoOAlias(identificador) {
  const valor = identificador.trim().toLowerCase();
  if (valor.includes('@')) {
    return findByCorreo(valor);
  }
  const rows = await query('SELECT * FROM usuarios WHERE LOWER(alias) = ? LIMIT 1', [valor]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Reemplaza solo el hash (p. ej. al pasar una contraseña de documentos a Argon2id al entrar).
 * No toca la marca de cambio pendiente ni la fecha de actualización: la contraseña es la misma.
 * @param {number} id - Id de la cuenta.
 * @param {string} hash - Hash nuevo.
 */
async function reemplazarHash(id, hash) {
  await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, id]);
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
 * @param {boolean} debeCambiarContrasena - true si la asignó el administrador (la persona
 *   debe crear la suya); false si la creó la propia persona.
 */
async function updatePassword(id, hash, debeCambiarContrasena) {
  await query(
    'UPDATE usuarios SET password_hash = ?, debe_cambiar_contrasena = ?, actualizado_en = ? WHERE id = ?',
    [hash, debeCambiarContrasena ? 1 : 0, formatLocalDate(nowLocal()), id]
  );
}

/**
 * Busca una cuenta que trabaja casos (contador o auxiliar) por su ID.
 * @param {number} id - ID del usuario.
 * @returns {Promise<{id: number, nombre: string, rol: string}|null>} La cuenta, o null si no existe o tiene otro rol.
 */
async function findContadorOAuxiliarById(id) {
  const rows = await query(
    "SELECT id, nombre, rol FROM usuarios WHERE id = ? AND rol IN ('contador', 'auxiliar')",
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Guarda el nombre, el correo y el rol de una cuenta existente (edición desde el directorio).
 * Nunca toca la contraseña.
 * @param {number} id - ID del usuario.
 * @param {{ nombre: string, correo: string, rol: string }} datos - Datos ya validados.
 */
async function update(id, { nombre, correo, rol }) {
  await query('UPDATE usuarios SET nombre = ?, correo = ?, rol = ?, actualizado_en = ? WHERE id = ?', [
    nombre,
    correo,
    rol,
    formatLocalDate(nowLocal()),
    id,
  ]);
}

/**
 * Cuenta los casos de una cuenta y los auxiliares que la apoyan, para decidir si puede cambiar de rol.
 * @param {number} id - ID del usuario.
 * @returns {Promise<{ casos: number, auxiliares: number }>}
 */
async function contarCasosYAuxiliares(id) {
  const filas = await query(
    `SELECT (SELECT COUNT(*) FROM casos WHERE contador_id = ?) AS casos,
            (SELECT COUNT(*) FROM contador_auxiliar WHERE contador_id = ?) AS auxiliares`,
    [id, id]
  );
  return { casos: Number(filas[0].casos), auxiliares: Number(filas[0].auxiliares) };
}

module.exports = {
  update,
  contarCasosYAuxiliares,
  findByCorreo,
  findByCorreoOAlias,
  reemplazarHash,
  registrarUltimoAcceso,
  updatePassword,
  create,
  findById,
  findAll,
  findAllPublic,
  findCountersPublic,
  findCounterById,
  findContadorOAuxiliarById,
};