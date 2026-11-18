const { query, conTransaccion } = require('../config/db');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');
const { calcularEstado } = require('../utils/estadoJunta');
const { esAdministradorAtendido, permisosDeJunta, veAgendaCompleta } = require('../utils/accesoJuntas');

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
 * @param {number[]} ids - Ids a comprobar (puede estar vacía).
 * @returns {Promise<number[]>}
 */
async function idsConRolDeCalendario(ids) {
  if (ids.length === 0) return [];
  const marcas = ids.map(() => '?').join(', ');
  const filas = await query(`SELECT id FROM usuarios WHERE id IN (${marcas}) AND rol IN (${MARCAS_ROLES})`, [
    ...ids,
    ...ROLES_CALENDARIO,
  ]);
  return filas.map((fila) => fila.id);
}

/**
 * Arma las juntas que entrega la API a partir de sus filas, con un solo viaje por los invitados.
 * @param {Array<Object>} filas - Filas de `juntas` con `creador_nombre` y `creador_rol`.
 * @param {{ id: number, rol: string }} consultante - Cuenta que consulta (para `soy_organizador` y sus permisos).
 * @returns {Promise<Array<Object>>}
 */
async function armarJuntas(filas, consultante) {
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
      privada: fila.privada === 1,
      estado: calcularEstado(participantes),
      soy_organizador: fila.creado_por === consultante.id,
      ...permisosDeJunta(consultante, { organizadorId: fila.creado_por, organizadorRol: fila.creador_rol, participantes }),
    };
  });
}

const SELECT_JUNTA = `SELECT j.id, j.titulo, j.descripcion, j.inicio, j.fin, j.privada, j.creado_por, u.nombre AS creador_nombre, u.rol AS creador_rol
                        FROM juntas j JOIN usuarios u ON u.id = j.creado_por`;

/**
 * Busca una junta por id, sin comprobar quién la pide (el controlador decide el acceso).
 * @param {number} id - Id de la junta.
 * @param {{ id: number, rol: string }} consultante - Cuenta que consulta (para `soy_organizador` y sus permisos).
 * @returns {Promise<Object|null>}
 */
async function buscarPorId(id, consultante) {
  const filas = await query(`${SELECT_JUNTA} WHERE j.id = ?`, [id]);
  const juntas = await armarJuntas(filas, consultante);
  return juntas[0] || null;
}

/**
 * Juntas que se cruzan con el rango y donde la cuenta es creadora o invitada, por inicio.
 * @param {{ id: number, rol: string }} consultante - Cuenta que consulta.
 * @param {string} desde - Medianoche del primer día (`AAAA-MM-DD HH:mm:ss`), incluida.
 * @param {string} hastaExclusivo - Medianoche del día siguiente al último, excluida.
 * @returns {Promise<Array<Object>>}
 */
async function listarEnRango(consultante, desde, hastaExclusivo) {
  const filas = await query(
    `${SELECT_JUNTA}
      WHERE j.inicio < ? AND j.fin > ?
        AND (j.creado_por = ? OR EXISTS (
              SELECT 1 FROM junta_participantes jp WHERE jp.junta_id = j.id AND jp.usuario_id = ?))
      ORDER BY j.inicio ASC, j.id ASC`,
    [hastaExclusivo, desde, consultante.id, consultante.id]
  );
  return armarJuntas(filas, consultante);
}

/**
 * Busca una cuenta que usa el calendario.
 * @param {number} id - Id de la cuenta.
 * @returns {Promise<{ id: number, nombre: string, rol: string }|null>} La cuenta, o null si no existe o no usa el calendario.
 */
async function buscarUsuarioDelCalendario(id) {
  const filas = await query(`SELECT id, nombre, rol FROM usuarios WHERE id = ? AND rol IN (${MARCAS_ROLES})`, [
    id,
    ...ROLES_CALENDARIO,
  ]);
  return filas.length === 0 ? null : { id: filas[0].id, nombre: filas[0].nombre, rol: filas[0].rol };
}

/**
 * Administradores que atiende la recepcionista (ADMINISTRADORES_DE_RECEPCION), por nombre.
 * Los ids de la lista que no son administradores o no existen simplemente no aparecen.
 * @returns {Promise<Array<{ id: number, nombre: string }>>}
 */
async function administradoresAtendidos() {
  const filas = await query("SELECT id, nombre, rol FROM usuarios WHERE rol = 'administrador' ORDER BY nombre ASC, id ASC");
  return filas.filter(esAdministradorAtendido).map(({ id, nombre }) => ({ id, nombre }));
}

/**
 * Juntas que ocupan la agenda de una cuenta en el rango (donde organiza o está invitada, sin las que rechazó),
 * ya sin las canceladas. Quien consulta recibe completas las suyas; de las ajenas, solo lo que su privacidad permite:
 * pública → título, horario y organizador; privada → solo «Ocupado». Nunca id, descripción ni invitados.
 * Si quien consulta es secretaria y la agenda es de un administrador, todas llegan completas.
 * @param {{ id: number, rol: string }} dueno - Cuenta cuya agenda se consulta.
 * @param {{ id: number, rol: string }} consultante - Cuenta que consulta.
 * @param {string} desde - Medianoche del primer día (`AAAA-MM-DD HH:mm:ss`), incluida.
 * @param {string} hastaExclusivo - Medianoche del día siguiente al último, excluida.
 * @returns {Promise<Array<Object>>}
 */
