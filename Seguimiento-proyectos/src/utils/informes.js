// Reglas de los informes de horas de «Mis actividades» (rebanada 16): periodo, barras, horas y CSV.
// Funciones puras; la descarga recibe el documento y la API de URL para poder probarla.

import { formatearDuracion } from './actividades.js'
import { fechaADominioBackend, fechaParaFormulario } from './fechasCaso.js'

/** Máximo de días (contando el primero y el último) que acepta el informe. */
export const DIAS_MAX_DEL_PERIODO = 366

const MS_POR_DIA = 24 * 60 * 60 * 1000

const dosDigitos = (numero) => String(numero).padStart(2, '0')

/**
 * Periodo por defecto: del día 1 al último día del mes de `hoy`, en DD-MM-AAAA como lo escribe el formulario.
 * @param {Date} [hoy] - Instante (inyectable en pruebas).
 * @returns {{ desde: string, hasta: string }}
 */
export const periodoDelMes = (hoy = new Date()) => {
  const anio = hoy.getFullYear()
  const mes = hoy.getMonth() + 1
  const ultimo = new Date(anio, mes, 0).getDate()
  return {
    desde: `01-${dosDigitos(mes)}-${anio}`,
    hasta: `${dosDigitos(ultimo)}-${dosDigitos(mes)}-${anio}`,
  }
}

// Días entre dos fechas AAAA-MM-DD contando ambas (con UTC para que el cambio de horario no mueva un día).
const diasDelPeriodo = (desde, hasta) => {
  const aUtc = (iso) =>
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA) + 1
}

// Solo se acepta lo escrito como DD-MM-AAAA; fechaADominioBackend también acepta AAAA-MM-DD.
const fechaDelFormulario = (texto) =>
  /^\d{2}-\d{2}-\d{4}$/.test(String(texto ?? '').trim()) ? fechaADominioBackend(texto) : null

/**
 * Valida el periodo escrito en el formulario.
 * @param {{ desde: string, hasta: string }} datos - Fechas en DD-MM-AAAA.
 * @returns {{ valido: boolean, errores: { desde?: string, hasta?: string }, desde: string|null, hasta: string|null }}
 *   `desde` y `hasta` en AAAA-MM-DD cuando se pudieron leer.
 */
export const validarPeriodo = ({ desde, hasta }) => {
  const errores = {}
  const textoDesde = String(desde ?? '').trim()
  const textoHasta = String(hasta ?? '').trim()
  const desdeIso = fechaDelFormulario(textoDesde)
  const hastaIso = fechaDelFormulario(textoHasta)

  if (textoDesde === '') errores.desde = 'Escribe la fecha «Desde» con el formato DD-MM-AAAA.'
  else if (!desdeIso)
    errores.desde =
      'La fecha «Desde» no es válida. Usa el formato DD-MM-AAAA, por ejemplo 01-11-2026.'
  if (textoHasta === '') errores.hasta = 'Escribe la fecha «Hasta» con el formato DD-MM-AAAA.'
  else if (!hastaIso)
    errores.hasta =
      'La fecha «Hasta» no es válida. Usa el formato DD-MM-AAAA, por ejemplo 30-11-2026.'

  if (desdeIso && hastaIso) {
    if (desdeIso > hastaIso) {
      errores.hasta = 'La fecha «Hasta» debe ser igual o posterior a «Desde».'
    } else if (diasDelPeriodo(desdeIso, hastaIso) > DIAS_MAX_DEL_PERIODO) {
      errores.hasta = `El periodo no puede pasar de ${DIAS_MAX_DEL_PERIODO} días. Elige una fecha «Hasta» más cercana.`
    }
  }
  return { valido: Object.keys(errores).length === 0, errores, desde: desdeIso, hasta: hastaIso }
}

/**
 * Horas decimales con dos decimales y punto, como las espera una hoja de cálculo («1.50»).
 * @param {number|null|undefined} minutos
 * @returns {string}
 */
export const minutosAHoras = (minutos) =>
  ((Number.isFinite(minutos) && minutos > 0 ? minutos : 0) / 60).toFixed(2)

