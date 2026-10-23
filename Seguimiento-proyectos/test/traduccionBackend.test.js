// Pruebas de la traducción entre la forma del backend y los códigos internos
// del frontend (RF-13, RF-19, RF-28, RF-29, RF-30, RF-31).
// El backend usa 'Pendiente'/'En proceso'/'Finalizado' y 'Alta'/'Media'/'Baja';
// las pantallas usan 'pendiente'/'en_proceso'/'finalizado' y 'alta'/'media'/'baja'.
// Todo valor desconocido se traduce a null y nunca se lanza una excepción.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  casoDeBackend,
  estadoABackend,
  estadoDeBackend,
  prioridadABackend,
  prioridadDeBackend,
} from '../src/utils/traduccionBackend.js'

// Pares [forma del backend, código interno] del contrato del plan.
const ESTADOS = [
  ['Pendiente', 'pendiente'],
  ['En proceso', 'en_proceso'],
  ['Finalizado', 'finalizado'],
]

const PRIORIDADES = [
  ['Alta', 'alta'],
  ['Media', 'media'],
  ['Baja', 'baja'],
]

// Valores que no pertenecen a ninguna de las dos formas: se espera null.
const DESCONOCIDOS = [
  '',
  '   ',
  null,
  undefined,
  'Pendiente ',
  'EN PROCESO',
  'Urgente',
  0,
  1,
  true,
  {},
  [],
]

// Comprueba las dos garantías del contrato: no lanza y devuelve null.
const comprobarDesconocido = (fn, valor, contexto) => {
  let resultado
  assert.doesNotThrow(
    () => {
      resultado = fn(valor)
    },
    `${contexto}: un valor desconocido no debe lanzar excepciones`,
  )
  assert.equal(resultado, null, `${contexto}: un valor desconocido se traduce a null`)
}

// --- estados ---------------------------------------------------------------

test('estadoDeBackend traduce los tres estados del backend a su código interno', () => {
  for (const [estadoBackend, estadoInterno] of ESTADOS) {
    assert.equal(
      estadoDeBackend(estadoBackend),
      estadoInterno,
      `el estado del backend "${estadoBackend}" equivale a "${estadoInterno}"`,
    )
  }
})

test('estadoABackend traduce los tres códigos internos a la forma del backend', () => {
  for (const [estadoBackend, estadoInterno] of ESTADOS) {
    assert.equal(
      estadoABackend(estadoInterno),
      estadoBackend,
      `el código interno "${estadoInterno}" equivale a "${estadoBackend}" en el backend`,
    )
  }
})

test('estadoDeBackend y estadoABackend son consistentes en ida y vuelta', () => {
  for (const [estadoBackend, estadoInterno] of ESTADOS) {
    assert.equal(
      estadoABackend(estadoDeBackend(estadoBackend)),
      estadoBackend,
      `ida y vuelta del estado "${estadoBackend}"`,
    )
    assert.equal(
      estadoDeBackend(estadoABackend(estadoInterno)),
      estadoInterno,
      `ida y vuelta del código interno "${estadoInterno}"`,
    )
  }
})

test('estadoDeBackend devuelve null para estados desconocidos sin lanzar', () => {
  for (const valor of [...DESCONOCIDOS, 'pendiente', 'en_proceso', 'finalizado']) {
    comprobarDesconocido(estadoDeBackend, valor, `estadoDeBackend(${JSON.stringify(valor)})`)
  }
})

test('estadoABackend devuelve null para códigos desconocidos sin lanzar', () => {
  for (const valor of [...DESCONOCIDOS, 'Pendiente', 'En proceso', 'Finalizado']) {
    comprobarDesconocido(estadoABackend, valor, `estadoABackend(${JSON.stringify(valor)})`)
  }
})

// --- prioridades -----------------------------------------------------------

test('prioridadDeBackend traduce las tres prioridades del backend a su código interno', () => {
  for (const [prioridadBackend, prioridadInterna] of PRIORIDADES) {
    assert.equal(
      prioridadDeBackend(prioridadBackend),
      prioridadInterna,
      `la prioridad del backend "${prioridadBackend}" equivale a "${prioridadInterna}"`,
    )
  }
})

test('prioridadABackend traduce los tres códigos internos a la forma del backend', () => {
  for (const [prioridadBackend, prioridadInterna] of PRIORIDADES) {
    assert.equal(
      prioridadABackend(prioridadInterna),
      prioridadBackend,
      `el código interno "${prioridadInterna}" equivale a "${prioridadBackend}" en el backend`,
    )
  }
})

test('prioridadDeBackend y prioridadABackend son consistentes en ida y vuelta', () => {
  for (const [prioridadBackend, prioridadInterna] of PRIORIDADES) {
    assert.equal(
      prioridadABackend(prioridadDeBackend(prioridadBackend)),
      prioridadBackend,
      `ida y vuelta de la prioridad "${prioridadBackend}"`,
    )
    assert.equal(
      prioridadDeBackend(prioridadABackend(prioridadInterna)),
      prioridadInterna,
      `ida y vuelta del código interno "${prioridadInterna}"`,
    )
  }
})

