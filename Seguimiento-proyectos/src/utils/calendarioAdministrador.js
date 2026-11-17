// Lógica pura del calendario del administrador: junta casos importantes, vencimientos de auditoría y
// entregas (fechas límite de la bitácora) en elementos por día. Sin Vue; las fechas son texto
// AAAA-MM-DD y nunca se leen con `new Date(texto)` (se desplazaría un día).

import { fechaADominioBackend } from './fechasCaso.js'
import { esCasoProximoAVencer, esCasoVencido, hoyLocal } from './filtrosCasos.js'

const TEXTOS_DE_URGENCIA = Object.freeze({
  vencido: 'Vencido',
  pronto: 'Vence pronto',
  'a-tiempo': 'A tiempo',
})

// Más grande = más urgente; sirve para elegir la marca de un día y ordenar su lista.
const PESO_DE_URGENCIA = Object.freeze({ vencido: 3, pronto: 2, 'a-tiempo': 1 })

/**
 * Qué tan urgente es una fecha: vencida si ya pasó, «pronto» de hoy a 3 días y a tiempo después.
 * Es la misma regla que usan los casos (`esCasoVencido` y `esCasoProximoAVencer`).
 * @param {string} vence - Fecha AAAA-MM-DD.
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {'vencido'|'pronto'|'a-tiempo'}
 */
export const urgenciaDe = (vence, hoy) => {
  const pendiente = { estado: 'pendiente', fecha_vencimiento: vence }
  if (esCasoVencido(pendiente, hoy)) return 'vencido'
  if (esCasoProximoAVencer(pendiente, hoy)) return 'pronto'
  return 'a-tiempo'
}

/**
 * Texto visible de un nivel de urgencia (el color nunca es el único indicador).
 * @param {'vencido'|'pronto'|'a-tiempo'} urgencia
 * @returns {string}
 */
export const textoDeUrgencia = (urgencia) => TEXTOS_DE_URGENCIA[urgencia] ?? ''

// AAAA-MM-DD real de una fecha de la API (con o sin hora) o DD-MM-AAAA; null si no existe.
const diaReal = (fecha) =>
  typeof fecha === 'string' ? fechaADominioBackend(fecha.trim().slice(0, 10)) : null

const comoPersona = ({ id, nombre }) => ({ id, nombre })

// Un caso de un auxiliar se atribuye al contador que lo apoya y dice «de {auxiliar}».
const elementoDeCaso = (caso) => {
  const vence = diaReal(caso.fecha_vencimiento)
  if (!vence || caso.estado === 'finalizado') return null
  const deAuxiliar = caso.contador_que_apoya_id != null
  const responsable = deAuxiliar
    ? { id: caso.contador_que_apoya_id, nombre: caso.contador_que_apoya }
    : { id: caso.contador_id, nombre: caso.nombre_contador }
  return {
    clave: `caso-${caso.id}`,
    tipo: 'caso',
    id: caso.id,
    vence,
    titulo: caso.cliente,
    contadores: [comoPersona(responsable)],
    deAuxiliar: deAuxiliar ? caso.nombre_contador : null,
    caso,
  }
}

const elementoDeAuditoria = (auditoria) => {
  const vence = diaReal(auditoria.fechaVencimiento)
  if (!vence || auditoria.estado === 'Completado') return null
  return {
    clave: `auditoria-${auditoria.id}`,
    tipo: 'auditoria',
    id: auditoria.id,
    auditoriaId: auditoria.id,
    vence,
    titulo: auditoria.cliente,
    detalle: auditoria.noExpediente,
    contadores: auditoria.contadores.map(comoPersona),
    deAuxiliar: null,
  }
}

const elementoDeEntrega = (entrega) => {
  const vence = diaReal(entrega.fechaLimite)
  if (!vence) return null
  return {
    clave: `entrega-${entrega.id}`,
    tipo: 'entrega',
    id: entrega.id,
    auditoriaId: entrega.auditoriaId,
    vence,
    titulo: entrega.cliente,
    detalle: `${entrega.evento} · ${entrega.fase}`,
    contadores: entrega.contadores.map(comoPersona),
    deAuxiliar: null,
  }
}

