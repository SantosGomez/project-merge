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
