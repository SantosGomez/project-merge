const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrSistema, requireAltaClientes } = require('../middlewares/roleMiddleware');
const {
  listarClientes,
  crearCliente,
  actualizarCliente,
  reemplazarContadoresDelCliente,
} = require('../controllers/AjustesController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /ajustes/clientes — Catálogo de clientes (solo administrador o usuarios_de_sistema)
router.get('/clientes', authenticateToken, requireAdminOrSistema, asyncHandler(listarClientes));

// POST /ajustes/clientes — Alta de un cliente (administrador, usuarios_de_sistema y recepcionista)
router.post('/clientes', authenticateToken, requireAltaClientes, asyncHandler(crearCliente));

// PATCH /ajustes/clientes/:id — Editar datos y estado (solo administrador o usuarios_de_sistema)
router.patch('/clientes/:id', authenticateToken, requireAdminOrSistema, asyncHandler(actualizarCliente));

// PUT /ajustes/clientes/:id/contadores — Reemplazar sus contadores (solo administrador o usuarios_de_sistema)
router.put(
  '/clientes/:id/contadores',
  authenticateToken,
  requireAdminOrSistema,
  asyncHandler(reemplazarContadoresDelCliente)
);

module.exports = router;
