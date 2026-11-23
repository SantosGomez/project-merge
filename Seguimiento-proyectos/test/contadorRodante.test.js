/*
 * Número tipo odómetro (prueba en «experimento», idea del Counter de Vue Bits): cada dígito es una
 * tira 0-9 repetida tres veces; en reposo está en el tramo del medio (posición 10 + dígito).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { celdasDelContador } from '../src/utils/contadorRodante.js'

const posiciones = (celdas) => celdas.filter((c) => c.tipo === 'digito').map((c) => c.pos)

describe('celdasDelContador', () => {
  it('la primera vez pone cada dígito en reposo, sin saltos', () => {
    const celdas = celdasDelContador('20', null, [])
    assert.deepEqual(posiciones(celdas), [12, 10])
    assert.ok(celdas.every((c) => !c.salto))
  })

  it('las claves cuentan desde la derecha, así las unidades siguen siendo la misma celda', () => {
    const antes = celdasDelContador('9', null, [])
    const despues = celdasDelContador('10', '9', antes)
    assert.deepEqual(
      despues.map((c) => c.clave),
      ['d1', 'd0'],
    )
  })

  it('al subir de 9 a 0 rueda hacia adelante (tramo de arriba) y lo marca para volver al reposo', () => {
    const antes = celdasDelContador('09', null, [])
    const despues = celdasDelContador('10', '09', antes)
    assert.deepEqual(posiciones(despues), [11, 20])
    assert.deepEqual(
      despues.map((c) => c.salto),
      [false, true],
    )
  })

  it('al bajar de 0 a 9 rueda hacia atrás (tramo de abajo)', () => {
    const antes = celdasDelContador('10', null, [])
    const despues = celdasDelContador('09', '10', antes)
    assert.deepEqual(posiciones(despues), [10, 9])
  })

  it('los caracteres que no son dígito quedan fijos (los dos puntos del reloj)', () => {
    const celdas = celdasDelContador('00:59', null, [])
    assert.deepEqual(
      celdas.map((c) => c.tipo),
      ['digito', 'digito', 'signo', 'digito', 'digito'],
    )
    assert.equal(celdas[2].caracter, ':')
  })

  it('el reloj de 00:59 a 01:00 rueda todo hacia adelante', () => {
    const antes = celdasDelContador('00:59', null, [])
    const despues = celdasDelContador('01:00', '00:59', antes)
    assert.deepEqual(posiciones(despues), [10, 11, 20, 20])
  })

  it('sin movimiento no hay saltos: cada dígito va directo a su reposo', () => {
    const antes = celdasDelContador('09', null, [])
    const despues = celdasDelContador('10', '09', antes, { sinMovimiento: true })
    assert.deepEqual(posiciones(despues), [11, 10])
  })
})
