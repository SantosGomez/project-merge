const { query, conTransaccion } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Bloques de tiempo del cronómetro (rebanada 14). Un bloque con `fin` NULL es el cronómetro en marcha;
 * cada usuario tiene a lo más uno. Las horas se guardan en hora local del servidor.
 */

const SELECT_BLOQUE = `SELECT r.id, r.cliente_id, r.tipo_id, r.mes, r.inicio, r.fin, r.minutos, r.cobrable, r.manual,
                              c.nombre AS cliente, t.nombre AS tipo
                         FROM registros_tiempo r
                         JOIN clientes c ON c.id = r.cliente_id
                         JOIN tipos_actividad t ON t.id = r.tipo_id`;

/**
 * Convierte una fila en el bloque que entrega la API (con los nombres para el aviso fijo).
 * @param {Object} fila - Fila de `registros_tiempo` con `cliente` y `tipo`.
 * @returns {Object}
 */
function aBloque(fila) {
  return {
    id: fila.id,
    cliente_id: fila.cliente_id,
    tipo_id: fila.tipo_id,
    mes: fila.mes,
    inicio: formatLocalDate(fila.inicio),
    fin: fila.fin ? formatLocalDate(fila.fin) : null,
    minutos: fila.minutos,
    cobrable: Boolean(fila.cobrable),
    manual: Boolean(fila.manual),
    cliente: fila.cliente,
    tipo: fila.tipo,
  };
}

/**
 * Minutos entre dos fechas, redondeados y con mínimo 1 (un bloque nunca vale cero).
 * @param {Date} inicio - Inicio del bloque.
 * @param {Date} fin - Fin del bloque.
 * @returns {number}
 */
function minutosEntre(inicio, fin) {
  return Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / 60000));
}

/**
 * Bloquea la fila del usuario: serializa sus operaciones de cronómetro para que dos peticiones
 * simultáneas no dejen dos bloques en marcha.
 * @param {Function} ejecutar - Consulta ligada a la transacción.
 * @param {number} usuarioId - Dueño.
 */
async function bloquearUsuario(ejecutar, usuarioId) {
  await ejecutar('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
}

/**
 * Cierra el bloque en marcha del usuario (si lo hay) dentro de una transacción con el usuario bloqueado.
 * @param {Function} ejecutar - Consulta ligada a la transacción.
 * @param {number} usuarioId - Dueño.
 * @param {Date} ahora - Hora de cierre.
 * @returns {Promise<Object|null>} El bloque ya terminado, o null si no había cronómetro en marcha.
 */
async function cerrarActivo(ejecutar, usuarioId, ahora) {
  const filas = await ejecutar(`${SELECT_BLOQUE} WHERE r.usuario_id = ? AND r.fin IS NULL`, [usuarioId]);
  if (filas.length === 0) return null;
  const minutos = minutosEntre(filas[0].inicio, ahora);
  await ejecutar('UPDATE registros_tiempo SET fin = ?, minutos = ? WHERE id = ?', [
    formatLocalDate(ahora),
    minutos,
    filas[0].id,
  ]);
  return aBloque({ ...filas[0], fin: ahora, minutos });
}

/**
 * Bloque en marcha del usuario, o null.
 * @param {number} usuarioId - Dueño.
 * @returns {Promise<Object|null>}
 */
async function buscarActivo(usuarioId) {
  const filas = await query(`${SELECT_BLOQUE} WHERE r.usuario_id = ? AND r.fin IS NULL`, [usuarioId]);
  return filas.length > 0 ? aBloque(filas[0]) : null;
}

/**
 * Inicia un cronómetro y detiene el que estuviera en marcha, todo en una transacción.
 * @param {number} usuarioId - Dueño.
 * @param {{ cliente_id: number, tipo_id: number, mes: string, cobrable: boolean }} datos - Ya validados.
 * @returns {Promise<{ activo: Object, detenido: Object|null }>}
 */
async function iniciar(usuarioId, { cliente_id: clienteId, tipo_id: tipoId, mes, cobrable }) {
  return conTransaccion(async (ejecutar) => {
    await bloquearUsuario(ejecutar, usuarioId);
    const ahora = nowLocal();
    const detenido = await cerrarActivo(ejecutar, usuarioId, ahora);
    const resultado = await ejecutar(
      `INSERT INTO registros_tiempo (usuario_id, cliente_id, tipo_id, mes, inicio, cobrable, manual)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [usuarioId, clienteId, tipoId, mes, formatLocalDate(ahora), cobrable ? 1 : 0]
    );
    const filas = await ejecutar(`${SELECT_BLOQUE} WHERE r.id = ?`, [resultado.insertId]);
    return { activo: aBloque(filas[0]), detenido };
  });
}

/**
 * Detiene el cronómetro en marcha del usuario y guarda su bloque.
 * @param {number} usuarioId - Dueño.
 * @returns {Promise<Object|null>} El bloque terminado, o null si no había nada en marcha.
 */
async function detener(usuarioId) {
  return conTransaccion(async (ejecutar) => {
    await bloquearUsuario(ejecutar, usuarioId);
    return cerrarActivo(ejecutar, usuarioId, nowLocal());
  });
}

/**
 * Bloques terminados de un renglón en un mes, del que terminó primero al que terminó último.
 * @param {number} usuarioId - Dueño.
 * @param {{ cliente_id: number, tipo_id: number, mes: string }} renglon - Renglón ya validado.
 * @returns {Promise<Array<Object>>}
 */
async function listarDeRenglon(usuarioId, { cliente_id: clienteId, tipo_id: tipoId, mes }) {
  const filas = await query(
    `${SELECT_BLOQUE}
      WHERE r.usuario_id = ? AND r.cliente_id = ? AND r.tipo_id = ? AND r.mes = ? AND r.fin IS NOT NULL
      ORDER BY r.fin ASC, r.id ASC`,
    [usuarioId, clienteId, tipoId, mes]
  );
  return filas.map(aBloque);
}

/**
 * Agrega un bloque de tiempo escrito a mano: termina ahora y empieza `minutos` antes.
 * @param {number} usuarioId - Dueño.
 * @param {{ cliente_id: number, tipo_id: number, mes: string, minutos: number, cobrable: boolean }} datos - Ya validados.
 * @returns {Promise<Object>} El bloque creado.
 */
async function crearManual(usuarioId, { cliente_id: clienteId, tipo_id: tipoId, mes, minutos, cobrable }) {
  const fin = nowLocal();
  const inicio = new Date(fin.getTime() - minutos * 60000);
  const resultado = await query(
    `INSERT INTO registros_tiempo (usuario_id, cliente_id, tipo_id, mes, inicio, fin, minutos, cobrable, manual)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [usuarioId, clienteId, tipoId, mes, formatLocalDate(inicio), formatLocalDate(fin), minutos, cobrable ? 1 : 0]
  );
  const filas = await query(`${SELECT_BLOQUE} WHERE r.id = ?`, [resultado.insertId]);
  return aBloque(filas[0]);
}

/**
 * Borra un bloque que sea del usuario.
 * @param {number} id - Id del bloque.
 * @param {number} usuarioId - Dueño.
 * @returns {Promise<boolean>} true si existía y era suyo.
 */
async function borrar(id, usuarioId) {
  const resultado = await query('DELETE FROM registros_tiempo WHERE id = ? AND usuario_id = ?', [id, usuarioId]);
  return resultado.affectedRows > 0;
}

module.exports = { buscarActivo, iniciar, detener, listarDeRenglon, crearManual, borrar };
