// Validaciones y orden de las listas de «Mis actividades» (clientes y tipos de actividad propios).
// Funciones puras, sin Vue ni navegador.

import { fechaParaFormulario } from './fechasCaso.js'
import { esCasoProximoAVencer, esCasoVencido } from './filtrosCasos.js'

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

/** Reglas de vencimiento que ofrece el formulario del tipo («Sin fecha» es la de por defecto). */
export const REGLAS_VENCIMIENTO = Object.freeze([
  { value: 'ninguna', label: 'Sin fecha' },
  { value: 'dia_del_mes', label: 'Día fijo del mes' },
  { value: 'fin_de_mes', label: 'Fin de mes' },
  { value: 'dia_17_rfc', label: 'Día 17 según el RFC del cliente' },
])

/** Último día que se puede elegir como día fijo; el último día del mes se logra con «Fin de mes». */
export const DIA_MAX_DEL_MES = 28

/**
 * Regla de vencimiento de un tipo escrita para la fila del tipo.
 * @param {{ regla_vencimiento?: string, dia_del_mes?: number|null }} tipo
 * @returns {string}
 */
export const etiquetaDeRegla = ({ regla_vencimiento: regla, dia_del_mes: dia } = {}) => {
  if (regla === 'dia_del_mes') return `Vence el día ${dia}`
  if (regla === 'fin_de_mes') return 'Vence a fin de mes'
  if (regla === 'dia_17_rfc') return 'Vence el 17 según el RFC'
  return 'Sin fecha de vencimiento'
}

/**
 * Valida el nombre de un tipo de actividad y, con la regla «Día fijo del mes», su día.
 * @param {{ nombre: string, regla_vencimiento?: string, dia_del_mes?: string|number|null }} datos - Valores del formulario.
 * @returns {{ valido: boolean, errores: { nombre?: string, dia_del_mes?: string } }}
 */
