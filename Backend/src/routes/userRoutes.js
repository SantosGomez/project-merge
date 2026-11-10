const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrSistema } = require('../middlewares/roleMiddleware');
const { createUser, resetPassword, listUsers } = require('../controllers/UserController');
const { listarContadoresDeAuxiliar, reemplazarContadoresDeAuxiliar } = require('../controllers/AuxiliarController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET/PUT /usuarios/:id/contadores — El despacho consulta o fija a qué contadores apoya un auxiliar
router.get('/:id/contadores', authenticateToken, requireAdminOrSistema, asyncHandler(listarContadoresDeAuxiliar));
router.put('/:id/contadores', authenticateToken, requireAdminOrSistema, asyncHandler(reemplazarContadoresDeAuxiliar));

// GET /usuarios — Directorio de cuentas con datos públicos (solo administrador o usuarios_de_sistema)
router.get('/', authenticateToken, requireAdminOrSistema, asyncHandler(listUsers));

// POST /usuarios — Alta de usuario protegida (solo administrador o usuarios_de_sistema) (RF-28 a RF-30)
router.post('/', authenticateToken, requireAdminOrSistema, asyncHandler(createUser));

// PATCH /usuarios/restablecer-contrasena — Restablecimiento por correo, que va en el cuerpo (RF-42 a RF-44, historia 9b)
router.patch(
  '/restablecer-contrasena',
  authenticateToken,
  requireAdminOrSistema,
  asyncHandler(resetPassword)
);

module.exports = router;
