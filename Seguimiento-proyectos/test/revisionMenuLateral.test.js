/*
 * Revisión del menú lateral (MaquetaLayout.vue), verificación estática:
 * 1. Con el menú del celular abierto, el contenido y la barra quedan inertes (el foco no se escapa).
 * 2. «Auditorías» queda activo también en la ficha de una auditoría.
 * 3. Los ítems del menú no llevan tooltip: la etiqueta y el subtítulo ya dan el contexto.
 * 4. El foco de los ítems del menú es celeste, como el del logo.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const src = read('../src/layouts/MaquetaLayout.vue')
const plantilla = src.slice(0, src.indexOf('<script'))
const script = src.slice(src.indexOf('<script'), src.indexOf('<style'))
const estilos = src.slice(src.indexOf('<style'))

/** Etiquetas de apertura de los q-item del menú (incluido «Cerrar sesión»). */
const itemsDelMenu = () => {
  const drawer = plantilla.slice(plantilla.indexOf('<q-drawer'), plantilla.indexOf('</q-drawer>'))
  return [...drawer.matchAll(/<q-item\s[\s\S]*?<\/q-item>/g)].map((m) => m[0])
}

describe('Menú lateral: foco atrapado en el celular', () => {
  it('el fondo se bloquea solo con el menú del celular abierto', () => {
    assert.match(
      script,
      /const fondoBloqueado = computed\(\(\) => !esEscritorio\.value && drawerOpen\.value\)/,
    )
  })

  it('la barra superior y el contenido quedan inertes mientras tanto', () => {
    const header = plantilla.match(/<q-header[^>]*>/)?.[0] ?? ''
    const contenedor = plantilla.match(/<q-page-container[^>]*>/)?.[0] ?? ''
    assert.match(header, /:inert="fondoBloqueado"/)
    assert.match(contenedor, /:inert="fondoBloqueado"/)
    // «Saltar al contenido» llevaría a un contenido bloqueado: también queda inerte.
    const saltar = plantilla.slice(plantilla.indexOf('<q-btn'), plantilla.indexOf('/>'))
    assert.match(saltar, /class="saltar-contenido"/)
    assert.match(saltar, /:inert="fondoBloqueado"/)
  })
})

describe('Menú lateral: «Auditorías» activo en la ficha', () => {
  it('la ficha de auditoría cuenta como la sección de auditorías', () => {
    assert.match(
      script,
      /const enAuditorias = computed\(\(\) =>\s*\['auditorias', 'auditoria-ficha'\]\.includes\(route\.name\)/,
    )
  })

  it('las dos opciones de «Auditorías» usan enAuditorias para el activo y aria-current', () => {
    const opciones = itemsDelMenu().filter((item) =>
      item.includes(':to="{ name: \'auditorias\' }"'),
    )
    assert.equal(opciones.length, 2, 'una para el administrador y otra para el contador')
    for (const opcion of opciones) {
      assert.match(opcion, /:active="enAuditorias"/)
      assert.match(opcion, /:aria-current="enAuditorias \? 'page' : undefined"/)
    }
  })
})

describe('Menú lateral: sin tooltips en los ítems', () => {
  it('ningún ítem del menú lleva q-tooltip', () => {
    const items = itemsDelMenu()
    assert.ok(items.length >= 9, `se esperan los 9 ítems del menú, hay ${items.length}`)
    for (const item of items) assert.doesNotMatch(item, /<q-tooltip/)
  })

  it('el logo conserva su tooltip: es la única pista de que fija el menú', () => {
    assert.match(plantilla, /<q-tooltip v-if="esEscritorio">\{\{ textoBotonMenu \}\}<\/q-tooltip>/)
  })
})

describe('Menú lateral: foco celeste en los ítems', () => {
  it('los ítems del menú dibujan el anillo de foco en celeste', () => {
    const regla = estilos.match(/\.q-item--nav:focus-visible\s*\{([^}]+)\}/)?.[1] ?? ''
    assert.match(regla, /outline:\s*2px solid var\(--q-secondary\) !important/)
    assert.match(regla, /outline-offset:\s*-2px/)
  })
})
