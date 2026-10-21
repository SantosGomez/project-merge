const { query } = require('../config/db');
const { findById: findUserById } = require('./UserModel');

/**
 * Obtiene una sesión por su token (jti).
 * Solo existen las sesiones que el inicio de sesión registró en la tabla `sesiones`.
 * @param {string} token - Identificador de la sesión (jti).
 * @returns {Promise<Object|null>} Datos de la sesión o null si no existe.
 */
async function obtenerSesion(token) {
  try {
    const rows = await query('SELECT * FROM sesiones WHERE jti = ?', [token]);
    if (rows.length > 0) {
      return rows[0];
    }
  } catch (err) {
    // Sin base de datos no hay sesión registrada que valga
  }

  return null;
}

/**
 * Registra una nueva sesión en la base de datos.
 * @param {string} jti - Identificador único de la sesión.
 * @param {number} usuarioId - ID del usuario propietario.
 * @param {Date} ultimaActividad - Fecha y hora de la última actividad.
 */
async function registrarSesion(jti, usuarioId, ultimaActividad) {
  try {
    await query(
      'INSERT INTO sesiones (jti, usuario_id, ultima_actividad, revocado, creado_en) VALUES (?, ?, ?, 0, ?)',
      [jti, usuarioId, ultimaActividad, ultimaActividad]
    );
  } catch (err) {
    // En entorno de prueba sin BD, ignorar
  }
}

/**
 * Actualiza la marca de última actividad de una sesión (RF-25).
 * @param {string} token - Identificador de la sesión (jti).
 * @param {Date} ahora - Fecha y hora actual de la actividad.
 */
async function tocarActividad(token, ahora) {
  try {
    await query('UPDATE sesiones SET ultima_actividad = ? WHERE jti = ?', [
      ahora,
      token,
    ]);
  } catch (err) {
    // En entorno de prueba sin BD, ignorar
  }
}

/**
 * Revoca una sesión marcándola como revocada.
 * @param {string} token - Identificador de la sesión (jti).
 */
async function revocar(token) {
  try {
    await query('UPDATE sesiones SET revocado = 1 WHERE jti = ?', [token]);
  } catch (err) {
    // En entorno de prueba sin BD, ignorar
  }
}

module.exports = { obtenerSesion, registrarSesion, tocarActividad, revocar };
