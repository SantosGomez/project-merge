/*
 * Movimiento del menú lateral (MaquetaLayout.vue): verificación estática.
 * 1. En el celular el menú se desliza (la regla «al instante» es solo de escritorio).
 * 2. Al fijar o desfijar, el contenido acompaña al menú con la misma curva.
 * 3. El menú anima con la curva de salida de la app y dentro de los 155 ms de Quasar.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const src = read('../src/layouts/MaquetaLayout.vue')
const drawerTag = src.match(/<q-drawer[\s\S]*?>/)?.[0] ?? ''
const estilos = src.slice(src.indexOf('<style'))
// La curva vive en `app.scss` como `--dg-curva-salida` (cubic-bezier(0.23, 1, 0.32, 1)).
const CURVA_SALIDA = 'var(--dg-curva-salida)'

/** Duraciones en ms de una declaración `transition`. */
const duraciones = (declaracion) => [...declaracion.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]))

describe('Movimiento del menú lateral', () => {
  it('en el celular el menú se desliza: «al instante» solo aplica en escritorio', () => {
    const clase =
      drawerTag.match(/:class="\{\s*'menu-lateral--al-instante':\s*([^}]+)\}"/)?.[1] ?? ''
    assert.ok(clase, 'falta la clase menu-lateral--al-instante en q-drawer')
    assert.match(
      clase,
      /esEscritorio/,
      'sin esEscritorio el celular nunca tiene cursor y pierde el deslizamiento',
    )
  })

  it('q-drawer no lleva transition-show/transition-hide (no son props de QDrawer)', () => {
    assert.doesNotMatch(drawerTag, /transition-(show|hide)=/)
  })

  it('el menú anima su ancho y posición con la curva de salida en 150 ms o menos', () => {
    const regla =
      estilos.match(
        /:global\(\.q-body--layout-animate \.q-drawer:has\(> \.menu-lateral\)\)\s*\{([^}]+)\}/,
      )?.[1] ?? ''
    assert.ok(regla, 'falta la regla de transición del menú')
    assert.ok(regla.includes(CURVA_SALIDA), 'el menú usa la curva de salida de la app')
    assert.match(regla, /width/)
    assert.match(regla, /transform/)
    const ms = duraciones(regla)
    assert.ok(
      ms.length > 0 && ms.every((d) => d <= 150),
      'Quasar quita la clase de animación a los 155 ms',
    )
  })

  it('al fijar o desfijar, el contenido se anima con la misma curva y duración que el menú', () => {
    const contenedor = src.match(/<q-page-container[^>]*>/)?.[0] ?? ''
    assert.match(
      contenedor,
      /contenedor-paginas--acompana-menu/,
      'el contenedor recibe la clase mientras cambia el fijado',
    )

    const regla = estilos.match(/\.contenedor-paginas--acompana-menu\s*\{([^}]+)\}/)?.[1] ?? ''
    assert.ok(regla.includes('padding-left'), 'se anima el relleno izquierdo del contenido')
    assert.ok(regla.includes(CURVA_SALIDA))
    assert.ok(duraciones(regla).every((d) => d <= 150))

    // Mientras dura el cambio, el menú también anima: los dos se mueven con el mismo reloj.
    const clase = drawerTag.match(/'menu-lateral--al-instante':\s*([^}]+)\}/)?.[1] ?? ''
    assert.match(clase, /!acompanarMenu/)

    // La bandera se enciende al alternar el fijado y se apaga sola.
    const alternar = src.match(/const alternarMenuFijado = \(\) => \{[\s\S]*?\n\}/)?.[0] ?? ''
    assert.match(alternar, /acompanarMenu\.value = true/)
    assert.match(alternar, /setTimeout/)
  })

  it('con movimiento reducido tampoco se anima el contenido', () => {
    const reducido =
      estilos.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    assert.match(reducido, /contenedor-paginas--acompana-menu/)
  })
})
