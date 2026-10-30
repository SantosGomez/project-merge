// Lógica de la lista de auditorías: conteo por semáforo, búsqueda y orden.
// Funciones puras, sin Vue; el semáforo y los días los calcula el backend desde la bitácora.

// Del más urgente al menos urgente.
export const SEMAFOROS = ['Vencido', 'Crítico', 'Atención', 'En tiempo', 'Concluida']

const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Cuántas auditorías hay en cada semáforo (todos los semáforos, con ceros).
 * @param {Array<Object>} auditorias
 * @returns {Record<string, number>}
 */
export const contarPorSemaforo = (auditorias) => {
  const conteo = Object.fromEntries(SEMAFOROS.map((semaforo) => [semaforo, 0]))
  for (const auditoria of auditorias) {
    if (auditoria.semaforo in conteo) conteo[auditoria.semaforo] += 1
  }
  return conteo
}

/**
 * Filtra por texto (cliente o expediente, sin mayúsculas ni acentos), estado y semáforo.
 * 'todos' o un valor vacío no filtra.
 * @param {Array<Object>} auditorias
 * @param {{ texto?: string, estado?: string, semaforo?: string }} filtros
 * @returns {Array<Object>}
 */
export const filtrarAuditorias = (auditorias, { texto = '', estado = 'todos', semaforo = 'todos' } = {}) => {
  const buscado = normalizar(texto)
  return auditorias.filter(
    (a) =>
      (buscado === '' || normalizar(a.cliente).includes(buscado) || normalizar(a.noExpediente).includes(buscado)) &&
      (!estado || estado === 'todos' || a.estado === estado) &&
      (!semaforo || semaforo === 'todos' || a.semaforo === semaforo),
  )
}

const posicionSemaforo = (semaforo) => {
  const posicion = SEMAFOROS.indexOf(semaforo)
  return posicion === -1 ? SEMAFOROS.length : posicion
}

const CRITERIOS = {
  // Primero el semáforo más grave; dentro de él, lo que vence antes; sin plazo, al final.
  urgencia: (a, b) =>
    posicionSemaforo(a.semaforo) - posicionSemaforo(b.semaforo) ||
    (a.diasParaVencer ?? Infinity) - (b.diasParaVencer ?? Infinity) ||
    b.id - a.id,
  recientes: (a, b) => b.id - a.id,
  cliente: (a, b) => a.cliente.localeCompare(b.cliente, 'es', { sensitivity: 'base' }) || b.id - a.id,
}

/**
 * Devuelve una copia ordenada: 'urgencia' (predeterminado), 'recientes' o 'cliente'.
 * @param {Array<Object>} auditorias
 * @param {string} criterio
 * @returns {Array<Object>}
 */
export const ordenarAuditorias = (auditorias, criterio = 'urgencia') =>
  [...auditorias].sort(CRITERIOS[criterio] ?? CRITERIOS.urgencia)
