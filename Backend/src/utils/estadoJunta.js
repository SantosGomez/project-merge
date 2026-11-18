/**
 * Regla de estado de las juntas y textos de sus avisos (puro, sin base de datos).
 * El estado nunca se guarda: se calcula cada vez a partir de las respuestas de los invitados.
 */

/**
 * Estado de una junta según las respuestas de sus invitados (el organizador no cuenta).
 * Sin administradores invitados está confirmada; con ellos, un rechazo la cancela,
 * mientras alguno esté pendiente queda por confirmar y cuando todos aceptan se confirma.
 * @param {Array<{ rol: string, respuesta: string }>} participantes - Invitados con su respuesta.
 * @returns {'confirmada'|'por_confirmar'|'cancelada'}
 */
function calcularEstado(participantes) {
  const administradores = participantes.filter((p) => p.rol === 'administrador');
  if (administradores.some((p) => p.respuesta === 'rechazada')) return 'cancelada';
  if (administradores.some((p) => p.respuesta !== 'aceptada')) return 'por_confirmar';
  return 'confirmada';
}

/**
 * Separa `AAAA-MM-DD HH:mm:ss` en la fecha `DD-MM-AAAA` y la hora `HH:mm` (sin usar Date).
 * @param {string} inicio - Fecha y hora local de la junta.
 * @returns {{ fecha: string, hora: string }}
 */
function fechaYHoraDeAviso(inicio) {
  const [anio, mes, dia] = inicio.slice(0, 10).split('-');
  return { fecha: `${dia}-${mes}-${anio}`, hora: inicio.slice(11, 16) };
}

/** Aviso de invitación a una junta. */
function mensajeDeInvitacion(organizador, titulo, inicio) {
  const { fecha, hora } = fechaYHoraDeAviso(inicio);
  return `${organizador} te invitó a «${titulo}» el ${fecha} a las ${hora}`;
}

/** Aviso de cambio de fecha u hora, que pide volver a confirmar. */
function mensajeDeCambio(organizador, titulo, inicio) {
  const { fecha, hora } = fechaYHoraDeAviso(inicio);
  return `${organizador} cambió «${titulo}» al ${fecha} a las ${hora}. Vuelve a confirmar tu asistencia`;
}

/** Aviso de que la junta se canceló al borrarla el organizador. */
function mensajeDeBorrado(organizador, titulo, inicio) {
  return `${organizador} canceló «${titulo}» del ${fechaYHoraDeAviso(inicio).fecha}`;
}

/** Aviso al organizador de la respuesta de un invitado. */
function mensajeDeRespuesta(nombre, titulo, respuesta) {
  return `${nombre} ${respuesta === 'aceptada' ? 'aceptó' : 'rechazó'} «${titulo}»`;
}

/** Aviso del nuevo estado de la junta tras la respuesta de un administrador. */
function mensajeDeEstado(titulo, estado) {
  return estado === 'confirmada' ? `La junta «${titulo}» quedó confirmada` : `La junta «${titulo}» se canceló`;
}

module.exports = {
  calcularEstado,
  fechaYHoraDeAviso,
  mensajeDeInvitacion,
  mensajeDeCambio,
  mensajeDeBorrado,
  mensajeDeRespuesta,
  mensajeDeEstado,
};
