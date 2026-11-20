// Reglas para pasar un caso dentro del equipo del contador (rebanada 38).
// Funciones puras, sin Vue ni red.

/**
 * Equipo al que el contador puede pasar casos: él mismo y sus auxiliares.
 * Sin auxiliares no hay equipo: la acción «Pasar a…» no se ofrece.
 * @param {number|string} contadorId - id del contador autenticado.
 * @param {Array<{ id: number, nombre: string }>} [auxiliares] - sus auxiliares.
 * @returns {Array<{ id: number, nombre: string, esPropio: boolean }>}
 */
export const armarEquipoParaPasar = (contadorId, auxiliares) => {
  if (!Array.isArray(auxiliares) || auxiliares.length === 0) {
    return []
  }
  return [
    { id: Number(contadorId), nombre: '', esPropio: true },
    ...auxiliares.map((a) => ({ id: Number(a.id), nombre: a.nombre, esPropio: false })),
  ]
}

/**
 * Personas a las que se puede pasar un caso: el equipo sin el dueño actual.
 * Si el dueño no es del equipo (caso del contador al que se apoya), no hay destinos.
 * @param {Array<{ id: number }>} equipo - resultado de `armarEquipoParaPasar`.
 * @param {number|string|null} duenioId - contador_id del caso.
 * @returns {Array<{ id: number, nombre: string, esPropio: boolean }>}
 */
export const destinosParaPasar = (equipo, duenioId) => {
  if (
    duenioId === null ||
    duenioId === undefined ||
    !equipo.some((p) => p.id === Number(duenioId))
  ) {
    return []
  }
  return equipo.filter((p) => p.id !== Number(duenioId))
}

/**
 * Cómo se nombra al destino en el diálogo y en el aviso.
 * @param {{ nombre: string, esPropio: boolean }} destino
 * @returns {string}
 */
export const textoDestino = (destino) => (destino.esPropio ? 'tu lista' : destino.nombre)
