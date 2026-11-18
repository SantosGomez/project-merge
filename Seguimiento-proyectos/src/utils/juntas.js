// Utilidades puras del calendario de juntas: rango visible, periodo, fechas del formulario,
// respuesta de los invitados y colocación de las juntas en la cuadrícula.
// Sin Vue, sin Quasar y sin efectos secundarios. Las fechas se parten como texto o se arman con
// componentes: nunca se le pasa a `Date` el texto de una fecha ISO, porque se lee como UTC y desplaza un día.

import { fechaADominioBackend, fechaParaFormulario } from './fechasCaso.js'

export const VISTAS = Object.freeze(['mes', 'semana', 'dia'])

/** Horario laboral que muestran las vistas de semana y día (de 8:00 a 19:00). */
export const HORA_INICIO_VISTA = 8
export const HORA_FIN_VISTA = 19

/** Máximos de los textos (columnas de la tabla `juntas`) y de invitados. */
export const MAX_TITULO = 150
export const MAX_DESCRIPCION = 1000
export const MAX_INVITADOS = 50

/** Ancho (px) por debajo del cual la vista inicial es «Día». */
const ANCHO_MOVIL = 600

const MINUTOS_POR_DIA = 1440
const MINUTO_INICIO_VISTA = HORA_INICIO_VISTA * 60
const MINUTO_FIN_VISTA = HORA_FIN_VISTA * 60

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
const DIAS_DE_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const FORMA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const FORMA_FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/
const FORMA_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

const dosDigitos = (numero) => String(numero).padStart(2, '0')

/**
 * Interpreta AAAA-MM-DD como día local.
 * @param {*} texto
 * @returns {Date|null} null si no es una fecha real.
 */
export const parsearFechaISO = (texto) => {
  const partes = typeof texto === 'string' ? FORMA_ISO.exec(texto) : null
  if (!partes) return null
  const [anio, mes, dia] = partes.slice(1).map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  const existe =
    fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
  return existe ? fecha : null
}

/** Día local como AAAA-MM-DD. */
export const formatearFechaISO = (fecha) =>
  `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`

/** Hoy en hora local como AAAA-MM-DD. */
export const hoyISO = (ahora = new Date()) => formatearFechaISO(ahora)

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
const sumarDias = (iso, dias) => {
  const fecha = parsearFechaISO(iso)
  return formatearFechaISO(new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias))
}

/** Lunes de la semana de esa fecha (la semana va de lunes a domingo). */
const lunesDeLaSemana = (iso) => {
  const atrasDesdeLunes = (parsearFechaISO(iso).getDay() + 6) % 7
  return sumarDias(iso, -atrasDesdeLunes)
}

const domingoDeLaSemana = (iso) => sumarDias(lunesDeLaSemana(iso), 6)

const ultimoDiaDelMes = (anio, mes) => new Date(anio, mes, 0).getDate()

/**
 * Primer y último día que muestra la vista, ambos incluidos.
 * Mes y semana: de lunes a domingo; día: solo ese día.
 * @param {'mes'|'semana'|'dia'} vista
 * @param {string} iso - fecha de referencia AAAA-MM-DD.
 * @returns {{ desde: string, hasta: string }}
 */
