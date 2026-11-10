const CaseModel = require('../models/CaseModel');
const AuxiliarModel = require('../models/AuxiliarModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId } = require('../utils/validationUtils');

/**
 * Middleware que verifica que el caso exista y que el contador autenticado
 * pueda editarlo. Deja `req.soloEstado`: false si el caso es suyo o de uno de sus
 * auxiliares (edición completa); true si es auxiliar del dueño (solo el estado).
 * RF-10, RF-11, RF-16, RF-AX-10 a RF-AX-12.
 * @param {Object} req - Objeto de petición (req.user con id, req.params.id con ID del caso).
 * @param {Object} res - Objeto de respuesta.
 * @param {Function} next - Función siguiente del middleware.
 */
async function checkCaseOwnership(req, res, next) {
  // Si no hay usuario autenticado, rechazar
  if (!req.user) {
    res.status(403).json(
      buildError('Acceso denegado', 'usuario autenticado', 'Inicia sesión para consultar casos')
    );
    return;
  }

  // Solo ids de dígitos: MariaDB convertiría '12abc' en 12 y abriría otro caso (RF-35)
  const casoId = parseCounterId(req.params && req.params.id);
  const caso = casoId ? await CaseModel.findById(casoId) : null;

  // Caso inexistente o id inválido
  if (!caso) {
    res.status(404).json(
      buildError('No se encontró el caso', 'ID del caso', 'Revisa que el caso exista y actualiza la lista')
    );
    return;
  }

  const usuarioId = Number(req.user.id);
  const duenioId = Number(caso.contador_id);

  // El caso es del contador autenticado o de uno de sus auxiliares: edición completa
  const misAuxiliares = await AuxiliarModel.listarAuxiliares(usuarioId);
  if (duenioId === usuarioId || misAuxiliares.some((a) => Number(a.id) === duenioId)) {
    req.caso = caso;
    req.soloEstado = false;
    next();
    return;
  }

  // El contador autenticado es auxiliar del dueño del caso: solo cambia el estado
  const auxiliaresDelDuenio = await AuxiliarModel.listarAuxiliares(duenioId);
  if (auxiliaresDelDuenio.some((a) => Number(a.id) === usuarioId)) {
    req.caso = caso;
    req.soloEstado = true;
    next();
    return;
  }

  // El caso pertenece a otro contador y el autenticado no es su auxiliar
  res.status(403).json(
    buildError('Acceso denegado', 'caso', 'No tienes permiso para abrir este caso')
  );
  return;
}

module.exports = { checkCaseOwnership };