async function agendaDe(dueno, consultante, desde, hastaExclusivo) {
  const filas = await query(
    `${SELECT_JUNTA}
      WHERE j.inicio < ? AND j.fin > ?
        AND (j.creado_por = ? OR EXISTS (
              SELECT 1 FROM junta_participantes jp
               WHERE jp.junta_id = j.id AND jp.usuario_id = ? AND jp.respuesta <> 'rechazada'))
      ORDER BY j.inicio ASC, j.id ASC`,
    [hastaExclusivo, desde, dueno.id, dueno.id]
  );
  const juntas = (await armarJuntas(filas, consultante)).filter((junta) => junta.estado !== 'cancelada');
  const todoCompleto = veAgendaCompleta(consultante, dueno);
  return juntas.map((junta) => {
    const esPropia = junta.soy_organizador || junta.participantes.some((p) => p.id === consultante.id);
    if (esPropia || todoCompleto) return junta;
    const { inicio, fin } = junta;
    if (junta.privada) return { id: null, titulo: 'Ocupado', inicio, fin, privada: true, ocupado: true };
    return {
      id: null,
      titulo: junta.titulo,
      inicio,
      fin,
      organizador: { nombre: junta.creado_por.nombre },
      privada: false,
      ocupado: true,
    };
  });
}

/**
 * Crea una junta con sus invitados en `pendiente`, todo en una transacción.
 * @param {number} creadorId - Cuenta organizadora.
 * @param {{ id: number, rol: string }} consultante - Cuenta que crea (puede ser una secretaria a nombre del organizador).
 * @param {{ titulo: string, descripcion: string|null, inicio: string, fin: string, participantes: number[] }} datos - Datos ya validados.
 * @param {Function} [avisos] - `async (ejecutar, juntaId)` que crea los avisos dentro de la misma transacción.
 * @returns {Promise<Object>} La junta creada.
 */
async function crear(creadorId, consultante, { titulo, descripcion, inicio, fin, participantes, privada }, avisos) {
  const ahora = formatLocalDate(nowLocal());
  const id = await conTransaccion(async (ejecutar) => {
    const resultado = await ejecutar(
      'INSERT INTO juntas (titulo, descripcion, inicio, fin, privada, creado_por, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [titulo, descripcion, inicio, fin, privada ? 1 : 0, creadorId, ahora, ahora]
    );
    if (participantes.length > 0) {
      const marcas = participantes.map(() => '(?, ?)').join(', ');
      await ejecutar(
        `INSERT INTO junta_participantes (junta_id, usuario_id) VALUES ${marcas}`,
        participantes.flatMap((usuarioId) => [resultado.insertId, usuarioId])
      );
    }
    if (avisos) await avisos(ejecutar, resultado.insertId);
    return resultado.insertId;
  });
  return buscarPorId(id, consultante);
}

/**
 * Reemplaza los datos de una junta y su lista de invitados: quien sigue conserva su respuesta,
 * los nuevos entran en `pendiente` y los que salen se borran.
 * @param {number} id - Id de la junta.
 * @param {{ id: number, rol: string }} consultante - Cuenta que edita (organizadora o secretaria).
 * @param {{ titulo: string, descripcion: string|null, inicio: string, fin: string, participantes: number[], privada: boolean }} datos - Datos ya validados.
 * @param {{ reiniciarRespuestas?: boolean, avisos?: Function }} [opciones] - `reiniciarRespuestas` devuelve todas las
 *   respuestas a `pendiente` (cambió la fecha o la hora); `avisos` es `async (ejecutar)` dentro de la misma transacción.
 * @returns {Promise<Object>} La junta actualizada.
 */
async function actualizar(
  id,
  consultante,
  { titulo, descripcion, inicio, fin, participantes, privada },
  { reiniciarRespuestas = false, avisos } = {}
) {
  await conTransaccion(async (ejecutar) => {
    await ejecutar('UPDATE juntas SET titulo = ?, descripcion = ?, inicio = ?, fin = ?, privada = ?, actualizado_en = ? WHERE id = ?', [
      titulo,
      descripcion,
      inicio,
      fin,
      privada ? 1 : 0,
      formatLocalDate(nowLocal()),
      id,
    ]);
    if (participantes.length === 0) {
      await ejecutar('DELETE FROM junta_participantes WHERE junta_id = ?', [id]);
    } else {
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
    }
    if (reiniciarRespuestas) {
      await ejecutar("UPDATE junta_participantes SET respuesta = 'pendiente', respondido_en = NULL WHERE junta_id = ?", [id]);
    }
    if (avisos) await avisos(ejecutar);
  });
  return buscarPorId(id, consultante);
}

/**
 * Guarda la respuesta de un invitado (puede cambiarla después) con la hora local.
 * @param {number} id - Id de la junta.
 * @param {number} invitadoId - Cuenta invitada cuya fila se actualiza (quien responde, o el administrador por quien responde la secretaria).
 * @param {{ id: number, rol: string }} consultante - Cuenta que responde, para armar la junta devuelta.
 * @param {'aceptada'|'rechazada'} respuesta - Respuesta ya validada.
 * @param {Function} [avisos] - `async (ejecutar)` que crea los avisos dentro de la misma transacción.
 * @returns {Promise<Object>} La junta actualizada.
 */
async function responder(id, invitadoId, consultante, respuesta, avisos) {
  await conTransaccion(async (ejecutar) => {
    await ejecutar('UPDATE junta_participantes SET respuesta = ?, respondido_en = ? WHERE junta_id = ? AND usuario_id = ?', [
      respuesta,
      formatLocalDate(nowLocal()),
      id,
      invitadoId,
    ]);
    if (avisos) await avisos(ejecutar);
  });
  return buscarPorId(id, consultante);
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
  buscarUsuarioDelCalendario,
  administradoresAtendidos,
  agendaDe,
  crear,
  actualizar,
  responder,
  eliminar,
};
