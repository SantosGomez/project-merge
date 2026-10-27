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

/**
 * Ejecuta varias consultas en una sola transacción: si una falla, no se guarda ninguna.
 * @param {(ejecutar: (sql: string, params?: Array) => Promise<Array>) => Promise<*>} trabajo
 *   recibe una función con la misma forma que `query`, ligada a la transacción.
 * @returns {Promise<*>} lo que devuelva `trabajo`.
 */
async function conTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(async (sql, params) => {
      const [rows] = await conexion.query(sql, params || []);
      return rows;
    });
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

module.exports = { query, pool, conTransaccion };