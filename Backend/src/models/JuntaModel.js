const { query, conTransaccion } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');
const { calcularEstado } = require('../utils/estadoJunta');

/**
 * Juntas del calendario y sus invitados. Las fechas se guardan y devuelven en hora local.
 * Los invitados se arman con `?` a mano en los `IN`, porque `db.js` solo acepta valores primitivos.
 */

const ROLES_CALENDARIO = ['administrador', 'contador', 'auxiliar', 'recepcionista'];
const MARCAS_ROLES = ROLES_CALENDARIO.map(() => '?').join(', ');

/**
 * Lista las cuentas que usan el calendario, menos la que pide, ordenadas por nombre.
 * @param {number} usuarioId - Cuenta que pide (se excluye).
 * @returns {Promise<Array<{ id: number, nombre: string, rol: string }>>}
 */
async function participantesDisponibles(usuarioId) {
  const filas = await query(
    `SELECT id, nombre, rol FROM usuarios WHERE rol IN (${MARCAS_ROLES}) AND id <> ? ORDER BY nombre ASC, id ASC`,
    [...ROLES_CALENDARIO, usuarioId]
  );
  return filas.map(({ id, nombre, rol }) => ({ id, nombre, rol }));
}

/**
 * De una lista de ids, devuelve los que existen y tienen un rol del calendario.
 * @param {number[]} ids - Ids a comprobar (lista no vacía).
 * @returns {Promise<number[]>}
 */
async function idsConRolDeCalendario(ids) {
  const marcas = ids.map(() => '?').join(', ');
  const filas = await query(`SELECT id FROM usuarios WHERE id IN (${marcas}) AND rol IN (${MARCAS_ROLES})`, [
    ...ids,
    ...ROLES_CALENDARIO,
  ]);
  return filas.map((fila) => fila.id);
}

/**
 * Arma las juntas que entrega la API a partir de sus filas, con un solo viaje por los invitados.
 * @param {Array<Object>} filas - Filas de `juntas` con `creador_nombre`.
 * @param {number} usuarioId - Cuenta que consulta (para `soy_organizador`).
 * @returns {Promise<Array<Object>>}
 */
async function armarJuntas(filas, usuarioId) {
  if (filas.length === 0) return [];
  const marcas = filas.map(() => '?').join(', ');
  const invitados = await query(
    `SELECT jp.junta_id, u.id, u.nombre, u.rol, jp.respuesta
       FROM junta_participantes jp
       JOIN usuarios u ON u.id = jp.usuario_id
      WHERE jp.junta_id IN (${marcas})
      ORDER BY u.nombre ASC, u.id ASC`,
    filas.map((fila) => fila.id)
  );
  return filas.map((fila) => {
    const participantes = invitados
      .filter((invitado) => invitado.junta_id === fila.id)
      .map(({ id, nombre, rol, respuesta }) => ({ id, nombre, rol, respuesta }));
    return {
      id: fila.id,
      titulo: fila.titulo,
      descripcion: fila.descripcion,
      inicio: formatLocalDate(fila.inicio),
      fin: formatLocalDate(fila.fin),
      creado_por: { id: fila.creado_por, nombre: fila.creador_nombre },
      participantes,
      estado: calcularEstado(participantes),
      soy_organizador: fila.creado_por === usuarioId,
    };
  });
}

const SELECT_JUNTA = `SELECT j.id, j.titulo, j.descripcion, j.inicio, j.fin, j.creado_por, u.nombre AS creador_nombre
                        FROM juntas j JOIN usuarios u ON u.id = j.creado_por`;

/**
 * Busca una junta por id, sin comprobar quién la pide (el controlador decide el acceso).
 * @param {number} id - Id de la junta.
 * @param {number} usuarioId - Cuenta que consulta (para `soy_organizador`).
 * @returns {Promise<Object|null>}
 */
async function buscarPorId(id, usuarioId) {
  const filas = await query(`${SELECT_JUNTA} WHERE j.id = ?`, [id]);
  const juntas = await armarJuntas(filas, usuarioId);
  return juntas[0] || null;
}

/**
 * Juntas que se cruzan con el rango y donde la cuenta es creadora o invitada, por inicio.
 * @param {number} usuarioId - Cuenta que consulta.
 * @param {string} desde - Medianoche del primer día (`AAAA-MM-DD HH:mm:ss`), incluida.
 * @param {string} hastaExclusivo - Medianoche del día siguiente al último, excluida.
 * @returns {Promise<Array<Object>>}
 */
async function listarEnRango(usuarioId, desde, hastaExclusivo) {
  const filas = await query(
    `${SELECT_JUNTA}
      WHERE j.inicio < ? AND j.fin > ?
        AND (j.creado_por = ? OR EXISTS (
              SELECT 1 FROM junta_participantes jp WHERE jp.junta_id = j.id AND jp.usuario_id = ?))
      ORDER BY j.inicio ASC, j.id ASC`,
    [hastaExclusivo, desde, usuarioId, usuarioId]
  );
  return armarJuntas(filas, usuarioId);
}

