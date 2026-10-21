// Utilidades de fecha y hora local (RNF-2, RF-25, RF-26).

/**
 * Devuelve la fecha y hora actuales en la zona local del servidor.
 * @returns {Date} fecha local actual.
 */
function nowLocal() {
  return new Date();
}

// Rellena con un cero a la izquierda los números de un solo dígito.
function rellenarCero(valor) {
  return String(valor).padStart(2, '0');
}

/**
 * Formatea una fecha en hora local con formato YYYY-MM-DD HH:mm:ss (RNF-2).
 * @param {Date} fecha - fecha a formatear.
 * @returns {string} fecha en formato YYYY-MM-DD HH:mm:ss sin zona horaria.
 */
function formatLocalDate(fecha) {
  const anio = fecha.getFullYear();
  const mes = rellenarCero(fecha.getMonth() + 1);
  const dia = rellenarCero(fecha.getDate());
  const horas = rellenarCero(fecha.getHours());
  const minutos = rellenarCero(fecha.getMinutes());
  const segundos = rellenarCero(fecha.getSeconds());
  return `${anio}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
}

/**
 * Indica si una sesión está inactiva: pasó más de `limiteMinutos`
 * desde la última actividad (RF-25).
 * @param {Date} ultimaActividad - última petición válida de la sesión.
 * @param {Date} hoy - instante actual, inyectado para tests deterministas.
 * @param {number} limiteMinutos - minutos de inactividad permitidos.
 * @returns {boolean} true si la sesión está inactiva.
 */
function isSessionInactive(ultimaActividad, hoy, limiteMinutos) {
  const diferenciaMs = hoy.getTime() - ultimaActividad.getTime();
  return diferenciaMs > limiteMinutos * 60 * 1000;
}

module.exports = { nowLocal, formatLocalDate, isSessionInactive };