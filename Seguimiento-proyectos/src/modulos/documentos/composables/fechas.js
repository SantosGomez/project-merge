/**
 * Cálculos de fecha puros, sin imports de Vue/Quasar.
 * Compartidos entre recepción (periodo) y directorio (semáforo).
 */

/** Un valor de solo día: `AAAA-MM-DD` sin hora y sin zona horaria. */
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/
/** Un valor de solo mes: `AAAA-MM` sin hora y sin zona horaria. */
const SOLO_MES = /^\d{4}-\d{2}$/
/** Forma de periodo válida: `YYYY-MM` con mes 01-12 (igual que el servidor). */
const FORMA_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Convierte un valor de fecha a `Date` en hora local, anclando a mediodía
 * los valores de solo día o solo mes para evitar retrocesos de zona horaria.
 * @param {Date | string} valor Fecha completa (`2026-10-08T10:15:00`), de solo día
 *   (`2026-10-01`) o de solo mes (`2026-10`), que se anclan a mediodía local.
 * @returns {Date} La fecha en hora local.
 */
export const aFechaLocal = (valor) => {
  if (valor instanceof Date) return valor
  const texto = String(valor)
  if (SOLO_DIA.test(texto)) return new Date(`${texto}T12:00:00`)
  if (SOLO_MES.test(texto)) return new Date(`${texto}-01T12:00:00`)
  return new Date(texto)
}

/**
 * Valida que un valor sea una fecha real y existente.
 * - Acepta objetos `Date` válidos.
 * - Acepta cadenas en formato ISO completo (`YYYY-MM-DD`), solo día (`YYYY-MM-DD`)
 *   o solo mes (`YYYY-MM`).
 * - Exige la forma de periodo del servidor (`YYYY-MM` con mes 01-12).
 * - Rechaza días que no existen (p. ej. 30 de febrero, 31 de abril, 32 de cualquier mes).
 * - Entradas no cadenas ni `Date` (`null`, `{}`, `123`, `NaN`) devuelven `false` sin lanzar.
 * @param {unknown} valor Valor a validar.
 * @returns {boolean} `true` si es una fecha válida, `false` en caso contrario.
 */
export const esFechaValida = (valor) => {
  // Aceptar objetos Date válidos
  if (valor instanceof Date) {
    return !Number.isNaN(valor.getTime())
  }
  if (typeof valor !== 'string') return false
  const texto = valor.trim()
  if (!texto) return false

  // Validar forma de periodo (YYYY-MM con mes 01-12) para entradas AAAA-MM
  if (SOLO_MES.test(texto)) {
    return FORMA_PERIODO.test(texto)
  }

  // Para fechas completas (AAAA-MM-DD), validar que el día exista realmente
  if (SOLO_DIA.test(texto)) {
    const [, , mesStr, diaStr] = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/) || []
    if (!mesStr || !diaStr) return false
    const mes = Number(mesStr)
    const dia = Number(diaStr)
    if (mes < 1 || mes > 12) return false
    // Crear fecha y comprobar que no hubo rollover (el día construido debe coincidir)
    const fecha = new Date(`${texto}T12:00:00`)
    return fecha.getDate() === dia && fecha.getMonth() + 1 === mes
  }

  // Para otros formatos ISO (con hora, zona horaria, etc.), delegar en Date
  // pero validar que el resultado sea una fecha válida
  const fecha = new Date(texto)
  if (Number.isNaN(fecha.getTime())) return false
  // Validar que la parte de fecha tenga mes 01-12
  const mes = fecha.getMonth() + 1
  return mes >= 1 && mes <= 12
}

/**
 * Devuelve el periodo `YYYY-MM` del mes al que pertenece la fecha dada.
 * Es texto y no un `Date` a propósito: comparable con `===` y ordenable como
 * cadena, que es lo que necesita el filtrado por periodo.
 * @param {Date | string} hoy La fecha de la que se toma el mes.
 * @returns {string | null} Periodo con el formato `YYYY-MM`, o `null` si la fecha es inválida.
 */
