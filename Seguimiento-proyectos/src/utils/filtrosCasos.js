// Filtros, orden y paginación de «Mis casos».
// Funciones puras sobre los casos internos del store: sin Vue y sin mutar lo que reciben.

/** Al entrar: casos abiertos (Pendiente + En proceso), sin filtros extra. */
export const FILTROS_INICIALES = Object.freeze({
  estado: 'abiertos',
  soloImportantes: false,
  soloVencidos: false,
})

/** Casos por página que el contador puede elegir. */
export const OPCIONES_POR_PAGINA = [10, 20, 50]

const ESTADOS_ABIERTOS = ['pendiente', 'en_proceso']

const dosDigitos = (numero) => String(numero).padStart(2, '0')

/**
 * Fecha local de hoy en AAAA-MM-DD (toISOString usaría UTC y de noche daría el día siguiente).
 * @param {Date} [ahora]
 * @returns {string}
 */
export const hoyLocal = (ahora = new Date()) =>
  `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`

// Día AAAA-MM-DD de una fecha del backend ('2026-10-26 00:00:00'); '' si no hay fecha.
const diaDe = (fecha) => (typeof fecha === 'string' ? fecha.slice(0, 10) : '')

/**
 * Un caso está vencido si su vencimiento es anterior a hoy y no está finalizado.
 * @param {Object} caso - caso interno (`estado`, `fecha_vencimiento`).
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {boolean}
 */
export const esCasoVencido = (caso, hoy) => {
  const vence = diaDe(caso.fecha_vencimiento)
  return vence !== '' && vence < hoy && caso.estado !== 'finalizado'
}

const cumpleEstado = (caso, estado) => {
  if (estado === 'todos') return true
  if (estado === 'abiertos') return ESTADOS_ABIERTOS.includes(caso.estado)
  return caso.estado === estado
}

/**
 * Filtra por estado, importantes y vencidos, y ordena por el vencimiento más cercano.
 * @param {Array<Object>} casos - casos internos del store.
 * @param {{ estado: string, soloImportantes: boolean, soloVencidos: boolean }} filtros
 *   estado: 'abiertos', 'pendiente', 'en_proceso', 'finalizado' o 'todos'.
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {Array<Object>} arreglo nuevo.
 */
export const filtrarCasos = (casos, filtros, hoy) =>
  casos
    .filter(
      (caso) =>
        cumpleEstado(caso, filtros.estado) &&
        (!filtros.soloImportantes || Boolean(caso.importante)) &&
        (!filtros.soloVencidos || esCasoVencido(caso, hoy)),
    )
    .sort(
      (a, b) =>
        diaDe(a.fecha_vencimiento).localeCompare(diaDe(b.fecha_vencimiento)) || Number(a.id) - Number(b.id),
    )

/**
 * Corta la lista en páginas. Si la página pedida ya no existe (p. ej. tras filtrar), se usa la última.
 * @param {Array} lista - elementos ya filtrados y ordenados.
 * @param {number} pagina - página pedida (desde 1).
 * @param {number} porPagina - elementos por página.
 * @returns {{ elementos: Array, pagina: number, totalPaginas: number, texto: string }}
 */
export const paginar = (lista, pagina, porPagina) => {
  const total = lista.length
  const totalPaginas = Math.ceil(total / porPagina)

  if (total === 0) {
    return { elementos: [], pagina: 1, totalPaginas: 0, texto: 'Sin casos con estos filtros' }
  }

  const paginaValida = Math.min(Math.max(1, pagina), totalPaginas)
  const inicio = (paginaValida - 1) * porPagina
  const elementos = lista.slice(inicio, inicio + porPagina)

  return {
    elementos,
    pagina: paginaValida,
    totalPaginas,
    texto: `Mostrando ${inicio + 1}–${inicio + elementos.length} de ${total} casos`,
  }
}
