// Utilidad de mensajes de error con tres partes en español (RF-23, RNF-5, RNF-6).

/**
 * Construye un mensaje de error con las tres partes exigidas por la spec:
 * qué ocurrió, sobre qué dato o acción, y qué debe hacer el usuario.
 * @param {string} queOcurrio - qué ocurrió.
 * @param {string} sobreQue - sobre qué dato o acción.
 * @param {string} queHacer - qué hacer a continuación.
 * @returns {{ mensaje: string }} objeto con el mensaje de error en español.
 */
function buildError(queOcurrio, sobreQue, queHacer) {
  return { mensaje: `${queOcurrio} sobre ${sobreQue}: ${queHacer}` };
}

module.exports = { buildError };