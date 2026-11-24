// Pruebas del módulo de cálculos de fecha puros (fechas.js).
// Se ejecutan con `node --test` desde `Frontend/`, sin dependencias: el módulo
// es JavaScript puro y no importa Vue ni Quasar.
//
// Zona horaria: la máquina de desarrollo está en America/Matamoros
// (GMT-6 en enero, GMT-5 en julio), donde se ve la trampa. Un valor de solo día
// como `2026-10-01` lo interpreta el motor como **UTC**, así que sin anclarlo a
// mediodía local retrocede al 30 de septiembre. `AAAA-MM` también es una forma
// ISO de solo fecha y el motor la lee como UTC: retrocede al mes anterior. Las
// pruebas fijan fechas de **primer día de mes** y valores `AAAA-MM` a propósito:
// son las que detectan el retroceso **al oeste de UTC** (en `UTC`,
// `Europe/Madrid`, `Asia/Tokyo`, `Pacific/Kiritimati` y `Pacific/Auckland`
// pasarían en verde sin anclaje; la ejecución con `TZ` al este de UTC se
// verifica fuera de este archivo).

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { aFechaLocal, periodoDe, esDiaHabil, ultimosPeriodos } from './fechas.js'

// --- Pruebas para aFechaLocal ---

test('aFechaLocal: Date se devuelve tal cual', () => {
  const d = new Date(2026, 9, 15, 10, 30)
  assert.strictEqual(aFechaLocal(d), d)
})

test('aFechaLocal: valor de solo día AAAA-MM-DD se ancla a mediodía local', () => {
  const fecha = aFechaLocal('2026-10-01')
  assert.ok(fecha instanceof Date)
  assert.equal(fecha.getFullYear(), 2026)
  assert.equal(fecha.getMonth(), 9) // octubre = mes 9 (0-indexado)
  assert.equal(fecha.getDate(), 1)
  assert.equal(fecha.getHours(), 12)
  assert.equal(fecha.getMinutes(), 0)
  assert.equal(fecha.getSeconds(), 0)
  assert.equal(fecha.getMilliseconds(), 0)
})

test('aFechaLocal: valor de solo mes AAAA-MM se ancla a su día 1 a mediodía local', () => {
  const fecha = aFechaLocal('2026-10')
  assert.ok(fecha instanceof Date)
  assert.equal(fecha.getFullYear(), 2026)
  assert.equal(fecha.getMonth(), 9)
  assert.equal(fecha.getDate(), 1)
  assert.equal(fecha.getHours(), 12)
})

test('aFechaLocal: ISO con hora se parsea como Date normal', () => {
  const fecha = aFechaLocal('2026-10-08T10:15:00')
  assert.ok(fecha instanceof Date)
  assert.equal(fecha.getFullYear(), 2026)
  assert.equal(fecha.getMonth(), 9)
  assert.equal(fecha.getDate(), 8)
  assert.equal(fecha.getHours(), 10)
  assert.equal(fecha.getMinutes(), 15)
})

// --- Pruebas para periodoDe ---

test('periodoDe devuelve el mes al que pertenece hoy', () => {
  assert.equal(periodoDe('2026-10-14T09:30:00'), '2026-10')
})

test('periodoDe acepta un Date completo y devuelve ese mes', () => {
  assert.equal(periodoDe(new Date(2026, 0, 15, 8, 0)), '2026-01')
})

test('periodoDe devuelve el formato YYYY-MM con el mes en dos dígitos', () => {
  assert.match(periodoDe('2026-03-09T23:00:00'), /^\d{4}-\d{2}$/)
  // Un mes de un solo dígito tiene que salir con cero a la izquierda.
  assert.equal(periodoDe('2026-03-31T23:00:00'), '2026-03')
})

test('periodoDe con el primer día de mes cae en el mes correcto', () => {
  assert.equal(periodoDe('2026-10-01'), '2026-10')
  // En UTC retrocede al año anterior entero: la prueba más dura de la trampa.
  assert.equal(periodoDe('2026-01-01'), '2026-01')
})

