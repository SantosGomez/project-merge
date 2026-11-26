const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrSistema, requireAltaClientes } = require('../middlewares/roleMiddleware');
const {
  listarClientes,
  listarContadores,
  crearCliente,
  actualizarCliente,
  reemplazarContadoresDelCliente,
} = require('../controllers/AjustesController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /ajustes/clientes — Catálogo de clientes (administrador, usuarios_de_sistema y recepcionista)
router.get('/clientes', authenticateToken, requireAltaClientes, asyncHandler(listarClientes));

// GET /ajustes/contadores — Cuentas que pueden llevar clientes (las mismas tres que dan de alta)
router.get('/contadores', authenticateToken, requireAltaClientes, asyncHandler(listarContadores));

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
