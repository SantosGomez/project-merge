const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireAdminOrSistema } = require('../middlewares/roleMiddleware');
const { createUser } = require('../controllers/UserController');

// POST /usuarios — Alta de usuario protegida (solo administrador o usuarios_de_sistema) (RF-28 a RF-30)
router.post('/', authenticateToken, requireAdminOrSistema, createUser);

module.exports = router;
