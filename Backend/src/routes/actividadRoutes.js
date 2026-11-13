const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { listarActividadesDelMes, guardarEstadoDeActividad } = require('../controllers/ActividadMesController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /actividades?mes=AAAA-MM — Lista del mes del contador o auxiliar
router.get('/', authenticateToken, requireContadorOAuxiliar, asyncHandler(listarActividadesDelMes));

// PUT /actividades/estado — Marca o desmarca como hecho un renglón del mes
router.put('/estado', authenticateToken, requireContadorOAuxiliar, asyncHandler(guardarEstadoDeActividad));

module.exports = router;
