const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const {
  obtenerHoy,
  marcarPaso,
  listarDeMes,
  corregirDia,
  guardarAjustes,
} = require('../controllers/JornadaController');
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// Jornada del contador o auxiliar: cada quien solo la suya (ni el administrador ni el contador ven la ajena)
router.get('/hoy', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(obtenerHoy));
router.post('/hoy/marcar', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(marcarPaso));
router.get('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarDeMes));
// «ajustes» va antes que «/:fecha» para que no se tome como una fecha
router.put('/ajustes', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(guardarAjustes));
router.put('/:fecha', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(corregirDia));

module.exports = router;
