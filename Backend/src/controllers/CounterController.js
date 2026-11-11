const UserModel = require('../models/UserModel');
const CaseModel = require('../models/CaseModel');
const { buildError } = require('../utils/errorUtils');
const { parseCounterId } = require('../utils/validationUtils');
const { casoConFechasLocales, formatearFechaISO, nowLocal } = require('../utils/dateUtils');

// Devuelve el caso con sus fechas como texto en hora local YYYY-MM-DD HH:mm:ss (RF-48, RNF-2).
// Serializador compartido de dateUtils (mismo que usa CaseController).
const conFechasLocales = casoConFechasLocales;

// El dashboard del admin pide solo los casos importantes con ?importantes=true; sin el parámetro, todos.
const pideSoloImportantes = (req) => req.query.importantes === 'true';

/**
 * Lista todos los contadores registrados (solo administrador).
 * RF-12, RF-24.
 * @param {Object} req - Petición Express (req.user ya verificado por requireAdmin).
 * @param {Object} res - Respuesta Express.
 */
async function listCounters(req, res) {
  const contadores = await UserModel.findCountersPublic();
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

  // El identificador debe ser un entero positivo y pertenecer a un contador (RF-16, RF-35)
  const idNumerico = parseCounterId(id);
  const contador = idNumerico ? await UserModel.findCounterById(idNumerico) : null;
  if (!contador) {
    return res.status(404).json(
      buildError('No se encontró el contador', 'contador solicitado', 'Revisa que el contador exista y actualiza la lista')
    );
  }

  // Obtener conteos con ceros incluidos (RF-13)
  const conteos = await CaseModel.countByStatus(idNumerico, { soloImportantes: pideSoloImportantes(req) });
  return res.status(200).json({
    contador_id: id,
    pendiente: conteos.pendiente,
    en_proceso: conteos.en_proceso,
    finalizado: conteos.finalizado,
  });
}

/**
 * Resumen de casos del equipo para los KPIs del dashboard (solo administrador): el total
 * del equipo y el desglose por contador, de una sola consulta. El total es la suma de las filas.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function teamSummary(req, res) {
  const porContador = await CaseModel.resumenPorContador(
    formatearFechaISO(nowLocal()),
    { soloImportantes: pideSoloImportantes(req) }
  );
  const equipo = { pendiente: 0, en_proceso: 0, finalizado: 0, abiertos: 0, vencidos: 0, alta_abiertos: 0 };
  for (const fila of porContador) {
    for (const campo of Object.keys(equipo)) equipo[campo] += fila[campo];
  }
  return res.status(200).json({ equipo, por_contador: porContador });
}

/**
 * Devuelve los casos de un contador o de un auxiliar (solo administrador). En un contador
 * se suman los casos escalados de sus auxiliares (los que marcó como importantes).
 * RF-14, RF-16, RF-24.
 * @param {Object} req - Petición Express con params.id del contador o auxiliar.
 * @param {Object} res - Respuesta Express.
 */
async function getCasesByCounter(req, res) {
  const { id } = req.params;

  // El identificador debe ser un entero positivo y pertenecer a una cuenta que trabaja casos (RF-16, RF-35)
  const idNumerico = parseCounterId(id);
  const contador = idNumerico ? await UserModel.findContadorOAuxiliarById(idNumerico) : null;
  if (!contador) {
    return res.status(404).json(
      buildError('No se encontró el contador', 'contador solicitado', 'Revisa que el contador exista y actualiza la lista')
    );
  }

  // Sus casos y los escalados de sus auxiliares; cada uno trae el nombre de su dueño
  const casos = await CaseModel.findParaAdministrador(idNumerico, { soloImportantes: pideSoloImportantes(req) });
  if (casos.length === 0) {
    return res.status(200).json({
      mensaje: 'El contador no tiene casos registrados',
      casos: [],
    });
  }
  return res.status(200).json({ casos: casos.map(conFechasLocales) });
}

/**
 * Devuelve los casos del equipo del contador autenticado: los suyos, los de sus auxiliares
 * y los de los contadores a los que apoya (casos en conjunto, con `solo_estado`).
 * RF-15, RF-24, RF-AX-07.
 * @param {Object} req - Petición Express (req.user con id del contador autenticado).
 * @param {Object} res - Respuesta Express.
 */
async function getMyCases(req, res) {
  const casos = await CaseModel.findByCounterYAuxiliares(req.user.id);
  if (casos.length === 0) {
    return res.status(200).json({
      mensaje: 'Aún no tienes casos registrados',
      casos: [],
    });
  }
  return res.status(200).json({ casos: casos.map(conFechasLocales) });
}

module.exports = { listCounters, teamSummary, countCasesByStatus, getCasesByCounter, getMyCases };
