const { query } = require('../config/db');
const { nowLocal } = require('../utils/dateUtils');

// Evento con el nombre de su fase y de quien lo registró (Contador_id = quien lo capturó).
const SELECT_EVENTO = `
  SELECT d.*, f.Fase AS FaseNombre, u.nombre AS RegistradoPorNombre
  FROM auditoria_dtl d
  JOIN fases_aud f ON f.IdFase = d.Fase_Id
  JOIN usuarios u ON u.id = d.Contador_id`;

/**
 * Registra un evento en la bitácora de una auditoría.
 * @param {number} auditoriaId - ID de la auditoría.
 * @param {Object} datos - Campos ya validados (fechas AAAA-MM-DD).
 * @param {number} registradoPor - ID de quien lo captura.
 * @returns {Promise<number>} ID del evento.
 */
async function create(auditoriaId, datos, registradoPor) {
  const resultado = await query(
    `INSERT INTO auditoria_dtl
      (AudHdr_Id, Contador_id, Folio_Actas, Evento, Fecha, FechaLimite, FechaEntrega, Descripcion, Fase_Id,
       Estado, Observaciones, CreadoEn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      auditoriaId,
      registradoPor,
      datos.folio,
      datos.evento,
      datos.fecha,
      datos.fecha_limite,
      datos.fecha_entrega,
      datos.descripcion,
      datos.fase_id,
      datos.estado,
      datos.observaciones,
      nowLocal(),
    ]
  );
  return resultado.insertId;
}

/**
 * Guarda los campos editables de un evento (quien lo registró y cuándo no cambian).
 * @param {number} eventoId - ID del evento.
 * @param {Object} datos - Todos los campos editables ya validados.
 * @returns {Promise<void>}
 */
async function update(eventoId, datos) {
  await query(
    `UPDATE auditoria_dtl SET
      Folio_Actas = ?, Evento = ?, Fecha = ?, FechaLimite = ?, FechaEntrega = ?, Descripcion = ?,
      Fase_Id = ?, Estado = ?, Observaciones = ?
     WHERE Id_AudDtl = ?`,
    [
      datos.folio,
      datos.evento,
      datos.fecha,
      datos.fecha_limite,
      datos.fecha_entrega,
      datos.descripcion,
      datos.fase_id,
      datos.estado,
      datos.observaciones,
      eventoId,
    ]
  );
}

/**
 * Borra un evento de la bitácora.
 * @param {number} eventoId - ID del evento.
 * @returns {Promise<void>}
 */
async function remove(eventoId) {
  await query('DELETE FROM auditoria_dtl WHERE Id_AudDtl = ?', [eventoId]);
}

/**
 * Busca un evento de una auditoría.
 * @param {number} auditoriaId - ID de la auditoría.
 * @param {number} eventoId - ID del evento.
 * @returns {Promise<Object|null>}
 */
async function findById(auditoriaId, eventoId) {
  const filas = await query(`${SELECT_EVENTO} WHERE d.AudHdr_Id = ? AND d.Id_AudDtl = ?`, [auditoriaId, eventoId]);
  return filas[0] ?? null;
}

/**
 * Indica si existe la fase.
 * @param {number} faseId - ID de la fase.
 * @returns {Promise<boolean>}
 */
async function faseExiste(faseId) {
  return (await query('SELECT 1 FROM fases_aud WHERE IdFase = ?', [faseId])).length > 0;
}

/**
 * Bitácora de una auditoría en orden cronológico (mismo día: en el orden en que se registró).
 * @param {number} auditoriaId - ID de la auditoría.
 * @returns {Promise<Array<Object>>}
 */
async function findByAuditoria(auditoriaId) {
  return query(`${SELECT_EVENTO} WHERE d.AudHdr_Id = ? ORDER BY d.Fecha, d.Id_AudDtl`, [auditoriaId]);
}

/**
 * Catálogo de fases en orden.
 * @returns {Promise<Array<Object>>}
 */
async function listFases() {
  return query('SELECT IdFase, Fase, Descripcion FROM fases_aud ORDER BY IdFase');
}

/**
 * Eventos pendientes de la bitácora de todas las auditorías abiertas (calendario del administrador):
 * con fecha límite, sin entrega y no cerrados (Completado o Rechazado, como el seguimiento).
 * Cada uno trae los datos de su auditoría y sus contadores asignados.
 * @returns {Promise<Array<Object>>} Eventos por fecha límite; `fecha_limite` en AAAA-MM-DD.
 */
async function findPendientesParaCalendario() {
  const eventos = await query(
    `SELECT d.Id_AudDtl AS id, d.AudHdr_Id AS auditoria_id, a.Cliente AS cliente, a.No_Expediente AS no_expediente,
            d.Evento AS evento, f.Fase AS fase, DATE_FORMAT(d.FechaLimite, '%Y-%m-%d') AS fecha_limite,
            d.Estado AS estado
     FROM auditoria_dtl d
     JOIN auditorias a ON a.IdAuditoria = d.AudHdr_Id
     JOIN fases_aud f ON f.IdFase = d.Fase_Id
     WHERE d.FechaLimite IS NOT NULL AND d.FechaEntrega IS NULL
       AND d.Estado NOT IN ('Completado', 'Rechazado') AND a.Estado <> 'Completado'
     ORDER BY d.FechaLimite, d.Id_AudDtl`
  );
  if (eventos.length === 0) return [];

  const ids = [...new Set(eventos.map((evento) => evento.auditoria_id))];
  const asignaciones = await query(
    `SELECT ac.IdAuditoria, u.id, u.nombre
     FROM aud_conta ac JOIN usuarios u ON u.id = ac.IdContador
     WHERE ac.IdAuditoria IN (${ids.map(() => '?').join(', ')})
     ORDER BY u.nombre`,
    ids
  );
  return eventos.map((evento) => ({
    ...evento,
    contadores: asignaciones
      .filter((asignacion) => asignacion.IdAuditoria === evento.auditoria_id)
      .map(({ id, nombre }) => ({ id, nombre })),
  }));
}

module.exports = { create, update, remove, findById, findByAuditoria, faseExiste, listFases, findPendientesParaCalendario };
