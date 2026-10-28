/*
 * Conversión de fechas del formulario a la forma de la API (RF-19, RNF-2).
 * Funciones puras: no montan Vue ni tocan la red.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { diaPermitidoParaVencimiento, fechaADominioBackend, fechaParaFormulario } from '../src/utils/fechasCaso.js'

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

describe('fechaParaFormulario', () => {
  it('muestra una fecha de la API (con o sin hora) como DD-MM-AAAA', () => {
    assert.equal(fechaParaFormulario('2026-12-31'), '31-12-2026')
    assert.equal(fechaParaFormulario('2027-01-07 00:00:00'), '07-01-2027')
  })

  it('devuelve texto vacío si no hay fecha o no tiene forma de fecha', () => {
    assert.equal(fechaParaFormulario(null), '')
    assert.equal(fechaParaFormulario(undefined), '')
    assert.equal(fechaParaFormulario('mañana'), '')
  })
})

describe('diaPermitidoParaVencimiento (calendario del vencimiento)', () => {
  it('el calendario entrega AAAA/MM/DD: deja elegir desde la fecha de inicio en adelante', () => {
    assert.equal(diaPermitidoParaVencimiento('2026/12/01', '01-12-2026', '2026-10-28'), true, 'el mismo día vale')
    assert.equal(diaPermitidoParaVencimiento('2027/01/15', '01-12-2026', '2026-10-28'), true)
    assert.equal(diaPermitidoParaVencimiento('2026/11/30', '01-12-2026', '2026-10-28'), false)
  })

  it('sin fecha de inicio compara con hoy, y con un inicio a medio escribir no bloquea nada', () => {
    assert.equal(diaPermitidoParaVencimiento('2026/10/27', '', '2026-10-28'), false)
    assert.equal(diaPermitidoParaVencimiento('2026/10/28', '  ', '2026-10-28'), true)
    assert.equal(diaPermitidoParaVencimiento('2020/01/01', '01-12-20', '2026-10-28'), true)
  })
})
