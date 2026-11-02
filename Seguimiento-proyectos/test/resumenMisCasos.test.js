// Pruebas del resumen de casos propios del contador («Mi resumen»).
// Debe entregar los mismos campos que el resumen del equipo del administrador.

import test from 'node:test'
import assert from 'node:assert/strict'

import { resumenMisCasos } from '../src/utils/resumenMisCasos.js'

const HOY = '2026-11-02'

const caso = (estado, prioridad, fecha_vencimiento) => ({ estado, prioridad, fecha_vencimiento })

test('resumenMisCasos cuenta por estado, abiertos, vencidos y Alta abiertos', () => {
  const casos = [
    caso('pendiente', 'alta', '2026-11-01 00:00:00'), // vencido ayer
    caso('pendiente', 'media', '2026-11-02 00:00:00'), // vence hoy: aún no vencido
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
  }
  assert.deepEqual(resumenMisCasos([], HOY), ceros)
  assert.deepEqual(resumenMisCasos(undefined, HOY), ceros)
})
