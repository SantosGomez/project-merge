const argon2 = require('argon2');

/**
 * Hashea una contraseña usando Argon2id (algoritmo por defecto de argon2).
 * @param {string} password - Contraseña en texto plano.
 * @returns {Promise<string>} Hash de la contraseña.
 */
async function hashPassword(password) {
  return await argon2.hash(password);
}

/**
 * Verifica una contraseña contra un hash Argon2id.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} hash - Hash almacenado.
 * @returns {Promise<boolean>} true si la contraseña coincide, false en caso contrario.
 */
async function verifyPassword(password, hash) {
  return await argon2.verify(hash, password);
}

module.exports = { hashPassword, verifyPassword };
