/**
 * Lógica pura de Direccionamiento para mostrar «Por entregar» y «Entregados» en una sola tabla
 * (sin Vue ni Quasar).
 */

/**
 * Une los pendientes y los entregados: primero los por entregar (en su orden) y luego los
 * entregados, el más reciente primero. Cada fila lleva `situacion`; no se mutan las originales.
 */
export const combinarFilas = (pendientes, entregados) => [
  ...pendientes.map((f) => ({ ...f, situacion: 'por-entregar' })),
  ...[...entregados]
    .sort((a, b) => String(b.fechaEntrega).localeCompare(String(a.fechaEntrega)))
    .map((f) => ({ ...f, situacion: 'entregado' })),
]

/** Filtra por cliente, contador y texto (folio o cliente, sin distinguir mayúsculas). */
export const filtrarFilas = (filas, { texto = '', cliente = null, contador = null } = {}) => {
  const q = String(texto ?? '')
    .trim()
    .toLowerCase()
  return filas.filter(
    (f) =>
      (!cliente || f.cliente === cliente) &&
      (!contador || f.contador === contador) &&
      (!q || f.folio.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q)),
  )
}
