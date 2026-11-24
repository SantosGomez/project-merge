/**
 * Etiqueta, color e icono del estado de un documento (lado cliente).
 *
 * Traduce el valor del ENUM `documentos.estado` que devuelve el servidor a lo
 * que se pinta en la tabla del Dashboard. Módulo de presentación puro: sin
 * imports de Vue ni de Quasar, para que `node --test` lo cargue sin dependencias.
 *
 * Los fondos claros ($info, $warning, $positive) exigen texto oscuro; solo
 * $negative admite texto blanco (6.41:1).
 */

const ESTILOS_POR_ESTADO = new Map([
  [
    'RECEPCIONADO',
    { etiqueta: 'Recepcionado', fondo: 'bg-info', texto: 'text-primary', icono: 'move_to_inbox' },
  ],
  [
    'EN_PROCESO',
    { etiqueta: 'En proceso', fondo: 'bg-info', texto: 'text-primary', icono: 'find_in_page' },
  ],
  [
    'PENDIENTE_CLIENTE',
    {
      etiqueta: 'Pendiente del cliente',
      fondo: 'bg-warning',
      texto: 'text-primary',
      icono: 'schedule',
    },
  ],
  [
    'COMPLETADO',
    { etiqueta: 'Completado', fondo: 'bg-positive', texto: 'text-primary', icono: 'check_circle' },
  ],
  [
    'CANCELADO',
    { etiqueta: 'Cancelado', fondo: 'bg-negative', texto: 'text-white', icono: 'cancel' },
  ],
])

/** Respaldo de cualquier valor que no sea de los cinco: neutro, gris oscuro (5.9:1). */
const ESTILO_DESCONOCIDO = {
  etiqueta: 'Estado no reconocido',
  fondo: 'bg-secondary-white-alternative',
  texto: 'text-grey-8',
  icono: 'help',
}

/**
 * Devuelve cómo se pinta el estado de un documento.
 *
 * Cualquier valor desconocido —incluidos `null`, la cadena vacía o las
 * minúsculas— cae al estilo neutro: falla hacia el lado seguro.
 *
 * @param {string} estado Valor de `documentos.estado` devuelto por el servidor.
 * @returns {{ etiqueta: string, fondo: string, texto: string, icono: string }}
 */
export const estiloDeEstadoDocumento = (estado) => ({
  // Copia: el caller no debe poder mutar el mapa.
  ...(ESTILOS_POR_ESTADO.get(estado) ?? ESTILO_DESCONOCIDO),
})
