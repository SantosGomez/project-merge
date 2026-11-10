const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin, requireContador, requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { listCounters, teamSummary, countCasesByStatus, getCasesByCounter } = require('../controllers/CounterController');
const {
  listarAuxiliares,
  asignarAuxiliar,
  quitarAuxiliar,
  listarContadoresQueMeTienenComoAuxiliar,
  listarDisponiblesParaAuxiliar,
} = require('../controllers/AuxiliarController');
const { asignarCaso } = require('../controllers/CaseController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /contadores — Listar contadores (solo administrador) (RF-12, RF-24)
router.get('/', authenticateToken, requireAdmin, asyncHandler(listCounters));

// GET /contadores/resumen — Resumen de casos del equipo y por contador para los KPIs (solo administrador)
router.get('/resumen', authenticateToken, requireAdmin, asyncHandler(teamSummary));

// Auxiliares: solo el contador dueño ve y cambia los suyos (RF-AX-01 a RF-AX-06)
router.get('/:id/auxiliares', authenticateToken, requireContador, asyncHandler(listarAuxiliares));
router.get(
  '/:id/auxiliares-disponibles',
  authenticateToken,
  requireContador,
  asyncHandler(listarDisponiblesParaAuxiliar)
);
// El auxiliar consulta a qué contadores apoya (selector «Registrar caso para»)
router.get(
  '/:id/contadores-que-me-tienen-como-auxiliar',
  authenticateToken,
  requireContadorOAuxiliar,
  asyncHandler(listarContadoresQueMeTienenComoAuxiliar)
);
router.post(
  '/:id/auxiliares/:auxiliarId',
  authenticateToken,
  requireContador,
  asyncHandler(asignarAuxiliar)
);
router.delete(
  '/:id/auxiliares/:auxiliarId',
  authenticateToken,
  requireContador,
  asyncHandler(quitarAuxiliar)
);

// GET /contadores/:id/conteos — Conteo de casos por estado de un contador (solo administrador) (RF-13, RF-16)
router.get('/:id/conteos', authenticateToken, requireAdmin, asyncHandler(countCasesByStatus));

// GET /contadores/:id/casos — Casos de un contador (solo administrador) (RF-14, RF-16, RF-24)
router.get('/:id/casos', authenticateToken, requireAdmin, asyncHandler(getCasesByCounter));

// POST /contadores/:id/casos — El administrador asigna un caso nuevo al contador y le avisa
router.post('/:id/casos', authenticateToken, requireAdmin, asyncHandler(asignarCaso));

module.exports = router;
