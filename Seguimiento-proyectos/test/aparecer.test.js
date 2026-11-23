/*
 * Entrada animada (prueba en «experimento», idea de Animated Content de Vue Bits): opciones de la
 * directiva `vAparecer` convertidas en variables CSS.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { vAparecer, variablesDeAparicion } from '../src/utils/aparecer.js'

describe('variablesDeAparicion', () => {
  it('sin opciones usa la entrada suave de la app (0.5 s, 6 px de desenfoque, 24 px)', () => {
    assert.deepEqual(variablesDeAparicion(), {
      '--aparecer-retraso': '0ms',
      '--aparecer-duracion': '500ms',
      '--aparecer-desenfoque': '6px',
      '--aparecer-distancia': '24px',
    })
  })

  it('cada orden espera 90 ms más que el anterior', () => {
    assert.equal(variablesDeAparicion({ orden: 3 })['--aparecer-retraso'], '270ms')
  })

  it('respeta duración, desenfoque y distancia propios', () => {
    assert.deepEqual(variablesDeAparicion({ duracion: 1000, desenfoque: 12, distancia: 40 }), {
      '--aparecer-retraso': '0ms',
      '--aparecer-duracion': '1000ms',
      '--aparecer-desenfoque': '12px',
      '--aparecer-distancia': '40px',
    })
  })
})

describe('dónde se usa', () => {
  const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

  it('la tarjeta del inicio de sesión entra con cortina desde la izquierda', () => {
    assert.match(
      leer('../src/pages/LoginPage.vue'),
      /<div\s+v-aparecer="\{ cortina: true, duracion: 900, desenfoque: 12, distancia: 40 \}"\s+class="login-page__card"/,
    )
  })

  it('los dashboards entran escalonados por bloques', () => {
    const admin = leer('../src/pages/AdminDashboardPage.vue')
    const contador = leer('../src/pages/ContadorDashboardPage.vue')
    for (const orden of [0, 1, 2, 3])
      assert.match(admin, new RegExp(`v-aparecer="\\{ orden: ${orden} \\}"`))
    for (const orden of [0, 1, 2])
      assert.match(contador, new RegExp(`v-aparecer="\\{ orden: ${orden} \\}"`))
  })

  it('las demás páginas entran completas desde el layout; los dashboards usan su propia entrada', () => {
    const layout = leer('../src/layouts/MaquetaLayout.vue')
    assert.match(
      layout,
      /<router-view v-else #default="\{ Component, route: rutaActual \}">\s*<component\s+:is="Component"\s+v-aparecer="\{ apagado: RUTAS_CON_ENTRADA_PROPIA\.includes\(rutaActual\.name\) \}"/,
    )
    assert.match(
      layout,
      /const RUTAS_CON_ENTRADA_PROPIA = \['admin-dashboard', 'contador-dashboard'\]/,
    )
  })

  it('con `apagado` la directiva no toca el elemento', () => {
    const clases = new Set()
    const el = {
      classList: { add: (c) => clases.add(c) },
      style: { setProperty: () => clases.add('estilo') },
    }
    globalThis.window = { matchMedia: () => ({ matches: false }) }
    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    }
    vAparecer.mounted(el, { value: { apagado: true } })
    assert.equal(clases.size, 0)
  })
})
