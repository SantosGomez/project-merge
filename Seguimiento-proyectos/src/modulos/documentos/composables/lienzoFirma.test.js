// Pruebas de los cálculos puros del lienzo de firma (lienzoFirma.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { medidasDelLienzo, posicionEnLienzo } from './lienzoFirma.js'

test('medidasDelLienzo multiplica el tamaño CSS por la densidad de píxeles y redondea', () => {
  assert.deepEqual(medidasDelLienzo({ anchoCss: 293, altoCss: 120, dpr: 2 }), {
    ancho: 586,
    alto: 240,
    escala: 2,
  })
  assert.deepEqual(medidasDelLienzo({ anchoCss: 293.4, altoCss: 120, dpr: 1.5 }), {
    ancho: 440,
    alto: 180,
    escala: 1.5,
  })
})

test('medidasDelLienzo toma dpr inválido o ausente como 1', () => {
  const esperado = { ancho: 293, alto: 120, escala: 1 }
  for (const dpr of [undefined, 0, -2, NaN, 'dos', Infinity]) {
    assert.deepEqual(medidasDelLienzo({ anchoCss: 293, altoCss: 120, dpr }), esperado)
  }
})

test('posicionEnLienzo devuelve coordenadas CSS relativas al lienzo', () => {
  const rect = { left: 40, top: 300 }
  assert.deepEqual(posicionEnLienzo(rect, { clientX: 100, clientY: 350 }), { x: 60, y: 50 })
})
