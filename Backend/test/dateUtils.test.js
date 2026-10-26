const assert = require('node:assert');
const { describe, test } = require('node:test');
const {
  nowLocal,
  formatLocalDate,
  isSessionInactive,
  parseFechaDDMMYYYY,
  parseFechaInicio,
  formatearFechaISO,
  calcularFechaVencimiento,
  casoConFechasLocales,
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

// --- Fechas de los casos (RF-48, RNF-2): sin desplazamientos de zona horaria ---

// parseFechaDDMMYYYY interpreta el texto del formulario como hora local.
function testParseFechaDDMMYYYY() {
  const fecha = parseFechaDDMMYYYY('31-12-2026');
  assert.ok(fecha instanceof Date, 'debe devolver una fecha');
  assert.strictEqual(fecha.getFullYear(), 2026);
  assert.strictEqual(fecha.getMonth(), 11, 'diciembre es el mes 11');
  assert.strictEqual(fecha.getDate(), 31, 'no debe desplazarse al día anterior');
}

// parseFechaDDMMYYYY no inventa fechas ni acepta otros formatos.
function testParseFechaDDMMYYYYInvalida() {
  for (const texto of ['31-02-2026', '2026-12-31', '31/12/2026', '', 'basura', null, 42]) {
    assert.strictEqual(
      parseFechaDDMMYYYY(texto),
      null,
      `"${texto}" no debe interpretarse como una fecha DD-MM-AAAA`
    );
  }
}

// Una fecha ISO se lee en hora local: `new Date('2026-12-31')` daría el día 30 en GMT-6.
function testParseFechaInicioISO() {
  const fecha = parseFechaInicio('2026-12-31');
  assert.ok(fecha instanceof Date, 'debe devolver una fecha');
  assert.strictEqual(fecha.getDate(), 31, 'el día debe ser el 31, no el 30');
  assert.strictEqual(fecha.getMonth(), 11);
  assert.strictEqual(fecha.getFullYear(), 2026);

  const conHora = parseFechaInicio('2026-12-31 08:30:00');
  assert.strictEqual(conHora.getDate(), 31, 'la parte de hora no cambia el día');
}

// Texto que no es una fecha real devuelve null (nunca un Invalid Date).
function testParseFechaInicioBasura() {
  for (const texto of ['no es fecha', '2026-13-01', '', null, undefined, {}]) {
    assert.strictEqual(parseFechaInicio(texto), null, `"${texto}" no debe ser una fecha válida`);
  }
  assert.strictEqual(parseFechaInicio(new Date('invalid')), null, 'un Date inválido tampoco vale');
}

// formatearFechaISO no incluye hora ni zona horaria.
function testFormatearFechaISO() {
  assert.strictEqual(formatearFechaISO(new Date(2026, 0, 5, 23, 59, 59)), '2026-01-05');
  assert.strictEqual(formatearFechaISO(new Date('invalid')), null);
}

// El vencimiento se cuenta en días hábiles desde la fecha de inicio (31-12-2026 es jueves).
function testCalcularFechaVencimiento() {
  assert.strictEqual(calcularFechaVencimiento('31-12-2026', 'Alta'), '2027-01-07');
  assert.strictEqual(calcularFechaVencimiento('31-12-2026', 'Media'), '2027-01-14');
  assert.strictEqual(calcularFechaVencimiento('31-12-2026', 'Baja'), '2027-01-21');
  assert.strictEqual(
    calcularFechaVencimiento('2026-12-31', 'Alta'),
    '2027-01-07',
    'la fecha ISO se interpreta en hora local y da el mismo resultado'
  );
}

// Con una fecha inválida devuelve null de inmediato: el bucle no puede colgarse.
function testCalcularFechaVencimientoInvalida() {
  const inicio = Date.now();
  assert.notStrictEqual(
    calcularFechaVencimiento('31-12-2026', 'Alta'),
    null,
    'control: una fecha válida sí calcula'
  );
  assert.strictEqual(calcularFechaVencimiento('basura', 'Alta'), null);
  assert.strictEqual(calcularFechaVencimiento('', 'Media'), null);
  assert.ok(Date.now() - inicio < 1000, 'no debe quedarse iterando');
}

// El serializador compartido formatea todas las fechas del caso en hora local,
// incluidas fecha_inicio y fecha_vencimiento (que en CaseController ya lo hace
// y en CounterController debe empezar a hacerlo).
function testCasoConFechasLocalesFormateaTodasLasFechas() {
  const caso = {
    id: 7,
    cliente: 'Cliente X',
    creado_en: new Date(2026, 11, 31, 8, 30, 0),
    actualizado_en: new Date(2026, 11, 31, 9, 0, 0),
    fecha_inicio: new Date(2026, 11, 31),
    fecha_vencimiento: new Date(2027, 0, 7),
  };

  const formateado = casoConFechasLocales(caso);

  assert.strictEqual(formateado.creado_en, formatLocalDate(caso.creado_en));
  assert.strictEqual(formateado.actualizado_en, formatLocalDate(caso.actualizado_en));
  assert.strictEqual(formateado.fecha_inicio, formatLocalDate(caso.fecha_inicio));
  assert.strictEqual(formateado.fecha_vencimiento, formatLocalDate(caso.fecha_vencimiento));
  // Los demás campos se conservan tal cual.
  assert.strictEqual(formateado.id, 7);
  assert.strictEqual(formateado.cliente, 'Cliente X');
}

function testCasoConFechasLocalesFechaInicioYVencimientoNulos() {
  const caso = {
    id: 9,
    creado_en: new Date(2026, 0, 1),
    actualizado_en: new Date(2026, 0, 1),
    fecha_inicio: null,
    fecha_vencimiento: null,
  };

  const formateado = casoConFechasLocales(caso);
  assert.strictEqual(formateado.fecha_inicio, null);
  assert.strictEqual(formateado.fecha_vencimiento, null);
}

describe('dateUtils', () => {
  test('testNowLocalDevuelveDate', testNowLocalDevuelveDate);
  test('testFormatLocalDateFormato', testFormatLocalDateFormato);
  test('testIsSessionInactiveInactiva', testIsSessionInactiveInactiva);
  test('testIsSessionInactiveActiva', testIsSessionInactiveActiva);
  test('parseFechaDDMMYYYY lee la fecha como hora local', testParseFechaDDMMYYYY);
  test('parseFechaDDMMYYYY rechaza fechas imposibles y formatos ajenos', testParseFechaDDMMYYYYInvalida);
  test('parseFechaInicio no desplaza un día las fechas ISO', testParseFechaInicioISO);
  test('parseFechaInicio devuelve null con texto inválido', testParseFechaInicioBasura);
  test('formatearFechaISO devuelve solo la fecha local', testFormatearFechaISO);
  test('calcularFechaVencimiento suma días hábiles', testCalcularFechaVencimiento);
  test('calcularFechaVencimiento no se cuelga con una fecha inválida', testCalcularFechaVencimientoInvalida);
  test('casoConFechasLocales formatea todas las fechas del caso', testCasoConFechasLocalesFormateaTodasLasFechas);
  test('casoConFechasLocales fecha_inicio y fecha_vencimiento nulos', testCasoConFechasLocalesFechaInicioYVencimientoNulos);
});
