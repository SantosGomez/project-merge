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
 * Verifica una contraseña contra el hash guardado. Acepta Argon2id y, para las cuentas que llegaron
 * de Proyecto-documentos, su formato `scrypt$N$sal$hash` (hex). Un hash roto o desconocido da false,
 * nunca una excepción.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} hash - Hash almacenado.
 * @returns {Promise<boolean>} true si la contraseña coincide, false en caso contrario.
 */
async function verifyPassword(password, hash) {
  if (typeof hash === 'string' && hash.startsWith('scrypt$')) {
    return verificarScrypt(password, hash);
  }
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}

// Tope del coste de scrypt que se acepta de un hash guardado (documentos usa 16384).
const SCRYPT_N_MAXIMO = 1 << 17;

/**
 * Verifica el formato de contraseñas de Proyecto-documentos: `scrypt$N$sal$hash`, sal y hash en hex,
 * derivada del largo del hash guardado. Comparación en tiempo constante.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} guardado - Valor guardado.
 * @returns {Promise<boolean>} true si coincide.
 */
async function verificarScrypt(password, guardado) {
  const partes = guardado.split('$');
  if (partes.length !== 4) return false;
  const [, n, salHex, hashHex] = partes;
  const N = Number(n);
  const esHex = (texto) => /^(?:[0-9a-f]{2})+$/i.test(texto);
  if (!/^\d+$/.test(n) || N < 2 || N > SCRYPT_N_MAXIMO || (N & (N - 1)) !== 0) return false;
  if (!esHex(salHex) || !esHex(hashHex)) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  try {
    const derivada = await new Promise((resolve, reject) => {
      crypto.scrypt(password, Buffer.from(salHex, 'hex'), esperado.length, { N, maxmem: 256 * N * 8 }, (err, clave) =>
        err ? reject(err) : resolve(clave)
      );
    });
    return crypto.timingSafeEqual(derivada, esperado);
  } catch (err) {
    return false;
  }
}

/**
 * Indica si un hash válido debe volver a guardarse en Argon2id (p. ej. los scrypt de documentos).
 * @param {string} hash - Hash almacenado.
 * @returns {boolean} true si no es Argon2id.
 */
function necesitaRehash(hash) {
  return typeof hash !== 'string' || !hash.startsWith('$argon2id$');
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

module.exports = { hashPassword, verifyPassword, verificarContraHashFicticio, necesitaRehash };
