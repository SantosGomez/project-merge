const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const {
  listarMisNotificaciones,
  marcarMisNotificacionesLeidas,
} = require('../controllers/NotificacionController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /notificaciones — Avisos de la cuenta que inició sesión y cuántos siguen sin leer
router.get('/', authenticateToken, asyncHandler(listarMisNotificaciones));

// PATCH /notificaciones/leidas — Marca como leídos los avisos de la cuenta que inició sesión
router.patch('/leidas', authenticateToken, asyncHandler(marcarMisNotificacionesLeidas));

module.exports = router;
