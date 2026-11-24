/**
 * Pruebas del resumen de las tarjetas de Direccionamiento.
 *
 * La regla de vencimiento es la misma del Dashboard: la fecha límite de HOY
 * todavía está en plazo; solo vence la de un día anterior.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { resumirPendientes } from './resumenDireccionamiento.js'

describe('resumirPendientes', () => {
  const hoy = new Date(2026, 10, 2, 9, 0, 0) // 2 de noviembre de 2026

  test('cuenta todos los pendientes de entrega', () => {
    const filas = [{ estado: 'RECEPCIONADO' }, { estado: 'RECEPCIONADO' }]

    assert.strictEqual(resumirPendientes(filas, hoy).porEntregar, 2)
  })

  test('cuenta solo las prioridades urgentes', () => {
    const filas = [
      { prioridad: 'URGENTE' },
      { prioridad: 'ALTA' },
      { prioridad: 'URGENTE' },
      { prioridad: 'BAJA' },
    ]

    assert.strictEqual(resumirPendientes(filas, hoy).urgentes, 2)
  })

  test('vence la fecha límite anterior a hoy, no la de hoy ni la nula', () => {
    const filas = [
      { fechaLimite: '2026-11-01T18:00:00' },
      { fechaLimite: '2026-11-02T18:00:00' },
      { fechaLimite: '2026-11-03T18:00:00' },
      { fechaLimite: null },
    ]

    assert.strictEqual(resumirPendientes(filas, hoy).vencidos, 1)
  })

  test('una lista vacía da todo en cero', () => {
    assert.deepStrictEqual(resumirPendientes([], hoy), {
      porEntregar: 0,
      urgentes: 0,
      vencidos: 0,
    })
  })
})
