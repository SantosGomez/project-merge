const assert = require('node:assert');
const {
  nowLocal,
  formatLocalDate,
  isSessionInactive,
} = require('../src/utils/dateUtils');

/**
 * Pruebas de utilidades de fecha y hora local (RNF-2, RF-25, RF-26).
 * Funciones síncronas; isSessionInactive recibe `hoy` inyectado para ser determinista.
 */

// nowLocal devuelve un objeto Date
function testNowLocalDevuelveDate() {
  const resultado = nowLocal();
  assert.ok(resultado instanceof Date, 'nowLocal debe devolver un objeto Date');
}

// formatLocalDate devuelve string con formato YYYY-MM-DD HH:mm:ss
function testFormatLocalDateFormato() {
  const fecha = new Date(2026, 9, 20, 14, 30, 5); // 20/10/2026 14:30:05 local
  const resultado = formatLocalDate(fecha);
  assert.strictEqual(typeof resultado, 'string', 'formatLocalDate debe devolver un string');
  // Patrón YYYY-MM-DD HH:mm:ss
  const patron = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  assert.ok(patron.test(resultado), 'el formato debe ser YYYY-MM-DD HH:mm:ss');
}

// isSessionInactive devuelve true si últimaActividad es más de 30 minutos antes de hoy
function testIsSessionInactiveInactiva() {
  const hoy = new Date();
  const ultimaActividad = new Date(hoy.getTime() - 31 * 60 * 1000); // 31 minutos antes
  assert.strictEqual(
    isSessionInactive(ultimaActividad, hoy, 30),
    true,
    'isSessionInactive debe devolver true si la inactividad supera los 30 minutos'
  );
}

// isSessionInactive devuelve false si últimaActividad es menos de 30 minutos antes de hoy
function testIsSessionInactiveActiva() {
  const hoy = new Date();
  const ultimaActividad = new Date(hoy.getTime() - 29 * 60 * 1000); // 29 minutos antes
  assert.strictEqual(
    isSessionInactive(ultimaActividad, hoy, 30),
    false,
    'isSessionInactive debe devolver false si la inactividad es menor a 30 minutos'
  );
}

module.exports = {
  testNowLocalDevuelveDate,
  testFormatLocalDateFormato,
  testIsSessionInactiveInactiva,
  testIsSessionInactiveActiva,
};
