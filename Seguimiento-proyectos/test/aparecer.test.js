/*
 * Entrada animada (prueba en «experimento», idea de Animated Content de Vue Bits): opciones de la
 * directiva `vAparecer` convertidas en variables CSS.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { reproducirAparicion, vAparecer, variablesDeAparicion } from '../src/utils/aparecer.js'

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

  it('«Mi resumen» escalona los bloques de cada pestaña, no el contenedor de las pestañas', () => {
    const contador = leer('../src/pages/ContadorDashboardPage.vue')
    assert.doesNotMatch(contador, /<q-tab-panels\s+v-model="pestana"\s+v-aparecer/)
    assert.match(contador, /<ResumenEquipo\s+v-aparecer="\{ orden: 2 \}"\s+propios/)
    assert.match(contador, /<AgendaCasos\s+v-else-if="!cases\.error"\s+v-aparecer="\{ orden: 3 \}"/)

    const equipo = leer('../src/components/MiEquipo.vue')
    assert.match(equipo, /<ResumenEquipo\s+v-aparecer="\{ orden: 0 \}"/)
    assert.match(equipo, /<section\s+v-aparecer="\{ orden: 1 \}"\s+class="mi-equipo__panel"/)
    assert.match(equipo, /v-if="seleccionada"\s+v-aparecer="\{ orden: 2 \}"/)

    const tablero = leer('../src/components/TableroAuditorias.vue')
    assert.match(tablero, /<AlertasAuditoria\s+v-if="propias"\s+v-aparecer="\{ orden: 0 \}"/)
    assert.match(tablero, /<q-tabs\s+v-model="vista"\s+v-aparecer="\{ orden: 1 \}"/)
    assert.match(tablero, /<q-tab-panels\s+v-model="vista"\s+v-aparecer="\{ orden: 2 \}"/)
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

describe('reproducirAparicion (repetir la entrada al cambiar de pestaña)', () => {
  it('relanza los bloques con la directiva y los hace empezar desde el primero', () => {
    const llamadas = []
    const bloque = (orden) => ({
      _aparecerOrden: orden,
      _aparecerReproducir: (desfase) => llamadas.push([orden, desfase]),
    })
    const sinDirectiva = {}
    const raiz = {
      ...bloque(2),
      querySelectorAll: () => [bloque(3), sinDirectiva, bloque(4)],
    }

    reproducirAparicion(raiz)

    assert.deepEqual(llamadas, [
      [2, 2],
      [3, 2],
      [4, 2],
    ])
  })

  it('sin raíz o sin bloques no hace nada', () => {
    assert.doesNotThrow(() => reproducirAparicion(null))
    assert.doesNotThrow(() => reproducirAparicion({ querySelectorAll: () => [] }))
  })
})

describe('se repite al cambiar de pestaña', () => {
  const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

  it('«Mi resumen» relanza la entrada de la pestaña que se abre', () => {
    assert.match(
      leer('../src/pages/ContadorDashboardPage.vue'),
      /watch\(pestana, \(\) =>\s*nextTick\(\(\) => reproducirAparicion\(paneles\.value\?\.\$el\)\),?\s*\)/,
    )
  })

  it('el tablero relanza la entrada al cambiar entre Resumen, Avance y Kanban', () => {
    assert.match(
      leer('../src/components/TableroAuditorias.vue'),
      /watch\(vista, \(\) =>\s*nextTick\(\(\) => reproducirAparicion\(paneles\.value\?\.\$el\)\),?\s*\)/,
    )
  })
})
