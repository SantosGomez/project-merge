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

module.exports = { avisarCambioAuditoria };