export const validarDatosTipo = ({ nombre, regla_vencimiento: regla, dia_del_mes: dia }) => {
  const errores = {}
  const nombreLimpio = recortar(nombre)
  if (nombreLimpio === '') {
    errores.nombre = 'Escribe el nombre del tipo de actividad.'
  } else if (nombreLimpio.length > MAX_NOMBRE_TIPO) {
    errores.nombre = `El nombre supera los ${MAX_NOMBRE_TIPO} caracteres. Escribe uno más corto.`
  }
  if (regla === 'dia_del_mes') {
    const numero = /^\d+$/.test(String(dia ?? '').trim()) ? Number(String(dia).trim()) : 0
    if (numero < 1 || numero > DIA_MAX_DEL_MES) {
      errores.dia_del_mes = `Escribe un día del mes de 1 a ${DIA_MAX_DEL_MES}. Para el último día del mes elige «Fin de mes».`
    }
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

// Un renglón pendiente se evalúa como un caso abierto (mismo umbral de «próximo a vencer»); uno hecho, como finalizado.
const comoCaso = (renglon) => ({
  estado: renglon.hecha ? 'finalizado' : 'pendiente',
  fecha_vencimiento: renglon.vence ?? '',
})

/**
 * Si un renglón pendiente ya venció o vence en los próximos 3 días (hoy incluido).
 * @param {{ hecha: boolean, vence: string|null }} renglon - Renglón de la lista del mes.
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {'vencida'|'pronto'|null} null si está hecho, no tiene fecha o aún falta tiempo.
 */
export const estadoDeVencimiento = (renglon, hoy) => {
  if (esCasoVencido(comoCaso(renglon), hoy)) return 'vencida'
  if (esCasoProximoAVencer(comoCaso(renglon), hoy)) return 'pronto'
  return null
}

/**
 * Cuántos renglones pendientes ya vencieron.
 * @param {Array<Object>} renglones - Renglones de la lista del mes.
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {number}
 */
export const contarVencidas = (renglones, hoy) =>
  renglones.filter((renglon) => estadoDeVencimiento(renglon, hoy) === 'vencida').length

/**
 * «Vence DD-MM-AAAA» de un renglón, o texto vacío si no tiene fecha.
 * @param {string|null} vence - Fecha AAAA-MM-DD.
 * @returns {string}
 */
export const textoDeVencimiento = (vence) => {
  const fecha = fechaParaFormulario(vence)
  return fecha ? `Vence ${fecha}` : ''
}

const ETIQUETAS_DE_ESTADO = { vencida: 'Vencida', pronto: 'Vence pronto' }

/**
 * Nombre accesible de la casilla «Hecha» de un renglón: cliente, tipo, fecha y etiqueta de alerta.
 * @param {Object} renglon - Renglón de la lista del mes (`cliente`, `tipo`, `vence`, `falta_rfc`, `hecha`).
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {string}
 */
export const nombreAccesibleDeRenglon = (renglon, hoy) => {
  const partes = [`Marcar como hecha: ${renglon.cliente}, ${renglon.tipo}.`]
  const fecha = textoDeVencimiento(renglon.vence)
  if (fecha) partes.push(`${fecha}.`)
  const estado = estadoDeVencimiento(renglon, hoy)
  if (estado) partes.push(`${ETIQUETAS_DE_ESTADO[estado]}.`)
  if (renglon.falta_rfc) partes.push('Falta el RFC del cliente.')
  return partes.join(' ')
}

/**
 * Orden de los renglones de un grupo: primero lo pendiente por fecha de vencimiento (lo vencido arriba,
 * lo que no tiene fecha al final) y luego lo hecho. Los empates conservan el orden de llegada.
 * @param {Array<Object>} renglones - Renglones de un grupo (no se modifica).
 * @returns {Array<Object>}
 */
export const ordenarPorVencimiento = (renglones) =>
  [...renglones].sort((a, b) => {
    if (a.hecha !== b.hecha) return Number(a.hecha) - Number(b.hecha)
    if (a.hecha) return 0
    if (a.vence === b.vence) return 0
    if (!a.vence) return 1
    if (!b.vence) return -1
    return a.vence < b.vence ? -1 : 1
  })

/**
 * Agrupa los renglones de la lista del mes por tipo, en el orden en que llegan (el backend los
 * entrega por tipo y cliente), con cuántos están hechos y los minutos registrados. Dentro de cada grupo los renglones van
 * ordenados por vencimiento (`ordenarPorVencimiento`).
 * @param {Array<Object>} actividades - Renglones (`tipo_id`, `tipo`, `tipo_activo`, `hecha`…).
 * @returns {Array<{ tipo_id: number, tipo: string, tipo_activo: boolean, renglones: Array<Object>, hechas: number, total: number, minutos: number }>}
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
        minutos: 0,
      })
    }
    const grupo = grupos.get(actividad.tipo_id)
    grupo.renglones.push(actividad)
    grupo.total += 1
    if (actividad.hecha) grupo.hechas += 1
    grupo.minutos += Number(actividad.minutos) || 0
  }
  return [...grupos.values()].map((grupo) => ({
    ...grupo,
    renglones: ordenarPorVencimiento(grupo.renglones),
  }))
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

// ---------- Calendario de vencimientos ----------

/**
 * AAAA-MM-DD como la pide `q-date` (AAAA/MM/DD), cambiando solo los separadores.
 * @param {string} fecha - Fecha AAAA-MM-DD.
 * @returns {string}
 */
export const fechaParaCalendario = (fecha) => fecha.replaceAll('-', '/')

/**
 * AAAA/MM/DD de `q-date` a AAAA-MM-DD, cambiando solo los separadores.
 * @param {string} fecha - Fecha AAAA/MM/DD.
 * @returns {string}
 */
export const fechaDeCalendario = (fecha) => fecha.replaceAll('/', '-')

/**
 * Renglones del calendario del mes mostrado: por su fecha de vencimiento, así que entran los del mes
 * anterior cuyo vencimiento cayó en el mes mostrado. Cada renglón lleva `mes`, el mes de la lista
 * al que pertenece (es el que se envía al marcarlo como hecho).
 * @param {string} mes - Mes mostrado AAAA-MM.
 * @param {Array<Object>} delMes - Renglones de la lista del mes mostrado.
 * @param {Array<Object>} delAnterior - Renglones de la lista del mes anterior.
 * @returns {{ conFecha: Array<Object>, sinFecha: number }} sinFecha cuenta solo los del mes mostrado.
 */
export const renglonesDelCalendario = (mes, delMes, delAnterior) => {
  const marcar = (lista, mesDeLista) => lista.map((renglon) => ({ ...renglon, mes: mesDeLista }))
  const todos = [...marcar(delMes, mes), ...marcar(delAnterior, mesAnterior(mes))]
  return {
    conFecha: todos.filter((renglon) => renglon.vence?.startsWith(`${mes}-`)),
    sinFecha: delMes.filter((renglon) => !renglon.vence).length,
  }
}

/**
 * Estado de un día del calendario según sus renglones: «vencida» si hay pendientes ya vencidas,
 * «por-vencer» si hay pendientes que aún no vencen, «hecha» si todo está hecho.
 * @param {Array<Object>} renglones - Renglones que vencen ese día.
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {'vencida'|'por-vencer'|'hecha'|null} null si el día no tiene vencimientos.
 */
export const estadoDelDia = (renglones, hoy) => {
  if (renglones.length === 0) return null
  if (renglones.some((renglon) => estadoDeVencimiento(renglon, hoy) === 'vencida')) return 'vencida'
  return renglones.some((renglon) => !renglon.hecha) ? 'por-vencer' : 'hecha'
}

/**
 * Estado de cada día que tiene vencimientos.
 * @param {Array<Object>} renglones - Renglones con fecha de vencimiento.
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {Object<string, 'vencida'|'por-vencer'|'hecha'>} Un estado por fecha AAAA-MM-DD.
 */
export const resumenDeDias = (renglones, hoy) => {
  const porDia = {}
  for (const renglon of renglones) (porDia[renglon.vence] ??= []).push(renglon)
  return Object.fromEntries(
    Object.entries(porDia).map(([dia, delDia]) => [dia, estadoDelDia(delDia, hoy)]),
  )
}

/**
 * Día de la semana (0 = domingo) de una fecha AAAA-MM-DD, con el constructor local de `Date`.
 * @param {string} fecha - Fecha AAAA-MM-DD.
 * @returns {number}
 */
const diaDeLaSemana = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return new Date(anio, mes - 1, dia).getDay()
}

/**
 * Si un día es inhábil: sábado, domingo o festivo.
 * @param {string} fecha - Fecha AAAA-MM-DD.
 * @param {Array<string>} festivos - Festivos del mes que entrega el backend (AAAA-MM-DD).
 * @returns {boolean}
 */
export const esDiaInhabil = (fecha, festivos) =>
  [0, 6].includes(diaDeLaSemana(fecha)) || festivos.includes(fecha)

const NOMBRES_DE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/**
 * Día escrito para mostrarlo, como «Viernes 13 de noviembre de 2026».
 * @param {string} fecha - Fecha AAAA-MM-DD.
 * @returns {string}
 */
export const tituloDeDia = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const nombreDeMes = NOMBRES_DE_MES[mes - 1].toLowerCase()
  return `${NOMBRES_DE_DIA[diaDeLaSemana(fecha)]} ${dia} de ${nombreDeMes} de ${anio}`
}