export const rangoVisible = (vista, iso) => {
  if (vista === 'dia') return { desde: iso, hasta: iso }
  if (vista === 'semana') return { desde: lunesDeLaSemana(iso), hasta: domingoDeLaSemana(iso) }
  const fecha = parsearFechaISO(iso)
  const primero = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-01`
  const ultimo = `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(
    ultimoDiaDelMes(fecha.getFullYear(), fecha.getMonth() + 1),
  )}`
  return { desde: lunesDeLaSemana(primero), hasta: domingoDeLaSemana(ultimo) }
}

/**
 * Fecha de referencia del periodo anterior (-1) o siguiente (1).
 * En el mes conserva el día o, si el mes nuevo es más corto, usa su último día.
 */
export const moverPeriodo = (vista, iso, direccion) => {
  if (vista === 'dia') return sumarDias(iso, direccion)
  if (vista === 'semana') return sumarDias(iso, 7 * direccion)
  const fecha = parsearFechaISO(iso)
  const mesDestino = new Date(fecha.getFullYear(), fecha.getMonth() + direccion, 1)
  const dia = Math.min(
    fecha.getDate(),
    ultimoDiaDelMes(mesDestino.getFullYear(), mesDestino.getMonth() + 1),
  )
  return formatearFechaISO(new Date(mesDestino.getFullYear(), mesDestino.getMonth(), dia))
}

/** Título del periodo en español: «noviembre de 2026», «16 – 20 de noviembre de 2026»… */
export const textoPeriodo = (vista, iso) => {
  const fecha = parsearFechaISO(iso)
  if (vista === 'mes') return `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`
  if (vista === 'dia') {
    return `${DIAS_DE_SEMANA[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`
  }
  // La semana se muestra de lunes a viernes.
  const lunes = parsearFechaISO(lunesDeLaSemana(iso))
  const viernes = parsearFechaISO(sumarDias(lunesDeLaSemana(iso), 4))
  if (lunes.getMonth() === viernes.getMonth()) {
    return `${lunes.getDate()} – ${viernes.getDate()} de ${MESES[lunes.getMonth()]} de ${lunes.getFullYear()}`
  }
  if (lunes.getFullYear() === viernes.getFullYear()) {
    return `${lunes.getDate()} de ${MESES[lunes.getMonth()]} – ${viernes.getDate()} de ${MESES[viernes.getMonth()]} de ${viernes.getFullYear()}`
  }
  return `${lunes.getDate()} de ${MESES[lunes.getMonth()]} de ${lunes.getFullYear()} – ${viernes.getDate()} de ${MESES[viernes.getMonth()]} de ${viernes.getFullYear()}`
}

/** Vista inicial según el ancho de la pantalla: Día en celular, Semana en el resto. */
export const vistaInicial = (ancho) => (ancho < ANCHO_MOVIL ? 'dia' : 'semana')

/**
 * Vista y fecha de la URL (`?vista=semana&fecha=2026-11-18`); lo inválido o ausente se sustituye
 * por la vista según el ancho y por hoy.
 */
export const leerVistaDeUrl = (query, ancho, hoy) => ({
  vista: VISTAS.includes(query?.vista) ? query.vista : vistaInicial(ancho),
  fecha: parsearFechaISO(query?.fecha) ? query.fecha : hoy,
})

/**
 * Une la fecha del formulario (DD-MM-AAAA) y la hora (HH:mm) en el formato de la API.
 * @returns {string|null} `AAAA-MM-DD HH:mm`, o null si la fecha o la hora no son válidas.
 */
export const armarFechaHora = (fecha, hora) => {
  const dia = fechaADominioBackend(fecha)
  const horaTexto = typeof hora === 'string' ? hora.trim() : ''
  return dia && FORMA_HORA.test(horaTexto) ? `${dia} ${horaTexto}` : null
}

const ETIQUETAS_RESPUESTA = { pendiente: 'Pendiente', aceptada: 'Aceptó', rechazada: 'Rechazó' }

/** Respuesta de un invitado como texto; una desconocida se trata como pendiente. */
export const etiquetaRespuesta = (respuesta) => ETIQUETAS_RESPUESTA[respuesta] ?? 'Pendiente'

const ETIQUETAS_ESTADO = {
  confirmada: 'Confirmada',
  por_confirmar: 'Por confirmar',
  cancelada: 'Cancelada',
}

/** Estado de la junta como texto; uno desconocido se trata como confirmada. */
export const etiquetaEstadoJunta = (estado) =>
  ETIQUETAS_ESTADO[estado] ?? ETIQUETAS_ESTADO.confirmada

/**
 * Respuesta de la cuenta a la invitación de la junta.
 * @param {{ participantes: Array<{ id: number, respuesta: string }> }} junta
 * @param {number|string|null} usuarioId - cuenta de la sesión.
 * @returns {string|null} null si la cuenta organiza la junta o no está invitada.
 */
export const miRespuestaEnJunta = (junta, usuarioId) => {
  if (usuarioId === null || usuarioId === undefined) return null
  const yo = junta.participantes.find((p) => String(p.id) === String(usuarioId))
  return yo ? yo.respuesta : null
}

/**
 * Textos que acompañan a la junta en el calendario: su estado si no es «Confirmada» y «Responder»
 * si la invitaron y todavía no contesta. Siempre con texto, nunca solo con color.
 * @returns {string[]}
 */
export const marcasDeJunta = (junta, usuarioId) => {
  const marcas = []
  if (junta.estado === 'por_confirmar' || junta.estado === 'cancelada') {
    marcas.push(etiquetaEstadoJunta(junta.estado))
  }
  if (miRespuestaEnJunta(junta, usuarioId) === 'pendiente') marcas.push('Responder')
  return marcas
}

/** HH:mm de una fecha y hora de la API (`AAAA-MM-DD HH:mm:ss`). */
export const horaDeFechaHora = (texto) => {
  const partes = FORMA_FECHA_HORA.exec(String(texto ?? ''))
  return partes ? `${partes[4]}:${partes[5]}` : ''
}

/**
 * Horario de la junta con su hora real: «09:00 – 10:30», o con la fecha de cada extremo si termina
 * otro día («18-11-2026 17:00 – 19-11-2026 09:00»).
 */
export const horarioDeJunta = (junta) => {
  const mismoDia = String(junta.inicio).slice(0, 10) === String(junta.fin).slice(0, 10)
  if (mismoDia) return `${horaDeFechaHora(junta.inicio)} – ${horaDeFechaHora(junta.fin)}`
  const extremo = (texto) => `${fechaParaFormulario(texto)} ${horaDeFechaHora(texto)}`
  return `${extremo(junta.inicio)} – ${extremo(junta.fin)}`
}

// Campo del formulario por la parte «sobre X» de los mensajes del backend.
const CAMPOS_POR_NOMBRE = {
  título: 'titulo',
  descripción: 'descripcion',
  inicio: 'inicio',
  fin: 'fin',
  participantes: 'participantes',
}

/**
 * Campo del formulario al que se refiere un error del backend («… sobre X: …»), o null.
 * @param {string} mensaje
 * @returns {string|null}
 */
export const campoDeErrorJunta = (mensaje) => {
  const sobre = /\bsobre ([^:.]+):/.exec(String(mensaje ?? ''))
  return sobre ? (CAMPOS_POR_NOMBRE[sobre[1].trim().toLowerCase()] ?? null) : null
}

// Minutos transcurridos desde una medianoche fija hasta esa fecha y hora (solo para comparar).
const minutosAbsolutos = (texto) => {
  const partes = FORMA_FECHA_HORA.exec(String(texto ?? ''))
  if (!partes) return null
  const [anio, mes, dia, horas, minutos] = partes.slice(1).map(Number)
  return Date.UTC(anio, mes - 1, dia) / 60000 + horas * 60 + minutos
}

const minutosDelDia = (iso) => minutosAbsolutos(`${iso} 00:00`)

/**
 * Lo que ocupa una junta en un día de las vistas de semana y día (de 8:00 a 19:00), en minutos
 * desde la medianoche. Recorta lo que cae fuera del horario y dice de qué lado se recortó.
 * @param {{ inicio: string, fin: string }} junta
 * @param {string} iso - día AAAA-MM-DD.
 * @returns {{ desde: number, hasta: number, recortadaAntes: boolean, recortadaDespues: boolean }|null}
 */
export const segmentoDelDia = (junta, iso) => {
  const base = minutosDelDia(iso)
  const inicio = minutosAbsolutos(junta.inicio) - base
  const fin = minutosAbsolutos(junta.fin) - base
  const desde = Math.max(inicio, MINUTO_INICIO_VISTA)
  const hasta = Math.min(fin, MINUTO_FIN_VISTA)
  if (hasta <= desde) return null
  return {
    desde,
    hasta,
    recortadaAntes: inicio < MINUTO_INICIO_VISTA,
    recortadaDespues: fin > MINUTO_FIN_VISTA,
  }
}

/** Juntas que tocan ese día (a cualquier hora), por hora de inicio. Es lo que muestra el mes. */
export const juntasDelDia = (juntas, iso) => {
  const base = minutosDelDia(iso)
  return juntas
    .filter(
      (junta) =>
        minutosAbsolutos(junta.inicio) - base < MINUTOS_POR_DIA &&
        minutosAbsolutos(junta.fin) - base > 0,
    )
    .sort(
      (a, b) =>
        minutosAbsolutos(a.inicio) - minutosAbsolutos(b.inicio) ||
        minutosAbsolutos(a.fin) - minutosAbsolutos(b.fin) ||
        a.id - b.id,
    )
}

/**
 * Reparte en columnas los segmentos que se cruzan para que no se tapen entre sí.
 * @param {Array<{ desde: number, hasta: number }>} segmentos - segmentos de un día.
 * @returns {Array<Object>} los mismos segmentos con `columna` y `columnas` (las del grupo que se cruza).
 */
export const distribuirSolapadas = (segmentos) => {
  const ordenados = [...segmentos].sort((a, b) => a.desde - b.desde || b.hasta - a.hasta)
  const resultado = []
  let grupo = []
  let finDelGrupo = -1
  let finDeCadaColumna = []

  const cerrarGrupo = () => {
    for (const elemento of grupo) elemento.columnas = finDeCadaColumna.length
    resultado.push(...grupo)
    grupo = []
    finDeCadaColumna = []
  }

  for (const segmento of ordenados) {
    if (grupo.length > 0 && segmento.desde >= finDelGrupo) cerrarGrupo()
    let columna = finDeCadaColumna.findIndex((fin) => fin <= segmento.desde)
    if (columna === -1) columna = finDeCadaColumna.length
    finDeCadaColumna[columna] = segmento.hasta
    finDelGrupo = Math.max(finDelGrupo, segmento.hasta)
    grupo.push({ ...segmento, columna })
  }
  cerrarGrupo()
  return resultado
}

/**
 * Todos los errores del formulario de junta a la vez, por campo ({} si todo está bien).
 * @param {{ titulo: string, fecha: string, horaInicio: string, horaFin: string, descripcion: string, participantes: Array }} datos
 * @returns {Object<string, string>}
 */
export const validarFormularioJunta = (datos) => {
  const errores = {}
  const titulo = (datos.titulo ?? '').trim()
  if (titulo === '') errores.titulo = 'Escribe el título de la junta.'
  else if (titulo.length > MAX_TITULO) {
    errores.titulo = `El título supera los ${MAX_TITULO} caracteres permitidos.`
  }

  const fecha = (datos.fecha ?? '').trim()
  if (fecha === '') errores.fecha = 'Elige la fecha de la junta.'
  else if (!fechaADominioBackend(fecha)) errores.fecha = 'Escribe la fecha como DD-MM-AAAA.'

  const horas = {}
  for (const [campo, nombre] of [
    ['horaInicio', 'inicio'],
    ['horaFin', 'fin'],
  ]) {
    const hora = (datos[campo] ?? '').trim()
    if (hora === '') errores[campo] = `Elige la hora de ${nombre}.`
    else if (!FORMA_HORA.test(hora))
      errores[campo] = 'Escribe la hora como HH:mm, por ejemplo 09:30.'
    else horas[campo] = hora
  }
  if (horas.horaInicio && horas.horaFin && horas.horaFin <= horas.horaInicio) {
    errores.horaFin = 'La hora de fin debe ser posterior a la de inicio.'
  }

  if ((datos.descripcion ?? '').trim().length > MAX_DESCRIPCION) {
    errores.descripcion = `La descripción supera los ${MAX_DESCRIPCION} caracteres permitidos.`
  }

  const invitados = datos.participantes ?? []
  if (invitados.length === 0) errores.participantes = 'Elige al menos un invitado.'
  else if (invitados.length > MAX_INVITADOS) {
    errores.participantes = `Puedes invitar a ${MAX_INVITADOS} personas como máximo.`
  }
  return errores
}
