const { query, conTransaccion } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Cartera por tipo de actividad (rebanada 11): qué clientes lleva cada contador o auxiliar en cada tipo.
 * Los ids de cliente y de tipo ya deben haberse comprobado como propios del usuario.
 */

/**
 * Ids de los clientes que el usuario lleva en un tipo (incluye clientes desactivados).
 * @param {number} tipoId - Tipo de actividad del usuario.
 * @returns {Promise<Array<number>>} Ids de cliente, de menor a mayor.
 */
async function listarClienteIds(tipoId) {
  const filas = await query('SELECT cliente_id FROM cartera_actividad WHERE tipo_id = ? ORDER BY cliente_id', [tipoId]);
  return filas.map((fila) => fila.cliente_id);
}

/**
 * Devuelve de los ids recibidos los que son clientes del usuario, con su estado activo.
 * @param {number} usuarioId - Dueño esperado.
 * @param {Array<number>} ids - Ids de cliente a comprobar.
 * @returns {Promise<Array<{ id: number, activo: boolean }>>}
 */
async function clientesDeUsuario(usuarioId, ids) {
  if (ids.length === 0) return [];
  const filas = await query('SELECT id, activo FROM clientes WHERE usuario_id = ? AND id IN (?)', [usuarioId, ids]);
  return filas.map((fila) => ({ id: fila.id, activo: Boolean(fila.activo) }));
}

/**
 * Aplica la diferencia de la cartera de un tipo en una sola transacción: agrega (sin repetir lo que ya está)
 * y quita. Si algo falla no se guarda nada.
 * @param {number} usuarioId - Dueño de la cartera.
 * @param {number} tipoId - Tipo de actividad.
 * @param {Array<number>} agregar - Clientes que se suman.
 * @param {Array<number>} quitar - Clientes que se sacan.
 * @returns {Promise<Array<number>>} Ids que quedan en la cartera del tipo.
 */
async function aplicarCambios(usuarioId, tipoId, agregar, quitar) {
  const creadoEn = formatLocalDate(nowLocal());
  await conTransaccion(async (ejecutar) => {
    if (agregar.length > 0) {
      await ejecutar('INSERT IGNORE INTO cartera_actividad (usuario_id, cliente_id, tipo_id, creado_en) VALUES ?', [
        agregar.map((clienteId) => [usuarioId, clienteId, tipoId, creadoEn]),
      ]);
    }
    if (quitar.length > 0) {
      await ejecutar('DELETE FROM cartera_actividad WHERE tipo_id = ? AND cliente_id IN (?)', [tipoId, quitar]);
    }
  });
  return listarClienteIds(tipoId);
}

module.exports = { listarClienteIds, clientesDeUsuario, aplicarCambios };
