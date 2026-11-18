const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { listarMisClientes, crearCliente, actualizarCliente } = require('../controllers/ClienteController');
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /clientes — Clientes propios del contador o auxiliar
router.get('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarMisClientes));

// POST /clientes — Agrega un cliente a la cartera propia
router.post('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(crearCliente));

// PATCH /clientes/:id — Edita, desactiva o reactiva un cliente propio
router.patch('/:id', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(actualizarCliente));

module.exports = router;