/**
 * Día que está elegido al abrir el calendario: hoy si es del mes mostrado; si no, el primer día
 * con vencimientos; y si no hay ninguno, el día 1.
 * @param {string} mes - Mes mostrado AAAA-MM.
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @param {Object<string, string>} dias - Salida de `resumenDeDias`.
 * @returns {string} Fecha AAAA-MM-DD.
 */
export const diaInicialDelCalendario = (mes, hoy, dias) => {
  if (hoy.startsWith(`${mes}-`)) return hoy
  return Object.keys(dias).sort()[0] ?? `${mes}-01`
}

/**
 * Aviso de cuántas actividades del mes no salen en el calendario por no tener fecha de vencimiento.
 * @param {number} cantidad - Actividades sin fecha del mes mostrado.
 * @returns {string} Texto vacío si no hay ninguna.
 */
export const textoSinFecha = (cantidad) => {
  if (cantidad === 0) return ''
  const sujeto =
    cantidad === 1
      ? '1 actividad de este mes no tiene fecha de vencimiento'
      : `${cantidad} actividades de este mes no tienen fecha de vencimiento`
  return `${sujeto} y no ${cantidad === 1 ? 'sale' : 'salen'} en el calendario. Búscala${cantidad === 1 ? '' : 's'} en la «Lista del mes».`
}

