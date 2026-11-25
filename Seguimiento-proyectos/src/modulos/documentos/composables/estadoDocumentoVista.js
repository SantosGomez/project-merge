/**
 * Etiqueta, color e icono del estado de un documento (lado cliente).
 *
 * Traduce el valor del ENUM `documentos.estado` que devuelve el servidor a lo
 * que se pinta en la tabla del Dashboard. Módulo de presentación puro: sin
 * imports de Vue ni de Quasar, para que `node --test` lo cargue sin dependencias.
 *
 * Cada estado devuelve dos cosas: `fondo`, la clase de color sólido que usan los puntos de
 * los selectores, y `chip`, las clases de la píldora clara (fondo suave, texto y borde del
 * color del estado; se definen en `css/documentos.scss`). $info y $positive son oscuros
 * (para los avisos con texto blanco), así que nunca se pone texto `primary` encima de ellos.
 */

const ESTILOS_POR_ESTADO = new Map([
  [
    'RECEPCIONADO',
    {
      etiqueta: 'Recepcionado',
      fondo: 'bg-info',
      chip: 'chip-doc chip-doc--recepcionado',
      icono: 'move_to_inbox',
    },
  ],
  [
    'EN_PROCESO',
    {
      etiqueta: 'En proceso',
      fondo: 'bg-info',
      chip: 'chip-doc chip-doc--en-proceso',
      icono: 'find_in_page',
    },
  ],
  [
    'PENDIENTE_CLIENTE',
    {
      etiqueta: 'Pendiente del cliente',
      fondo: 'bg-warning',
      chip: 'chip-doc chip-doc--pendiente',
      icono: 'schedule',
    },
  ],
  [
    'COMPLETADO',
    {
      etiqueta: 'Completado',
      fondo: 'bg-positive',
      chip: 'chip-doc chip-doc--completado',
      icono: 'check_circle',
    },
  ],
  [
    'CANCELADO',
    {
      etiqueta: 'Cancelado',
      fondo: 'bg-negative',
      chip: 'chip-doc chip-doc--cancelado',
      icono: 'cancel',
    },
  ],
])

/** Respaldo de cualquier valor que no sea de los cinco: píldora neutra con texto legible. */
const ESTILO_DESCONOCIDO = {
  etiqueta: 'Estado no reconocido',
  fondo: 'bg-secondary-white-alternative',
  chip: 'chip-doc chip-doc--neutro',
  icono: 'help',
}

/**
 * Devuelve cómo se pinta el estado de un documento.
 *
 * Cualquier valor desconocido —incluidos `null`, la cadena vacía o las
 * minúsculas— cae al estilo neutro: falla hacia el lado seguro.
 *
 * @param {string} estado Valor de `documentos.estado` devuelto por el servidor.
 * @returns {{ etiqueta: string, fondo: string, chip: string, icono: string }}
 */
export const estiloDeEstadoDocumento = (estado) => ({
  // Copia: el caller no debe poder mutar el mapa.
  ...(ESTILOS_POR_ESTADO.get(estado) ?? ESTILO_DESCONOCIDO),
})
