const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const { requireCalendario } = require('../middlewares/roleMiddleware');
const {
  listarParticipantesDisponibles,
  listarJuntas,
  obtenerAgenda,
  crearJunta,
  obtenerJunta,
  actualizarJunta,
  responderJunta,
  eliminarJunta,
} = require('../controllers/JuntaController');
const { asyncHandler } = require('../utils/asyncHandler');

// GET /juntas/participantes-disponibles — Cuentas que se pueden invitar (va antes que /:id)
router.get('/participantes-disponibles', authenticateToken, requireCalendario, asyncHandler(listarParticipantesDisponibles));

// GET /juntas?desde=&hasta= — Juntas propias que se cruzan con el rango
router.get('/', authenticateToken, requireCalendario, asyncHandler(listarJuntas));

// GET /juntas/agenda/:usuarioId?desde=&hasta= — Agenda de otra persona del calendario (va antes que /:id)
router.get('/agenda/:usuarioId', authenticateToken, requireCalendario, asyncHandler(obtenerAgenda));

// POST /juntas — Crea una junta con invitados
router.post('/', authenticateToken, requireCalendario, asyncHandler(crearJunta));

// GET /juntas/:id — Una junta propia (organizada o con invitación)
router.get('/:id', authenticateToken, requireCalendario, asyncHandler(obtenerJunta));

// PATCH /juntas/:id — Solo el organizador cambia la junta
router.patch('/:id', authenticateToken, requireCalendario, asyncHandler(actualizarJunta));

// PATCH /juntas/:id/respuesta — Un invitado acepta o rechaza
router.patch('/:id/respuesta', authenticateToken, requireCalendario, asyncHandler(responderJunta));

// DELETE /juntas/:id — Solo el organizador borra la junta
router.delete('/:id', authenticateToken, requireCalendario, asyncHandler(eliminarJunta));

module.exports = router;
