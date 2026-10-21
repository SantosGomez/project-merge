const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContador } = require('../middlewares/roleMiddleware');
const { checkCaseOwnership } = require('../middlewares/ownershipMiddleware');
const { createCase, updateCase } = require('../controllers/CaseController');
const { getMyCases } = require('../controllers/CounterController');

// POST /casos — Registrar un nuevo caso (solo contador autenticado) (RF-09, RF-17 a RF-21)
router.post('/', authenticateToken, requireContador, createCase);

// PATCH /casos/:id — Cambiar estado y/o prioridad de caso propio (solo contador, checkCaseOwnership) (RF-22)
router.patch('/:id', authenticateToken, checkCaseOwnership, updateCase);

// GET /casos/mis-casos — Leer los propios casos del contador autenticado (RF-15, RF-24)
router.get('/mis-casos', authenticateToken, getMyCases);

module.exports = router;
