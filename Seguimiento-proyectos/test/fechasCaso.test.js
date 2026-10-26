/*
 * Conversión de fechas del formulario a la forma de la API (RF-19, RNF-2).
 * Funciones puras: no montan Vue ni tocan la red.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { fechaADominioBackend } from '../src/utils/fechasCaso.js'

describe('fechaADominioBackend', () => {
  it('convierte el formato del formulario DD-MM-AAAA al de la base AAAA-MM-DD', () => {
    assert.equal(fechaADominioBackend('31-12-2026'), '2026-12-31')
    assert.equal(fechaADominioBackend('05-01-2027'), '2027-01-05')
  })

  it('acepta una fecha que ya viene en AAAA-MM-DD', () => {
    assert.equal(fechaADominioBackend('2026-12-31'), '2026-12-31')
  })

  it('ignora los espacios del inicio y del final', () => {
    assert.equal(fechaADominioBackend('  31-12-2026  '), '2026-12-31')
  })

  it('rechaza fechas imposibles y formatos ajenos', () => {
    for (const fecha of [
      '31-02-2026',
      '32-01-2026',
      '00-12-2026',
      '2026-13-01',
      '2026-02-30',
      '31/12/2026',
      '2026/12/31',
      '31-12-26',
      '',
      '   ',
      'hoy',
      null,
      undefined,
      42,
    ]) {
      assert.equal(fechaADominioBackend(fecha), null, `"${fecha}" no debe aceptarse`)
    }
  })
})
