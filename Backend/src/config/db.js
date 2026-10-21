const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Pool de conexiones a MariaDB.
 * Lee configuración de variables de entorno con valores por defecto para entorno local.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'delgrow_contadores',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Ejecuta una consulta SQL con parámetros opcionales y devuelve las filas.
 * @param {string} sql - Sentencia SQL.
 * @param {Array} params - Parámetros de la consulta (opcional).
 * @returns {Promise<Array>} Filas resultantes.
 */
async function query(sql, params) {
  const [rows] = await pool.query(sql, params || []);
  return rows;
}

module.exports = { query, pool };