/**
 * Elementos que se marcan en el calendario. Quedan fuera los casos finalizados, las auditorías
 * completadas y todo lo que no tenga una fecha real.
 * @param {{ casos?: Array<Object>, auditorias?: Array<Object>, entregas?: Array<Object> }} fuentes
 *   casos traducidos de `GET /contadores/casos-importantes`, auditorías de `listarAuditorias` y
 *   entregas de `listarEntregasCalendario`.
 * @returns {Array<Object>} `{ clave, tipo: 'caso'|'auditoria'|'entrega', id, vence, titulo, contadores, deAuxiliar }`.
 */
export const elementosDelCalendario = ({ casos = [], auditorias = [], entregas = [] }) =>
  [
    ...casos.map(elementoDeCaso),
    ...auditorias.map(elementoDeAuditoria),
    ...entregas.map(elementoDeEntrega),
  ].filter((elemento) => elemento !== null)

/**
 * Deja solo lo que es de un contador (una auditoría compartida cuenta para cada contador asignado).
 * @param {Array<Object>} elementos - Salida de `elementosDelCalendario`.
 * @param {number|null} contadorId - Contador elegido, o null para todos.
 * @returns {Array<Object>}
 */
export const filtrarPorContador = (elementos, contadorId) =>
  contadorId === null || contadorId === undefined
    ? elementos
    : elementos.filter((elemento) => elemento.contadores.some((c) => c.id === contadorId))

/**
 * Contadores que aparecen en los elementos, sin repetir y por nombre, para el selector del filtro.
 * @param {Array<Object>} elementos - Salida de `elementosDelCalendario`.
 * @returns {Array<{ id: number, nombre: string }>}
 */
export const opcionesDeContador = (elementos) => {
  const porId = new Map()
  for (const elemento of elementos) {
    for (const contador of elemento.contadores) porId.set(contador.id, contador)
  }
  return [...porId.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  )
}

/**
 * Marca de cada día con algo que vence: la urgencia más alta de ese día.
 * @param {Array<Object>} elementos - Salida de `elementosDelCalendario` (ya filtrada).
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {Object<string, 'vencido'|'pronto'|'a-tiempo'>} Una urgencia por fecha AAAA-MM-DD.
 */
export const marcasPorDia = (elementos, hoy) => {
  const marcas = {}
  for (const elemento of elementos) {
    const urgencia = urgenciaDe(elemento.vence, hoy)
    if (
      !marcas[elemento.vence] ||
      PESO_DE_URGENCIA[urgencia] > PESO_DE_URGENCIA[marcas[elemento.vence]]
    ) {
      marcas[elemento.vence] = urgencia
    }
  }
  return marcas
}

const GRUPOS = Object.freeze({ caso: 'casos', auditoria: 'auditorias', entrega: 'entregas' })

/**
 * Lo que vence un día, en los tres grupos de la lista, por nombre del cliente.
 * @param {Array<Object>} elementos - Salida de `elementosDelCalendario` (ya filtrada).
 * @param {string} dia - Fecha AAAA-MM-DD.
 * @returns {{ casos: Array<Object>, auditorias: Array<Object>, entregas: Array<Object> }}
 */
export const agruparDelDia = (elementos, dia) => {
  const grupos = { casos: [], auditorias: [], entregas: [] }
  for (const elemento of elementos) {
    if (elemento.vence === dia) grupos[GRUPOS[elemento.tipo]].push(elemento)
  }
  for (const lista of Object.values(grupos)) {
    lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }))
  }
  return grupos
}

// ---- Rebanada 19: franja «Requiere atención», modo día/rango, estado en la URL y tira de la semana ----

/** Días después de hoy que cuenta «Esta semana» (hoy incluido). */
const DIAS_DE_LA_SEMANA = 7

