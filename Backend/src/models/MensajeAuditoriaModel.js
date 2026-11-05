const { query } = require('../config/db');
const { nowLocal } = require('../utils/dateUtils');

// Mensaje con el nombre y el rol de quien lo escribió.
const SELECT_MENSAJE = `
  SELECT m.*, u.nombre AS AutorNombre, u.rol AS AutorRol
  FROM auditoria_mensajes m
  JOIN usuarios u ON u.id = m.IdUsuario`;

/**
 * Guarda un mensaje en el chat de una auditoría.
 * @param {number} auditoriaId - ID de la auditoría.
 * @param {string} texto - Mensaje ya validado.
 * @param {number} usuarioId - ID de quien lo escribe.
 * @returns {Promise<number>} ID del mensaje.
 */
async function create(auditoriaId, texto, usuarioId) {
  const resultado = await query(
    'INSERT INTO auditoria_mensajes (IdAuditoria, IdUsuario, Mensaje, CreadoEn) VALUES (?, ?, ?, ?)',
    [auditoriaId, usuarioId, texto, nowLocal()]
  );
  return resultado.insertId;
}

/**
 * Busca un mensaje por su ID.
 * @param {number} mensajeId - ID del mensaje.
 * @returns {Promise<Object|null>}
 */
async function findById(mensajeId) {
  const filas = await query(`${SELECT_MENSAJE} WHERE m.IdMensaje = ?`, [mensajeId]);
  return filas[0] ?? null;
}

/**
 * Chat de una auditoría en el orden en que se enviaron los mensajes.
 * @param {number} auditoriaId - ID de la auditoría.
 * @returns {Promise<Array<Object>>}
 */
async function findByAuditoria(auditoriaId) {
  return query(`${SELECT_MENSAJE} WHERE m.IdAuditoria = ? ORDER BY m.IdMensaje`, [auditoriaId]);
}

module.exports = { create, findById, findByAuditoria };
