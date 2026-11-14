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
const { asyncHandler } = require('../utils/asyncHandler');

// Jornada del contador o auxiliar: cada quien solo la suya (ni el administrador ni el contador ven la ajena)
router.get('/hoy', authenticateToken, requireContadorOAuxiliar, asyncHandler(obtenerHoy));
router.post('/hoy/marcar', authenticateToken, requireContadorOAuxiliar, asyncHandler(marcarPaso));
router.get('/', authenticateToken, requireContadorOAuxiliar, asyncHandler(listarDeMes));
// «ajustes» va antes que «/:fecha» para que no se tome como una fecha
router.put('/ajustes', authenticateToken, requireContadorOAuxiliar, asyncHandler(guardarAjustes));
router.put('/:fecha', authenticateToken, requireContadorOAuxiliar, asyncHandler(corregirDia));

module.exports = router;