/** Rangos que abre cada cifra de la franja. */
export const RANGOS = Object.freeze(['vencidos', 'hoy', 'semana', 'entregas'])

const TITULOS_DE_RANGO = Object.freeze({
  vencidos: 'Lo vencido hasta hoy',
  hoy: 'Lo que vence hoy',
  semana: 'Lo que vence en los próximos 7 días',
  entregas: 'Entregas de auditoría de los próximos 7 días',
})

/**
 * Título del modo rango (lo que abre una cifra de la franja).
 * @param {'vencidos'|'hoy'|'semana'|'entregas'} rango
 * @returns {string}
 */
export const tituloDeRango = (rango) => TITULOS_DE_RANGO[rango] ?? ''

// Fecha AAAA-MM-DD sumando días con calendario local (nunca `new Date('AAAA-MM-DD')`).
const sumarDias = (fecha, dias) => {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return hoyLocal(new Date(anio, mes - 1, dia + dias))
}

const ENTRE_HOY_Y_SEMANA = (vence, hoy) =>
  vence >= hoy && vence <= sumarDias(hoy, DIAS_DE_LA_SEMANA)

const FILTROS_DE_RANGO = Object.freeze({
  vencidos: (elemento, hoy) => elemento.vence < hoy,
  hoy: (elemento, hoy) => elemento.vence === hoy,
  semana: (elemento, hoy) => ENTRE_HOY_Y_SEMANA(elemento.vence, hoy),
  entregas: (elemento, hoy) =>
    elemento.tipo === 'entrega' && ENTRE_HOY_Y_SEMANA(elemento.vence, hoy),
})

/**
 * Elementos de un rango de la franja, por fecha y luego por cliente.
 * @param {Array<Object>} elementos - Salida de `elementosDelCalendario` (ya filtrada).
 * @param {'vencidos'|'hoy'|'semana'|'entregas'} rango
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {Array<Object>}
 */
export const elementosDeRango = (elementos, rango, hoy) =>
  elementos
    .filter((elemento) => FILTROS_DE_RANGO[rango](elemento, hoy))
    .sort(
      (a, b) =>
        a.vence.localeCompare(b.vence) ||
        a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' }),
    )

/**
 * Las cuatro cifras de la franja «Requiere atención»; cada una cuenta lo mismo que lista su rango.
 * @param {Array<Object>} elementos - Salida de `elementosDelCalendario` (ya filtrada).
 * @param {string} hoy - Fecha local de hoy en AAAA-MM-DD.
 * @returns {{ vencidos: number, hoy: number, semana: number, entregas: number }}
 */
export const cifrasDeAtencion = (elementos, hoy) =>
  Object.fromEntries(RANGOS.map((rango) => [rango, elementosDeRango(elementos, rango, hoy).length]))

/**
 * Reparte elementos en las pestañas del modo día: Casos y Auditorías (vencimientos y entregas
 * en dos subgrupos). Conserva el orden recibido.
 * @param {Array<Object>} elementos
 * @returns {{ casos: Array<Object>, vencimientos: Array<Object>, entregas: Array<Object>, auditorias: Array<Object> }}
 */
export const agruparPorPestana = (elementos) => {
  const casos = elementos.filter((e) => e.tipo === 'caso')
  const vencimientos = elementos.filter((e) => e.tipo === 'auditoria')
  const entregas = elementos.filter((e) => e.tipo === 'entrega')
  return { casos, vencimientos, entregas, auditorias: [...vencimientos, ...entregas] }
}

/**
 * Pestaña que se abre en el modo día: la preferida, salvo que esté vacía y la otra no.
 * @param {{ casos: Array<Object>, auditorias: Array<Object> }} grupos - Salida de `agruparPorPestana`.
 * @param {'casos'|'auditorias'} preferida
 * @returns {'casos'|'auditorias'}
 */
