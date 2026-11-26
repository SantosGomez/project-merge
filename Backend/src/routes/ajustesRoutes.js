const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrSistema } = require('../middlewares/roleMiddleware');
const { listarClientes } = require('../controllers/AjustesController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /ajustes/clientes — Catálogo de clientes (solo administrador o usuarios_de_sistema)
router.get('/clientes', authenticateToken, requireAdminOrSistema, asyncHandler(listarClientes));

module.exports = router;
