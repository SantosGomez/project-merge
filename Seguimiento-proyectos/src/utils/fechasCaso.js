// Conversión de fechas de los casos entre el formulario y la API.
// El formulario usa DD-MM-AAAA; la API (y la columna DATE) usan AAAA-MM-DD.
// Funciones puras, síncronas, sin Vue y sin efectos secundarios.

const FORMATO_DDMMYYYY = /^(\d{2})-(\d{2})-(\d{4})$/
const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Comprueba que el día exista en ese mes (rechaza 31-02, 32-01...). */
const fechaReal = (anio, mes, dia) => {
  const fecha = new Date(anio, mes - 1, dia)
  return (
    fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia
  )
}

/**
 * Traduce una fecha del formulario o de la API a la forma que guarda la base (AAAA-MM-DD).
 * Acepta DD-MM-AAAA y AAAA-MM-DD; cualquier otra cosa devuelve null.
 * @param {*} fecha - texto recibido.
 * @returns {string|null} fecha en AAAA-MM-DD, o null si no es una fecha real.
 */
export const fechaADominioBackend = (fecha) => {
  if (typeof fecha !== 'string') {
    return null
  }

  const texto = fecha.trim()

  const ddmm = FORMATO_DDMMYYYY.exec(texto)
  if (ddmm) {
    const [, dia, mes, anio] = ddmm
    return fechaReal(Number(anio), Number(mes), Number(dia)) ? `${anio}-${mes}-${dia}` : null
  }

  const iso = FORMATO_ISO.exec(texto)
  if (iso) {
    const [, anio, mes, dia] = iso
    return fechaReal(Number(anio), Number(mes), Number(dia)) ? texto : null
  }

  return null
}
