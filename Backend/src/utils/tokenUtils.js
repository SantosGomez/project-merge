const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

// Utilidades de tokens de acceso JWT (RF-01, RF-04, RF-05, RF-25, RF-26, RF-41).

/**
 * Genera un token de acceso JWT firmado con su propio campo exp (RF-01) y un
 * `jti` aleatorio, para que cada inicio de sesión tenga un token y una sesión
 * propios aunque sea el mismo usuario en el mismo instante (RF-41).
 * @param {object} payload - datos de la cuenta (id, rol).
 * @param {string} secreto - secreto con el que se firma el token.
 * @param {string|number} expiresIn - duración del token (ej. '1h', '30m').
 * @returns {string} token JWT firmado.
 */
function generateAccessToken(payload, secreto, expiresIn) {
  return jwt.sign({ ...payload, jti: crypto.randomBytes(16).toString('hex') }, secreto, { expiresIn });
}

/**
 * Verifica firma y expiración de un token de acceso (RF-04, RF-05).
 * @param {string} token - token JWT a verificar.
 * @param {string} secreto - secreto con el que se firmó.
 * @returns {{ valido: boolean, payload: object|null, error: string|null }}
 *   resultado de la verificación; error es 'expirado' cuando venció el campo exp,
 *   'token_invalido' cuando la firma o la forma no son válidas.
 */
function verifyAccessToken(token, secreto) {
  try {
    const decodificado = jwt.verify(token, secreto);
    // Se descartan iat y exp: el payload devuelto son los datos del usuario y su jti.
    const { iat, exp, ...payload } = decodificado;
    return { valido: true, payload, error: null };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { valido: false, payload: null, error: 'expirado' };
    }
    return { valido: false, payload: null, error: 'token_invalido' };
  }
}

/**
 * Indica si el token ya expiró respecto a `hoy` (RF-05).
 * No valida la firma: solo compara el campo exp con la fecha dada.
 * @param {string} token - token JWT.
 * @param {Date} hoy - instante de referencia, inyectado para tests deterministas.
 * @returns {boolean} true si expiró o si el token no se puede decodificar.
 */
function isTokenExpired(token, hoy) {
  const decodificado = jwt.decode(token);
  if (!decodificado || typeof decodificado.exp !== 'number') {
    return true;
  }
  return decodificado.exp * 1000 <= hoy.getTime();
}

module.exports = { generateAccessToken, verifyAccessToken, isTokenExpired };