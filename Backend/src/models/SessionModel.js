const { query } = require('../config/db');
const { findById: findUserById } = require('./UserModel');

/**
 * Obtiene una sesión por su token (jti), con la marca de cambio de contraseña de su cuenta.
 * Solo existen las sesiones que el inicio de sesión registró en la tabla `sesiones`.
 * Un fallo de la base de datos se propaga: quien llama decide la respuesta (RF-40).
 * @param {string} token - Identificador de la sesión (jti).
 * @returns {Promise<Object|null>} Datos de la sesión (más `debe_cambiar_contrasena`) o null si no existe.
 */
async function obtenerSesion(token) {
  const rows = await query(
    `SELECT s.*, u.debe_cambiar_contrasena
     FROM sesiones s LEFT JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.jti = ?`,
    [token]
  );
  if (rows.length > 0) {
    return rows[0];
  }

  return null;
}

/**
 * Registra una nueva sesión en la base de datos.
 * Un fallo de la base de datos se propaga (RF-38).
 * @param {string} jti - Identificador único de la sesión.
 * @param {number} usuarioId - ID del usuario propietario.
 * @param {Date} ultimaActividad - Fecha y hora de la última actividad.
 */
async function registrarSesion(jti, usuarioId, ultimaActividad) {
  await query(
    'INSERT INTO sesiones (jti, usuario_id, ultima_actividad, revocado, creado_en) VALUES (?, ?, ?, 0, ?)',
    [jti, usuarioId, ultimaActividad, ultimaActividad]
  );
}

/**
 * Actualiza la marca de última actividad de una sesión (RF-25).
 * Un fallo de la base de datos se propaga (RF-40).
 * @param {string} token - Identificador de la sesión (jti).
 * @param {Date} ahora - Fecha y hora actual de la actividad.
 */
async function tocarActividad(token, ahora) {
  await query('UPDATE sesiones SET ultima_actividad = ? WHERE jti = ?', [
    ahora,
    token,
  ]);
}

/**
 * Revoca una sesión marcándola como revocada.
 * Un fallo de la base de datos se propaga (RF-39).
 * @param {string} token - Identificador de la sesión (jti).
 */
async function revocar(token) {
  await query('UPDATE sesiones SET revocado = 1 WHERE jti = ?', [token]);
}

/**
 * Revoca todas las sesiones de un usuario, p. ej. tras restablecer su contraseña (RF-42, RF-05).
 * Un fallo de la base de datos se propaga.
 * @param {number} usuarioId - ID del usuario.
 */
async function revocarSesionesDeUsuario(usuarioId) {
  await query('UPDATE sesiones SET revocado = 1 WHERE usuario_id = ?', [usuarioId]);
}

module.exports = { obtenerSesion, registrarSesion, tocarActividad, revocar, revocarSesionesDeUsuario };
