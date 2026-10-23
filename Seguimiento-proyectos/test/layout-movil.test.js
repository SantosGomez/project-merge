/*
 * Verificación estática de la barra móvil en MaquetaLayout.vue (historia #6).
 * No monta Vue; comprueba la fila única, el «Volver» de solo icono y el recorte del título.
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

const botonVolver = () => {
  const icono = barra.indexOf('icon="arrow_back"')
  const inicio = barra.lastIndexOf('<q-btn', icono)
  return barra.slice(inicio, barra.indexOf('>', inicio) + 1)
}

describe('Barra móvil — verificación estática', () => {
  it('la barra pone menú, flecha y título en una sola fila, en ese orden', () => {
    assert.match(cssRule('.layout-bar__row'), /flex-wrap:\s*nowrap/, 'la fila no salta de línea')

    const menu = barra.indexOf('icon="menu"')
    const flecha = barra.indexOf('icon="arrow_back"')
    const titulo = barra.indexOf('layout-bar__title')

    assert.ok(menu >= 0 && flecha >= 0 && titulo >= 0, 'faltan menú, flecha o título')
    assert.ok(menu < flecha, 'el menú va antes que la flecha')
    assert.ok(flecha < titulo, 'la flecha va antes del título')
  })

  it('el «Volver» de la barra es solo una flecha con el mismo destino y nombre accesible', () => {
    const boton = botonVolver()

    assert.ok(boton, 'falta el «Volver» de la barra')
    assert.match(boton, /icon="arrow_back"/, 'sigue siendo la flecha de volver')
    assert.doesNotMatch(boton, /(^|\s)label="/, 'ya no muestra la palabra «Volver»')
    assert.ok(boton.includes(':to="{ name: backRouteName }"'), 'conserva el destino de vuelta')
    assert.ok(
      boton.includes(':aria-label="`Volver a ${backTitle}`"'),
      'conserva el nombre accesible',
    )
  })

  it('el tooltip de la flecha dice «Volver a <pantalla>»', () => {
    assert.ok(
      barra.includes('<q-tooltip>Volver a {{ backTitle }}</q-tooltip>'),
      'el tooltip nombra la pantalla anterior',
    )
  })

  it('el título de la barra se recorta con «…» sin pasar a otra línea', () => {
    const titulo = cssRule('.layout-bar__title')
    assert.match(titulo, /white-space:\s*nowrap/, 'el título no salta de línea')
    assert.match(titulo, /overflow:\s*hidden/, 'el título se recorta')
    assert.match(titulo, /text-overflow:\s*ellipsis/, 'el título termina en «…»')
  })

  it('el título de la barra ofrece su nombre completo en un tooltip', () => {
    const titulo = barra.match(/<h1 class="layout-bar__title">[\s\S]*?<\/h1>/)?.[0] ?? ''

    assert.ok(titulo, 'falta el título de la barra')
    assert.match(
      titulo,
      /<q-tooltip>\{\{\s*pageTitle\s*\}\}<\/q-tooltip>/,
      'el tooltip muestra el nombre completo',
    )
  })

  it('la barra cabe en 56 px sin bajar de 44 px el área táctil', () => {
    const relleno = cssRule('.layout-bar').match(/padding:\s*(\d+)px\s+(\d+)px\s*;/)?.[1]
    assert.ok(relleno !== undefined, 'la barra declara relleno vertical y horizontal en px')

    const altoToque = Number(cssRule('.control-touch').match(/min-height:\s*(\d+)px/)?.[1] ?? 0)
    assert.ok(altoToque >= 44, `el área táctil mide ${altoToque} px`)

    const alto = Number(relleno) * 2 + altoToque
    assert.ok(alto <= 56, `la barra mide ${alto} px`)
  })
})