/**
 * Inicio y fin de un bloque como HH:MM; si termina otro día, el fin lleva su fecha (DD-MM-AAAA).
 * @param {{ inicio: string, fin: string }} bloque - Horas del servidor (`AAAA-MM-DD HH:mm:ss`).
 * @returns {{ inicio: string, fin: string }}
 */
export const horasDelBloque = ({ inicio, fin }) => {
  const horaFin = fin.slice(11, 16)
  return {
    inicio: inicio.slice(11, 16),
    fin:
      fin.slice(0, 10) === inicio.slice(0, 10) ? horaFin : `${fechaParaFormulario(fin)} ${horaFin}`,
  }
}

/**
 * Fracción (0 a 1) para una barra: el tiempo de la fila sobre el total del periodo.
 * @param {number} minutos - Minutos de la fila.
 * @param {number} total - Minutos del periodo.
 * @returns {number}
 */
export const proporcion = (minutos, total) => (total > 0 ? Math.min(1, minutos / total) : 0)

/**
 * Texto que acompaña a cada barra: «2 h 30 min · 45 %».
 * @param {{ minutos: number, porcentaje: number }} fila
 * @returns {string}
 */
export const textoDeBarra = ({ minutos, porcentaje }) =>
  `${formatearDuracion(minutos)} · ${porcentaje} %`

/** Bytes de marca de orden que Excel necesita para leer el CSV como UTF-8. */
export const BOM = '﻿'

/** Columnas del CSV del detalle. */
export const COLUMNAS_CSV = Object.freeze([
  'Fecha',
  'Cliente',
  'Tipo',
  'Inicio',
  'Fin',
  'Minutos',
  'Horas',
  'Cobrable',
  'A mano',
])

/**
 * Evita que Excel tome un texto como fórmula: si empieza con = + - @ (o tabulador o retorno de carro)
 * se le antepone un apóstrofo.
 * @param {*} valor - Texto del campo; lo que no sea texto se deja igual.
 * @returns {*}
 */
export const neutralizarFormula = (valor) =>
  typeof valor === 'string' && /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor

/**
 * Deja un valor listo para una celda CSV: neutraliza fórmulas y lo entrecomilla (duplicando las comillas)
 * si trae coma, comilla o salto de línea.
 * @param {*} valor
 * @returns {string}
 */
export const escaparCampoCsv = (valor) => {
  const texto = String(neutralizarFormula(valor) ?? '')
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

const siONo = (valor) => (valor ? 'Sí' : 'No')

/**
 * Arma el CSV del detalle: BOM UTF-8, separador coma y filas separadas por CRLF.
 * @param {Array<Object>} bloques - Bloques del periodo, en el orden en que se quieren.
 * @returns {string}
 */
export const armarCsv = (bloques) => {
  const filas = bloques.map((bloque) => {
    const horas = horasDelBloque(bloque)
    return [
      bloque.fecha,
      bloque.cliente,
      bloque.tipo,
      horas.inicio,
      horas.fin,
      bloque.minutos,
      minutosAHoras(bloque.minutos),
      siONo(bloque.cobrable),
      siONo(bloque.manual),
    ]
      .map(escaparCampoCsv)
      .join(',')
  })
  return `${BOM}${[COLUMNAS_CSV.join(','), ...filas].join('\r\n')}`
}

/**
 * Nombre del archivo del CSV para un periodo.
 * @param {string} desde - AAAA-MM-DD.
 * @param {string} hasta - AAAA-MM-DD.
 * @returns {string}
 */
export const nombreArchivoCsv = (desde, hasta) => `actividades_${desde}_a_${hasta}.csv`

/**
 * Descarga un CSV en el navegador con un Blob y un enlace temporal.
 * @param {string} contenido - Texto del CSV (con su BOM).
 * @param {string} nombre - Nombre del archivo.
 * @param {{ documento?: Document, urlApi?: Object }} [entorno] - Inyectable en pruebas.
 */
export const descargarCsv = (
  contenido,
  nombre,
  { documento = globalThis.document, urlApi = globalThis.URL } = {},
) => {
  const url = urlApi.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
  const enlace = documento.createElement('a')
  enlace.href = url
  enlace.download = nombre
  documento.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  urlApi.revokeObjectURL(url)
}