export const periodoDe = (hoy) => {
  if (!esFechaValida(hoy)) return null
  const fecha = aFechaLocal(hoy)
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}`
}

/**
 * Los últimos `n` periodos hasta el de `hoy`, del más reciente al más antiguo,
 * con la forma que espera un `q-select` (`{ value: 'YYYY-MM', label }`).
 *
 * Se construye cada mes desde el día 1: restar meses a un día 31 con
 * `setMonth` saltaría al mes siguiente y repetiría o perdería periodos.
 * @param {Date} hoy Fecha de referencia, por parámetro para poder probarla.
 * @param {number} n Cuántos periodos devolver.
 * @returns {Array<{ value: string, label: string }>}
 */
export const ultimosPeriodos = (hoy, n) =>
  Array.from({ length: n }, (_, i) => {
    const valor = periodoDe(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1, 12))
    return { value: valor, label: formatearPeriodo(valor) }
  })

/**
 * ¿Esta fecha cae en un día que cuenta como laborable?
 *
 * Sábado y domingo no cuentan. No hay lista de días festivos: el plan no los
 * metió y esta función no los adivina. Cuando hagan falta, será otro cambio.
 *
 * @param {Date | string | unknown} fecha La fecha que se pregunta.
 * @returns {boolean} `false` en sábado o domingo, `true` en el resto.
 */
export const esDiaHabil = (fecha) => {
  // `getDay` da 0 para domingo y 6 para sábado.
  const dia = aFechaLocal(fecha).getDay()
  return dia !== 0 && dia !== 6
}

/** Formato de fecha que ya usan las cinco vistas: "8 oct 2026". */
const FORMATEADOR_FECHA = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Formato de periodo largo: "octubre de 2026" (lo usa `SeguimientoPage.vue`). */
const FORMATEADOR_PERIODO_LARGO = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  year: 'numeric',
})

/** Formato de periodo corto: "oct 2026" (lo usa `DashboardPage.vue`). */
const FORMATEADOR_PERIODO_CORTO = new Intl.DateTimeFormat('es-MX', {
  month: 'short',
  year: 'numeric',
})

/**
 * Formatea una fecha `YYYY-MM-DD` a "8 oct 2026".
 *
 * El valor se ancla a mediodía local porque `2026-10-08` a secas lo interpreta
 * el motor como UTC y en México (UTC-6) retrocede al día anterior.
 * @param {string} valor Fecha en formato `YYYY-MM-DD`.
 * @returns {string} La fecha formateada, o `'—'` si falta o es imposible.
 */
export const formatearFecha = (valor) => {
  if (!valor || typeof valor !== 'string') return '—'
  try {
    return FORMATEADOR_FECHA.format(new Date(`${valor}T12:00:00`))
  } catch {
    // `Intl.DateTimeFormat.format()` lanza `RangeError` ante una fecha inválida.
    return '—'
  }
}

/**
 * Formatea un periodo `YYYY-MM`.
 *
 * El periodo se ancla al día 1 a mediodía local, por el mismo motivo que la
 * fecha: un `AAAA-MM` a secas lo lee el motor como UTC y retrocede al mes anterior.
 * @param {string} valor Periodo en formato `YYYY-MM`.
 * @param {{ mes?: 'short' | 'long' }} [opciones] `mes` decide la forma del mes:
 *   `'long'` (por defecto) da "octubre de 2026" y `'short'` da "oct 2026".
 * @returns {string} El periodo formateado, o `'—'` si falta o es imposible.
 */
export const formatearPeriodo = (valor, opciones = {}) => {
  if (!valor || typeof valor !== 'string') return '—'
  try {
    const fecha = new Date(`${valor}-01T12:00:00`)
    const fmt = opciones.mes === 'short' ? FORMATEADOR_PERIODO_CORTO : FORMATEADOR_PERIODO_LARGO
    return fmt.format(fecha)
  } catch {
    return '—'
  }
}
