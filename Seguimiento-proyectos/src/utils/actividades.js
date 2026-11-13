// Validaciones y orden de las listas de «Mis actividades» (clientes y tipos de actividad propios).
// Funciones puras, sin Vue ni navegador.

/** Longitudes máximas que acepta el backend. */
export const MAX_NOMBRE_CLIENTE = 150
export const MAX_NOMBRE_TIPO = 120

// RFC de empresa (12) o de persona física (13): 3-4 letras, fecha AAMMDD y homoclave de 3 caracteres.
const FORMA_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

const recortar = (valor) => (typeof valor === 'string' ? valor.trim() : '')

/**
 * RFC como lo guarda el backend: recortado y en mayúsculas; vacío queda en null.
 * @param {*} rfc - Texto escrito en el formulario.
 * @returns {string|null}
 */
export const normalizarRfc = (rfc) => recortar(rfc).toUpperCase() || null

/**
 * Valida el nombre y el RFC opcional de un cliente.
 * @param {{ nombre: string, rfc: string }} datos - Valores del formulario.
 * @returns {{ valido: boolean, errores: { nombre?: string, rfc?: string } }} Textos listos para mostrar junto al campo.
 */
export const validarDatosCliente = ({ nombre, rfc }) => {
  const errores = {}
  const nombreLimpio = recortar(nombre)
  if (nombreLimpio === '') {
    errores.nombre = 'Escribe el nombre del cliente.'
  } else if (nombreLimpio.length > MAX_NOMBRE_CLIENTE) {
    errores.nombre = `El nombre supera los ${MAX_NOMBRE_CLIENTE} caracteres. Escribe uno más corto.`
  }

  const rfcNormalizado = normalizarRfc(rfc)
  if (rfcNormalizado !== null && !FORMA_RFC.test(rfcNormalizado)) {
    errores.rfc =
      'El RFC debe tener 12 o 13 caracteres, como ABC010101XY1. Corrígelo o déjalo vacío.'
  }
  return { valido: Object.keys(errores).length === 0, errores }
}

/**
 * Valida el nombre de un tipo de actividad.
 * @param {{ nombre: string }} datos - Valores del formulario.
 * @returns {{ valido: boolean, errores: { nombre?: string } }}
 */
export const validarDatosTipo = ({ nombre }) => {
  const errores = {}
  const nombreLimpio = recortar(nombre)
  if (nombreLimpio === '') {
    errores.nombre = 'Escribe el nombre del tipo de actividad.'
  } else if (nombreLimpio.length > MAX_NOMBRE_TIPO) {
    errores.nombre = `El nombre supera los ${MAX_NOMBRE_TIPO} caracteres. Escribe uno más corto.`
  }
  return { valido: Object.keys(errores).length === 0, errores }
}

/**
 * Lista nueva con el elemento reemplazado (mismo id) o agregado, con los activos primero y cada
 * grupo por nombre sin distinguir mayúsculas ni acentos, igual que la ordena el backend.
 * @param {Array<{ id: number, nombre: string, activo: boolean }>} lista - Lista actual (no se modifica).
 * @param {{ id: number, nombre: string, activo: boolean }} elemento - Elemento guardado.
 * @returns {Array<Object>}
 */
export const mezclarEnLista = (lista, elemento) =>
  [...lista.filter((actual) => actual.id !== elemento.id), elemento].sort(
    (a, b) =>
      Number(b.activo) - Number(a.activo) ||
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) ||
      a.id - b.id,
  )

const NOMBRES_DE_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const FORMA_MES = /^(\d{4})-(0[1-9]|1[0-2])$/

const textoDeMes = (anio, mes) => `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`

/**
 * Indica si un texto es un mes con la forma AAAA-MM (mes de 01 a 12).
 * @param {*} mes - Valor a revisar.
 * @returns {boolean}
 */
export const esMesValido = (mes) => typeof mes === 'string' && FORMA_MES.test(mes)

/**
 * Mes de una fecha en hora local, como texto AAAA-MM (el mes en que se hace el trabajo).
 * @param {Date} [hoy] - Fecha de referencia; por defecto, ahora.
 * @returns {string}
 */
export const mesActual = (hoy = new Date()) => textoDeMes(hoy.getFullYear(), hoy.getMonth() + 1)

