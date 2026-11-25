// Pruebas de la píldora de prioridad de un documento (prioridadVista.js).

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { estiloDePrioridadDocumento } from './prioridadVista.js'

test('cada prioridad de la base sale con su píldora', () => {
  const esperado = {
    URGENTE: 'chip-doc chip-doc--urgente',
    ALTA: 'chip-doc chip-doc--alta',
    MEDIA: 'chip-doc chip-doc--media',
    BAJA: 'chip-doc chip-doc--baja',
  }

  for (const [prioridad, chip] of Object.entries(esperado)) {
    assert.deepEqual(estiloDePrioridadDocumento(prioridad), { chip }, prioridad)
  }
})

test('una prioridad desconocida sale neutra', () => {
  for (const prioridad of ['', null, undefined, 'media']) {
    assert.deepEqual(
      estiloDePrioridadDocumento(prioridad),
      { chip: 'chip-doc chip-doc--neutro' },
      String(prioridad),
    )
  }
})
