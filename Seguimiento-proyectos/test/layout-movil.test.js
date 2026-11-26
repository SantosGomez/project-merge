/*
 * Verificación estática de la barra móvil en MaquetaLayout.vue (historia #6).
 * No monta Vue; comprueba la fila única, que ya no hay «Volver» y el recorte del título.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const src = read('../src/layouts/MaquetaLayout.vue')

const cssRule = (selector) => {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return src.match(new RegExp(`${escapado}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

const barra = src.slice(src.indexOf('<q-header'), src.indexOf('</q-header>'))

describe('Barra móvil — verificación estática', () => {
  it('la barra pone menú y título en una sola fila, en ese orden', () => {
    assert.match(cssRule('.layout-bar__row'), /flex-wrap:\s*nowrap/, 'la fila no salta de línea')

    const menu = barra.indexOf('icon="menu"')
    const titulo = barra.indexOf('layout-bar__title')

    assert.ok(menu >= 0 && titulo >= 0, 'faltan menú o título')
    assert.ok(menu < titulo, 'el menú va antes del título')
  })

  it('la barra solo tiene «Volver» en «Mi perfil» abierto desde módulos', () => {
    const flechas = barra.match(/<q-btn[^>]*icon="arrow_back"/g) ?? []
    assert.equal(flechas.length, 1, 'una sola flecha de volver')
    assert.match(flechas[0], /v-if="perfilDesdeModulos"/, 'solo con el perfil desde módulos')
    assert.ok(!src.includes('backRouteName'), 'no queda el cálculo del destino de vuelta')
  })

  it('el título de la barra se recorta con «…» sin pasar a otra línea', () => {
    const titulo = cssRule('.layout-bar__title')
    assert.match(titulo, /white-space:\s*nowrap/, 'el título no salta de línea')
    assert.match(titulo, /overflow:\s*hidden/, 'el título se recorta')
    assert.match(titulo, /text-overflow:\s*ellipsis/, 'el título termina en «…»')
  })

  it('el título de la barra muestra el nombre sin repetirlo en un tooltip', () => {
    const titulo = barra.match(/<h1 class="layout-bar__title">[\s\S]*?<\/h1>/)?.[0] ?? ''

    assert.ok(titulo, 'falta el título de la barra')
    assert.match(titulo, /\{\{\s*pageTitle\s*\}\}/, 'el título muestra el nombre')
    assert.doesNotMatch(titulo, /q-tooltip/, 'no repite el mismo texto en un tooltip')
  })

  it('la barra cabe en 56 px sin bajar de 44 px el área táctil', () => {
    const relleno = cssRule('.layout-bar').match(/padding:\s*(\d+)px\s+(\d+)px\s*;/)?.[1]
    assert.ok(relleno !== undefined, 'la barra declara relleno vertical y horizontal en px')

    // Revisión de UI, rebanada 9: la regla de 44 px es global (app.scss), ya no se copia en el layout.
    const appScss = read('../src/css/app.scss')
    const altoToque = Number(appScss.match(/\n\.control-touch\s*\{[^}]*min-height:\s*(\d+)px/)?.[1] ?? 0)
    assert.ok(altoToque >= 44, `el área táctil mide ${altoToque} px`)

    const alto = Number(relleno) * 2 + altoToque
    assert.ok(alto <= 56, `la barra mide ${alto} px`)
  })
})
