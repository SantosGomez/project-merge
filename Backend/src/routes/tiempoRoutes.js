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
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// Cronómetro y bloques de tiempo del contador o auxiliar (cada quien solo lo suyo)
router.get('/activo', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(obtenerActivo));
router.post('/iniciar', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(iniciarCronometro));
router.post('/detener', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(detenerCronometro));
router.post('/manual', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(agregarTiempoManual));
router.get('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarBloques));
router.delete('/:id', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(borrarBloque));

module.exports = router;