/**
 * Mes anterior a uno dado, calculado sobre el texto (sin `Date`, que desplaza días por la zona horaria).
 * @param {string} mes - Mes AAAA-MM válido.
 * @returns {string}
 */
export const mesAnterior = (mes) => {
  const [, anio, numero] = FORMA_MES.exec(mes)
  return Number(numero) === 1
    ? textoDeMes(Number(anio) - 1, 12)
    : textoDeMes(Number(anio), Number(numero) - 1)
}

/**
 * Mes siguiente a uno dado, calculado sobre el texto.
 * @param {string} mes - Mes AAAA-MM válido.
 * @returns {string}
 */
export const mesSiguiente = (mes) => {
  const [, anio, numero] = FORMA_MES.exec(mes)
  return Number(numero) === 12
    ? textoDeMes(Number(anio) + 1, 1)
    : textoDeMes(Number(anio), Number(numero) + 1)
}

/**
 * Mes escrito para mostrarlo, como «Noviembre de 2026».
 * @param {string} mes - Mes AAAA-MM válido.
 * @returns {string}
 */
export const etiquetaDeMes = (mes) => {
  const [, anio, numero] = FORMA_MES.exec(mes)
  return `${NOMBRES_DE_MES[Number(numero) - 1]} de ${anio}`
}

/**
 * Agrupa los renglones de la lista del mes por tipo, en el orden en que llegan (el backend los
 * entrega por tipo y cliente), con cuántos están hechos.
 * @param {Array<Object>} actividades - Renglones (`tipo_id`, `tipo`, `tipo_activo`, `hecha`…).
 * @returns {Array<{ tipo_id: number, tipo: string, tipo_activo: boolean, renglones: Array<Object>, hechas: number, total: number }>}
 */
export const agruparPorTipo = (actividades) => {
  const grupos = new Map()
  for (const actividad of actividades) {
    if (!grupos.has(actividad.tipo_id)) {
      grupos.set(actividad.tipo_id, {
        tipo_id: actividad.tipo_id,
        tipo: actividad.tipo,
        tipo_activo: actividad.tipo_activo,
        renglones: [],
        hechas: 0,
        total: 0,
      })
    }
    const grupo = grupos.get(actividad.tipo_id)
    grupo.renglones.push(actividad)
    grupo.total += 1
    if (actividad.hecha) grupo.hechas += 1
  }
  return [...grupos.values()]
}

/**
 * Total de renglones hechos y de renglones del mes, sumando todos los grupos.
 * @param {Array<{ hechas: number, total: number }>} grupos - Salida de `agruparPorTipo`.
 * @returns {{ hechas: number, total: number }}
 */
export const totalesDelMes = (grupos) => ({
  hechas: grupos.reduce((suma, grupo) => suma + grupo.hechas, 0),
  total: grupos.reduce((suma, grupo) => suma + grupo.total, 0),
})

/**
 * Diferencia entre la cartera cargada de un tipo y la que quedó marcada: solo eso se envía al guardar.
 * @param {Array<number>} cargados - Ids de cliente marcados al abrir.
 * @param {Array<number>} elegidos - Ids de cliente marcados al guardar.
 * @returns {{ agregar: Array<number>, quitar: Array<number> }}
 */
export const calcularCambiosDeCartera = (cargados, elegidos) => ({
  agregar: elegidos.filter((id) => !cargados.includes(id)),
  quitar: cargados.filter((id) => !elegidos.includes(id)),
})

/**
 * Por qué la lista del mes está vacía, para explicar qué falta y a dónde ir.
 * @param {{ clientes: Array<{ activo: boolean }>, tipos: Array<{ activo: boolean, total_clientes: number }> }} catalogos
 * @returns {'sin-clientes'|'sin-tipos'|'sin-cartera'|'sin-renglones'}
 */
export const diagnosticoVacio = ({ clientes, tipos }) => {
  const tiposActivos = tipos.filter((tipo) => tipo.activo)
  if (!clientes.some((cliente) => cliente.activo)) return 'sin-clientes'
  if (tiposActivos.length === 0) return 'sin-tipos'
  if (tiposActivos.every((tipo) => tipo.total_clientes === 0)) return 'sin-cartera'
  return 'sin-renglones'
}
