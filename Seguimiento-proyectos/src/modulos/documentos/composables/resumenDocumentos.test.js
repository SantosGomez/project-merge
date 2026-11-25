// Pruebas del conteo por estado de las tarjetas del Dashboard, de la marca de
// «vencido» y del texto del plazo (resumenDocumentos.js). Se ejecutan con
// `node --test`, sin dependencias: el módulo es JavaScript puro y recibe «hoy» por parámetro.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { contarPorEstado, esVencido, textoDelPlazo } from './resumenDocumentos.js'

const HOY = new Date(2026, 9, 15, 10, 0, 0) // 15 de octubre de 2026, hora local

/** Documento con la forma de GET /documentos; solo importan estado y fecha límite. */
const doc = (estado, fechaLimite = null) => ({ estado, fechaLimite })

describe('contarPorEstado', () => {
  test('cuenta cuántos documentos hay en cada estado', () => {
    const documentos = [
      doc('RECEPCIONADO'),
      doc('RECEPCIONADO'),
      doc('EN_PROCESO'),
      doc('PENDIENTE_CLIENTE'),
      doc('COMPLETADO'),
      doc('COMPLETADO'),
      doc('COMPLETADO'),
      doc('CANCELADO'),
    ]
    const cuentas = contarPorEstado(documentos)
    assert.equal(cuentas.RECEPCIONADO, 2)
    assert.equal(cuentas.EN_PROCESO, 1)
    assert.equal(cuentas.PENDIENTE_CLIENTE, 1)
    assert.equal(cuentas.COMPLETADO, 3)
    assert.equal(cuentas.CANCELADO, 1)
  })

  test('un estado sin documentos cuenta cero y una lista vacía deja todo en cero', () => {
    const cuentas = contarPorEstado([])
    assert.deepEqual(cuentas, {
      RECEPCIONADO: 0,
      EN_PROCESO: 0,
      PENDIENTE_CLIENTE: 0,
      COMPLETADO: 0,
      CANCELADO: 0,
    })
  })
})

describe('esVencido', () => {
  test('lo que sigue en trámite y pasó su fecha límite está vencido', () => {
    assert.equal(esVencido(doc('EN_PROCESO', '2026-10-14T23:00:00'), HOY), true)
    assert.equal(esVencido(doc('RECEPCIONADO', '2026-09-01T12:00:00'), HOY), true)
    assert.equal(esVencido(doc('PENDIENTE_CLIENTE', '2026-10-01T12:00:00'), HOY), true)
  })

  test('la fecha límite de hoy o futura no está vencida', () => {
    assert.equal(esVencido(doc('EN_PROCESO', '2026-10-15T08:00:00'), HOY), false)
    assert.equal(esVencido(doc('EN_PROCESO', '2026-10-30T12:00:00'), HOY), false)
  })

  test('lo terminado, cancelado o sin fecha límite nunca está vencido', () => {
    assert.equal(esVencido(doc('COMPLETADO', '2026-10-01T12:00:00'), HOY), false)
    assert.equal(esVencido(doc('CANCELADO', '2026-10-01T12:00:00'), HOY), false)
    assert.equal(esVencido(doc('EN_PROCESO', null), HOY), false)
  })
})

describe('textoDelPlazo', () => {
  test('cuenta los días por fecha, no por horas', () => {
    assert.equal(textoDelPlazo(doc('EN_PROCESO', '2026-10-14T23:00:00'), HOY), 'Venció hace 1 día')
    assert.equal(textoDelPlazo(doc('EN_PROCESO', '2026-10-07T12:00:00'), HOY), 'Venció hace 8 días')
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', '2026-10-15T08:00:00'), HOY), 'Vence hoy')
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', '2026-10-16T08:00:00'), HOY), 'Vence mañana')
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', '2026-10-20T12:00:00'), HOY), 'Faltan 5 días')
  })

  test('cruza el fin de mes sin perder días', () => {
    assert.equal(
      textoDelPlazo(doc('EN_PROCESO', '2026-09-30T12:00:00'), HOY),
      'Venció hace 15 días',
    )
  })

  test('lo terminado o cancelado no tiene plazo que contar', () => {
    assert.equal(textoDelPlazo(doc('COMPLETADO', '2026-10-01T12:00:00'), HOY), '')
    assert.equal(textoDelPlazo(doc('CANCELADO', '2026-10-01T12:00:00'), HOY), '')
  })

  test('sin fecha límite lo dice', () => {
    assert.equal(textoDelPlazo(doc('RECEPCIONADO', null), HOY), 'Sin fecha límite')
  })
})
