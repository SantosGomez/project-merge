const { query } = require('../config/db');
const { formatLocalDate } = require('../utils/dateUtils');

/**
 * Consultas de los informes de horas (rebanada 16). Todas filtran por el usuario de la sesión, y un bloque
 * pertenece al día de su `inicio`. Un cronómetro en marcha (`fin` NULL) no cuenta hasta que se detiene.
 * `fecha` es DATE y las horas TIME: se leen ya formateadas para que el driver no las desplace.
 */

const COLUMNAS_JORNADA = `DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
       TIME_FORMAT(entrada, '%H:%i') AS entrada,
       TIME_FORMAT(salida_descanso, '%H:%i') AS salida_descanso,
       TIME_FORMAT(regreso_descanso, '%H:%i') AS regreso_descanso,
       TIME_FORMAT(salida, '%H:%i') AS salida`;

/**
 * Bloques terminados del usuario cuyo inicio cae en el rango, del más reciente al más antiguo.
 * Incluyen clientes y tipos desactivados. Un cliente o tipo ajeno simplemente no coincide con nada.
 * @param {number} usuarioId - Dueño.
 * @param {{ desde: string, hasta: string, clienteId: number|null, tipoId: number|null }} filtros - Ya validados.
 * @returns {Promise<Array<Object>>}
 */
async function listarBloques(usuarioId, { desde, hasta, clienteId, tipoId }) {
  const condiciones = ['r.usuario_id = ?', 'r.fin IS NOT NULL', 'DATE(r.inicio) >= ?', 'DATE(r.inicio) <= ?'];
  const parametros = [usuarioId, desde, hasta];
  if (clienteId !== null) {
    condiciones.push('r.cliente_id = ?');
    parametros.push(clienteId);
  }
  if (tipoId !== null) {
    condiciones.push('r.tipo_id = ?');
    parametros.push(tipoId);
  }
  const filas = await query(
    `SELECT r.id, r.cliente_id, r.tipo_id, r.inicio, r.fin, r.minutos, r.cobrable, r.manual,
            c.nombre AS cliente, t.nombre AS tipo
       FROM registros_tiempo r
       JOIN clientes c ON c.id = r.cliente_id
       JOIN tipos_actividad t ON t.id = r.tipo_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY r.inicio DESC, r.id DESC`,
    parametros
  );
  return filas.map((fila) => {
    const inicio = formatLocalDate(fila.inicio);
    return {
      id: fila.id,
      fecha: inicio.slice(0, 10),
      cliente_id: fila.cliente_id,
      cliente: fila.cliente,
      tipo_id: fila.tipo_id,
      tipo: fila.tipo,
      inicio,
      fin: formatLocalDate(fila.fin),
      minutos: fila.minutos,
      cobrable: Boolean(fila.cobrable),
      manual: Boolean(fila.manual),
    };
  });
}

/**
 * Minutos de bloques terminados por día (sin filtros de cliente ni tipo) para saber cuánto de cada
 * jornada quedó asignado a actividades.
 * @param {number} usuarioId - Dueño.
 * @param {string} desde - AAAA-MM-DD.
 * @param {string} hasta - AAAA-MM-DD.
 * @returns {Promise<Map<string, number>>} Minutos por fecha AAAA-MM-DD.
 */
async function minutosPorDia(usuarioId, desde, hasta) {
  const filas = await query(
    `SELECT DATE_FORMAT(inicio, '%Y-%m-%d') AS dia, SUM(minutos) AS total
       FROM registros_tiempo
      WHERE usuario_id = ? AND fin IS NOT NULL AND DATE(inicio) >= ? AND DATE(inicio) <= ?
      GROUP BY dia`,
    [usuarioId, desde, hasta]
  );
  return new Map(filas.map((fila) => [fila.dia, Number(fila.total)]));
}

/**
 * Jornadas del usuario en el rango, de la más antigua a la más reciente.
 * @param {number} usuarioId - Dueño.
 * @param {string} desde - AAAA-MM-DD.
 * @param {string} hasta - AAAA-MM-DD.
 * @returns {Promise<Array<Object>>}
 */
async function listarJornadas(usuarioId, desde, hasta) {
  return query(
    `SELECT ${COLUMNAS_JORNADA} FROM jornadas
      WHERE usuario_id = ? AND fecha >= ? AND fecha <= ?
      ORDER BY fecha ASC`,
    [usuarioId, desde, hasta]
  );
}

module.exports = { listarBloques, minutosPorDia, listarJornadas };
