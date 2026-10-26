const crypto = require('node:crypto');
const argon2 = require('argon2');


/**
 * Hashea una contraseña usando Argon2id (algoritmo por defecto de argon2).
 * @param {string} password - Contraseña en texto plano.
 * @returns {Promise<string>} Hash de la contraseña.
 */
async function hashPassword(password) {
  return await argon2.hash(password);
}

// Hash Argon2id de una contraseña aleatoria que nadie conoce. Se calcula al cargar el módulo (una sola vez)
// para que la primera consulta de un correo inexistente no tarde más que las siguientes.
const hashFicticio = hashPassword(crypto.randomBytes(32).toString('hex'));

/**
 * Verifica una contraseña contra un hash Argon2id.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} hash - Hash almacenado.
 * @returns {Promise<boolean>} true si la contraseña coincide, false en caso contrario.
 */
async function verifyPassword(password, hash) {
  return await argon2.verify(hash, password);
}

/**
 * Hace el mismo trabajo de verificación que una cuenta real, contra un hash ficticio, y devuelve false.
 * Se usa cuando el correo no existe, para que el login tarde igual y no revele qué correos tienen cuenta.
 * @param {string} password - Contraseña recibida.
 * @returns {Promise<false>} siempre false.
 */
async function verificarContraHashFicticio(password) {
  await verifyPassword(password, await hashFicticio);
  return false;
}

module.exports = { hashPassword, verifyPassword, verificarContraHashFicticio };