test('periodoDe acepta el periodo AAAA-MM y devuelve ese mismo mes', () => {
  // `AAAA-MM` es también una forma ISO de solo fecha y el motor la lee como UTC:
  // sin anclarla a su día 1 a mediodía, el periodo retrocede un mes entero.
  assert.equal(periodoDe('2026-10'), '2026-10')
  assert.equal(periodoDe('2026-11'), '2026-11')
})

test('el periodo AAAA-MM y el mismo periodo con día dan la misma cadena', () => {
  // Las dos formas tienen que ser intercambiables, porque el selector entrega
  // `AAAA-MM` y las fechas de recepción traen `AAAA-MM-DD`: filtrar con una y
  // pintar con la otra no puede dar dos periodos distintos para el mismo mes.
  assert.equal(periodoDe('2026-10'), periodoDe('2026-10-01'))
  assert.equal(periodoDe('2026-11'), periodoDe('2026-11-01'))
  // Un mes de un solo dígito también, que es la otra forma de equivocarse.
  assert.equal(periodoDe('2026-03'), '2026-03')
})

test('periodoDe devuelve null con entradas inválidas', () => {
  const entradasInvalidas = [
    'basura',
    '',
    null,
    {},
    '2026-13-01', // mes inexistente
    '2026-10-32', // día inexistente
    '2026-02-30', // 30 de febrero (rollover silencioso a 2 de marzo)
  ]

  for (const entrada of entradasInvalidas) {
    assert.equal(periodoDe(entrada), null, `periodoDe(${JSON.stringify(entrada)}) debe ser null`)
  }
})

// --- Pruebas para esDiaHabil ---

test('esDiaHabil devuelve false en sábado', () => {
  // 2026-10-10 es sábado
  assert.equal(esDiaHabil('2026-10-10'), false)
  assert.equal(esDiaHabil(new Date(2026, 9, 10)), false)
})

test('esDiaHabil devuelve false en domingo', () => {
  // 2026-10-11 es domingo
  assert.equal(esDiaHabil('2026-10-11'), false)
  assert.equal(esDiaHabil(new Date(2026, 9, 11)), false)
})

test('esDiaHabil devuelve true en día laborable (lunes a viernes)', () => {
  // 2026-10-12 es lunes
  assert.equal(esDiaHabil('2026-10-12'), true)
  // 2026-10-13 es martes
  assert.equal(esDiaHabil('2026-10-13'), true)
  // 2026-10-14 es miércoles
  assert.equal(esDiaHabil('2026-10-14'), true)
  // 2026-10-15 es jueves
  assert.equal(esDiaHabil('2026-10-15'), true)
  // 2026-10-16 es viernes
  assert.equal(esDiaHabil('2026-10-16'), true)
})

test('esDiaHabil acepta Date y cadena ISO completa', () => {
  assert.equal(esDiaHabil(new Date(2026, 9, 12, 10, 30)), true) // lunes con hora
  assert.equal(esDiaHabil('2026-10-12T10:30:00'), true)
})

// --- Pruebas para ultimosPeriodos (selector de periodo del Dashboard) ---

// El 31 es a propósito: restar meses a un día 31 con `setMonth` salta de mes
// (31 de noviembre → 1 de diciembre) y repetiría o perdería periodos.
test('ultimosPeriodos: del más reciente al más antiguo, cruzando de enero a diciembre', () => {
  assert.deepEqual(ultimosPeriodos(new Date(2026, 0, 31, 10, 0), 3), [
    { value: '2026-01', label: 'enero de 2026' },
    { value: '2025-12', label: 'diciembre de 2025' },
    { value: '2025-11', label: 'noviembre de 2025' },
  ])
})

test('ultimosPeriodos: devuelve exactamente n periodos, sin repetir', () => {
  const periodos = ultimosPeriodos(new Date(2026, 9, 31, 10, 0), 12).map((p) => p.value)
  assert.equal(periodos.length, 12)
  assert.equal(new Set(periodos).size, 12)
  assert.equal(periodos[0], '2026-10')
  assert.equal(periodos[11], '2025-11')
})
