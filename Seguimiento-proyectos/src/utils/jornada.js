// Reglas de la jornada de «Mis actividades» (rebanada 15): paso que sigue, textos de horas, validación de
// las cuatro horas y plegado de la tarjeta. Funciones puras; el almacén del equipo se inyecta en pruebas.

import { formatearDuracion } from './actividades.js'

/** Los cuatro pasos del día, en orden (coinciden con las columnas de la API). */
export const PASOS = Object.freeze(['entrada', 'salida_descanso', 'regreso_descanso', 'salida'])

/** Nombre visible de cada hora del día. */
export const ETIQUETAS_DE_PASO = Object.freeze({
  entrada: 'Entrada',
  salida_descanso: 'Salida a descanso',
  regreso_descanso: 'Regreso de descanso',
  salida: 'Salida',
})

const BOTON_DE_PASO = Object.freeze({
  entrada: { etiqueta: 'Registrar entrada', icono: 'login' },
  salida_descanso: { etiqueta: 'Salir a descanso', icono: 'free_breakfast' },
  regreso_descanso: { etiqueta: 'Regresar de descanso', icono: 'work_history' },
  salida: { etiqueta: 'Registrar salida', icono: 'logout' },
})

/**
 * Paso que sigue en la jornada y el botón que lo registra.
 * @param {Object|null} jornada - Las cuatro horas de hoy, o null si no hay jornada.
 * @returns {{ paso: string, etiqueta: string, icono: string } | null} null con la salida ya registrada.
 */
export const siguientePaso = (jornada) => {
  let paso
  if (!jornada?.entrada) paso = 'entrada'
  else if (jornada.salida) return null
  else if (!jornada.salida_descanso) paso = 'salida_descanso'
  else if (!jornada.regreso_descanso) paso = 'regreso_descanso'
  else paso = 'salida'
  return { paso, ...BOTON_DE_PASO[paso] }
}

/**
 * Si desde la entrada todavía se puede registrar la salida sin tomar descanso.
 * @param {Object|null} jornada - Las cuatro horas de hoy.
 * @returns {boolean}
 */
export const puedeSalirSinDescanso = (jornada) =>
  Boolean(jornada?.entrada) && !jornada.salida_descanso && !jornada.salida

/**
 * La jornada está abierta desde la entrada hasta la salida.
 * @param {Object|null} jornada - Las cuatro horas de hoy.
 * @returns {boolean}
 */
export const jornadaAbierta = (jornada) => Boolean(jornada?.entrada) && !jornada.salida

/**
 * Compara lo trabajado con la jornada base: «Llevas 6 h 10 min de 8 h» o «1 h 15 min extra».
 * @param {{ minutos: number, baseMinutos: number, cerrada: boolean }} datos - `cerrada` si ya registró la salida.
 * @returns {{ texto: string, extra: boolean }}
 */
export const textoDeHorasTrabajadas = ({ minutos, baseMinutos, cerrada }) => {
  const base = formatearDuracion(baseMinutos)
  if (minutos > baseMinutos)
    return { texto: `${formatearDuracion(minutos - baseMinutos)} extra`, extra: true }
  if (minutos === baseMinutos) return { texto: `Completaste tus ${base}`, extra: false }
  const verbo = cerrada ? 'Trabajaste' : 'Llevas'
  return { texto: `${verbo} ${formatearDuracion(minutos)} de ${base}`, extra: false }
}

/**
 * Minutos trabajados que no están en ningún bloque de tiempo de actividades (nunca negativo).
 * @param {number} trabajados - Minutos trabajados del día.
 * @param {number} asignados - Minutos de bloques de actividades del día.
 * @returns {number}
 */
export const minutosSinAsignar = (trabajados, asignados) => Math.max(0, trabajados - asignados)

/**
 * Texto de lo asignado a actividades y lo que queda sin asignar.
 * @param {{ trabajados: number, asignados: number }} datos
 * @returns {string}
 */
export const textoDeTiempoAsignado = ({ trabajados, asignados }) =>
  `Asignado a actividades: ${formatearDuracion(asignados)} · Sin asignar: ${formatearDuracion(minutosSinAsignar(trabajados, asignados))}`

/**
 * Resumen de una línea para la tarjeta plegada.
 * @param {Object|null} jornada - Las cuatro horas de hoy.
 * @param {number} minutos - Minutos trabajados.
 * @returns {string}
 */
