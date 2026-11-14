const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const {
  obtenerActivo,
  iniciarCronometro,
  detenerCronometro,
  listarBloques,
  agregarTiempoManual,
  borrarBloque,
} = require('../controllers/RegistroTiempoController');
const { asyncHandler } = require('../utils/asyncHandler');

// Cronómetro y bloques de tiempo del contador o auxiliar (cada quien solo lo suyo)
router.get('/activo', authenticateToken, requireContadorOAuxiliar, asyncHandler(obtenerActivo));
router.post('/iniciar', authenticateToken, requireContadorOAuxiliar, asyncHandler(iniciarCronometro));
router.post('/detener', authenticateToken, requireContadorOAuxiliar, asyncHandler(detenerCronometro));
router.post('/manual', authenticateToken, requireContadorOAuxiliar, asyncHandler(agregarTiempoManual));
router.get('/', authenticateToken, requireContadorOAuxiliar, asyncHandler(listarBloques));
router.delete('/:id', authenticateToken, requireContadorOAuxiliar, asyncHandler(borrarBloque));

module.exports = router;
