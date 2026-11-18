const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { obtenerTiempo } = require('../controllers/InformeTiempoController');
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// Informes de horas del contador o auxiliar: cada quien solo los suyos (ni el administrador ni el contador ven los ajenos)
router.get('/tiempo', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(obtenerTiempo));

module.exports = router;
