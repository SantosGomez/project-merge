// Pruebas del resumen de casos propios del contador («Mi resumen»).
// Debe entregar los mismos campos que el resumen del equipo del administrador, más los próximos a vencer.

import test from 'node:test'
import assert from 'node:assert/strict'

import { resumenMisCasos } from '../src/utils/resumenMisCasos.js'

const HOY = '2026-11-02'

const caso = (estado, prioridad, fecha_vencimiento) => ({ estado, prioridad, fecha_vencimiento })

test('resumenMisCasos cuenta por estado, abiertos, vencidos, Alta abiertos y próximos a vencer', () => {
  const casos = [
    caso('pendiente', 'alta', '2026-11-01 00:00:00'), // vencido ayer
    caso('pendiente', 'media', '2026-11-02 00:00:00'), // vence hoy: próximo a vencer
    caso('en_proceso', 'alta', '2026-12-01 00:00:00'),
    caso('en_proceso', 'baja', '2026-10-01'), // vencido
    caso('finalizado', 'alta', '2026-10-01 00:00:00'), // finalizado: ni abierto ni vencido
  ]

  assert.deepEqual(resumenMisCasos(casos, HOY), {
    pendiente: 2,
    en_proceso: 2,
    finalizado: 1,
    abiertos: 4,
    vencidos: 2,
    alta_abiertos: 2,
    proximosAVencer: 1,
  })
})

test('resumenMisCasos sin casos entrega todo en cero', () => {
  const ceros = {
    pendiente: 0,
    en_proceso: 0,
    finalizado: 0,
    abiertos: 0,
    vencidos: 0,
    alta_abiertos: 0,
    proximosAVencer: 0,
  }
  assert.deepEqual(resumenMisCasos([], HOY), ceros)
  assert.deepEqual(resumenMisCasos(undefined, HOY), ceros)
})

test('resumenMisCasos cuenta como próximos a vencer los que vencen de hoy a 3 días', () => {
  const casos = [
    caso('pendiente', 'media', '2026-11-02 00:00:00'), // hoy
    caso('pendiente', 'alta', '2026-11-03 00:00:00'), // mañana
    caso('en_proceso', 'baja', '2026-11-04 00:00:00'), // en 2 días
    caso('pendiente', 'media', '2026-11-05 00:00:00'), // en 3 días
    caso('pendiente', 'alta', '2026-11-06 00:00:00'), // en 4 días: no
    caso('pendiente', 'media', '2026-11-01 00:00:00'), // vencido: no
    caso('finalizado', 'alta', '2026-11-02 00:00:00'), // finalizado: no
  ]

  const resumen = resumenMisCasos(casos, HOY)

  assert.equal(resumen.proximosAVencer, 4)
  assert.equal(resumen.vencidos, 1)
  assert.equal(resumen.abiertos, 6)
})
