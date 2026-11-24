// Formación del folio (tarea T7 de la especificación 002).
//
// Sin un solo import: nada de aquí habla con la base de datos ni con el
// servidor. Por eso `node --test` lo carga sin nada más.
//
// ⚠️ `anioDe` NO vive aquí, aunque el plan §2 lo mencione junto a esta función:
// ya está en `fechas.js` desde la T5, y el propio plan exige que ninguna función
// pura se importe de un lado al otro. Por eso el año llega por parámetro.
//
// Lo que NO está aquí es la reserva del número. Sacar el siguiente consecutivo es
// lo que bloquea la fila de `contador_folio` dentro de una transacción (§4.2 del
// plan, tarea T26 del bloque D); esta función solo le da forma al texto. Por eso
// es pura: dos llamadas con los mismos dos números dan el mismo folio.

/**
 * Arma el folio de un documento: `DCA`, guion, año de cuatro dígitos, guion y
 * consecutivo de cuatro dígitos.
 *
 * El consecutivo se rellena con ceros a la IZQUIERDA hasta cuatro dígitos, y el
 * ancho importa: el folio se ordena y se compara como texto en las pantallas y
 * en los reportes, así que un `1000` sin el cero de delante se leería antes que
 * el `999` que es su anterior. Un número de más de cuatro dígitos se deja como
 * sale: aquí no se recorta nada.
 *
 * El consecutivo es por año (RF-5.3). La numeración vuelve a uno el 1 de enero
 * y es el año, que se lo pasa quien llama, lo que evita que el folio del año
 * nuevo choque con el del anterior.
 *
 * @param {number} anio El año del folio, con cuatro cifras.
 * @param {number} consecutivo El número del folio dentro de ese año.
 * @returns {string} El folio completo, por ejemplo `'DCA-2026-0001'`.
 */
export const formarFolio = (anio, consecutivo) =>
  `DCA-${anio}-${String(consecutivo).padStart(4, '0')}`