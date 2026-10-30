// Lógica del tablero de auditorías del dashboard del administrador (hoja «Dashboard» del boceto).
// Funciones puras, sin Vue; el semáforo, la fase y los días los calcula el backend desde la bitácora.

export const TOTAL_FASES = 6

/**
 * Indicadores del encabezado del tablero: activas (todo lo que no está concluido) y
 * cuántas hay en cada semáforo urgente.
 * @param {Array<{ semaforo: string }>} auditorias
 * @returns {{ activas: number, vencidas: number, criticas: number, atencion: number }}
 */
export const indicadoresAuditorias = (auditorias) => {
  const contar = (semaforo) => auditorias.filter((a) => a.semaforo === semaforo).length
  return {
    activas: auditorias.filter((a) => a.semaforo !== 'Concluida').length,
    vencidas: contar('Vencido'),
    criticas: contar('Crítico'),
    atencion: contar('Atención'),
  }
}

/**
 * Marca de cada una de las 6 fases para la vista «tipo historia»: 'cumplida' antes de la
 * fase actual, 'actual' en ella y 'pendiente' después. Si la auditoría está concluida, la
 * fase en la que terminó también cuenta como cumplida. Sin fase, la actual es la 1.
 * @param {number|null} faseActual
 * @param {string} semaforo
 * @returns {Array<'cumplida'|'actual'|'pendiente'>}
 */
export const marcasDeFases = (faseActual, semaforo) => {
  const actual = faseActual ?? 1
  return Array.from({ length: TOTAL_FASES }, (_, i) => {
    const numero = i + 1
    if (numero < actual) return 'cumplida'
    if (numero === actual) return semaforo === 'Concluida' ? 'cumplida' : 'actual'
    return 'pendiente'
  })
}

/**
 * Días para el próximo vencimiento en palabras, sin números negativos.
 * @param {number|null} dias
 * @returns {string}
 */
export const textoDiasPlazo = (dias) => {
  if (dias === null || dias === undefined) return '—'
  if (dias === 0) return 'vence hoy'
  const cuantos = Math.abs(dias)
  const unidad = cuantos === 1 ? 'día' : 'días'
  return dias < 0 ? `venció hace ${cuantos} ${unidad}` : `en ${cuantos} ${unidad}`
}
