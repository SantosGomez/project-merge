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

const faseDe = (auditoria) => auditoria.faseActual?.id ?? 1
const cerosPorFase = () => Array(TOTAL_FASES).fill(0)

/**
 * Auditorías activas (no concluidas) en cada una de las 6 fases. Sin fase cuenta en la 1.
 * @param {Array<{ faseActual: { id: number }|null, semaforo: string }>} auditorias
 * @returns {number[]} seis conteos, de la fase 1 a la 6.
 */
export const activasPorFase = (auditorias) => {
  const conteo = cerosPorFase()
  for (const auditoria of auditorias) {
    if (auditoria.semaforo !== 'Concluida') conteo[faseDe(auditoria) - 1] += 1
  }
  return conteo
}

// El tipo es texto libre: «Visita domiciliaria» y «visita Domiciliaria » son el mismo.
const claveTipo = (tipo) =>
  String(tipo ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Tabla «Activas por tipo y fase» del boceto: por tipo, activas, concluidas, total y
 * activas en cada fase; más el renglón de total. Los tipos se agrupan sin importar
 * mayúsculas, acentos ni espacios y se muestran con la primera forma escrita.
 * @param {Array<{ tipoAud: string, faseActual: { id: number }|null, semaforo: string }>} auditorias
 * @returns {{ filas: Array<Object>, total: Object }}
 */
export const tablaTipoFase = (auditorias) => {
  const conteosVacios = () => ({ activas: 0, concluidas: 0, total: 0, fases: cerosPorFase() })
  const nuevaFila = (tipo) => ({ tipo, ...conteosVacios() })
  const porTipo = new Map()
  const total = conteosVacios()

  for (const auditoria of auditorias) {
    const clave = claveTipo(auditoria.tipoAud)
    if (!porTipo.has(clave)) porTipo.set(clave, nuevaFila(String(auditoria.tipoAud ?? '').trim()))
    for (const fila of [porTipo.get(clave), total]) {
      fila.total += 1
      if (auditoria.semaforo === 'Concluida') {
        fila.concluidas += 1
      } else {
        fila.activas += 1
        fila.fases[faseDe(auditoria) - 1] += 1
      }
    }
  }

  const filas = [...porTipo.values()].sort((a, b) =>
    a.tipo.localeCompare(b.tipo, 'es', { sensitivity: 'base' }),
  )
  return { filas, total }
}
