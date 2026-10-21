require('dotenv').config();

// Fuente única del secreto y de la duración del token de acceso (RF-01, RF-04, RF-05).
// Los valores por defecto son solo de desarrollo; cada entorno los define en .env
// con las variables JWT_SECRET y JWT_EXPIRES_IN.
const JWT_SECRET = process.env.JWT_SECRET || 'delgrow_secret_cambiar_en_produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
