// Fechas del servidor (tarea T5 de la especificación 002).
//
// Sin un solo import: nada de aquí habla con la base de datos ni con el
// servidor. Por eso `node --test` lo carga sin nada más.
//
// ⚠️ LA REGLA QUE SOSTIENE ESTE MÓDULO: ninguna función llama a
// `new Date()` sin argumentos. El día lo recibe quien llama, y así las pruebas
// pueden fijar la fecha en vez de depender del día en que se corren.
//
// Por qué, medido en esta máquina con desfase de 5 horas (America/Matamoros):
//
//   new Date('2026-01-01')  ->  2025-12-31   retrocede un día Y un año
//   new Date('2026-10-01')  ->  2026-09-30   retrocede un mes
//
// Un valor de SOLO DÍA lo interpreta el motor como UTC. Anclarlo a mediodía local
// hace imposible ese retroceso, y con él se acaban los dos fallos que el proyecto
// ya pagó: el folio del 1 de enero saliendo con el año anterior, y el semáforo
// contando mal el último día del mes.

/** Un valor de solo día: cuatro dígitos, guion, dos, guion, dos. Sin hora. */
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Convierte un valor a `Date` en hora local.
 *
 * Un valor de solo día se ancla a **mediodía** local. Un valor que ya trae hora
 * se respeta tal cual, incluida una `Z`: si viene con `Z` significa UTC de
 * verdad, y doblarla a hora local sería inventarse una hora.
 *
 * ⚠️ Una entrada que no es una fecha devuelve un `Date` INVÁLIDO, no la fecha de
 * hoy y no un error. Quien llama tiene que revisarlo: una fecha inválida
 * comparada con otra da `false` en todas las comparaciones, y en el semáforo
 * eso dejaría a un cliente en verde sin que nadie viera nada raro.
 *
 * @param {Date | string | unknown} valor Fecha completa (`2026-10-08T10:15:00`),
 *   de solo día (`2026-10-08`) o un `Date` ya hecho.
 * @returns {Date} La fecha en hora local, o inválida si el valor no lo era.
 */
export const aFechaLocal = (valor) => {
  if (valor instanceof Date) return valor

  const texto = String(valor)
  return new Date(SOLO_DIA.test(texto) ? `${texto}T12:00:00` : texto)
}

/**
 * Deja la fecha a las 00:00:00.000 hora local, sin cambiar el día.
 *
 * Existe para comparar DÍAS y no momentos. Sin esto, las 23:00 del lunes y las
 * 01:00 del martes se compararían como dos instantes distintos, y una fecha
 * límite podría cruzar de día por un margen de horas que no significa nada.
 *
 * Devuelve un `Date` nuevo: el que le pasen no se toca.
 *
 * @param {Date | string | unknown} valor Lo mismo que `aFechaLocal`.
 * @returns {Date} La misma fecha, a medianoche local.
 */
export const aMedianoche = (valor) => {
  const fecha = aFechaLocal(valor)
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0)
}

/**
 * El año de una fecha, como número.
 *
 * El consecutivo del folio es por año (RF-5.3). Si el 1 de enero devolviera el
 * año anterior, el primer folio del año saldría con el año equivocado, y es
 * justo lo que pasa si alguien quita el anclaje a mediodía.
 *
 * @param {Date | string | unknown} hoy La fecha de la que se toma el año.
 * @returns {number} El año, con cuatro cifras.
 */
export const anioDe = (hoy) => aFechaLocal(hoy).getFullYear()

/**
 * ¿Esta fecha cae en un día que cuenta como laborable?
 *
 * Sábado y domingo no cuentan. No hay lista de días festivos: el plan no los
 * metió y esta función no los adivina. Cuando hagan falta, será otro cambio.
 *
 * @param {Date | string | unknown} fecha La fecha que se pregunta.
 * @returns {boolean} `false` en sábado o domingo, `true` en el resto.
 */
export const esDiaHabil = (fecha) => {
  // `getDay` da 0 para domingo y 6 para sábado.
  const dia = aFechaLocal(fecha).getDay()
  return dia !== 0 && dia !== 6
}