export const resumenDeJornada = (jornada, minutos) => {
  if (!jornada?.entrada) return 'Aún no registras tu entrada.'
  if (jornada.salida) return `Jornada cerrada: trabajaste ${formatearDuracion(minutos)}`
  if (jornada.salida_descanso && !jornada.regreso_descanso) {
    return `En descanso desde las ${jornada.salida_descanso} · llevas ${formatearDuracion(minutos)} trabajadas`
  }
  return `Entrada ${jornada.entrada} · llevas ${formatearDuracion(minutos)} trabajados`
}

const FORMA_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

const aMinutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5))

/**
 * Valida las cuatro horas de una corrección: `HH:MM` de 24 h, nada sin entrada, no hay regreso sin salida a
 * descanso y entrada ≤ salida a descanso ≤ regreso ≤ salida. Lo vacío es lo que no ocurrió.
 * @param {Object} horas - Valores del formulario (texto o vacío).
 * @returns {{ valido: boolean, errores: Object, horas: Object }} `horas` con lo vacío como null.
 */
export const validarHorasJornada = (horas) => {
  const limpias = {}
  const errores = {}
  for (const paso of PASOS) {
    const texto = String(horas?.[paso] ?? '').trim()
    limpias[paso] = texto === '' ? null : texto
    if (texto !== '' && !FORMA_HORA.test(texto)) {
      errores[paso] = 'Escribe la hora con el formato HH:MM de 24 horas, por ejemplo 09:30.'
    }
  }

  if (
    !errores.entrada &&
    limpias.entrada === null &&
    PASOS.some((paso) => limpias[paso] !== null)
  ) {
    errores.entrada = 'Falta la entrada: no puede haber otras horas sin ella.'
  }
  if (
    !errores.regreso_descanso &&
    limpias.regreso_descanso !== null &&
    limpias.salida_descanso === null
  ) {
    errores.regreso_descanso =
      'Hay regreso del descanso pero no salida a descanso. Escribe también la salida a descanso.'
  }

  let anterior = null
  for (const paso of PASOS) {
    if (limpias[paso] === null || errores[paso]) continue
    if (anterior && aMinutos(limpias[paso]) < aMinutos(limpias[anterior])) {
      errores[paso] =
        `Esta hora debe ser igual o posterior a la de ${ETIQUETAS_DE_PASO[anterior].toLowerCase()}.`
    }
    anterior = paso
  }
  return { valido: Object.keys(errores).length === 0, errores, horas: limpias }
}

/** Jornada base elegible: de 1 a 16 horas, en medias horas. */
export const OPCIONES_JORNADA_BASE = Object.freeze(
  Array.from({ length: 31 }, (_, i) => {
    const value = 60 + i * 30
    return Object.freeze({ label: formatearDuracion(value), value })
  }),
)

const rellenar = (n) => String(n).padStart(2, '0')

/**
 * Fecha local de hoy como AAAA-MM-DD, armada con sus partes (sin `new Date(texto)`).
 * @param {Date} [hoy] - Instante (inyectable en pruebas).
 * @returns {string}
 */
export const fechaDeHoy = (hoy = new Date()) =>
  `${hoy.getFullYear()}-${rellenar(hoy.getMonth() + 1)}-${rellenar(hoy.getDate())}`

const CLAVE_JORNADA_PLEGADA = 'delgrow_jornada_plegada'

const obtenerAlmacenLocal = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * Si la tarjeta «Mi jornada de hoy» quedó plegada en este equipo (por defecto, desplegada).
 * @param {Object|null} [almacen] - almacén del equipo (inyectable en pruebas).
 * @returns {boolean}
 */
export const leerJornadaPlegada = (almacen = obtenerAlmacenLocal()) => {
  try {
    return almacen?.getItem(CLAVE_JORNADA_PLEGADA) === 'true'
  } catch {
    return false
  }
}

/**
 * Guarda si la tarjeta queda plegada. Si el almacenamiento está bloqueado no se interrumpe la pantalla.
 * @param {boolean} plegada - Estado elegido.
 * @param {Object|null} [almacen] - almacén del equipo (inyectable en pruebas).
 */
export const guardarJornadaPlegada = (plegada, almacen = obtenerAlmacenLocal()) => {
  try {
    almacen?.setItem(CLAVE_JORNADA_PLEGADA, String(plegada))
  } catch {
    // La preferencia no es crítica: sin almacenamiento, la tarjeta vuelve a abrirse desplegada.
  }
}
