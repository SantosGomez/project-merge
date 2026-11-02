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
    caso('pendiente', 'media', '2026-11-02 00:00:00'), // vence hoy: aún no vencido, cuenta como próximo a vencer
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
    proximosAVencer: 1, // el que vence hoy
    sinVencimiento: 0,
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
    sinVencimiento: 0,
  }
  assert.deepEqual(resumenMisCasos([], HOY), ceros)
  assert.deepEqual(resumenMisCasos(undefined, HOY), ceros)
})

test('resumenMisCasos incluye proximosAVencer (≤ 3 días) y sinVencimiento', () => {
  // HOY = 2026-11-02 (lunes)
  const casos = [
    // Próximos a vencer (≤ 3 días calendario desde hoy, no finalizados, con fecha)
    caso('pendiente', 'media', '2026-11-02 00:00:00'), // hoy (día 0)
    caso('pendiente', 'alta', '2026-11-03 00:00:00'),   // mañana (día 1)
    caso('en_proceso', 'baja', '2026-11-04 00:00:00'),  // pasado mañana (día 2)
    caso('pendiente', 'media', '2026-11-05 00:00:00'),  // día 3
    // NO próximos a vencer (día 4)
    caso('pendiente', 'alta', '2026-11-06 00:00:00'),
    // Vencidos (no cuentan como próximos)
    caso('pendiente', 'media', '2026-11-01 00:00:00'),
    // Sin vencimiento
    caso('pendiente', 'alta', ''),
    caso('en_proceso', 'media', null),
    caso('pendiente', 'baja', undefined),
    // Finalizados con fecha cercana: NO cuentan (ya están cerrados)
    caso('finalizado', 'alta', '2026-11-02 00:00:00'),
  ]

  const resumen = resumenMisCasos(casos, HOY)

  assert.equal(resumen.proximosAVencer, 4, '4 casos vencen en ≤ 3 días (hoy a jueves)')
  assert.equal(resumen.sinVencimiento, 3, '3 casos sin fecha de vencimiento')
  // Verificamos que los campos originales siguen funcionando
  assert.equal(resumen.vencidos, 1, 'solo 1 vencido (el de ayer)')
  assert.equal(resumen.finalizado, 1)
  assert.equal(resumen.abiertos, 9, 'todos menos el finalizado')
})
