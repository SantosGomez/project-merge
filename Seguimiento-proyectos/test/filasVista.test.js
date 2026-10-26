// Pruebas de las adaptaciones de datos para las vistas (RF-11, RF-12, RF-13, RNF-03).
// Funciones puras: los servicios entregan la forma del backend traducida a códigos
// internos y los componentes de la maqueta esperan otra forma; aquí se comprueba el puente.

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AYUDA_CONTEO,
  ayudaConteo,
  casoAFila,
  casosAFilas,
  contadorAFila,
} from '../src/utils/filasVista.js'
import { STATUSES } from '../src/utils/constants.js'

test('contadorAFila usa el nombre del backend como nombre visible (RF-11)', () => {
  assert.deepEqual(contadorAFila({ id: 3, nombre: 'ana' }), { id: 3, name: 'ana' })
})

test('contadorAFila conserva el nombre largo completo, sin recortarlo (RNF-08)', () => {
  const largo = 'María de los Ángeles Fernández-Ñandú (turno de noche)'

  assert.equal(contadorAFila({ id: 7, nombre: largo }).name, largo)
})

test('contadorAFila no inventa datos si el contador no es un objeto', () => {
  assert.equal(contadorAFila(null), null)
  assert.equal(contadorAFila(undefined), null)
  assert.equal(contadorAFila(42), null)
})

test('casoAFila traduce los campos internos a los que espera CaseRow (RF-13)', () => {
  const fila = casoAFila({
    id: 9,
    cliente: 'Distribuidora Ñandú',
    estado: 'en_proceso',
    prioridad: 'alta',
    contador_id: 3,
    creado_en: '2026-01-01 10:00:00',
    actualizado_en: '2026-01-02 11:00:00',
  })

  assert.deepEqual(fila, {
    id: 9,
    client: 'Distribuidora Ñandú',
    status: 'en_proceso',
    priority: 'alta',
    counterId: 3,
  })
})

test('casoAFila conserva el cliente completo y no arrastra campos del backend (RNF-08)', () => {
  const cliente = 'Servicios Integrales del Norte, S.A. de C.V. — sucursal 12'
  const fila = casoAFila({ id: 1, cliente, estado: 'pendiente', prioridad: 'baja' })

  assert.equal(fila.client, cliente)
  assert.equal('cliente' in fila, false)
  assert.equal('estado' in fila, false)
  assert.equal('prioridad' in fila, false)
  assert.equal(fila.counterId, null, 'sin contador_id se informa null, no undefined')
})

test('casoAFila no inventa datos si el caso no es un objeto', () => {
  assert.equal(casoAFila(null), null)
  assert.equal(casoAFila(undefined), null)
  assert.equal(casoAFila('caso'), null)
})

test('casosAFilas adapta la lista completa y descarta los elementos inválidos', () => {
  const filas = casosAFilas([
    { id: 1, cliente: 'Ana', estado: 'pendiente', prioridad: 'alta' },
    null,
    { id: 2, cliente: 'Luis', estado: 'finalizado', prioridad: 'baja' },
  ])

  assert.deepEqual(
    filas.map((fila) => fila.id),
    [1, 2],
  )
})

test('casosAFilas sin lista devuelve una lista vacía, no un error', () => {
  assert.deepEqual(casosAFilas(), [])
  assert.deepEqual(casosAFilas(null), [])
  assert.deepEqual(casosAFilas([]), [])
})

test('cada conteo tiene texto de ayuda propio (RNF-03)', () => {
  assert.deepEqual(Object.keys(AYUDA_CONTEO).sort(), [...STATUSES].sort())

  for (const estado of STATUSES) {
    assert.equal(typeof ayudaConteo(estado), 'string')
    assert.ok(ayudaConteo(estado).length > 20, `la ayuda de ${estado} explica qué cuenta`)
  }

  // Cada ayuda es distinta: no se repite el mismo texto para los tres conteos.
  assert.equal(new Set(STATUSES.map((estado) => ayudaConteo(estado))).size, STATUSES.length)
})

test('ayudaConteo devuelve null para un conteo desconocido', () => {
  assert.equal(ayudaConteo('archivado'), null)
  assert.equal(ayudaConteo(null), null)
})
