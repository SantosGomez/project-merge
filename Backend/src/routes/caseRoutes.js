const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin, requireContador, requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { checkCaseOwnership } = require('../middlewares/ownershipMiddleware');
const {
  createCase,
  updateCase,
  cambiarPrioridadComoAdmin,
  crearCasoComoAuxiliar,
  crearCasoParaMiAuxiliar,
  pasarCaso,
} = require('../controllers/CaseController');
const { getMyCases } = require('../controllers/CounterController');
const { asyncHandler } = require('../utils/asyncHandler');

// POST /casos — Registrar un nuevo caso (contador o auxiliar autenticado) (RF-09, RF-17 a RF-21)
router.post('/', authenticateToken, requireContadorOAuxiliar, asyncHandler(createCase));

// POST /casos/para-auxiliar — El auxiliar crea un caso a nombre de su contador (RF-AX-13)
router.post(
  '/para-auxiliar',
  authenticateToken,
  requireContadorOAuxiliar,
  asyncHandler(crearCasoComoAuxiliar)
);

// POST /casos/para-mi-auxiliar — El contador registra un caso nuevo a nombre de uno de sus auxiliares
router.post('/para-mi-auxiliar', authenticateToken, requireContador, asyncHandler(crearCasoParaMiAuxiliar));

// PATCH /casos/:id — Editar un caso propio o del equipo (contador o auxiliar, checkCaseOwnership) (RF-22)
router.patch('/:id', authenticateToken, requireContadorOAuxiliar, asyncHandler(checkCaseOwnership), asyncHandler(updateCase));

// PATCH /casos/:id/responsable — El contador pasa un caso a él mismo o a uno de sus auxiliares
router.patch('/:id/responsable', authenticateToken, requireContador, asyncHandler(pasarCaso));

// PATCH /casos/:id/prioridad — El administrador cambia la prioridad del caso de cualquier contador y lo avisa
router.patch('/:id/prioridad', authenticateToken, requireAdmin, asyncHandler(cambiarPrioridadComoAdmin));

// GET /casos/mis-casos — Leer los propios casos del contador autenticado (RF-15, RF-24)
router.get('/mis-casos', authenticateToken, asyncHandler(getMyCases));

module.exports = router;
