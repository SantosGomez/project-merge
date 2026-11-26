/**
 * Contadores de cada cliente (`cliente_contador`). Es el ÚNICO punto que escribe esa tabla y que
 * mantiene `clientes.usuario_id` como «contador principal».
 *
 * Invariante: `clientes.usuario_id` es NULL si el cliente no tiene filas en `cliente_contador`, o es
 * el principal: el de menor `asignado_en` (DATETIME(3)) y, a igualdad, el de menor `usuario_id`.
 *
 * Todas las funciones aceptan al final una función `ejecutar(sql, params) => Promise<filas>` ligada a
 * una transacción que ya abrió quien llama (así el alta de un cliente y sus contadores se guardan
 * juntos). Sin ella, cada escritura abre su propia transacción: si falla a la mitad, no cambia nada.
 */

/**
 * Subconsulta SQL con el id del contador principal del cliente `c` (alias obligatorio `c` en la consulta
 * que la use). Es el ÚNICO lugar donde se escribe esa regla de lectura: el de menor `asignado_en` y, a
 * igualdad, el de menor `usuario_id` (la misma que mantiene `sincronizarPrincipal`).
 */
const SQL_PRINCIPAL_DE_C =
  '(SELECT x.usuario_id FROM cliente_contador x WHERE x.cliente_id = c.id ORDER BY x.asignado_en ASC, x.usuario_id ASC LIMIT 1)';

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

/**
 * Inserta las asignaciones que falten; las que ya existen no cambian. Cada una lleva la hora de ahora
 * con milisegundos más 1 ms por su posición en la lista, para que el primero quede como principal.
 */
async function insertarAsignaciones(ejecutar, clienteId, usuarioIds) {
  if (usuarioIds.length === 0) return;
  // El desfase es un entero calculado aquí (no viene de quien llama), por eso va en el texto y no como parámetro.
  const valores = usuarioIds
    .map((_, posicion) => `(?, ?, DATE_ADD(NOW(3), INTERVAL ${posicion * 1000} MICROSECOND))`)
    .join(', ');
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
 * Si el primero de la lista ya estaba y otro contador lo precede en antigüedad, lo pasa 1 ms antes del
 * más antiguo de los demás: así «el primero de la lista» siempre es el principal.
 */
async function adelantarAlPrimero(ejecutar, clienteId, primeroId) {
  const antiguoDeLosDemas = '(SELECT m FROM (SELECT MIN(asignado_en) AS m FROM cliente_contador WHERE cliente_id = ? AND usuario_id <> ?) t)';
  await ejecutar(
    `UPDATE cliente_contador SET asignado_en = DATE_SUB(${antiguoDeLosDemas}, INTERVAL 1000 MICROSECOND)
     WHERE cliente_id = ? AND usuario_id = ? AND asignado_en >= ${antiguoDeLosDemas}`,
    [clienteId, primeroId, clienteId, primeroId, clienteId, primeroId]
  );
}

/**
 * Deja como contadores del cliente exactamente a `usuarioIds` (vacío = sin contador); el primero de la
 * lista queda como principal. Quien ya estaba conserva su fecha de asignación, salvo que haya que
 * adelantarlo para que sea el principal.
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
      await adelantarAlPrimero(ejec, clienteId, ids[0]);
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

/**
 * Regla única de quién puede llevar clientes (ser contador de un cliente): una cuenta con rol general
 * `contador` o `auxiliar`, o con el rol Contador en el módulo de Documentos (`usuario_modulos`: modulo
 * 'documentos', rol 'contador'). `usuarios` no tiene un campo de cuenta activa, así que no se exige.
 * @param {number[]} usuarioIds - Ids a comprobar (sin repetir).
 * @returns {Promise<number[]>} Los ids que no cumplen (incluye los que no existen); vacío si todos pueden.
 */
async function idsQueNoPuedenLlevarClientes(usuarioIds) {
  if (usuarioIds.length === 0) return [];
  const { query } = require('../config/db');
  const marcas = usuarioIds.map(() => '?').join(', ');
  const validos = await query(
    `SELECT u.id FROM usuarios u
     WHERE u.id IN (${marcas})
       AND (u.rol IN ('contador', 'auxiliar')
            OR EXISTS (SELECT 1 FROM usuario_modulos m WHERE m.usuario_id = u.id AND m.modulo = 'documentos' AND m.rol = 'contador'))`,
    usuarioIds
  );
  const ids = new Set(validos.map((fila) => Number(fila.id)));
  return usuarioIds.filter((id) => !ids.has(Number(id)));
}

/**
 * Indica si una cuenta puede llevar clientes (ver `idsQueNoPuedenLlevarClientes`).
 * @param {number} usuarioId - Id de la cuenta.
 * @returns {Promise<boolean>}
 */
async function puedeLlevarClientes(usuarioId) {
  return (await idsQueNoPuedenLlevarClientes([Number(usuarioId)])).length === 0;
}

module.exports = {
  SQL_PRINCIPAL_DE_C,
  idsQueNoPuedenLlevarClientes,
  puedeLlevarClientes,
  contadoresDe,
  principalDe,
  reemplazarContadores,
  agregarContador,
  quitarContador,
  enTransaccionDePool,
};
