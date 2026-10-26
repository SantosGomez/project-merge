const CaseModel = require('../models/CaseModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId } = require('../utils/validationUtils');

/**
 * Middleware que verifica que el caso exista y pertenezca al contador autenticado.
 * RF-10, RF-11, RF-16.
 * @param {Object} req - Objeto de petición (req.user con id, req.params.id con ID del caso).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function checkCaseOwnership(req, res, next) {
  // Si no hay usuario autenticado, rechazar
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicie sesión para consultar casos')
    );
    return;
  }

  // Solo ids de dígitos: MariaDB convertiría '12abc' en 12 y abriría otro caso (RF-35)
  const casoId = parseCounterId(req.params && req.params.id);
  const caso = casoId ? await CaseModel.findById(casoId) : null;

  // Caso inexistente o id inválido
  if (!caso) {
    res.status(404).json(
      buildError('No se encontró el caso', 'ID del caso', 'Verifique que el ID del caso sea correcto')
    );
    return;
  }

  // El caso pertenece a otro contador
  if (caso.contador_id !== req.user.id) {
    res.status(403).json(
      buildError('Acceso denegado', 'caso', 'No tiene permiso para acceder a este caso')
    );
    return;
  }

  // El controlador usa este caso sin volver a consultarlo
  req.caso = caso;
  next();
}

module.exports = { checkCaseOwnership };
