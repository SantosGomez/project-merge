const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { crearPase, abrirEventos } = require('../controllers/EventosController');
const { asyncHandler } = require('../utils/asyncHandler');

// POST /eventos/pase — Pase de un solo uso (60 s) para abrir la conexión de tiempo real
router.post('/pase', authenticateToken, asyncHandler(crearPase));

// GET /eventos?pase=… — Conexión de Server-Sent Events: avisos de casos y prioridades al instante
router.get('/', asyncHandler(abrirEventos));

module.exports = router;
