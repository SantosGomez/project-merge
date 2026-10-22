const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrSistema } = require('../middlewares/roleMiddleware');
const { createUser, resetPassword } = require('../controllers/UserController');
const { asyncHandler } = require('../utils/asyncHandler');

// POST /usuarios — Alta de usuario protegida (solo administrador o usuarios_de_sistema) (RF-28 a RF-30)
router.post('/', authenticateToken, requireAdminOrSistema, asyncHandler(createUser));

// PATCH /usuarios/:usuario/restablecer-contrasena — Restablecimiento protegido (RF-42 a RF-44)
router.patch(
  '/:usuario/restablecer-contrasena',
  authenticateToken,
  requireAdminOrSistema,
  asyncHandler(resetPassword)
);

module.exports = router;
