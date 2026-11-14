const { query, conTransaccion } = require('../config/db');
const { PASOS, JORNADA_BASE_DEFECTO, evaluarPaso } = require('../utils/jornada');

/**
 * Jornada de cada usuario (rebanada 15): las cuatro horas del día y la jornada base.
 * `fecha` es DATE y las horas TIME: se leen ya formateadas (`AAAA-MM-DD` y `HH:MM`) para que el driver
 * no las convierta en fechas y las desplace por la zona horaria.
 */

const COLUMNAS_JORNADA = `DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha,
       TIME_FORMAT(entrada, '%H:%i') AS entrada,
       TIME_FORMAT(salida_descanso, '%H:%i') AS salida_descanso,
       TIME_FORMAT(regreso_descanso, '%H:%i') AS regreso_descanso,
       TIME_FORMAT(salida, '%H:%i') AS salida`;

/**
 * Convierte una fila en la jornada que entrega la API (solo las cuatro horas y la fecha).
 * @param {Object} fila - Fila leída con `COLUMNAS_JORNADA`.
 * @returns {Object}
 */
function aJornada(fila) {
  return {
    fecha: fila.fecha,
    entrada: fila.entrada,
    salida_descanso: fila.salida_descanso,
    regreso_descanso: fila.regreso_descanso,
    salida: fila.salida,
  };
}

/**
 * Jornada de un día del usuario, o null si no hay.
 * @param {number} usuarioId - Dueño.
 * @param {string} fecha - AAAA-MM-DD.
 * @returns {Promise<Object|null>}
 */
async function buscarDeFecha(usuarioId, fecha) {
  const filas = await query(`SELECT ${COLUMNAS_JORNADA} FROM jornadas WHERE usuario_id = ? AND fecha = ?`, [
    usuarioId,
    fecha,
  ]);
  return filas.length > 0 ? aJornada(filas[0]) : null;
}

/**
 * Jornadas del usuario en un mes, de la más antigua a la más reciente.
 * @param {number} usuarioId - Dueño.
 * @param {string} mes - AAAA-MM ya validado.
 * @returns {Promise<Array<Object>>}
 */
async function listarDeMes(usuarioId, mes) {
  const filas = await query(
    `SELECT ${COLUMNAS_JORNADA} FROM jornadas
      WHERE usuario_id = ? AND fecha >= ? AND fecha <= LAST_DAY(?)
      ORDER BY fecha ASC`,
    [usuarioId, `${mes}-01`, `${mes}-01`]
  );
  return filas.map(aJornada);
}

/**
 * Registra un paso del día con la hora dada, en una transacción con el usuario bloqueado: dos pasos
 * iguales a la vez no se pisan (el segundo ve el primero y recibe un conflicto).
 * @param {number} usuarioId - Dueño.
 * @param {string} fecha - AAAA-MM-DD de hoy (del servidor).
 * @param {string} paso - Uno de `PASOS` ya validado.
 * @param {string} hora - HH:MM:SS (del servidor).
 * @returns {Promise<{ resultado: 'ok'|'repetido'|'fuera_de_orden', jornada: Object|null }>}
 */
async function marcarPaso(usuarioId, fecha, paso, hora) {
  return conTransaccion(async (ejecutar) => {
    await ejecutar('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuarioId]);
    const filas = await ejecutar(`SELECT ${COLUMNAS_JORNADA} FROM jornadas WHERE usuario_id = ? AND fecha = ?`, [
      usuarioId,
      fecha,
    ]);
    const actual = filas.length > 0 ? aJornada(filas[0]) : null;
    const resultado = evaluarPaso(actual, paso);
    if (resultado !== 'ok') return { resultado, jornada: actual };

    // `paso` sale de la lista fija PASOS: es seguro como nombre de columna.
    const columna = PASOS.find((nombre) => nombre === paso);
    await ejecutar(
      `INSERT INTO jornadas (usuario_id, fecha, ${columna}) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE ${columna} = VALUES(${columna})`,
      [usuarioId, fecha, hora]
    );
    const nuevas = await ejecutar(`SELECT ${COLUMNAS_JORNADA} FROM jornadas WHERE usuario_id = ? AND fecha = ?`, [
      usuarioId,
      fecha,
    ]);
    return { resultado: 'ok', jornada: aJornada(nuevas[0]) };
  });
}

/**
 * Guarda las cuatro horas de un día (reemplaza lo que había). Todo vacío borra la jornada.
 * @param {number} usuarioId - Dueño.
 * @param {string} fecha - AAAA-MM-DD.
 * @param {Object} horas - Las cuatro horas ya validadas (`HH:MM` o null).
 * @returns {Promise<Object|null>} La jornada guardada, o null si quedó vacía y se borró.
 */
async function guardar(usuarioId, fecha, horas) {
  if (PASOS.every((paso) => horas[paso] === null)) {
    await query('DELETE FROM jornadas WHERE usuario_id = ? AND fecha = ?', [usuarioId, fecha]);
    return null;
  }
  await query(
    `INSERT INTO jornadas (usuario_id, fecha, entrada, salida_descanso, regreso_descanso, salida)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE entrada = VALUES(entrada), salida_descanso = VALUES(salida_descanso),
       regreso_descanso = VALUES(regreso_descanso), salida = VALUES(salida)`,
    [usuarioId, fecha, horas.entrada, horas.salida_descanso, horas.regreso_descanso, horas.salida]
  );
  return buscarDeFecha(usuarioId, fecha);
}

/**
 * Minutos de los bloques de tiempo terminados cuyo inicio cae en ese día (rebanada 14).
 * Un cronómetro en marcha no cuenta hasta que se detiene.
 * @param {number} usuarioId - Dueño.
 * @param {string} fecha - AAAA-MM-DD.
 * @returns {Promise<number>}
 */
async function minutosDeActividades(usuarioId, fecha) {
  const filas = await query(
    `SELECT COALESCE(SUM(minutos), 0) AS total FROM registros_tiempo
      WHERE usuario_id = ? AND fin IS NOT NULL AND DATE(inicio) = ?`,
    [usuarioId, fecha]
  );
  return Number(filas[0].total);
}

/**
 * Jornada base del usuario en minutos (8 horas si nunca la cambió).
 * @param {number} usuarioId - Dueño.
 * @returns {Promise<number>}
 */
async function buscarJornadaBase(usuarioId) {
  const filas = await query('SELECT jornada_base_minutos FROM ajustes_actividades WHERE usuario_id = ?', [usuarioId]);
  return filas.length > 0 ? filas[0].jornada_base_minutos : JORNADA_BASE_DEFECTO;
}

/**
 * Guarda la jornada base del usuario (una fila por usuario).
 * @param {number} usuarioId - Dueño.
 * @param {number} minutos - Ya validados.
 * @returns {Promise<void>}
 */
async function guardarJornadaBase(usuarioId, minutos) {
  await query(
    `INSERT INTO ajustes_actividades (usuario_id, jornada_base_minutos) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE jornada_base_minutos = VALUES(jornada_base_minutos)`,
    [usuarioId, minutos]
  );
}

module.exports = {
  buscarDeFecha,
  listarDeMes,
  marcarPaso,
  guardar,
  minutosDeActividades,
  buscarJornadaBase,
  guardarJornadaBase,
};
