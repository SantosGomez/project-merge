const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar, requireLlevaClientes } = require('../middlewares/roleMiddleware');
const {
  listarMisClientes,
  crearCliente,
  actualizarCliente,
  miCartera,
  buscarCatalogo,
  vincularClientes,
  desvincularCliente,
} = require('../controllers/ClienteController');
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /clientes — Clientes propios del contador o auxiliar
router.get('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarMisClientes));

// POST /clientes — Agrega un cliente a la cartera propia
router.post('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(crearCliente));

// PATCH /clientes/:id — Edita, desactiva o reactiva un cliente propio
router.patch('/:id', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(actualizarCliente));

// Cartera propia: la ve y la cambia quien puede llevar clientes. No lleva requireModuloActividades
// porque «Mi perfil» lo ve todo el que trabaja casos.

// GET /clientes/mi-cartera — Clientes vinculados a quien consulta
router.get('/mi-cartera', authenticateToken, requireLlevaClientes, asyncHandler(miCartera));

// GET /clientes/catalogo — Busca clientes activos del catálogo para vincularlos
router.get('/catalogo', authenticateToken, requireLlevaClientes, asyncHandler(buscarCatalogo));

// POST /clientes/vinculos — Vincula clientes del catálogo a la cartera propia (todo o nada)
router.post('/vinculos', authenticateToken, requireLlevaClientes, asyncHandler(vincularClientes));

// DELETE /clientes/vinculos/:clienteId — Quita solo el vínculo propio con un cliente
router.delete('/vinculos/:clienteId', authenticateToken, requireLlevaClientes, asyncHandler(desvincularCliente));

module.exports = router;
