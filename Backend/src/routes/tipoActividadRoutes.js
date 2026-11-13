const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { listarMisTipos, crearTipo, actualizarTipo } = require('../controllers/TipoActividadController');
const { listarClientesDelTipo, guardarClientesDelTipo } = require('../controllers/CarteraActividadController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /tipos-actividad — Tipos de actividad propios del contador o auxiliar
router.get('/', authenticateToken, requireContadorOAuxiliar, asyncHandler(listarMisTipos));

// POST /tipos-actividad — Agrega un tipo de actividad propio
router.post('/', authenticateToken, requireContadorOAuxiliar, asyncHandler(crearTipo));

// PATCH /tipos-actividad/:id — Edita, desactiva o reactiva un tipo propio
router.patch('/:id', authenticateToken, requireContadorOAuxiliar, asyncHandler(actualizarTipo));

// GET /tipos-actividad/:id/clientes — Ids de los clientes que lleva el usuario en ese tipo
router.get('/:id/clientes', authenticateToken, requireContadorOAuxiliar, asyncHandler(listarClientesDelTipo));

// PUT /tipos-actividad/:id/clientes — Guarda la diferencia de la cartera: { agregar, quitar }
router.put('/:id/clientes', authenticateToken, requireContadorOAuxiliar, asyncHandler(guardarClientesDelTipo));

module.exports = router;
