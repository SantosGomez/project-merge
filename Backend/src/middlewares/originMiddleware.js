const { buildError } = require('../utils/errorUtils');
const { isOriginAllowed } = require('../utils/originUtils');
const bitacora = require('../utils/bitacoraSeguridad');

/**
 * Middleware que rechaza las peticiones de orígenes no permitidos (RF-34, criterios 24 y 28).
 * Una petición sin cabecera Origin (herramientas de prueba, scripts, pruebas automáticas)
 * continúa: la restricción de origen protege al navegador y no sustituye al token (RF-04).
 * @param {string[]} permitidos - orígenes permitidos.
 * @returns {Function} middleware de Express (req, res, next).
 */
function createOriginGuard(permitidos) {
  return function originGuard(req, res, next) {
    const origen = req.headers ? req.headers.origin : undefined;

    // RF-34: sin origen declarado se acepta; el control de acceso sigue siendo el token.
    if (!origen) {
      next();
      return;
    }

    if (isOriginAllowed(origen, permitidos)) {
      next();
      return;
    }

    bitacora.registrar('origen_rechazado', req, { origen: origen, metodo: req.method }, 'warn');
    // Sin cabeceras CORS: el navegador no deja leer la respuesta (RF-23, RNF-5, RNF-6).
    res.status(403).json(
      buildError(
        'Origen no permitido',
        'origen de la petición',
        'Usa la aplicación web autorizada para entrar al servicio'
      )
    );
  };
}

/**
 * Construye las opciones del paquete `cors` para los orígenes permitidos (RF-34).
 * Sin origen no se añaden cabeceras CORS; con un origen permitido se refleja ese origen.
 * @param {string[]} permitidos - orígenes permitidos.
 * @returns {{ origin: Function }} opciones para `cors`.
 */
function buildCorsOptions(permitidos) {
  return {
    origin: (origen, callback) => {
      callback(null, !origen || isOriginAllowed(origen, permitidos));
    },
  };
}

module.exports = { createOriginGuard, buildCorsOptions };
