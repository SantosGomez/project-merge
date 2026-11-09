const { eventos } = require('./eventos');

/**
 * Avisa en tiempo real que una auditoría o su bitácora cambió: a los administradores y a
 * cada contador indicado (sus asignados; al reasignar, los de antes y los de después).
 * El aviso es el mismo para todos, así el tablero de cada uno se recarga solo.
 * @param {number} auditoriaId - ID de la auditoría.
 * @param {Array<{ id: number }>} contadores - contadores a avisar; los repetidos se avisan una vez.
 */
function avisarCambioAuditoria(auditoriaId, contadores) {
  const datos = { auditoriaId };
  eventos.enviarARol('administrador', 'auditoria-actualizada', datos);
  for (const id of new Set(contadores.map((contador) => contador.id))) {
    eventos.enviarAUsuario(id, 'auditoria-actualizada', datos);
  }
}

/**
 * Manda en tiempo real un mensaje nuevo del chat a los administradores y a los contadores
 * asignados (también a las otras pestañas de quien lo escribió).
 * @param {number} auditoriaId - ID de la auditoría.
 * @param {Array<{ id: number }>} contadores - contadores asignados.
 * @param {Object} mensaje - mensaje en formato de la API.
 * @param {string} cliente - cliente de la auditoría, para el aviso emergente del frontend.
 */
function avisarMensajeAuditoria(auditoriaId, contadores, mensaje, cliente) {
  const datos = { auditoriaId, cliente, mensaje };
  eventos.enviarARol('administrador', 'mensaje-auditoria', datos);
  for (const id of new Set(contadores.map((contador) => contador.id))) {
    eventos.enviarAUsuario(id, 'mensaje-auditoria', datos);
  }
}

module.exports = { avisarCambioAuditoria, avisarMensajeAuditoria };
