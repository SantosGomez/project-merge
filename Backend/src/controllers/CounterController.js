const UserModel = require('../models/UserModel');
const CaseModel = require('../models/CaseModel');
const { buildError } = require('../utils/errorUtils');

/**
 * Lista todos los contadores registrados (solo administrador).
 * RF-12, RF-24.
 * @param {Object} req - Petición Express (req.user ya verificado por requireAdmin).
 * @param {Object} res - Respuesta Express.
 */
async function listCounters(req, res) {
  const contadores = await UserModel.findAll({ rol: 'contador' });
  if (contadores.length === 0) {
    return res.status(200).json({
      mensaje: 'No hay contadores registrados',
      contadores: [],
    });
  }
  return res.status(200).json({ contadores });
}

/**
 * Devuelve el conteo de casos por estado de un contador (solo administrador).
 * RF-13, RF-16, RF-24.
 * @param {Object} req - Petición Express con params.id del contador.
 * @param {Object} res - Respuesta Express.
 */
async function countCasesByStatus(req, res) {
  const { id } = req.params;

  // Verificar que el contador exista (RF-16)
  const contador = await UserModel.findById(id);
  if (!contador) {
    return res.status(404).json(
      buildError('No se encontró el contador', 'contador solicitado', 'Verifique el identificador del contador')
    );
  }

  // Obtener conteos con ceros incluidos (RF-13)
  const conteos = await CaseModel.countByStatus(id);
  return res.status(200).json({
    contador_id: id,
    pendiente: conteos.pendiente,
    en_proceso: conteos.en_proceso,
    finalizado: conteos.finalizado,
  });
}

/**
 * Devuelve los casos de un contador (solo administrador).
 * RF-14, RF-16, RF-24.
 * @param {Object} req - Petición Express con params.id del contador.
 * @param {Object} res - Respuesta Express.
 */
async function getCasesByCounter(req, res) {
  const { id } = req.params;

  // Verificar que el contador exista (RF-16)
  const contador = await UserModel.findById(id);
  if (!contador) {
    return res.status(404).json(
      buildError('No se encontró el contador', 'contador solicitado', 'Verifique el identificador del contador')
    );
  }

  const casos = await CaseModel.findByCounter(id);
  if (casos.length === 0) {
    return res.status(200).json({
      mensaje: 'El contador no tiene casos registrados',
      casos: [],
    });
  }
  return res.status(200).json({ casos });
}

/**
 * Devuelve los propios casos del contador autenticado.
 * RF-15, RF-24.
 * @param {Object} req - Petición Express (req.user con id del contador autenticado).
 * @param {Object} res - Respuesta Express.
 */
async function getMyCases(req, res) {
  const casos = await CaseModel.findByCounter(req.user.id);
  if (casos.length === 0) {
    return res.status(200).json({
      mensaje: 'No tiene casos registrados aún',
      casos: [],
    });
  }
  return res.status(200).json({ casos });
}

module.exports = { listCounters, countCasesByStatus, getCasesByCounter, getMyCases };