export const pestanaDelDia = (grupos, preferida) => {
  const otra = preferida === 'casos' ? 'auditorias' : 'casos'
  return grupos[preferida].length === 0 && grupos[otra].length > 0 ? otra : preferida
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const partesDeDia = (dia) => {
  const [, mes, numero] = dia.split('-').map(Number)
  return { mes: MESES[mes - 1], numero }
}

/** «Lo que vence el 12 de noviembre». */
export const encabezadoDeDia = (dia) => {
  const { mes, numero } = partesDeDia(dia)
  return `Lo que vence el ${numero} de ${mes}`
}

/** «12 nov», para el chip que regresa a la vista general. */
export const etiquetaCortaDeDia = (dia) => {
  const { mes, numero } = partesDeDia(dia)
  return `${numero} ${mes.slice(0, 3)}`
}

/**
 * Vista elegida según `?dia` y `?rango`. Un valor inválido o repetido se ignora (vista general);
 * si vienen los dos, gana el día.
 * @param {Object} consulta - `route.query`.
 * @returns {{ dia: string|null, rango: string|null }}
 */
export const leerVista = (consulta) => {
  const dia = typeof consulta.dia === 'string' ? fechaADominioBackend(consulta.dia) : null
  if (dia) return { dia, rango: null }
  const rango = RANGOS.includes(consulta.rango) ? consulta.rango : null
  return { dia: null, rango }
}

/**
 * Consulta de la URL con la vista elegida, sin perder `tab` ni lo demás.
 * @param {Object} consulta - `route.query` actual.
 * @param {{ dia?: string, rango?: string }|null} vista - null vuelve a la vista general.
 * @returns {Object}
 */
export const consultaConVista = (consulta, vista) => {
  const resto = { ...consulta }
  delete resto.dia
  delete resto.rango
  return {
    ...resto,
    ...(vista?.dia ? { dia: vista.dia } : {}),
    ...(vista?.rango ? { rango: vista.rango } : {}),
  }
}

/**
 * Días de la tira de la semana: la semana anterior, la del día elegido y la siguiente
 * (21 días, de lunes a domingo).
 * @param {string} dia - Fecha AAAA-MM-DD elegida.
 * @returns {Array<string>}
 */
export const diasDeTira = (dia) => {
  const [anio, mes, numero] = dia.split('-').map(Number)
  const desdeElLunes = (new Date(anio, mes - 1, numero).getDay() + 6) % 7
  const inicio = sumarDias(dia, -desdeElLunes - 7)
  return Array.from({ length: 21 }, (_, i) => sumarDias(inicio, i))
}

/** Ayuda del dashboard mientras se ve un día o un grupo. */
export const TEXTO_AYUDA_MODO_DIA =
  'Para volver a la vista general, quita la fecha elegida o pulsa la tecla Esc.'

/** «12 de noviembre», para el resumen que lee el lector de pantalla. */
export const etiquetaLargaDeDia = (dia) => {
  const { mes, numero } = partesDeDia(dia)
  return `${numero} de ${mes}`
}

const cuantos = (cantidad, singular, plural) =>
  cantidad === 1 ? `1 ${singular}` : `${cantidad} ${plural}`

/**
 * Línea corta para anunciar el cambio de vista: «12 de noviembre: 1 caso y 2 auditorías».
 * Las entregas cuentan como auditorías.
 * @param {string} etiqueta - Día o grupo elegido.
 * @param {Array<Object>} elementos - Lo que se muestra.
 * @returns {string}
 */
export const resumenParaLector = (etiqueta, elementos) => {
  const casos = elementos.filter((e) => e.tipo === 'caso').length
  const auditorias = elementos.length - casos
  const partes = [
    ...(casos > 0 ? [cuantos(casos, 'caso', 'casos')] : []),
    ...(auditorias > 0 ? [cuantos(auditorias, 'auditoría', 'auditorías')] : []),
  ]
  return `${etiqueta}: ${partes.length > 0 ? partes.join(' y ') : 'nada que mostrar'}`
}
