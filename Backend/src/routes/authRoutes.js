const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { login, logout } = require('../controllers/AuthController');
const { asyncHandler } = require('../utils/asyncHandler');

// POST /auth/login — Inicio de sesión (RF-01, RF-02, RF-03, RF-06)
router.post('/login', asyncHandler(login));

// POST /auth/logout — Cierre de sesión con revocación persistente (RF-26, RF-31)
router.post('/logout', authenticateToken, asyncHandler(logout));

module.exports = router;
