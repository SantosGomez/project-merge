const express = require('express');
const router = express.Router();
const { authenticateToken, autenticarConCambioPendiente } = require('../middlewares/authMiddleware');
const { login, logout, cambiarContrasena, cambiarMiContrasena, obtenerPerfil } = require('../controllers/AuthController');
const { asyncHandler } = require('../utils/asyncHandler');

// POST /auth/login — Inicio de sesión (RF-01, RF-02, RF-03, RF-06)
router.post('/login', asyncHandler(login));

// POST /auth/logout — Cierre de sesión con revocación persistente (RF-26, RF-31); también con cambio pendiente
router.post('/logout', autenticarConCambioPendiente, asyncHandler(logout));

// PATCH /auth/contrasena — La persona crea su propia contraseña tras entrar con la asignada
router.patch('/contrasena', autenticarConCambioPendiente, asyncHandler(cambiarContrasena));

// PATCH /auth/mi-contrasena — Cambio voluntario de la contraseña, escribiendo la actual
router.patch('/mi-contrasena', authenticateToken, asyncHandler(cambiarMiContrasena));

// GET /auth/perfil — Datos de la cuenta de la sesión para «Mi perfil»
router.get('/perfil', authenticateToken, asyncHandler(obtenerPerfil));

module.exports = router;
