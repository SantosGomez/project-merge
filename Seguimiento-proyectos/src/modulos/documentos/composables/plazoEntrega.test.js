// Pruebas del módulo de plazo de entrega (plazoEntrega.js).
// Se ejecutan con `node --test` desde `Frontend/`, sin dependencias: el módulo
// es JavaScript puro y no importa Vue ni Quasar.
//
// Zona horaria: la máquina de desarrollo está en America/Matamoros
// (GMT-6 en enero, GMT-5 en julio), donde se ve la trampa. Un valor de solo día
// como `2026-10-01` lo interpreta el motor como **UTC**, así que sin anclarlo a
// mediodía local retrocede al 30 de septiembre. Las pruebas usan fechas base
// conocidas para evitar depender del día actual.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { plazoDeEntrega } from './plazoEntrega.js'

// --- Casos base: cada prioridad da la fecha esperada ---

test('plazoDeEntrega: URGENTE (2 días hábiles) desde lunes', () => {
  // Lunes 12 oct 2026 + 2 días hábiles desde mañana (mar 13) = Miércoles 14 oct 2026
  const limite = plazoDeEntrega('URGENTE', '2026-10-12')
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 9) // octubre = 9 (0-indexado)
  assert.equal(limite.getDate(), 14)
  assert.equal(limite.getHours(), 12) // mediodía local
})

test('plazoDeEntrega: ALTA (4 días hábiles) desde lunes', () => {
  // Lunes 12 oct 2026 + 4 días hábiles desde mañana (mar 13) = Viernes 16 oct 2026
  const limite = plazoDeEntrega('ALTA', '2026-10-12')
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 9)
  assert.equal(limite.getDate(), 16)
})

test('plazoDeEntrega: MEDIA (8 días hábiles) desde lunes', () => {
  // Lunes 12 oct 2026 + 8 días hábiles desde mañana (mar 13) = Jueves 22 oct 2026
  // Mar 13 (1), Mié 14 (2), Jue 15 (3), Vie 16 (4), Lun 19 (5), Mar 20 (6), Mié 21 (7), Jue 22 (8)
  const limite = plazoDeEntrega('MEDIA', '2026-10-12')
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 9)
  assert.equal(limite.getDate(), 22)
})

test('plazoDeEntrega: BAJA (15 días hábiles) desde lunes', () => {
  // Lunes 12 oct 2026 + 15 días hábiles desde mañana (mar 13) = Lunes 2 nov 2026
  const limite = plazoDeEntrega('BAJA', '2026-10-12')
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 10) // noviembre = 10
  assert.equal(limite.getDate(), 2)
})

// --- Salta fines de semana ---

test('plazoDeEntrega salta fin de semana: viernes + 2 días hábiles = martes', () => {
  // Viernes 16 oct 2026 + 2 días hábiles (URGENTE) = Martes 20 oct 2026
  // Sábado 17 y domingo 18 no cuentan
  const limite = plazoDeEntrega('URGENTE', '2026-10-16')
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 9)
  assert.equal(limite.getDate(), 20)
  // Verificar que es martes (getDay = 2)
  assert.equal(limite.getDay(), 2)
})

test('plazoDeEntrega salta fin de semana: jueves + 4 días hábiles = miércoles', () => {
  // Jueves 15 oct 2026 + 4 días hábiles (ALTA) = Miércoles 21 oct 2026
  // Viernes 16 (1), salta 17-18, lunes 19 (2), martes 20 (3), miércoles 21 (4)
  const limite = plazoDeEntrega('ALTA', '2026-10-15')
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 9)
  assert.equal(limite.getDate(), 21)
  assert.equal(limite.getDay(), 3) // miércoles
})

// --- Salta de diciembre a enero ---

test('plazoDeEntrega salta de diciembre a enero: 30 dic + 2 días hábiles = 1 ene', () => {
  // Miércoles 30 dic 2026 + 2 días hábiles desde mañana (jue 31) = Viernes 1 ene 2027
  // Jueves 31 dic (1), Viernes 1 ene (2) — 1 ene 2027 es viernes (día hábil)
  const limite = plazoDeEntrega('URGENTE', '2026-12-30')
  assert.equal(limite.getFullYear(), 2027)
  assert.equal(limite.getMonth(), 0) // enero = 0
  assert.equal(limite.getDate(), 1)
  assert.equal(limite.getDay(), 5) // viernes
})

test('plazoDeEntrega salta año nuevo con prioridad ALTA: 29 dic + 4 días hábiles = 4 ene', () => {
  // Martes 29 dic 2026 + 4 días hábiles desde mañana (mié 30) = Lunes 4 ene 2027
  // Mié 30 (1), Jue 31 (2), Vie 1 ene (3), salta 2-3 (sáb-dom), Lun 4 ene (4)
  const limite = plazoDeEntrega('ALTA', '2026-12-29')
  assert.equal(limite.getFullYear(), 2027)
  assert.equal(limite.getMonth(), 0)
  assert.equal(limite.getDate(), 4)
  assert.equal(limite.getDay(), 1) // lunes
})

// --- Prioridad desconocida lanza Error ---

test('plazoDeEntrega lanza Error con prioridad desconocida', () => {
  assert.throws(
    () => plazoDeEntrega('INEXISTENTE', '2026-10-12'),
    /Prioridad desconocida: INEXISTENTE/,
  )
})

test('plazoDeEntrega lanza Error con prioridad en minúsculas', () => {
  assert.throws(() => plazoDeEntrega('urgente', '2026-10-12'), /Prioridad desconocida: urgente/)
})

test('plazoDeEntrega lanza Error con cadena vacía', () => {
  assert.throws(() => plazoDeEntrega('', '2026-10-12'), /Prioridad desconocida: /)
})

// --- Acepta Date como parámetro hoy ---

test('plazoDeEntrega acepta Date como parámetro hoy', () => {
  const limite = plazoDeEntrega('URGENTE', new Date(2026, 9, 12, 10, 30))
  assert.equal(limite.getFullYear(), 2026)
  assert.equal(limite.getMonth(), 9)
  assert.equal(limite.getDate(), 14)
})
