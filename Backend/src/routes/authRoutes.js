const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { login, logout } = require('../controllers/AuthController');

// POST /auth/login — Inicio de sesión (RF-01, RF-02, RF-03, RF-06)
router.post('/login', login);

// POST /auth/logout — Cierre de sesión con revocación persistente (RF-26, RF-31)
router.post('/logout', authenticateToken, logout);

module.exports = router;
