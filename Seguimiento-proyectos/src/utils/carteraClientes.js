// Clave de agrupación: sin acentos, en minúsculas y con un solo espacio entre palabras.
const claveDeCliente = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Cartera de clientes de un usuario, derivada de sus propios casos (no hay catálogo aparte).
 * @param {Array<Object>} casos - casos del store (`cliente`, `estado`, `contador_id`).
 * @param {number|string} usuarioId - usuario dueño de los casos.
 * @returns {Array<{ clave: string, nombre: string, abiertos: number, finalizados: number, total: number, importante: boolean }>}
 */
export const carteraDeClientes = (casos, usuarioId) => {
  const grupos = new Map()

  for (const caso of casos ?? []) {
    if (Number(caso.contador_id) !== Number(usuarioId)) continue
    const clave = claveDeCliente(caso.cliente)
    const grupo = grupos.get(clave) ?? {
      clave,
      nombre: '',
      abiertos: 0,
      finalizados: 0,
      total: 0,
      importante: false,
      reciente: '',
    }
    grupo.total += 1
    if (caso.estado === 'finalizado') grupo.finalizados += 1
    else {
      grupo.abiertos += 1
      if (caso.importante) grupo.importante = true
    }
    const creado = String(caso.creado_en ?? '')
    if (grupo.nombre === '' || creado > grupo.reciente) {
      grupo.nombre = String(caso.cliente).trim()
      grupo.reciente = creado
    }
    grupos.set(clave, grupo)
  }

  return [...grupos.values()]
    .sort((a, b) => b.abiertos - a.abiertos || a.nombre.localeCompare(b.nombre, 'es'))
    .map(({ clave, nombre, abiertos, finalizados, total, importante }) => ({
      clave,
      nombre,
      abiertos,
      finalizados,
      total,
      importante,
    }))
}
