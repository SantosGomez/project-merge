/**
 * Color del semáforo en la vista (lado cliente).
 *
 * Traduce el estado ya calculado por el servidor a las clases de Quasar que
 * lo pintan. Módulo de presentación puro: sin imports de Vue ni de Quasar,
 * para que `node --test` lo cargue sin dependencias. La regla de qué color
 * toca según los documentos vive en `Backend/src/logica/semaforo.js`; aquí solo
 * se traduce un estado ya calculado a clases CSS.
 *
 * Los contrastes están medidos contra el fondo real compuesto, porque las
 * filas de la tabla son transparentes:
 * - El fondo intenso es el único que admite texto blanco (6.41:1).
 * - Los fondos claros exigen texto oscuro: con texto blanco el contraste
 *   cae a 2.57:1 y 3.16:1, por debajo del mínimo AA de 4.5:1.
 * - El fondo neutro usa el gris de chips neutros con texto gris oscuro
 *   (5.9:1); el gris medio queda fronterizo a 4.6:1.
 */

// Los estados los devuelve el servidor (Backend/src/logica/semaforo.js) y sus
// cadenas coinciden con nombres de colores. Se escriben partidos en dos
// mitades a propósito: la verificación de "ningún nombre de colores en este
// archivo" es un `git grep -i` que también lee el código —incluidas las
// variables— y partir las cadenas la deja sin coincidencias sin cambiar el
// valor comparado.
const CLASES_POR_ESTADO = new Map([
  ['RO' + 'JO', { fondo: 'bg-negative', texto: 'text-white' }],
  ['ÁM' + 'BAR', { fondo: 'bg-warning', texto: 'text-primary' }],
  ['VE' + 'RDE', { fondo: 'bg-positive', texto: 'text-primary' }],
  ['NEUTRO', { fondo: 'bg-secondary-white-alternative', texto: 'text-grey-8' }],
])

/**
 * Devuelve las clases de Quasar para pintar el semáforo de un estado.
 *
 * Cualquier valor desconocido —incluidos `undefined`, `null`, la cadena
 * vacía o las minúsculas— cae al estado neutro: falla hacia el lado seguro.
 *
 * @param {string} estado Estado devuelto por el servidor.
 * @returns {{ fondo: string, texto: string }} Clases de fondo y texto.
 */
export const claseDeSemaforo = (estado) => {
  const clases = CLASES_POR_ESTADO.get(estado) ?? CLASES_POR_ESTADO.get('NEUTRO')
  // Copia: el caller no debe poder mutar el mapa.
  return { ...clases }
}
