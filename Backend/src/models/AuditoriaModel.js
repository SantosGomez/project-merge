const { query, conTransaccion } = require('../config/db');
const { nowLocal } = require('../utils/dateUtils');

/**
 * Registra una auditoría y asigna a sus contadores en una sola transacción.
 * @param {Object} datos - Campos de la auditoría ya validados (fechas AAAA-MM-DD).
 * @param {number[]} contadores - IDs de los contadores asignados.
 * @param {number} creadoPor - ID de quien la registra.
 * @returns {Promise<number>} ID de la auditoría creada.
 */
async function create(datos, contadores, creadoPor) {
  const ahora = nowLocal();
  return conTransaccion(async (consulta) => {
    const resultado = await consulta(
      `INSERT INTO auditorias
        (Cliente, No_Expediente, Dependencia, TipoAud, Estatal, FechaPeriodo_inicio, FechaPeriodo_final,
         FechaInicio, FechaVencimiento, Descripcion, Observacion, CreadoPor, CreadoEn, ActualizadoEn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.cliente,
        datos.no_expediente,
        datos.dependencia,
        datos.tipo_auditoria,
        datos.estatal ? 1 : 0,
        datos.periodo_inicio,
        datos.periodo_final,
        datos.fecha_inicio,
        datos.fecha_vencimiento,
        datos.descripcion ?? null,
        datos.observacion ?? null,
        creadoPor,
        ahora,
        ahora,
      ]
    );
    const id = resultado.insertId;
    for (const contadorId of contadores) {
      await consulta('INSERT INTO aud_conta (IdAuditoria, IdContador, AsignadoEn) VALUES (?, ?, ?)', [
        id,
        contadorId,
        ahora,
      ]);
    }
    return id;
  });
}

/**
 * Guarda los datos de una auditoría y, si se indican, reemplaza sus contadores asignados.
 * @param {number} id - ID de la auditoría.
 * @param {Object} datos - Todos los campos editables ya validados (fechas AAAA-MM-DD).
 * @param {number[]|null} contadores - Nueva lista de contadores, o null para no tocarla.
 * @returns {Promise<void>}
 */
async function update(id, datos, contadores) {
  const ahora = nowLocal();
  await conTransaccion(async (consulta) => {
    await consulta(
      `UPDATE auditorias SET
        Cliente = ?, No_Expediente = ?, Dependencia = ?, TipoAud = ?, Estatal = ?,
        FechaPeriodo_inicio = ?, FechaPeriodo_final = ?, Estado = ?, FechaInicio = ?, FechaVencimiento = ?,
        Descripcion = ?, Observacion = ?, ActualizadoEn = ?
       WHERE IdAuditoria = ?`,
      [
        datos.cliente,
        datos.no_expediente,
        datos.dependencia,
        datos.tipo_auditoria,
        datos.estatal ? 1 : 0,
        datos.periodo_inicio,
        datos.periodo_final,
        datos.estado,
        datos.fecha_inicio,
        datos.fecha_vencimiento,
        datos.descripcion,
        datos.observacion,
        ahora,
        id,
      ]
    );
    if (contadores) {
      // Se conserva la fecha de asignación de quien sigue asignado.
      const marcas = contadores.map(() => '?').join(', ');
      await consulta(`DELETE FROM aud_conta WHERE IdAuditoria = ? AND IdContador NOT IN (${marcas})`, [id, ...contadores]);
      for (const contadorId of contadores) {
        await consulta('INSERT IGNORE INTO aud_conta (IdAuditoria, IdContador, AsignadoEn) VALUES (?, ?, ?)', [
          id,
          contadorId,
          ahora,
        ]);
      }
    }
  });
}

/**
 * Indica si un contador está asignado a una auditoría.
 * @param {number} auditoriaId - ID de la auditoría.
 * @param {number} contadorId - ID del contador.
 * @returns {Promise<boolean>}
 */
async function estaAsignado(auditoriaId, contadorId) {
  const filas = await query('SELECT 1 FROM aud_conta WHERE IdAuditoria = ? AND IdContador = ?', [auditoriaId, contadorId]);
  return filas.length > 0;
}

/**
 * Busca una auditoría por su ID, con sus contadores asignados.
 * @param {number} id - ID de la auditoría.
 * @returns {Promise<Object|null>} La fila de la auditoría con `contadores` o null.
 */
async function findById(id) {
  const filas = await query('SELECT * FROM auditorias WHERE IdAuditoria = ?', [id]);
  if (filas.length === 0) return null;
  const [conContadores] = await agregarContadores(filas);
  return conContadores;
}

/**
 * Lista las auditorías, las más recientes primero, con sus contadores.
 * @param {{ contadorId?: number }} [filtro] - con contadorId, solo donde ese contador está asignado.
 * @returns {Promise<Array<Object>>} Filas de auditorias con `contadores`.
 */
async function findAll({ contadorId } = {}) {
  const filas = contadorId
    ? await query(
        `SELECT a.* FROM auditorias a
         JOIN aud_conta ac ON ac.IdAuditoria = a.IdAuditoria AND ac.IdContador = ?
         ORDER BY a.IdAuditoria DESC`,
        [contadorId]
      )
    : await query('SELECT * FROM auditorias ORDER BY IdAuditoria DESC');
  return agregarContadores(filas);
}

/**
 * Agrega a cada fila la lista `contadores` ({ id, nombre }) ordenada por nombre.
 * @param {Array<Object>} filas - Filas de la tabla auditorias.
 * @returns {Promise<Array<Object>>} Las mismas filas con sus contadores.
 */
async function agregarContadores(filas) {
  if (filas.length === 0) return [];
  const ids = filas.map((fila) => fila.IdAuditoria);
  const asignaciones = await query(
    `SELECT ac.IdAuditoria, u.id, u.nombre
     FROM aud_conta ac JOIN usuarios u ON u.id = ac.IdContador
     WHERE ac.IdAuditoria IN (${ids.map(() => '?').join(', ')})
     ORDER BY u.nombre`,
    ids
  );
  return filas.map((fila) => ({
    ...fila,
    contadores: asignaciones
      .filter((asignacion) => asignacion.IdAuditoria === fila.IdAuditoria)
      .map(({ id, nombre }) => ({ id, nombre })),
  }));
}

/**
 * De una lista de IDs, devuelve solo los que son cuentas con rol de contador.
 * @param {number[]} ids - IDs a revisar.
 * @returns {Promise<number[]>} IDs de contadores existentes.
 */
async function filtrarContadores(ids) {
  if (ids.length === 0) return [];
  const filas = await query(
    `SELECT id FROM usuarios WHERE rol = 'contador' AND id IN (${ids.map(() => '?').join(', ')})`,
    ids
  );
  return filas.map((fila) => fila.id);
}

module.exports = { create, update, findById, findAll, estaAsignado, filtrarContadores };
