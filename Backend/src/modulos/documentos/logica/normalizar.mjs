// Normalización de texto y RFC para búsquedas (RF-7.4).
//
// Sin imports: módulo de lógica pura del backend.

/**
 * Normaliza un texto para búsqueda: minúsculas, sin acentos (diacríticos)
 * y sin espacios adicionales a los extremos.
 *
 * @param {string} texto
 * @returns {string} Texto en minúsculas y sin acentos.
 */
export function normalizarParaBuscar(texto) {
  if (typeof texto !== 'string') return '';
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza un RFC: mayúsculas, sin guiones ni espacios.
 *
 * @param {string} rfc
 * @returns {string} RFC limpio.
 */
export function normalizarRfc(rfc) {
  if (typeof rfc !== 'string') return '';
  return rfc
    .trim()
    .toUpperCase()
    .replace(/[-\s]/g, '');
}
