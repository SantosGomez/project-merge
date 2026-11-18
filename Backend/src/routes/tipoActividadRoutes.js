const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireContadorOAuxiliar } = require('../middlewares/roleMiddleware');
const { listarMisTipos, crearTipo, actualizarTipo } = require('../controllers/TipoActividadController');
const { listarClientesDelTipo, guardarClientesDelTipo } = require('../controllers/CarteraActividadController');
const { requireModuloActividades } = require('../middlewares/moduloMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /tipos-actividad — Tipos de actividad propios del contador o auxiliar
router.get('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarMisTipos));

// POST /tipos-actividad — Agrega un tipo de actividad propio
router.post('/', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(crearTipo));

// PATCH /tipos-actividad/:id — Edita, desactiva o reactiva un tipo propio
router.patch('/:id', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(actualizarTipo));

// GET /tipos-actividad/:id/clientes — Ids de los clientes que lleva el usuario en ese tipo
router.get('/:id/clientes', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(listarClientesDelTipo));

// PUT /tipos-actividad/:id/clientes — Guarda la diferencia de la cartera: { agregar, quitar }
router.put('/:id/clientes', authenticateToken, requireContadorOAuxiliar, requireModuloActividades, asyncHandler(guardarClientesDelTipo));

module.exports = router;
