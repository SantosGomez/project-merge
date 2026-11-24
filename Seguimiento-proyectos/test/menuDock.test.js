/*
 * Aspecto del dock de escritorio (MenuDock.vue), igual al del otro proyecto de DelGrow:
 * panel oscuro con borde celeste, iconos en azulejos con degradado, logo en su propio azulejo,
 * activa rellena de celeste y separadores antes y después de las opciones.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
const dock = leer('../src/components/MenuDock.vue')
const plantilla = dock.split('<script')[0]
const estilos = dock.slice(dock.indexOf('<style'))
const regla = (selector) =>
  estilos.match(
    new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  )?.[1] ?? ''

describe('Aspecto del dock', () => {
  it('el panel lleva el borde celeste de la paleta y centra los azulejos', () => {
    const panel = regla('.menu-dock')
    assert.match(panel, /border:\s*1px solid var\(--dg-dock-borde\)/)
    assert.match(panel, /align-items:\s*center/)
  })

  it('cada azulejo tiene el degradado oscuro de la paleta y el icono en blanco', () => {
    const azulejo = regla('.menu-dock__azulejo')
    assert.match(azulejo, /linear-gradient\(180deg, var\(--dg-dock-azulejo\), var\(--q-primary\)\)/)
    assert.match(azulejo, /color:\s*var\(--dg-texto-claro\)/)
  })

  it('la opción activa se rellena de celeste con el icono oscuro', () => {
    const activa = regla('.menu-dock__azulejo--activo')
    assert.match(activa, /background:\s*var\(--q-secondary\)/)
    assert.match(activa, /color:\s*var\(--q-primary\)/)
  })

  it('el logo va dentro de su propio azulejo y hay un separador antes y otro después de las opciones', () => {
    assert.match(
      plantilla,
      /<span class="menu-dock__azulejo menu-dock__azulejo--logo"[^>]*>\s*<img/,
    )
    assert.equal(plantilla.match(/class="menu-dock__separador"/g)?.length, 2)
  })
})
