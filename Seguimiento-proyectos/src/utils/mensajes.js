// Mensajes de error con tres partes en español (RF-36, RNF-01).
// Sin Vue, sin navegador y sin efectos secundarios.
//
// Se usan solo cuando NO llega respuesta del backend. Si el backend devuelve
// `{ mensaje }`, ese texto se muestra tal cual, sin reescribirlo.

/**
 * Une las tres partes de RNF-01 en el formato del plan:
 * "Qué ocurrió: X. Sobre: Y. Qué hacer: Z."
 */
export const construirError = (queOcurrio, sobreQue, queHacer) => ({
  mensaje: `Qué ocurrió: ${queOcurrio}. Sobre: ${sobreQue}. Qué hacer: ${queHacer}.`,
})

/** «Qué hacer» compartidos por los errores de carga, en trato de tú (revisión de UI, rebanada 2). */
export const QUE_HACER = Object.freeze({
  reintentar: 'Vuelve a intentarlo; si el problema continúa, avisa al administrador',
  revisarConexion: 'Revisa tu conexión a internet y vuelve a intentarlo',
  esperar: 'Vuelve a intentarlo en unos segundos',
})

const PATRON_TRES_PARTES = /^Qué ocurrió: (.+?)\. Sobre: (.+?)\. Qué hacer: (.+?)\.?$/s

/**
 * Separa un mensaje armado con `construirError` en sus tres partes, para mostrarlas con sus
 * etiquetas. Devuelve null si el texto no tiene ese formato (p. ej. un mensaje del backend).
 * @param {string} texto
 * @returns {{ queOcurrio: string, sobreQue: string, queHacer: string }|null}
 */
export const separarMensajeError = (texto) => {
  const partes = typeof texto === 'string' ? texto.trim().match(PATRON_TRES_PARTES) : null
  return partes ? { queOcurrio: partes[1], sobreQue: partes[2], queHacer: partes[3] } : null
}
