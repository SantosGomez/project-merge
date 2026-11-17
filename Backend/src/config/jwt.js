require('dotenv').config();
const crypto = require('node:crypto');

const LONGITUD_MIN_SECRETO = 32;

/**
 * Devuelve el secreto con el que se firman los tokens (RF-01, RF-04, RF-05).
 * No hay secreto fijo por defecto: uno conocido permitiría falsificar tokens.
 * - Con JWT_SECRET definido, se usa ese (mínimo 32 caracteres; si es más corto, el servidor no arranca).
 * - En producción sin JWT_SECRET, el servidor no arranca.
 * - En desarrollo sin JWT_SECRET, se genera uno aleatorio (las sesiones se pierden al reiniciar).
 * @param {Object} env - Variables de entorno (process.env).
 * @returns {string} Secreto JWT.
 */
function obtenerSecretoJwt(env) {
  if (env.JWT_SECRET) {
    if (env.JWT_SECRET.length < LONGITUD_MIN_SECRETO) {
      throw new Error(`JWT_SECRET debe tener al menos ${LONGITUD_MIN_SECRETO} caracteres: genere uno largo y aleatorio`);
    }
    return env.JWT_SECRET;
  }
  if (env.NODE_ENV === 'production') {
    throw new Error('Falta la variable de entorno JWT_SECRET: defínala en .env antes de iniciar el servidor');
  }
  return crypto.randomBytes(32).toString('hex');
}

// Fuente única del secreto y de la duración del token de acceso.
const JWT_SECRET = obtenerSecretoJwt(process.env);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
// Sesión persistente: tope absoluto aunque se use a diario (la inactividad la cierra antes).
const JWT_EXPIRES_IN_PERSISTENTE = process.env.JWT_EXPIRES_IN_PERSISTENTE || '30d';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN, JWT_EXPIRES_IN_PERSISTENTE, obtenerSecretoJwt };
