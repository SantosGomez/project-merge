// Pruebas de la etiqueta visible de la prioridad (etiquetaPrioridad.js).

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { etiquetaDePrioridad } from './etiquetaPrioridad.js'

test('cada prioridad guardada sale con su etiqueta visible', () => {
  assert.equal(etiquetaDePrioridad('BAJA'), 'Baja')
  assert.equal(etiquetaDePrioridad('MEDIA'), 'Media')
  assert.equal(etiquetaDePrioridad('ALTA'), 'Alta')
  assert.equal(etiquetaDePrioridad('URGENTE'), 'Urgente')
})

test('un valor desconocido o vacío se devuelve tal cual', () => {
  assert.equal(etiquetaDePrioridad('OTRA'), 'OTRA')
  assert.equal(etiquetaDePrioridad(''), '')
  assert.equal(etiquetaDePrioridad(undefined), '')
})
