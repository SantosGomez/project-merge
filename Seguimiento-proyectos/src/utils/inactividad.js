// Cálculo de la inactividad de la sesión (RF-07).
// `hoy` se recibe como parámetro (Date) para que el resultado sea determinista en las pruebas.
// Sin Vue, sin navegador y sin efectos secundarios.

/** Milisegundos que tiene un minuto. */
const MS_POR_MINUTO = 60 * 1000

/**
 * Minutos completos transcurridos entre `ultimaActividad` y `hoy`.
 * Los segundos sueltos se descartan (redondeo hacia abajo).
 */
export const calcularMinutosInactividad = (ultimaActividad, hoy) =>
  Math.floor((hoy.getTime() - ultimaActividad.getTime()) / MS_POR_MINUTO)

/**
 * Indica si la sesión superó el límite de inactividad.
 * Es inactiva solo cuando los minutos son MAYORES que el límite:
 * exactamente en el límite (30) la sesión sigue viva (RF-07).
 */
export const estaInactivo = (ultimaActividad, hoy, limiteMinutos) =>
  calcularMinutosInactividad(ultimaActividad, hoy) > limiteMinutos
