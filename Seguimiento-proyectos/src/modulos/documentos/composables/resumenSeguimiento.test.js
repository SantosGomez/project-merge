import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { resumirSeguimiento, ordenarPorAtencion } from './resumenSeguimiento.js'

const exp = (folio, estado) => ({ folio, estado })

describe('resumirSeguimiento (encabezado del portal)', () => {
  test('cuenta lo que necesita al cliente, lo que está en proceso y lo completado', () => {
    const resumen = resumirSeguimiento([
      exp('A', 'PENDIENTE_CLIENTE'),
      exp('B', 'RECEPCIONADO'),
      exp('C', 'EN_PROCESO'),
      exp('D', 'EN_PROCESO'),
      exp('E', 'COMPLETADO'),
    ])
    assert.deepStrictEqual(resumen, { necesitanAlgo: 1, enProceso: 3, completados: 1 })
  })

  test('los cancelados y los estados desconocidos no cuentan en ningún grupo', () => {
    const resumen = resumirSeguimiento([exp('A', 'CANCELADO'), exp('B', 'otro'), exp('C', null)])
    assert.deepStrictEqual(resumen, { necesitanAlgo: 0, enProceso: 0, completados: 0 })
  })

  test('sin expedientes todo es cero', () => {
    assert.deepStrictEqual(resumirSeguimiento([]), {
      necesitanAlgo: 0,
      enProceso: 0,
      completados: 0,
    })
  })
})

describe('ordenarPorAtencion (orden de la lista)', () => {
  test('lo que necesita al cliente va primero y el resto conserva su orden', () => {
    const ordenados = ordenarPorAtencion([
      exp('A', 'EN_PROCESO'),
      exp('B', 'PENDIENTE_CLIENTE'),
      exp('C', 'COMPLETADO'),
      exp('D', 'PENDIENTE_CLIENTE'),
    ])
    assert.deepStrictEqual(
      ordenados.map((e) => e.folio),
      ['B', 'D', 'A', 'C'],
    )
  })

  test('no modifica el arreglo original', () => {
    const original = [exp('A', 'EN_PROCESO'), exp('B', 'PENDIENTE_CLIENTE')]
    ordenarPorAtencion(original)
    assert.deepStrictEqual(
      original.map((e) => e.folio),
      ['A', 'B'],
    )
  })
})
