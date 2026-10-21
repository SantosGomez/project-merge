// Funciones puras de orígenes permitidos (RF-34, criterios 24 y 28).
// No dependen de Express ni del entorno: el valor de la variable de entorno
// se recibe como argumento, de modo que son deterministas y fáciles de probar.

// Orígenes locales de desarrollo del frontend web (plan 8.4).
const ORIGENES_POR_DEFECTO = ['http://localhost:9000', 'http://127.0.0.1:9000'];

/**
 * Convierte el texto de la variable de entorno en la lista de orígenes permitidos.
 * Recorta espacios, quita la barra final y descarta los elementos vacíos.
 * @param {string|undefined} valorEnv - texto separado por comas (por ejemplo CORS_ORIGENES).
 * @returns {string[]} orígenes permitidos; si el valor falta o está vacío,
 * los orígenes locales de desarrollo del frontend web.
 */
function parseAllowedOrigins(valorEnv) {
  if (typeof valorEnv !== 'string' || valorEnv.trim() === '') {
    return [...ORIGENES_POR_DEFECTO];
  }

  const origenes = valorEnv
    .split(',')
    .map((origen) => origen.trim().replace(/\/+$/, ''))
    .filter((origen) => origen !== '');

  return origenes.length > 0 ? origenes : [...ORIGENES_POR_DEFECTO];
}

/**
 * Indica si un origen está en la lista de permitidos.
 * La comparación es exacta y distingue mayúsculas (RF-34).
 * Un origen ausente, nulo o vacío nunca está permitido.
 * @param {string|null|undefined} origen - valor de la cabecera Origin.
 * @param {string[]} permitidos - orígenes permitidos.
 * @returns {boolean} true si el origen está permitido.
 */
function isOriginAllowed(origen, permitidos) {
  if (typeof origen !== 'string' || origen === '') {
    return false;
  }

  if (!Array.isArray(permitidos)) {
    return false;
  }

  return permitidos.includes(origen);
}

module.exports = { ORIGENES_POR_DEFECTO, parseAllowedOrigins, isOriginAllowed };
