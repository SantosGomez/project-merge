// Lógica pura del calendario del administrador: junta casos importantes, vencimientos de auditoría y
// entregas (fechas límite de la bitácora) en elementos por día. Sin Vue; las fechas son texto
// AAAA-MM-DD y nunca se leen con `new Date(texto)` (se desplazaría un día).

import { fechaADominioBackend } from './fechasCaso.js'
import { esCasoProximoAVencer, esCasoVencido } from './filtrosCasos.js'

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
