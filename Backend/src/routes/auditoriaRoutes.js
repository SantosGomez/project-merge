const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrContador } = require('../middlewares/roleMiddleware');
const { createAuditoria, listAuditorias, updateAuditoria } = require('../controllers/AuditoriaController');
const {
  createEvento,
  listEventos,
  listFases,
  updateEvento,
  deleteEvento,
} = require('../controllers/AuditoriaEventoController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /auditorias — Listar auditorías (el contador solo ve aquellas donde está asignado)
router.get('/', authenticateToken, requireAdminOrContador, asyncHandler(listAuditorias));

// POST /auditorias — Registrar una auditoría (administrador o contador)
router.post('/', authenticateToken, requireAdminOrContador, asyncHandler(createAuditoria));

// PATCH /auditorias/:id — Editar (el contador solo si está asignado; solo el administrador reasigna)
router.patch('/:id', authenticateToken, requireAdminOrContador, asyncHandler(updateAuditoria));

// GET /auditorias/fases — Catálogo de fases (para el formulario de la bitácora)
router.get('/fases', authenticateToken, requireAdminOrContador, asyncHandler(listFases));

// GET /auditorias/:id/eventos — Bitácora en orden cronológico (administrador o contador asignado)
router.get('/:id/eventos', authenticateToken, requireAdminOrContador, asyncHandler(listEventos));

// POST /auditorias/:id/eventos — Registrar un evento en la bitácora (administrador o contador asignado)
router.post('/:id/eventos', authenticateToken, requireAdminOrContador, asyncHandler(createEvento));

// PATCH /auditorias/:id/eventos/:eventoId — Editar un evento (p. ej. registrar la entrega)
router.patch('/:id/eventos/:eventoId', authenticateToken, requireAdminOrContador, asyncHandler(updateEvento));

// DELETE /auditorias/:id/eventos/:eventoId — Borrar un evento capturado por error
router.delete('/:id/eventos/:eventoId', authenticateToken, requireAdminOrContador, asyncHandler(deleteEvento));

module.exports = router;