/**
 * Crea una junta con sus invitados en `pendiente`, todo en una transacción.
 * @param {number} creadorId - Cuenta organizadora.
 * @param {{ titulo: string, descripcion: string|null, inicio: string, fin: string, participantes: number[] }} datos - Datos ya validados.
 * @param {Function} [avisos] - `async (ejecutar, juntaId)` que crea los avisos dentro de la misma transacción.
 * @returns {Promise<Object>} La junta creada.
 */
async function crear(creadorId, { titulo, descripcion, inicio, fin, participantes }, avisos) {
  const ahora = formatLocalDate(nowLocal());
  const id = await conTransaccion(async (ejecutar) => {
    const resultado = await ejecutar(
      'INSERT INTO juntas (titulo, descripcion, inicio, fin, creado_por, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [titulo, descripcion, inicio, fin, creadorId, ahora, ahora]
    );
    const marcas = participantes.map(() => '(?, ?)').join(', ');
    await ejecutar(
      `INSERT INTO junta_participantes (junta_id, usuario_id) VALUES ${marcas}`,
      participantes.flatMap((usuarioId) => [resultado.insertId, usuarioId])
    );
    if (avisos) await avisos(ejecutar, resultado.insertId);
    return resultado.insertId;
  });
  return buscarPorId(id, creadorId);
}

/**
 * Reemplaza los datos de una junta y su lista de invitados: quien sigue conserva su respuesta,
 * los nuevos entran en `pendiente` y los que salen se borran.
 * @param {number} id - Id de la junta.
 * @param {number} usuarioId - Cuenta organizadora que consulta.
 * @param {{ titulo: string, descripcion: string|null, inicio: string, fin: string, participantes: number[] }} datos - Datos ya validados.
 * @param {{ reiniciarRespuestas?: boolean, avisos?: Function }} [opciones] - `reiniciarRespuestas` devuelve todas las
 *   respuestas a `pendiente` (cambió la fecha o la hora); `avisos` es `async (ejecutar)` dentro de la misma transacción.
 * @returns {Promise<Object>} La junta actualizada.
 */
async function actualizar(
  id,
  usuarioId,
  { titulo, descripcion, inicio, fin, participantes },
  { reiniciarRespuestas = false, avisos } = {}
) {
  await conTransaccion(async (ejecutar) => {
    await ejecutar('UPDATE juntas SET titulo = ?, descripcion = ?, inicio = ?, fin = ?, actualizado_en = ? WHERE id = ?', [
      titulo,
      descripcion,
      inicio,
      fin,
      formatLocalDate(nowLocal()),
      id,
    ]);
    const marcasIds = participantes.map(() => '?').join(', ');
    await ejecutar(`DELETE FROM junta_participantes WHERE junta_id = ? AND usuario_id NOT IN (${marcasIds})`, [
      id,
      ...participantes,
    ]);
    const marcasNuevos = participantes.map(() => '(?, ?)').join(', ');
    await ejecutar(
      `INSERT IGNORE INTO junta_participantes (junta_id, usuario_id) VALUES ${marcasNuevos}`,
      participantes.flatMap((participanteId) => [id, participanteId])
    );
    if (reiniciarRespuestas) {
      await ejecutar("UPDATE junta_participantes SET respuesta = 'pendiente', respondido_en = NULL WHERE junta_id = ?", [id]);
    }
    if (avisos) await avisos(ejecutar);
  });
  return buscarPorId(id, usuarioId);
}

/**
 * Guarda la respuesta de un invitado (puede cambiarla después) con la hora local.
 * @param {number} id - Id de la junta.
 * @param {number} usuarioId - Cuenta invitada que responde.
 * @param {'aceptada'|'rechazada'} respuesta - Respuesta ya validada.
 * @param {Function} [avisos] - `async (ejecutar)` que crea los avisos dentro de la misma transacción.
 * @returns {Promise<Object>} La junta actualizada.
 */
async function responder(id, usuarioId, respuesta, avisos) {
  await conTransaccion(async (ejecutar) => {
    await ejecutar('UPDATE junta_participantes SET respuesta = ?, respondido_en = ? WHERE junta_id = ? AND usuario_id = ?', [
      respuesta,
      formatLocalDate(nowLocal()),
      id,
      usuarioId,
    ]);
    if (avisos) await avisos(ejecutar);
  });
  return buscarPorId(id, usuarioId);
}

/**
 * Borra una junta; sus invitados y sus avisos con junta se borran en cascada.
 * @param {number} id - Id de la junta.
 * @param {Function} [avisos] - `async (ejecutar)` que crea los avisos (sin junta) dentro de la misma transacción.
 * @returns {Promise<void>}
 */
async function eliminar(id, avisos) {
  await conTransaccion(async (ejecutar) => {
    if (avisos) await avisos(ejecutar);
    await ejecutar('DELETE FROM juntas WHERE id = ?', [id]);
  });
}

module.exports = {
  participantesDisponibles,
  idsConRolDeCalendario,
  buscarPorId,
  listarEnRango,
  crear,
  actualizar,
  responder,
  eliminar,
};
