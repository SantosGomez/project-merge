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
 * Comprueba que todos los parámetros sean primitivos. `pool.query` de mysql2 expande objetos
 * y arreglos (`{a:1}` → `` `a` = 1 ``, `[1,2]` → `1, 2`), lo que permitiría inyectar SQL si un
 * campo llegara sin validar su tipo. Para listas (`IN`, `VALUES`) se arman los marcadores a mano.
 * @param {Array} params - Parámetros de la consulta.
 * @throws {Error} Si algún parámetro no es string, number finito, boolean, bigint, null, Date o Buffer
 *   (`undefined` se admite: mysql2 lo envía como NULL y no se expande).
 */
function validarParametros(params) {
  if (!Array.isArray(params)) {
    throw new TypeError('Parámetro SQL no permitido: los parámetros deben ir en un arreglo.');
  }
  params.forEach((valor, indice) => {
    const permitido =
      valor === null ||
      valor === undefined ||
      typeof valor === 'string' ||
      typeof valor === 'boolean' ||
      typeof valor === 'bigint' ||
      (typeof valor === 'number' && Number.isFinite(valor)) ||
      valor instanceof Date ||
      Buffer.isBuffer(valor);
    if (!permitido) {
      throw new TypeError(
        `Parámetro SQL no permitido en la posición ${indice}: solo se aceptan texto, número, booleano, nulo, fecha o buffer.`
      );
    }
  });
}

/**
 * Ejecuta una consulta SQL con parámetros opcionales y devuelve las filas.
 * @param {string} sql - Sentencia SQL.
 * @param {Array} params - Parámetros de la consulta (opcional).
 * @returns {Promise<Array>} Filas resultantes.
 */
async function query(sql, params) {
  const parametros = params || [];
  validarParametros(parametros);
  const [rows] = await pool.query(sql, parametros);
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
      const parametros = params || [];
      validarParametros(parametros);
      const [rows] = await conexion.query(sql, parametros);
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

module.exports = { query, pool, conTransaccion, validarParametros };