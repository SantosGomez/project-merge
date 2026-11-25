/**
 * Pruebas de la lógica que mezcla «Por entregar» y «Entregados» en una sola tabla.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { combinarFilas, filtrarFilas } from './entregadosVista.js'

const pendientes = [
  { id: 1, folio: 'DCA-2026-0001', cliente: 'Comercializadora del Norte', contador: 'Ana' },
  { id: 2, folio: 'DCA-2026-0002', cliente: 'Servicios Contables Sur', contador: null },
]
const entregados = [
  {
    id: 10,
    folio: 'DCA-2026-0010',
    cliente: 'Comercializadora del Norte',
    contador: 'Luis',
    fechaEntrega: '2026-11-05T09:00:00',
  },
  {
    id: 11,
    folio: 'DCA-2026-0011',
    cliente: 'Otro Cliente',
    contador: 'Ana',
    fechaEntrega: '2026-11-20T16:30:00',
  },
]

describe('combinarFilas', () => {
  test('primero los por entregar, luego los entregados con el más reciente primero', () => {
    const filas = combinarFilas(pendientes, entregados)
    assert.deepEqual(
      filas.map((f) => f.id),
      [1, 2, 11, 10],
    )
  })

  test('cada fila indica su situación sin modificar las originales', () => {
    const filas = combinarFilas(pendientes, entregados)
    assert.deepEqual(
      filas.map((f) => f.situacion),
      ['por-entregar', 'por-entregar', 'entregado', 'entregado'],
    )
    assert.equal(pendientes[0].situacion, undefined)
    assert.equal(entregados[0].situacion, undefined)
  })

  test('sin entregados devuelve solo los pendientes', () => {
    assert.deepEqual(
      combinarFilas(pendientes, []).map((f) => f.id),
      [1, 2],
    )
  })
})

describe('filtrarFilas', () => {
  const filas = combinarFilas(pendientes, entregados)
  const ids = (resultado) => resultado.map((f) => f.id)

  test('sin criterios devuelve todo', () => {
    assert.deepEqual(ids(filtrarFilas(filas, {})), [1, 2, 11, 10])
    assert.deepEqual(ids(filtrarFilas(filas, { texto: '   ' })), [1, 2, 11, 10])
  })

  test('el texto busca por folio o cliente sin importar mayúsculas, en las dos clases de filas', () => {
    assert.deepEqual(ids(filtrarFilas(filas, { texto: 'dca-2026-0010' })), [10])
    assert.deepEqual(ids(filtrarFilas(filas, { texto: '  NORTE ' })), [1, 10])
  })

  test('el cliente y el contador filtran las dos clases de filas', () => {
    assert.deepEqual(ids(filtrarFilas(filas, { cliente: 'Comercializadora del Norte' })), [1, 10])
    assert.deepEqual(ids(filtrarFilas(filas, { contador: 'Ana' })), [1, 11])
  })

  test('los criterios se combinan', () => {
    assert.deepEqual(ids(filtrarFilas(filas, { contador: 'Ana', texto: 'otro' })), [11])
  })

  test('sin coincidencias devuelve una lista vacía', () => {
    assert.deepEqual(filtrarFilas(filas, { texto: 'zzz' }), [])
  })
})
