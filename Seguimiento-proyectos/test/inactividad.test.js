// Pruebas de la caducidad por inactividad (RF-07).
// `hoy` se inyecta como Date para que las pruebas sean deterministas y no dependan del reloj real.

import test from 'node:test'
import assert from 'node:assert/strict'

import { calcularMinutosInactividad, estaInactivo } from '../src/utils/inactividad.js'

// Fechas en hora local: mes 9 = octubre, para no depender de la zona horaria al comparar.
const fecha = (hora, minuto, segundo = 0, milisegundo = 0) =>
  new Date(2026, 9, 22, hora, minuto, segundo, milisegundo)

// Límite de inactividad de la spec: 30 minutos (RF-07).
const LIMITE_MINUTOS = 30

test('calcularMinutosInactividad devuelve 0 cuando no ha pasado tiempo', () => {
  const ultimaActividad = fecha(10, 0)

  assert.equal(calcularMinutosInactividad(ultimaActividad, fecha(10, 0)), 0)
  assert.equal(
    calcularMinutosInactividad(ultimaActividad, fecha(10, 0, 0, 500)),
    0,
    'medio segundo no completa un minuto',
  )
})

test('calcularMinutosInactividad redondea hacia abajo los segundos sueltos', () => {
  const ultimaActividad = fecha(10, 0)

  assert.equal(calcularMinutosInactividad(ultimaActividad, fecha(10, 0, 59)), 0)
  assert.equal(calcularMinutosInactividad(ultimaActividad, fecha(10, 1, 0)), 1)
  assert.equal(
    calcularMinutosInactividad(ultimaActividad, fecha(10, 30, 59)),
    30,
    '30 minutos y 59 segundos son 30 minutos completos',
  )
})

test('calcularMinutosInactividad cuenta los minutos completos entre fechas con segundos', () => {
  const ultimaActividad = fecha(8, 15, 45)

  assert.equal(calcularMinutosInactividad(ultimaActividad, fecha(8, 45, 44)), 29)
  assert.equal(calcularMinutosInactividad(ultimaActividad, fecha(8, 45, 45)), 30)
  assert.equal(calcularMinutosInactividad(ultimaActividad, fecha(9, 30, 0)), 74)
})

test('calcularMinutosInactividad funciona al cruzar la medianoche', () => {
  const ultimaActividad = new Date(2026, 9, 22, 23, 50, 0)

  assert.equal(
    calcularMinutosInactividad(ultimaActividad, new Date(2026, 9, 23, 0, 20, 0)),
    30,
    'de 23:50 a 00:20 del día siguiente hay 30 minutos (RF-07)',
  )
  assert.equal(
    calcularMinutosInactividad(ultimaActividad, new Date(2026, 9, 23, 0, 21, 0)),
    31,
    'un minuto más supera el límite (RF-07)',
  )
})

test('estaInactivo no marca inactividad antes del límite de 30 minutos', () => {
  const ultimaActividad = fecha(10, 0)

  for (const [hora, minuto] of [[10, 0], [10, 15], [10, 29]]) {
    assert.equal(
      estaInactivo(ultimaActividad, fecha(hora, minuto), LIMITE_MINUTOS),
      false,
      `a las ${hora}:${minuto} todavía no hay inactividad`,
    )
  }
})

test('estaInactivo no marca inactividad exactamente en el límite de 30 minutos', () => {
  const ultimaActividad = fecha(10, 0)

  assert.equal(
    estaInactivo(ultimaActividad, fecha(10, 30), LIMITE_MINUTOS),
    false,
    'exactamente 30 minutos no supera el límite',
  )
  assert.equal(
    estaInactivo(ultimaActividad, fecha(10, 30, 59), LIMITE_MINUTOS),
    false,
    '30 minutos y 59 segundos siguen siendo 30 minutos completos',
  )
})

test('estaInactivo marca inactividad a partir de 31 minutos', () => {
  const ultimaActividad = fecha(10, 0)

  assert.equal(estaInactivo(ultimaActividad, fecha(10, 31), LIMITE_MINUTOS), true)
  assert.equal(estaInactivo(ultimaActividad, fecha(10, 31, 1), LIMITE_MINUTOS), true)
  assert.equal(estaInactivo(ultimaActividad, fecha(12, 0), LIMITE_MINUTOS), true)
})

test('estaInactivo respeta otro límite recibido por parámetro', () => {
  const ultimaActividad = fecha(10, 0)

  assert.equal(
    estaInactivo(ultimaActividad, fecha(11, 0), 60),
    false,
    'con límite de 60, exactamente 60 minutos no es inactividad',
  )
  assert.equal(
    estaInactivo(ultimaActividad, fecha(11, 1), 60),
    true,
    'con límite de 60, 61 minutos sí es inactividad',
  )
})
