const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { listarActividadesDelMes, guardarEstadoDeActividad } = require('../controllers/ActividadMesController');
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /actividades?mes=AAAA-MM — Lista del mes del contador o auxiliar
router.get('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarActividadesDelMes));

// PUT /actividades/estado — Marca o desmarca como hecho un renglón del mes
router.put('/estado', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(guardarEstadoDeActividad));

module.exports = router;
