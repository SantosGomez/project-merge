/*
 * «Tu próxima junta» y la línea de la hora actual de «Mi Calendario» (rebanada 42).
 * Funciones puras: el «ahora» llega como parámetro para poder probarlas.
 */
import { esJuntaOcupada, miRespuestaEnJunta } from './juntas.js'

/** Solo se anuncia una junta que empieza dentro de este plazo. */
const VENTANA_SEGUNDOS = 24 * 60 * 60

/** «AAAA-MM-DD HH:mm:ss» en hora local → Date (nunca `new Date(texto)`, que puede leerse como UTC). */
const fechaHoraLocal = (texto) => {
  const [fecha = '', hora = '00:00:00'] = String(texto ?? '').split(' ')
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const [horas = 0, minutos = 0, segundos = 0] = hora.split(':').map(Number)
  return new Date(anio, mes - 1, dia, horas, minutos, segundos)
}

// Cuenta si es tuya y sigue en pie: no cancelada, no rechazada por ti, no un bloque «Ocupado» ajeno.
const cuentaParaMi = (junta, usuarioId) =>
  !esJuntaOcupada(junta) &&
  junta.estado !== 'cancelada' &&
  miRespuestaEnJunta(junta, usuarioId) !== 'rechazada'

/**
 * La junta que importa ahora: la que está en curso (la que empezó antes) o, si no hay, la que empieza
 * antes dentro de las próximas 24 h.
 * @param {Array<Object>} juntas - juntas propias (`GET /juntas`).
 * @param {Date} ahora
 * @param {number|string} usuarioId
 * @returns {{ junta: Object, enCurso: boolean, segundos: number } | null} `segundos` falta para que
 *   empiece o, si está en curso, para que termine.
 */
export const proximaJunta = (juntas, ahora, usuarioId) => {
  const momento = ahora.getTime()
  const vigentes = juntas
    .filter((junta) => cuentaParaMi(junta, usuarioId))
    .map((junta) => ({
      junta,
      inicio: fechaHoraLocal(junta.inicio).getTime(),
      fin: fechaHoraLocal(junta.fin).getTime(),
    }))

  const enCurso = vigentes
    .filter(({ inicio, fin }) => inicio <= momento && momento < fin)
    .sort((a, b) => a.inicio - b.inicio)[0]
  if (enCurso) {
    return {
      junta: enCurso.junta,
      enCurso: true,
      segundos: Math.ceil((enCurso.fin - momento) / 1000),
    }
  }

  const siguiente = vigentes
    .filter(({ inicio }) => inicio > momento && (inicio - momento) / 1000 <= VENTANA_SEGUNDOS)
    .sort((a, b) => a.inicio - b.inicio)[0]
  if (!siguiente) return null
  return {
    junta: siguiente.junta,
    enCurso: false,
    segundos: Math.ceil((siguiente.inicio - momento) / 1000),
  }
}

const dosCifras = (numero) => String(numero).padStart(2, '0')

/** Segundos → «HH:MM:SS»; lo negativo cuenta como cero. */
export const cuentaRegresiva = (segundos) => {
  const total = Math.max(0, Math.floor(segundos))
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  return `${dosCifras(horas)}:${dosCifras(minutos)}:${dosCifras(total % 60)}`
}

/**
 * Minutos desde el inicio de la vista (1 px por minuto en Semana y Día) o null fuera del horario visible.
 * @param {Date} ahora
 * @param {number} horaInicio - HORA_INICIO_VISTA.
 * @param {number} horaFin - HORA_FIN_VISTA.
 * @returns {number|null}
 */
export const minutosDesdeInicioDeVista = (ahora, horaInicio, horaFin) => {
  const minutos = ahora.getHours() * 60 + ahora.getMinutes() - horaInicio * 60
  return minutos < 0 || minutos > (horaFin - horaInicio) * 60 ? null : minutos
}
