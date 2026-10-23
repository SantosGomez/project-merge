/**
 * Envuelve un controlador `async` de Express para que cualquier rechazo llegue
 * al manejador global de errores con `next(err)`, en vez de dejar la petición
 * sin respuesta o detener el proceso (RNF-8, RF-47).
 * @param {Function} fn - Controlador `(req, res, next)` que puede devolver una promesa.
 * @returns {Function} Middleware de Express equivalente que propaga los rechazos.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
