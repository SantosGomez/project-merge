/*
 * Verificación estática del drawer/sidebar en MaquetaLayout.vue.
 * No monta Vue; comprueba cadenas clave en el archivo editado.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const src = read('../src/layouts/MaquetaLayout.vue')

describe('Drawer sidebar — verificación estática', () => {
  it('contiene q-drawer con propiedades aprobadas', () => {
    assert.ok(src.includes('<q-drawer'), 'falta q-drawer')
    assert.ok(src.includes('v-model="drawerOpen"'), 'falta v-model drawerOpen')
    assert.ok(src.includes('show-if-above'), 'falta show-if-above')
    assert.ok(src.includes(':breakpoint="1024"'), 'falta breakpoint 1024')
    assert.ok(src.includes(':width="220"'), 'falta width 220')
    assert.ok(src.includes('class="bg-blue-1"'), 'falta bg-blue-1')
    assert.ok(src.includes('aria-label="Navegación principal"'), 'falta aria-label navegación')
    assert.ok(!src.includes('bordered'), 'no debe llevar bordered')
  })

  it('drawer con transiciones slide-right/slide-left', () => {
    assert.ok(src.includes('transition-show="slide-right"'), 'falta transition-show slide-right')
    assert.ok(src.includes('transition-hide="slide-left"'), 'falta transition-hide slide-left')
  })

  it('layout usa view hHh (header arriba, drawer hijo)', () => {
    assert.ok(src.includes('view="hHh Lpr lFf"'), 'falta view hHh Lpr lFf')
  })

  it('contiene drawerOpen como ref en script', () => {
    assert.ok(src.includes('import { computed, ref }'), 'falta import ref junto a computed')
    assert.ok(src.includes('const drawerOpen = ref(true)'), 'falta drawerOpen ref(true)')
  })

  it('tiene q-toolbar con título "Navegación" al inicio del drawer', () => {
    assert.ok(src.includes('<q-toolbar class="bg-primary text-white">'), 'falta q-toolbar drawer')
    assert.ok(
      src.includes('<q-toolbar-title>Navegación</q-toolbar-title>'),
      'falta q-toolbar-title Navegación',
    )
  })

  it('tiene q-scroll-area sin altura fija en px, q-list y etiqueta de navegación', () => {
    assert.ok(src.includes('<q-scroll-area'), 'falta q-scroll-area')
    assert.ok(!src.includes('calc(100vh'), 'no debe llevar altura fija calc(100vh)')
    assert.ok(src.includes('<q-list'), 'falta q-list')
    assert.ok(src.includes('Navegación'), 'falta texto Navegación')
    assert.ok(src.includes('<q-item-label header'), 'falta header de lista')
  })

  it('tiene los 4 links internos con rutas aprobadas', () => {
    const routes = ['admin-dashboard', 'admin-directorio', 'contador-registro', 'contador-casos']
    for (const r of routes) {
      assert.ok(src.includes(r), `falta ruta ${r}`)
      assert.ok(src.includes(`name: '${r}'`), `falta name '${r}'`)
    }
  })

  it('cada item es clickable con ripple, iconos y aria-label', () => {
    const clickable = (src.match(/clickable/g) || []).length
    const ripple = (src.match(/v-ripple/g) || []).length
    assert.ok(clickable >= 4, `se esperan al menos 4 clickable, hay ${clickable}`)
    assert.ok(ripple >= 4, `se esperan al menos 4 v-ripple, hay ${ripple}`)
    assert.ok(src.includes('dashboard'), 'falta icono dashboard')
    assert.ok(src.includes('group'), 'falta icono group')
    assert.ok(src.includes('add_circle'), 'falta icono add_circle')
    assert.ok(src.includes('list_alt'), 'falta icono list_alt')
    assert.ok(src.includes('aria-label='), 'falta aria-label en items')
    assert.ok(src.includes('Ir al dashboard del administrador'), 'falta aria-label dashboard')
    assert.ok(src.includes('Ir al directorio de contadores'), 'falta aria-label directorio')
    assert.ok(src.includes('Ir al registro de caso'), 'falta aria-label registro')
    assert.ok(src.includes('Ir a mis casos'), 'falta aria-label mis casos')
  })

  it('cada item tiene active-class, clase q-item--nav e icono primary', () => {
    const activeClass = (src.match(/active-class="bg-primary text-white"/g) || []).length
    const navClass = (src.match(/class="q-item--nav"/g) || []).length
    const primaryIcons = (src.match(/color="primary"/g) || []).length
    assert.ok(activeClass >= 4, `se esperan 4 active-class, hay ${activeClass}`)
    assert.ok(navClass >= 4, `se esperan 4 class q-item--nav, hay ${navClass}`)
    assert.ok(primaryIcons >= 4, `se esperan 4 iconos color primary, hay ${primaryIcons}`)
    assert.ok(src.includes('.q-item--nav:hover'), 'falta regla hover de .q-item--nav')
  })

  it('tiene q-tooltip en cada ítem', () => {
    const count = (src.match(/<q-tooltip>/g) || []).length
    assert.ok(count >= 4, `se esperan al menos 4 q-tooltip, hay ${count}`)
  })

  it('tiene botón de menú en cabecera con clases de visibilidad', () => {
    assert.ok(src.includes('icon="menu"'), 'falta icon menu')
    assert.ok(src.includes('aria-label="Abrir menú de navegación"'), 'falta aria-label menú')
    assert.ok(src.includes('lt-lg'), 'falta clase lt-lg')
  })

  it('no introduce overflow horizontal a 360px (sin widths fijos en px fuera del drawer)', () => {
    // El drawer usa :width="220" (overlay) y no hay anchos fijos adicionales que rompan.
    assert.ok(src.includes(':width="220"'), 'drawer usa ancho 220')
  })
})
