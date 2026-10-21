const { query } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Busca un caso por su ID.
 * RF-14, RF-16.
 * @param {number} id - ID del caso.
 * @returns {Promise<Object|null>} El caso encontrado o null.
 */
async function findById(id) {
  const rows = await query('SELECT * FROM casos WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Devuelve los casos asignados a un contador.
 * RF-14, RF-15.
 * @param {number} contadorId - ID del contador.
 * @returns {Promise<Array>} Lista de casos del contador.
 */
async function findByCounter(contadorId) {
  const rows = await query(
    'SELECT * FROM casos WHERE contador_id = ? ORDER BY id DESC',
    [contadorId]
  );
  return rows;
}

/**
 * Devuelve el conteo de casos por estado para un contador, incluyendo ceros.
 * RF-13.
 * @param {number} contadorId - ID del contador.
 * @returns {Promise<{pendiente: number, en_proceso: number, finalizado: number}>} Conteos por estado.
 */
async function countByStatus(contadorId) {
  const rows = await query(
    `SELECT estado, COUNT(*) AS cantidad
     FROM casos
     WHERE contador_id = ?
     GROUP BY estado`,
    [contadorId]
  );

  const conteos = { pendiente: 0, en_proceso: 0, finalizado: 0 };
  rows.forEach((row) => {
    if (row.estado === 'Pendiente') {
      conteos.pendiente = row.cantidad;
    } else if (row.estado === 'En proceso') {
      conteos.en_proceso = row.cantidad;
    } else if (row.estado === 'Finalizado') {
      conteos.finalizado = row.cantidad;
    }
  });
  return conteos;
}

/**
 * Crea un nuevo caso y devuelve el ID insertado.
 * RF-17, RF-18.
 * @param {Object} datos - Datos del caso: contador_id, cliente, estado, prioridad, creado_en, actualizado_en.
 * @returns {Promise<number>} ID del caso insertado.
 */
async function create({ contador_id, cliente, estado, prioridad, creado_en, actualizado_en }) {
  const ahora = formatLocalDate(nowLocal());
  const result = await query(
    `INSERT INTO casos (contador_id, cliente, estado, prioridad, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [contador_id, cliente, estado, prioridad, creado_en || ahora, actualizado_en || ahora]
  );
  return result.insertId;
}

/**
 * Actualiza el estado de un caso.
 * RF-22.
 * @param {number} id - ID del caso.
 * @param {string} estado - Nuevo estado (Pendiente, En proceso, Finalizado).
 */
async function updateStatus(id, estado) {
  const ahora = formatLocalDate(nowLocal());
  await query(
    'UPDATE casos SET estado = ?, actualizado_en = ? WHERE id = ?',
    [estado, ahora, id]
  );
}

/**
 * Actualiza la prioridad de un caso.
 * RF-22.
 * @param {number} id - ID del caso.
 * @param {string} prioridad - Nueva prioridad (Alta, Media, Baja).
 */
async function updatePriority(id, prioridad) {
  const ahora = formatLocalDate(nowLocal());
  await query(
    'UPDATE casos SET prioridad = ?, actualizado_en = ? WHERE id = ?',
    [prioridad, ahora, id]
  );
}

module.exports = { findById, findByCounter, countByStatus, create, updateStatus, updatePriority };