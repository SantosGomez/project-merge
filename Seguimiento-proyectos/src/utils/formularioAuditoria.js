// Lógica de los formularios de auditoría y bitácora: sugerencias al escribir, fase propuesta,
// días permitidos en el calendario y a qué campo se refiere un error. Funciones puras, sin Vue.

import { fechaADominioBackend } from './fechasCaso.js'

// Tipos de procedimiento del boceto; el campo sigue aceptando texto libre (sin catálogo).
export const TIPOS_AUDITORIA = ['Revisión de Gabinete', 'Revisión Electrónica', 'Visita Domiciliaria', 'Auditoría Estatal']

// Eventos frecuentes de la bitácora con la fase en la que suelen ocurrir (null: cualquier fase).
export const EVENTOS_SUGERIDOS = [
  { evento: 'Orden de visita domiciliaria (inicio)', faseId: 1 },
  { evento: 'Oficio de inicio de revisión de gabinete', faseId: 1 },
  { evento: 'Resolución provisional (revisión electrónica)', faseId: 1 },
  { evento: 'Requerimiento adicional de información', faseId: 2 },
  { evento: 'Acta parcial', faseId: 2 },
  { evento: 'Segundo requerimiento (revisión electrónica)', faseId: 2 },
  { evento: 'Última acta parcial', faseId: 3 },
  { evento: 'Oficio de observaciones', faseId: 3 },
  { evento: 'Escrito para desvirtuar observaciones', faseId: 4 },
  { evento: 'Autocorrección (pago de contribuciones omitidas)', faseId: 4 },
  { evento: 'Solicitud de acuerdo conclusivo', faseId: 4 },
  { evento: 'Acta final', faseId: 5 },
  { evento: 'Oficio de conclusión de la revisión', faseId: 5 },
  { evento: 'Resolución determinante', faseId: 5 },
  { evento: 'Pago o garantía del crédito fiscal', faseId: 6 },
  { evento: 'Recurso de revocación interpuesto', faseId: 6 },
  { evento: 'Juicio de nulidad', faseId: 6 },
  { evento: 'Notificación de multa formal', faseId: null },
]

const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Sugerencias que contienen el texto escrito (sin mayúsculas ni acentos); sin texto, todas.
 * @param {string[]} sugerencias
 * @param {string} texto
 * @returns {string[]}
 */
export const filtrarSugerencias = (sugerencias, texto) => {
  const buscado = normalizar(texto)
  return buscado === '' ? [...sugerencias] : sugerencias.filter((s) => normalizar(s).includes(buscado))
}

/**
 * Fase en la que suele ocurrir un evento conocido; null si es texto libre o puede ser cualquiera.
 * @param {string} evento
 * @returns {number|null}
 */
export const faseSugerida = (evento) => {
  const buscado = normalizar(evento)
  return EVENTOS_SUGERIDOS.find((s) => normalizar(s.evento) === buscado)?.faseId ?? null
}

/**
 * Para `options` de q-date: permite el día si no es anterior a `desde` (DD-MM-AAAA).
 * Sin fecha de referencia válida no bloquea nada; al guardar se valida igual.
 * @param {string} dia - día del calendario en AAAA/MM/DD.
 * @param {string} desde - fecha del formulario en DD-MM-AAAA.
 * @returns {boolean}
 */
export const diaNoAnterior = (dia, desde) => {
  const referencia = fechaADominioBackend(desde)
  if (!referencia) return true
  return dia.replaceAll('/', '-') >= referencia
}

// Cómo nombran los mensajes a cada campo (backend: «… sobre X: …»; formulario: «Sobre: X.»).
const CAMPOS_POR_NOMBRE = {
  cliente: 'cliente',
  'no. de expediente': 'noExpediente',
  dependencia: 'dependencia',
  'tipo de auditoria': 'tipoAud',
  'inicio del periodo': 'periodoInicio',
  'fin del periodo': 'periodoFinal',
  'fecha de inicio': 'fechaInicio',
  'fecha de vencimiento': 'fechaVencimiento',
  descripcion: 'descripcion',
  observacion: 'observacion',
  estado: 'estado',
  contadores: 'contadores',
}

/**
 * Campo del formulario al que se refiere un mensaje de error, o null si no es de un campo.
 * @param {string} mensaje
 * @returns {string|null}
 */
export const campoConError = (mensaje) => {
  // Termina en «:», en salto de línea o en un punto que cierra la frase (seguido de mayúscula o
  // al final); así «no. de expediente» conserva su punto.
  const sobre = /[Ss]obre:?\s+(.+?)(?::|\n|\.\s+(?=[A-ZÁÉÍÓÚÑ])|\.$|$)/.exec(String(mensaje ?? ''))
  if (!sobre) return null
  const nombre = normalizar(sobre[1]).replace(/^(el|la|los|las)\s+/, '')
  return CAMPOS_POR_NOMBRE[nombre] ?? null
}