/**
 * Minutos registrados en todo el mes, sumando los grupos.
 * @param {Array<{ minutos: number }>} grupos - Salida de `agruparPorTipo`.
 * @returns {number}
 */
export const minutosDelMes = (grupos) => grupos.reduce((suma, grupo) => suma + grupo.minutos, 0)

/**
 * Duración escrita para el renglón, el grupo y el mes: «45 min», «2 h» o «1 h 20 min».
 * @param {number|null|undefined} minutos - Minutos; lo que no sea un número positivo cuenta como cero.
 * @returns {string}
 */
export const formatearDuracion = (minutos) => {
  const total = Number.isFinite(minutos) && minutos > 0 ? Math.floor(minutos) : 0
  const horas = Math.floor(total / 60)
  const resto = total % 60
  if (horas === 0) return `${resto} min`
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}

/**
 * Tiempo transcurrido del cronómetro como H:MM:SS.
 * @param {number} segundos - Segundos transcurridos.
 * @returns {string}
 */
export const formatearCronometro = (segundos) => {
  const total = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0
  const horas = Math.floor(total / 3600)
  const minutos = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const resto = String(total % 60).padStart(2, '0')
  return `${horas}:${minutos}:${resto}`
}

const FORMA_HORA_SERVIDOR = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

/**
 * Lee una hora del servidor (AAAA-MM-DD HH:mm:ss, hora local) armando la fecha con sus partes.
 * @param {*} texto - Hora recibida de la API.
 * @returns {Date|null} null si no tiene esa forma.
 */
export const parsearHoraDelServidor = (texto) => {
  const partes = typeof texto === 'string' ? FORMA_HORA_SERVIDOR.exec(texto) : null
  if (!partes) return null
  const [anio, mes, dia, horas, minutos, segundos] = partes.slice(1).map(Number)
  return new Date(anio, mes - 1, dia, horas, minutos, segundos)
}

/**
 * Segundos entre dos horas del servidor; nunca negativo y 0 si alguna no es válida.
 * @param {string} inicio - Hora de inicio.
 * @param {string} ahora - Hora actual del servidor.
 * @returns {number}
 */
export const segundosEntre = (inicio, ahora) => {
  const desde = parsearHoraDelServidor(inicio)
  const hasta = parsearHoraDelServidor(ahora)
  if (!desde || !hasta) return 0
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 1000))
}

/** Máximo de minutos que se puede agregar a mano en un solo bloque (un día completo). */
export const MINUTOS_MAX_MANUAL = 1440

/**
 * Valida los minutos de un bloque escrito a mano: entero de 1 a 1440.
 * @param {*} valor - Lo escrito en el campo (texto o número).
 * @returns {{ valido: true, minutos: number } | { valido: false, error: string }}
 */
export const validarMinutosManual = (valor) => {
  const texto = String(valor ?? '').trim()
  const minutos = /^\d+$/.test(texto) ? Number(texto) : 0
  if (minutos < 1 || minutos > MINUTOS_MAX_MANUAL) {
    return {
      valido: false,
      error: `Escribe un número entero de minutos entre 1 y ${MINUTOS_MAX_MANUAL}, por ejemplo 30.`,
    }
  }
  return { valido: true, minutos }
}
