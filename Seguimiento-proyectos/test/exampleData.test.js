import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_CLIENT_LENGTH,
  PRIORITIES,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROFILES,
  SIMULATION,
  STATUSES,
  STATUS_LABELS,
} from '../src/utils/constants.js'
import { exampleAccounts, exampleCases, exampleCounters } from '../src/services/exampleData.js'

// Supuestos de medición para "más filas de las que caben en una ventana de 1024 × 768 px"
// (RF-45, RNF-10): con 768 px de alto y filas de 56 px se ven menos de 14 filas completas.
const VIEWPORT_HEIGHT_PX = 768
const ROW_HEIGHT_PX = 56
const MIN_ROWS_FOR_OVERFLOW = Math.ceil(VIEWPORT_HEIGHT_PX / ROW_HEIGHT_PX)

// Nombre del contador que coincide con la cuenta de ejemplo del perfil contador.
const COUNTER_NAME_OF_ACCOUNT = 'contador'

// Longitud mínima que se considera "nombre largo" para contadores y clientes (RNF-9).
const LONG_NAME_MIN_LENGTH = 25
const LONG_CLIENT_MIN_LENGTH = 60

const hasSpecialCharacters = (text) => /[áéíóúüñÁÉÍÓÚÜÑ]/.test(text)

const casesOfCounter = (counterId) =>
  exampleCases.filter((oneCase) => oneCase.counterId === counterId)

test('constants.js reúne los valores únicos del dominio', () => {
  assert.deepEqual(STATUSES, ['pendiente', 'en_proceso', 'finalizado'])
  assert.deepEqual(PRIORITIES, ['alta', 'media', 'baja'])
  assert.deepEqual(STATUS_LABELS, {
    pendiente: 'Pendiente',
    en_proceso: 'En proceso',
    finalizado: 'Finalizado',
  })
  assert.deepEqual(PRIORITY_LABELS, { alta: 'Alta', media: 'Media', baja: 'Baja' })
  assert.deepEqual(PRIORITY_COLORS, { alta: 'red', media: 'amber', baja: 'green' })
  assert.deepEqual(PROFILES, { administrador: 'administrador', contador: 'contador' })
  assert.equal(MAX_CLIENT_LENGTH, 80)
  assert.equal(SIMULATION.error, 'Simular error')
  assert.equal(SIMULATION.expiry, 'Simular caducidad')
})

test('la semilla trae las dos cuentas de ejemplo con su perfil y su contador asignado', () => {
  const admin = exampleAccounts.find((account) => account.username === 'admin')
  const contador = exampleAccounts.find((account) => account.username === 'contador')

  assert.ok(admin, 'falta la cuenta admin')
  assert.equal(admin.password, 'admin123')
  assert.equal(admin.profile, PROFILES.administrador)

  assert.ok(contador, 'falta la cuenta contador')
  assert.equal(contador.password, 'contador123')
  assert.equal(contador.profile, PROFILES.contador)

  assert.equal(exampleAccounts.length, 2, 'la maqueta solo define dos cuentas de ejemplo')

  const counter = exampleCounters.find((one) => one.id === contador.counterId)
  assert.ok(counter, 'la cuenta contador debe pertenecer a un contador del equipo')
  assert.equal(counter.name, COUNTER_NAME_OF_ACCOUNT)
})

test('la cuenta contador empieza sin casos', () => {
  const account = exampleAccounts.find((one) => one.username === 'contador')
  const counter = exampleCounters.find((one) => one.id === account.counterId)

  assert.deepEqual(
    casesOfCounter(counter.id),
    [],
    'la cuenta contador no debe tener casos al empezar',
  )
})

test('hay al menos otro contador con casos en los tres estados', () => {
  const account = exampleAccounts.find((one) => one.username === 'contador')

  const countersWithAllStatuses = exampleCounters.filter((counter) => {
    if (counter.id === account.counterId) return false
    const statuses = new Set(casesOfCounter(counter.id).map((oneCase) => oneCase.status))
    return STATUSES.every((status) => statuses.has(status))
  })

  assert.ok(
    countersWithAllStatuses.length >= 1,
    'debe existir un contador distinto de la cuenta contador con casos en Pendiente, En proceso y Finalizado',
  )
})

test('la semilla incluye un contador de nombre largo con caracteres especiales', () => {
  const longNameCounters = exampleCounters.filter(
    (counter) => counter.name.length >= LONG_NAME_MIN_LENGTH && hasSpecialCharacters(counter.name),
  )

  assert.ok(
    longNameCounters.length >= 1,
    'debe existir un contador con nombre largo y caracteres especiales',
  )
})

test('la semilla incluye un caso con cliente de nombre largo y caracteres especiales', () => {
  const longClientCases = exampleCases.filter(
    (oneCase) =>
      oneCase.client.length >= LONG_CLIENT_MIN_LENGTH &&
      oneCase.client.length <= MAX_CLIENT_LENGTH &&
      hasSpecialCharacters(oneCase.client),
  )

  assert.ok(
    longClientCases.length >= 1,
    'debe existir un caso con cliente de nombre largo, dentro del límite y con caracteres especiales',
  )
})

test('hay filas suficientes para desbordar una ventana de 1024 × 768 px', () => {
  assert.ok(
    exampleCounters.length >= MIN_ROWS_FOR_OVERFLOW,
    `P-2 y P-3 necesitan al menos ${MIN_ROWS_FOR_OVERFLOW} contadores para exigir desplazamiento vertical`,
  )

  const maxCasesOfOneCounter = Math.max(
    ...exampleCounters.map((counter) => casesOfCounter(counter.id).length),
  )
  assert.ok(
    maxCasesOfOneCounter >= MIN_ROWS_FOR_OVERFLOW,
    `la lista de casos de un mismo contador necesita al menos ${MIN_ROWS_FOR_OVERFLOW} filas para exigir desplazamiento vertical`,
  )
})

test('la semilla es coherente: identificadores únicos, referencias válidas y textos dentro del límite', () => {
  const counterIds = exampleCounters.map((counter) => counter.id)
  const caseIds = exampleCases.map((oneCase) => oneCase.id)

  assert.equal(
    new Set(counterIds).size,
    counterIds.length,
    'los identificadores de contador deben ser únicos',
  )
  assert.equal(
    new Set(caseIds).size,
    caseIds.length,
    'los identificadores de caso deben ser únicos',
  )

  for (const counter of exampleCounters) {
    assert.equal(typeof counter.id, 'string')
    assert.ok(counter.name.trim().length > 0, 'todo contador debe tener nombre')
  }

  for (const oneCase of exampleCases) {
    assert.ok(
      counterIds.includes(oneCase.counterId),
      `el caso ${oneCase.id} apunta a un contador inexistente`,
    )
    assert.ok(STATUSES.includes(oneCase.status), `estado no permitido en el caso ${oneCase.id}`)
    assert.ok(
      PRIORITIES.includes(oneCase.priority),
      `prioridad no permitida en el caso ${oneCase.id}`,
    )
    assert.ok(oneCase.client.trim().length > 0, `el caso ${oneCase.id} necesita cliente`)
    assert.ok(
      oneCase.client.length <= MAX_CLIENT_LENGTH,
      `el cliente del caso ${oneCase.id} supera los ${MAX_CLIENT_LENGTH} caracteres`,
    )
  }
})