test('prioridadDeBackend devuelve null para prioridades desconocidas sin lanzar', () => {
  for (const valor of [...DESCONOCIDOS, 'alta', 'media', 'baja']) {
    comprobarDesconocido(
      prioridadDeBackend,
      valor,
      `prioridadDeBackend(${JSON.stringify(valor)})`,
    )
  }
})

test('prioridadABackend devuelve null para códigos desconocidos sin lanzar', () => {
  for (const valor of [...DESCONOCIDOS, 'Alta', 'Media', 'Baja']) {
    comprobarDesconocido(prioridadABackend, valor, `prioridadABackend(${JSON.stringify(valor)})`)
  }
})

// --- caso completo ---------------------------------------------------------

// Caso tal como lo devuelve el backend, con campos que no se traducen.
const casoValidoDeBackend = () => ({
  id: 7,
  cliente: 'Distribuidora Ñandú',
  estado: 'En proceso',
  prioridad: 'Alta',
  contador_id: 3,
  creado_en: '2026-10-22 10:15:00',
})

test('casoDeBackend traduce estado y prioridad y conserva los demás campos', () => {
  const casoBackend = casoValidoDeBackend()

  assert.deepEqual(casoDeBackend(casoBackend), {
    id: 7,
    cliente: 'Distribuidora Ñandú',
    estado: 'en_proceso',
    prioridad: 'alta',
    contador_id: 3,
    creado_en: '2026-10-22 10:15:00',
  })
})

test('casoDeBackend devuelve una copia y no modifica el caso original', () => {
  const casoBackend = casoValidoDeBackend()
  const copiaOriginal = structuredClone(casoBackend)
  const resultado = casoDeBackend(casoBackend)

  assert.notEqual(resultado, casoBackend, 'el resultado debe ser un objeto nuevo')
  assert.deepEqual(casoBackend, copiaOriginal, 'el caso recibido no debe cambiar')
  assert.equal(casoBackend.estado, 'En proceso', 'el estado del backend se conserva intacto')
  assert.equal(casoBackend.prioridad, 'Alta', 'la prioridad del backend se conserva intacta')
})

test('casoDeBackend traduce los tres estados y las tres prioridades', () => {
  for (const [estadoBackend, estadoInterno] of ESTADOS) {
    for (const [prioridadBackend, prioridadInterna] of PRIORIDADES) {
      const resultado = casoDeBackend({
        id: 1,
        cliente: 'Cliente',
        estado: estadoBackend,
        prioridad: prioridadBackend,
      })

      assert.deepEqual(
        resultado,
        { id: 1, cliente: 'Cliente', estado: estadoInterno, prioridad: prioridadInterna },
        `el caso con ${estadoBackend}/${prioridadBackend} se traduce a ${estadoInterno}/${prioridadInterna}`,
      )
    }
  }
})

test('casoDeBackend devuelve null cuando el estado no es válido', () => {
  for (const estado of ['', null, undefined, 'en_proceso', 'Urgente']) {
    const casoBackend = { ...casoValidoDeBackend(), estado }

    assert.doesNotThrow(
      () => casoDeBackend(casoBackend),
      `el estado ${JSON.stringify(estado)} no debe lanzar excepciones`,
    )
    assert.equal(
      casoDeBackend(casoBackend),
      null,
      `un caso con estado ${JSON.stringify(estado)} no se puede traducir`,
    )
  }
})

test('casoDeBackend devuelve null cuando la prioridad no es válida', () => {
  for (const prioridad of ['', null, undefined, 'alta', 'Urgente']) {
    const casoBackend = { ...casoValidoDeBackend(), prioridad }

    assert.doesNotThrow(
      () => casoDeBackend(casoBackend),
      `la prioridad ${JSON.stringify(prioridad)} no debe lanzar excepciones`,
    )
    assert.equal(
      casoDeBackend(casoBackend),
      null,
      `un caso con prioridad ${JSON.stringify(prioridad)} no se puede traducir`,
    )
  }
})

test('casoDeBackend devuelve null cuando el caso no tiene estado o prioridad', () => {
  const sinEstado = casoValidoDeBackend()
  delete sinEstado.estado
  const sinPrioridad = casoValidoDeBackend()
  delete sinPrioridad.prioridad

  assert.equal(casoDeBackend(sinEstado), null, 'falta el estado: no se puede traducir')
  assert.equal(casoDeBackend(sinPrioridad), null, 'falta la prioridad: no se puede traducir')
})

test('casoDeBackend devuelve null cuando no recibe un objeto', () => {
  for (const valor of [null, undefined, '', 'un caso', 42, true]) {
    comprobarDesconocido(casoDeBackend, valor, `casoDeBackend(${JSON.stringify(valor)})`)
  }
})
