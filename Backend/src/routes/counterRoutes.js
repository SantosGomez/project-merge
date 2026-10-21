const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/roleMiddleware');
const { listCounters, countCasesByStatus, getCasesByCounter } = require('../controllers/CounterController');

// GET /contadores — Listar contadores (solo administrador) (RF-12, RF-24)
router.get('/', authenticateToken, requireAdmin, listCounters);

// GET /contadores/:id/conteos — Conteo de casos por estado de un contador (solo administrador) (RF-13, RF-16)
router.get('/:id/conteos', authenticateToken, requireAdmin, countCasesByStatus);

// GET /contadores/:id/casos — Casos de un contador (solo administrador) (RF-14, RF-16, RF-24)
router.get('/:id/casos', authenticateToken, requireAdmin, getCasesByCounter);

module.exports = router;
