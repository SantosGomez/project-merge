/**
 * Contadores de cada cliente (`cliente_contador`). Es el ÚNICO punto que escribe esa tabla y que
 * mantiene `clientes.usuario_id` como «contador principal».
 *
 * Invariante: `clientes.usuario_id` es NULL si el cliente no tiene filas en `cliente_contador`, o es
 * el principal: el de menor `asignado_en` y, a igualdad, el de menor `usuario_id`.
 *
 * Todas las funciones aceptan al final una función `ejecutar(sql, params) => Promise<filas>` ligada a
 * una transacción que ya abrió quien llama (así el alta de un cliente y sus contadores se guardan
 * juntos). Sin ella, cada escritura abre su propia transacción: si falla a la mitad, no cambia nada.
 */

/** Ejecuta `trabajo` en la transacción de quien llama o, si no hay, en una propia. */
async function enTransaccion(ejecutar, trabajo) {
  if (ejecutar) return trabajo(ejecutar);
  const { conTransaccion } = require('../config/db');
  return conTransaccion(trabajo);
}

/**
 * Ejecuta `trabajo` en una transacción de un pool de mysql2 (el que usan las rutas de documentos).
 * Un pool sin `getConnection` (los dobles de prueba) ejecuta sin transacción.
 * @param {Object} pool - Pool de mysql2.
 * @param {(ejecutar: Function) => Promise<*>} trabajo - Recibe `ejecutar(sql, params)` que devuelve las filas.
 * @returns {Promise<*>} Lo que devuelva `trabajo`.
 */
async function enTransaccionDePool(pool, trabajo) {
  if (typeof pool.getConnection !== 'function') {
    return trabajo(async (sql, params = []) => (await pool.query(sql, params))[0]);
  }
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(async (sql, params = []) => (await conexion.query(sql, params))[0]);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

/** Deja `clientes.usuario_id` en el contador principal del cliente (NULL si no tiene). */
async function sincronizarPrincipal(ejecutar, clienteId) {
  await ejecutar(
    `UPDATE clientes SET usuario_id = (
       SELECT usuario_id FROM cliente_contador WHERE cliente_id = ? ORDER BY asignado_en ASC, usuario_id ASC LIMIT 1
     ) WHERE id = ?`,
    [clienteId, clienteId]
  );
}

/** Inserta las asignaciones que falten (con la hora de ahora); las que ya existen no cambian. */
async function insertarAsignaciones(ejecutar, clienteId, usuarioIds) {
  if (usuarioIds.length === 0) return;
  const valores = usuarioIds.map(() => '(?, ?, NOW())').join(', ');
  const parametros = usuarioIds.flatMap((usuarioId) => [clienteId, usuarioId]);
  await ejecutar(
    `INSERT INTO cliente_contador (cliente_id, usuario_id, asignado_en) VALUES ${valores}
     ON DUPLICATE KEY UPDATE cliente_id = cliente_id`,
    parametros
  );
}

/**
 * Contadores de un cliente, el principal primero.
 * @param {number} clienteId - Id del cliente.
 * @param {Function} [ejecutar] - Consulta dentro de una transacción ajena (opcional).
 * @returns {Promise<Array<{ id: number, nombre: string }>>}
 */
async function contadoresDe(clienteId, ejecutar) {
  const consultar = ejecutar || require('../config/db').query;
  const filas = await consultar(
    `SELECT u.id, u.nombre FROM cliente_contador cc JOIN usuarios u ON u.id = cc.usuario_id
     WHERE cc.cliente_id = ? ORDER BY cc.asignado_en ASC, cc.usuario_id ASC`,
    [clienteId]
  );
  return filas.map((fila) => ({ id: fila.id, nombre: fila.nombre }));
}

/**
 * Id del contador principal de un cliente.
 * @param {number} clienteId - Id del cliente.
 * @param {Function} [ejecutar] - Consulta dentro de una transacción ajena (opcional).
 * @returns {Promise<number|null>} null si el cliente no tiene contadores.
 */
async function principalDe(clienteId, ejecutar) {
  const [principal] = await contadoresDe(clienteId, ejecutar);
  return principal ? principal.id : null;
}

/**
 * Deja como contadores del cliente exactamente a `usuarioIds` (vacío = sin contador). Quien ya estaba
 * conserva su fecha de asignación.
 * @param {number} clienteId - Id del cliente.
 * @param {number[]} usuarioIds - Cuentas que serán sus contadores.
 * @param {Function} [ejecutar] - Transacción ajena (opcional).
 * @returns {Promise<void>}
 */
async function reemplazarContadores(clienteId, usuarioIds, ejecutar) {
  const ids = [...new Set(usuarioIds.map(Number))];
  await enTransaccion(ejecutar, async (ejec) => {
    if (ids.length === 0) {
      await ejec('DELETE FROM cliente_contador WHERE cliente_id = ?', [clienteId]);
    } else {
      const marcas = ids.map(() => '?').join(', ');
      await ejec(`DELETE FROM cliente_contador WHERE cliente_id = ? AND usuario_id NOT IN (${marcas})`, [clienteId, ...ids]);
      await insertarAsignaciones(ejec, clienteId, ids);
    }
    await sincronizarPrincipal(ejec, clienteId);
  });
}

/**
 * Suma un contador al cliente (si ya lo era, no cambia nada).
 * @param {number} clienteId - Id del cliente.
 * @param {number} usuarioId - Cuenta que se suma.
 * @param {Function} [ejecutar] - Transacción ajena (opcional).
 * @returns {Promise<void>}
 */
async function agregarContador(clienteId, usuarioId, ejecutar) {
  await enTransaccion(ejecutar, async (ejec) => {
    await insertarAsignaciones(ejec, clienteId, [Number(usuarioId)]);
    await sincronizarPrincipal(ejec, clienteId);
  });
}

/**
 * Quita un contador del cliente; si era el principal, pasa a serlo el siguiente (o NULL si no queda).
 * @param {number} clienteId - Id del cliente.
 * @param {number} usuarioId - Cuenta que se quita.
 * @param {Function} [ejecutar] - Transacción ajena (opcional).
 * @returns {Promise<void>}
 */
async function quitarContador(clienteId, usuarioId, ejecutar) {
  await enTransaccion(ejecutar, async (ejec) => {
    await ejec('DELETE FROM cliente_contador WHERE cliente_id = ? AND usuario_id = ?', [clienteId, usuarioId]);
    await sincronizarPrincipal(ejec, clienteId);
  });
}

module.exports = {
  contadoresDe,
  principalDe,
  reemplazarContadores,
  agregarContador,
  quitarContador,
  enTransaccionDePool,
};
