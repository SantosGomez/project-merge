// Semáforo de auditorías en un solo lugar: clase CSS, textos de ayuda y días en palabras.
// Los colores viven en src/css/app.scss (.semaforo--<clase>); el semáforo lo calcula el backend.

const CLASE_SEMAFORO = {
  Vencido: 'vencido',
  Crítico: 'critico',
  Atención: 'atencion',
  'En tiempo': 'en-tiempo',
  Concluida: 'concluida',
}

/** Texto del semáforo en pantalla: el backend manda «Atención», la app lo nombra «En atención» (PRODUCT.md). */
export const etiquetaSemaforo = (semaforo) => (semaforo === 'Atención' ? 'En atención' : semaforo)

/**
 * Clase CSS del semáforo, para usar como `semaforo--<clase>`. Uno desconocido cuenta como «En tiempo».
 * @param {string} semaforo
 * @returns {string}
 */
export const claseSemaforo = (semaforo) => CLASE_SEMAFORO[semaforo] ?? 'en-tiempo'

/** Qué significa cada semáforo (tooltips). */
export const AYUDA_SEMAFORO = {
  Vencido: 'Un plazo pendiente de la bitácora ya pasó.',
  Crítico: 'Un plazo pendiente vence en 7 días o menos.',
  Atención:
    'Un plazo de la bitácora vence en 20 días o menos, o faltan 60 días o menos para la fecha de vencimiento de la auditoría.',
  'En tiempo': 'Sin vencimientos cercanos.',
  Concluida: 'Auditorías con estado Completado.',
}

/** Estado de la auditoría en pantalla: el backend guarda «En Proceso»; se muestra como en casos. */
export const etiquetaEstado = (estado) => (estado === 'En Proceso' ? 'En proceso' : estado)

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
