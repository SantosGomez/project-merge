import test from 'node:test'
import assert from 'node:assert/strict'

import { screenState } from '../src/utils/screenState.js'

const ROWS = [{ id: 'case-01' }, { id: 'case-02' }]

test('screenState devuelve contenido cuando hay filas y no hay error ni carga', () => {
  assert.equal(screenState({ loading: false, error: false, rows: ROWS }), 'contenido')
})

test('screenState devuelve vacío cuando no hay filas', () => {
  assert.equal(screenState({ loading: false, error: false, rows: [] }), 'vacio')
})

test('screenState devuelve vacío cuando las filas no llegan o no son un arreglo', () => {
  assert.equal(screenState({ loading: false, error: false }), 'vacio')
  assert.equal(screenState({ loading: false, error: false, rows: null }), 'vacio')
  assert.equal(screenState({ loading: false, error: false, rows: undefined }), 'vacio')
})

test('screenState devuelve carga mientras se obtienen los datos', () => {
  assert.equal(screenState({ loading: true, error: false, rows: ROWS }), 'cargando')
  assert.equal(screenState({ loading: true, error: false, rows: [] }), 'cargando')
  assert.equal(
    screenState({ loading: true, error: false }),
    'cargando',
    'la carga tiene prioridad sobre el vacío (RF-35)',
  )
})

test('screenState prioriza la carga sobre el contenido', () => {
  assert.equal(screenState({ loading: true, error: false, rows: ROWS }), 'cargando')
})

test('screenState prioriza el error sobre la carga y sobre el contenido', () => {
  assert.equal(screenState({ loading: false, error: true, rows: ROWS }), 'error')
  assert.equal(screenState({ loading: true, error: true, rows: ROWS }), 'error')
  assert.equal(screenState({ loading: true, error: true, rows: [] }), 'error')
  assert.equal(screenState({ loading: false, error: true, rows: [] }), 'error')
})

test('screenState trata los valores ausentes como una pantalla en contenido si hay filas', () => {
  assert.equal(screenState({ rows: ROWS }), 'contenido')
  assert.equal(screenState({}), 'vacio')
})

test('screenState solo devuelve los cuatro estados previstos', () => {
  const expected = ['cargando', 'error', 'vacio', 'contenido']
  const inputs = [
    { loading: true, error: false, rows: [] },
    { loading: false, error: true, rows: [] },
    { loading: false, error: false, rows: [] },
    { loading: false, error: false, rows: ROWS },
  ]

  const states = inputs.map((input) => screenState(input))

  assert.deepEqual(states, expected)
  assert.deepEqual([...new Set(states)], expected, 'no se repite ningún estado')
})

test('screenState no modifica la entrada', () => {
  const input = { loading: false, error: false, rows: ROWS }
  const before = JSON.parse(JSON.stringify(input))

  screenState(input)

  assert.deepEqual(input, before)
})
