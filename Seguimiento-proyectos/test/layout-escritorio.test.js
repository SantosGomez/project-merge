/*
 * Verificación estática del layout de escritorio en MaquetaLayout.vue (historia #5).
 * No monta Vue; comprueba las condiciones de visibilidad y el encabezado de página.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const src = read('../src/layouts/MaquetaLayout.vue')

describe('Layout de escritorio — verificación estática', () => {
  it('la barra superior solo se muestra por debajo de 1024 px', () => {
    const headerTag = src.match(/<q-header[^>]*>/)?.[0] ?? ''
    assert.ok(headerTag, 'falta q-header')
    assert.ok(
      headerTag.includes('v-if="$q.screen.lt.md"'),
      'la barra se muestra solo por debajo de 1024 px (lt-md)',
    )
  })

  it('el drawer queda fijo justo desde el ancho en que se oculta la barra (sin hueco en 1024 px)', () => {
    // QDrawer pasa a modo móvil cuando el ancho es <= breakpoint; la barra se ve con lt.md (< 1024).
    const drawerTag = src.match(/<q-drawer[\s\S]*?>/)?.[0] ?? ''
    const breakpoint = Number(drawerTag.match(/:breakpoint="(\d+)"/)?.[1])
    assert.equal(breakpoint + 1, 1024, 'el drawer se fija desde 1024 px, donde desaparece la barra')
  })

  it('desde 1024 px el encabezado va dentro de q-page-container, antes del contenido', () => {
    const headerTag = src.match(/<header[^>]*>/)?.[0] ?? ''
    assert.ok(headerTag, 'falta el encabezado de página')
    assert.ok(
      headerTag.includes('v-if="$q.screen.gt.sm"'),
      'el encabezado se muestra desde 1024 px (gt-sm)',
    )

    const contenedorTag = src.match(/<q-page-container[^>]*>/)
    assert.ok(contenedorTag, 'falta q-page-container')
    const inicioContenedor = contenedorTag.index

    const inicioEncabezado = src.indexOf('<header')
    const inicioPaginas = inicioContenedor + contenedorTag[0].length

    assert.ok(inicioEncabezado > inicioContenedor, 'el encabezado va dentro de q-page-container')
    assert.ok(
      inicioEncabezado < src.indexOf('<q-page', inicioPaginas),
      'el encabezado va antes de las páginas',
    )
    assert.ok(
      inicioEncabezado < src.indexOf('<router-view', inicioPaginas),
      'el encabezado va antes del router-view',
    )
  })

  it('el contenedor de páginas reparte 100vh entre el encabezado y la página (sin scroll de sobra)', () => {
    const contenedorTag = src.match(/<q-page-container[^>]*>/)?.[0] ?? ''
    assert.match(contenedorTag, /class="[^"]*contenedor-paginas[^"]*"/, 'falta la clase del contenedor')

    const regla = (selector) => {
      const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return src.match(new RegExp(`${escapado}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
    }

    const contenedor = regla('.contenedor-paginas')
    assert.match(contenedor, /display:\s*flex/, 'el contenedor es flex')
    assert.match(contenedor, /flex-direction:\s*column/, 'el contenedor apila encabezado y página')
    assert.match(contenedor, /min-height:\s*100vh/, 'el contenedor ocupa la ventana')

    assert.match(regla('.page-header'), /flex:\s*0 0 auto/, 'el encabezado ocupa solo su alto')

    const pagina = regla('.contenedor-paginas > :deep(.q-page)')
    assert.match(pagina, /flex:\s*1 1 auto/, 'la página se estira con el resto')
    assert.match(pagina, /min-height:\s*0\s*!important/, 'se anula el min-height de 100vh de QPage')
  })

  it('el encabezado reutiliza el título del layout, sin duplicarlo', () => {
    const inicioEncabezado = src.indexOf('<header')
    const finEncabezado = src.indexOf('</header>', inicioEncabezado)
    assert.ok(
      inicioEncabezado >= 0 && finEncabezado > inicioEncabezado,
      'falta el encabezado de página',
    )

    const encabezado = src.slice(inicioEncabezado, finEncabezado)
    assert.match(
      encabezado,
      /<h1 class="page-header__title">\{\{\s*pageTitle\s*\}\}<\/h1>/,
      'el título del encabezado sale de pageTitle',
    )

    const barra = src.slice(src.indexOf('<q-header'), src.indexOf('</q-header>'))
    assert.match(barra, /\{\{\s*pageTitle\s*\}\}/, 'la barra usa el mismo pageTitle')

    assert.equal(
      (src.match(/const pageTitle\s*=/g) ?? []).length,
      1,
      'pageTitle se declara una sola vez',
    )
  })

  it('el «Volver» del encabezado conserva destino y etiqueta accesible de la barra', () => {
    const inicioEncabezado = src.indexOf('<header')
    const finEncabezado = src.indexOf('</header>', inicioEncabezado)
    const encabezado = src.slice(inicioEncabezado, finEncabezado)
    const barra = src.slice(src.indexOf('<q-header'), src.indexOf('</q-header>'))

    const marcas = [':to="{ name: backRouteName }"', ':aria-label="`Volver a ${backTitle}`"']

    for (const marca of marcas) {
      assert.ok(barra.includes(marca), `la barra conserva ${marca}`)
      assert.ok(encabezado.includes(marca), `el encabezado reutiliza ${marca}`)
    }

    assert.ok(
      encabezado.includes(
        '<q-tooltip>Vuelve a {{ backTitle }}, la pantalla anterior del recorrido.</q-tooltip>',
      ),
      'el encabezado de escritorio conserva su tooltip',
    )
  })

  it('el «Volver» del encabezado se ve sobre fondo claro con el azul de la marca', () => {
    const inicioEncabezado = src.indexOf('<header')
    const finEncabezado = src.indexOf('</header>', inicioEncabezado)
    const encabezado = src.slice(inicioEncabezado, finEncabezado)
    const boton = encabezado.match(/<q-btn[\s\S]*?>/)?.[0] ?? ''

    assert.ok(boton, 'falta el «Volver» del encabezado')
    assert.match(boton, /\bcolor="primary"/, 'el «Volver» usa el azul de la marca')
    assert.doesNotMatch(boton, /text-color="white"/, 'el «Volver» ya no fuerza texto blanco')
    assert.match(
      boton,
      /class="[^"]*control-touch[^"]*"/,
      'el «Volver» conserva el área táctil de 44 px',
    )
  })

  it('el «Volver» del encabezado solo aparece cuando la pantalla tiene vuelta y no hay acceso denegado', () => {
    const inicioEncabezado = src.indexOf('<header')
    const finEncabezado = src.indexOf('</header>', inicioEncabezado)
    const encabezado = src.slice(inicioEncabezado, finEncabezado)
    const boton = encabezado.match(/<q-btn[\s\S]*?>/)?.[0] ?? ''

    assert.match(
      boton,
      /v-if="backRouteName && !accessDenied"/,
      'el encabezado espeja la condición de «Volver» de la barra',
    )
  })
})
