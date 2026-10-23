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

const cssRule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return src.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

const MINIMO_WCAG = 4.5
const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
    .map((canal) => (canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

describe('Drawer sidebar — verificación estática', () => {
  it('contiene q-drawer con propiedades aprobadas', () => {
    assert.ok(src.includes('<q-drawer'), 'falta q-drawer')
    const drawerTag = src.match(/<q-drawer[\s\S]*?>/)?.[0] ?? ''
    assert.ok(src.includes('v-model="drawerOpen"'), 'falta v-model drawerOpen')
    assert.ok(src.includes('show-if-above'), 'falta show-if-above')
    assert.ok(src.includes(':breakpoint="1024"'), 'falta breakpoint 1024')
    assert.ok(drawerTag.includes(':width="250"'), 'falta width 250')
    assert.ok(drawerTag.includes('bg-primary'), 'falta el azul marino de la marca')
    assert.ok(!drawerTag.includes('bg-blue-1'), 'el drawer ya no usa bg-blue-1')
    assert.ok(src.includes('aria-label="Navegación principal"'), 'falta aria-label navegación')
    assert.ok(!src.includes('bordered'), 'no debe llevar bordered')
  })

  it('drawer con transiciones slide-right/slide-left', () => {
    assert.ok(src.includes('transition-show="slide-right"'), 'falta transition-show slide-right')
    assert.ok(src.includes('transition-hide="slide-left"'), 'falta transition-hide slide-left')
  })

  it('el menú ocupa toda la altura y la barra superior empieza a su derecha', () => {
    assert.ok(src.includes('view="lHh Lpr lFf"'), 'falta view lHh Lpr lFf (menú a toda altura)')
  })

  it('contiene drawerOpen como ref en script', () => {
    assert.ok(src.includes('import { computed, ref }'), 'falta import ref junto a computed')
    assert.ok(src.includes('const drawerOpen = ref(false)'), 'falta drawerOpen ref(false)')
  })

  it('muestra el isotipo para fondo oscuro, «Grupo DelGrow S.C.» y «Seguimiento de Proyectos»', () => {
    const logoSrc = src.match(/src="([^"]*DELGROW_ISOTIPO-OF_T\.png)"/)?.[1] ?? ''
    assert.ok(logoSrc, 'falta el src del isotipo para fondo oscuro')
    assert.ok(
      !logoSrc.startsWith('/'),
      'el src del logo no debe empezar por / (Electron usa file://)',
    )
    assert.ok(src.includes('Grupo DelGrow S.C.'), 'falta el nombre de la empresa')
    assert.ok(src.includes('Seguimiento de Proyectos'), 'falta el nombre de la app')
    assert.ok(
      !src.includes('<q-toolbar-title>Navegación</q-toolbar-title>'),
      'la barra Navegación debe desaparecer',
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

  it('las opciones tienen texto, iconos y descripciones con contraste suficiente, también en el estado activo', () => {
    const variables = read('../src/css/quasar.variables.scss')
    const primary = variables.match(/\$primary:\s*(#[0-9a-fA-F]{6})/)?.[1]
    const secondary = variables.match(/\$secondary:\s*(#[0-9a-fA-F]{6})/)?.[1]
    assert.ok(primary, 'quasar.variables.scss declara $primary')
    assert.ok(secondary, 'quasar.variables.scss declara $secondary')

    const colorHex = (selector) =>
      cssRule(selector).match(/(?<![-\w])color:\s*(#[0-9a-fA-F]{6})/)?.[1]
    const colorSecundario = (selector) => {
      assert.match(
        cssRule(selector),
        /color:\s*var\(--q-secondary\)/,
        `${selector} usa var(--q-secondary)`,
      )
      return secondary
    }

    const colores = {
      etiquetas: colorHex('.q-item--nav'),
      iconos: colorSecundario('.q-item--nav .q-icon'),
      descripciones: colorHex('.q-item--nav .q-item__label--caption'),
    }

    for (const [nombre, color] of Object.entries(colores)) {
      assert.ok(color, `falta el color de ${nombre}`)
      assert.ok(
        contraste(color, primary) >= MINIMO_WCAG,
        `contraste ${contraste(color, primary).toFixed(2)}:1 de ${nombre}`,
      )
    }

    const activeClass = (src.match(/active-class="q-item--nav-activo"/g) || []).length
    const navClass = (src.match(/class="q-item--nav"/g) || []).length
    assert.ok(activeClass >= 4, `se esperan 4 active-class, hay ${activeClass}`)
    assert.ok(navClass >= 4, `se esperan 4 class q-item--nav, hay ${navClass}`)

    const drawerBlock = src.slice(src.indexOf('<q-drawer'), src.indexOf('</q-drawer>'))
    assert.ok(!drawerBlock.includes('color="primary"'), 'los iconos ya no usan color primary')
    assert.match(cssRule('.q-item--nav-activo'), /background:/, 'el activo tiene fondo propio')
    assert.match(
      cssRule('.q-item--nav-activo'),
      /box-shadow:[^;]*var\(--q-secondary\)/,
      'el activo lleva barra cian',
    )
    assert.ok(
      !src.includes('.q-item--nav:hover'),
      'el hover del menú lo aporta Quasar, sin regla propia',
    )
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
    // El drawer usa :width="250" (overlay) y no hay anchos fijos adicionales que rompan.
    assert.ok(src.includes(':width="250"'), 'drawer usa ancho 250')
  })
})
