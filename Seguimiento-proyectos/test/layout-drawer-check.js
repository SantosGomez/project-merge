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
    assert.ok(src.includes(':breakpoint="1023"'), 'falta breakpoint 1023 (fijo desde 1024 px)')
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

  it('la barra superior ya no tiene el botón de cerrar sesión', () => {
    const header = src.slice(src.indexOf('<q-header'), src.indexOf('</q-header>'))
    assert.ok(!header.includes('Cerrar sesión'), 'la barra ya no muestra Cerrar sesión')
    assert.ok(!header.includes('abrirDialogoCierre'), 'la barra ya no abre el diálogo de cierre')
    assert.ok(!src.includes('botonCerrarSesion'), 'no queda la ref botonCerrarSesion')
    assert.ok(!src.includes('.layout-bar__close'), 'no queda la clase layout-bar__close')
    assert.ok(header.includes('Volver'), 'la barra conserva Volver')
    assert.ok(header.includes('icon="menu"'), 'la barra conserva el botón de menú')
    assert.ok(header.includes('layout-bar__title'), 'la barra conserva el título')
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

  it('tiene q-scroll-area sin altura fija en px, q-list y etiqueta de sección', () => {
    assert.ok(src.includes('<q-scroll-area'), 'falta q-scroll-area')
    assert.ok(!src.includes('calc(100vh'), 'no debe llevar altura fija calc(100vh)')
    assert.ok(src.includes('<q-list'), 'falta q-list')
    assert.ok(
      src.includes('>Administración</q-item-label>'),
      'falta la etiqueta de la sección Administración',
    )
    assert.ok(src.includes('<q-item-label header'), 'falta header de lista')
  })

  it('el administrador ve solo la sección «Administración» con Dashboard admin y Directorio, y no las opciones del contador', () => {
    const inicioAdmin = src.indexOf('<template v-if="session.esAdministrador">')
    const finAdmin = src.indexOf('</template>', inicioAdmin)
    assert.ok(inicioAdmin >= 0, 'falta el bloque <template v-if="session.esAdministrador">')
    assert.ok(finAdmin > inicioAdmin, 'falta el cierre del bloque del administrador')

    const bloqueAdmin = src.slice(inicioAdmin, finAdmin)
    assert.match(bloqueAdmin, />Administración</, 'falta el título Administración')
    assert.ok(bloqueAdmin.includes("name: 'admin-dashboard'"), 'falta Dashboard admin')
    assert.ok(bloqueAdmin.includes("name: 'admin-directorio'"), 'falta Directorio')
    assert.ok(
      !bloqueAdmin.includes("name: 'contador-registro'"),
      'el administrador no ve Registro de caso',
    )
    assert.ok(!bloqueAdmin.includes("name: 'contador-casos'"), 'el administrador no ve Mis casos')

    const inicioContador = src.indexOf('<template v-if="session.esContador">')
    const finContador = src.indexOf('</template>', inicioContador)
    assert.ok(inicioContador >= 0, 'falta el bloque <template v-if="session.esContador">')
    assert.ok(finContador > inicioContador, 'falta el cierre del bloque del contador')

    const bloqueContador = src.slice(inicioContador, finContador)
    const sinBloques = src.replace(bloqueAdmin, '').replace(bloqueContador, '')
    for (const ruta of [
      'admin-dashboard',
      'admin-directorio',
      'contador-registro',
      'contador-casos',
    ]) {
      assert.ok(
        !sinBloques.includes(`name: '${ruta}'`),
        `la opción ${ruta} quedó fuera de su bloque de rol`,
      )
    }

    assert.ok(
      !/q-item[^>]*v-if="session\.esAdministrador"/.test(src),
      'el v-if del administrador debe estar solo en el <template>',
    )
    assert.ok(
      !/q-item[^>]*v-if="session\.esContador"/.test(src),
      'el v-if del contador debe estar solo en el <template>',
    )
  })

  it('el contador ve solo la sección «Mis casos» con Registro de caso y Mis casos, y no las opciones del administrador', () => {
    const inicioContador = src.indexOf('<template v-if="session.esContador">')
    const finContador = src.indexOf('</template>', inicioContador)
    assert.ok(inicioContador >= 0, 'falta el bloque <template v-if="session.esContador">')
    assert.ok(finContador > inicioContador, 'falta el cierre del bloque del contador')

    const bloqueContador = src.slice(inicioContador, finContador)
    assert.match(bloqueContador, /header>Mis casos<\/q-item-label>/, 'falta el título Mis casos')
    assert.ok(bloqueContador.includes("name: 'contador-registro'"), 'falta Registro de caso')
    assert.ok(bloqueContador.includes("name: 'contador-casos'"), 'falta Mis casos')
    assert.ok(
      !bloqueContador.includes("name: 'admin-dashboard'"),
      'el contador no ve Dashboard admin',
    )
    assert.ok(!bloqueContador.includes("name: 'admin-directorio'"), 'el contador no ve Directorio')

    const inicioAdmin = src.indexOf('<template v-if="session.esAdministrador">')
    const finAdmin = src.indexOf('</template>', inicioAdmin)
    assert.ok(inicioAdmin >= 0, 'falta el bloque <template v-if="session.esAdministrador">')
    assert.ok(finAdmin > inicioAdmin, 'falta el cierre del bloque del administrador')

    const bloqueAdmin = src.slice(inicioAdmin, finAdmin)
    const sinBloques = src.replace(bloqueContador, '').replace(bloqueAdmin, '')
    for (const ruta of [
      'admin-dashboard',
      'admin-directorio',
      'contador-registro',
      'contador-casos',
    ]) {
      assert.ok(
        !sinBloques.includes(`name: '${ruta}'`),
        `la opción ${ruta} quedó fuera de su bloque de rol`,
      )
    }

    assert.ok(
      !/q-item[^>]*v-if="session\.esContador"/.test(src),
      'el v-if del contador debe estar solo en el <template>',
    )
    assert.ok(
      !/q-item[^>]*v-if="session\.esAdministrador"/.test(src),
      'el v-if del administrador debe estar solo en el <template>',
    )
  })

  it('el título de la sección usa el azul claro de la marca y tiene contraste suficiente', () => {
    const variables = read('../src/css/quasar.variables.scss')
    const primary = variables.match(/\$primary:\s*(#[0-9a-fA-F]{6})/)?.[1]
    const secondary = variables.match(/\$secondary:\s*(#[0-9a-fA-F]{6})/)?.[1]
    assert.ok(primary && secondary, 'quasar.variables.scss declara $primary y $secondary')

    assert.match(
      cssRule('.drawer-nav .q-item__label--header'),
      /color:\s*var\(--q-secondary\)/,
      'el título de sección usa var(--q-secondary)',
    )
    assert.ok(
      contraste(secondary, primary) >= MINIMO_WCAG,
      `contraste ${contraste(secondary, primary).toFixed(2)}:1`,
    )
  })

  it('el pie del menú muestra las iniciales, el nombre y el rol después de la lista', () => {
    const cierreLista = src.indexOf('</q-scroll-area>')
    const inicioPie = src.indexOf('class="drawer-usuario"')
    const cierreDrawer = src.indexOf('</q-drawer>')
    assert.ok(cierreLista >= 0, 'falta el cierre de la lista')
    assert.ok(inicioPie > cierreLista, 'el pie va después de la lista')
    assert.ok(inicioPie < cierreDrawer, 'el pie va dentro del drawer')

    const pie = src.slice(inicioPie, cierreDrawer)
    assert.match(
      pie,
      /drawer-usuario__avatar[\s\S]*?\{\{\s*iniciales\s*\}\}/,
      'faltan las iniciales en el pie',
    )
    assert.match(
      pie,
      /drawer-usuario__nombre[\s\S]*?\{\{\s*session\.usuario\s*\}\}/,
      'falta el nombre de usuario en el pie',
    )
    assert.match(
      pie,
      /drawer-usuario__rol[\s\S]*?\{\{\s*rolLegible\s*\}\}/,
      'falta el rol legible en el pie',
    )
    assert.match(pie, /aria-hidden="true"/, 'las iniciales son decorativas')
    assert.match(src, /formatearIniciales\(session\.usuario\)/, 'faltan las iniciales de la sesión')
    assert.match(src, /formatearRol\(session\.rol\)/, 'falta el rol legible de la sesión')

    const pieTag = src.match(/<div class="drawer-usuario"[^>]*>/)?.[0] ?? ''
    assert.match(pieTag, /v-if="session\.autenticado"/, 'el pie se muestra con la sesión abierta')
    assert.doesNotMatch(pieTag, /esAdministrador|esContador/, 'el pie no depende del rol')

    const filaTag = src.match(/<div class="drawer-usuario__fila"[^>]*>/)?.[0] ?? ''
    assert.match(filaTag, /v-if="session\.usuario"/, 'la fila del nombre se muestra con usuario')
    assert.doesNotMatch(filaTag, /esAdministrador|esContador/, 'la fila no depende del rol')

    const filaInicio = src.indexOf('<div class="drawer-usuario__fila"')
    const opcionInicio = src.indexOf('@click="abrirDialogoCierre"')
    assert.ok(opcionInicio > filaInicio, 'la opción va después del inicio de la fila')
    let filaFin = filaInicio
    for (let cierre = 0; cierre < 3; cierre += 1) {
      filaFin = src.indexOf('</div>', filaFin + 1)
      assert.ok(filaFin > filaInicio, 'no se encontró el cierre de la fila del nombre')
    }
    assert.ok(opcionInicio > filaFin, 'la opción de cierre no va dentro de la fila del nombre')
  })

  it('el nombre del pie se recorta en una línea y el tooltip muestra el nombre completo', () => {
    const nombre = cssRule('.drawer-usuario__nombre')
    assert.match(nombre, /white-space:\s*nowrap/, 'el nombre no hace saltos de línea')
    assert.match(nombre, /overflow:\s*hidden/, 'el nombre se recorta')
    assert.match(nombre, /text-overflow:\s*ellipsis/, 'el nombre muestra puntos suspensivos')
    assert.doesNotMatch(
      nombre,
      /overflow-wrap:\s*anywhere/,
      'el nombre no se parte en varias líneas',
    )

    const pie = src.slice(src.indexOf('class="drawer-usuario"'), src.indexOf('</q-drawer>'))
    assert.match(
      pie,
      /<q-tooltip>\{\{\s*session\.usuario\s*\}\}<\/q-tooltip>/,
      'el tooltip muestra el nombre completo',
    )
  })

  it('el pie del menú tiene contraste suficiente y queda fijo sin tapar la lista', () => {
    const variables = read('../src/css/quasar.variables.scss')
    const primary = variables.match(/\$primary:\s*(#[0-9a-fA-F]{6})/)?.[1]
    const secondary = variables.match(/\$secondary:\s*(#[0-9a-fA-F]{6})/)?.[1]
    assert.ok(primary && secondary, 'quasar.variables.scss declara $primary y $secondary')

    const avatar = cssRule('.drawer-usuario__avatar')
    assert.match(avatar, /background:\s*var\(--q-secondary\)/, 'el círculo usa el azul claro')
    assert.match(avatar, /color:\s*var\(--q-primary\)/, 'las iniciales usan el azul marino')
    assert.match(avatar, /border-radius:\s*50%/, 'el avatar es un círculo')
    const ancho = avatar.match(/width:\s*(\d+)px/)?.[1]
    const alto = avatar.match(/height:\s*(\d+)px/)?.[1]
    assert.ok(ancho && ancho === alto, 'el avatar es cuadrado')
    assert.ok(
      contraste(secondary, primary) >= MINIMO_WCAG,
      `contraste del cian (iniciales y rol): ${contraste(secondary, primary).toFixed(2)}:1`,
    )

    assert.match(cssRule('.drawer-usuario__nombre'), /color:\s*#ffffff/i, 'el nombre es blanco')
    assert.ok(
      contraste('#ffffff', primary) >= MINIMO_WCAG,
      `contraste del nombre: ${contraste('#ffffff', primary).toFixed(2)}:1`,
    )

    assert.match(
      cssRule('.drawer-usuario__rol'),
      /color:\s*var\(--q-secondary\)/,
      'el rol usa el cian de la marca',
    )

    const pie = cssRule('.drawer-usuario')
    assert.match(pie, /flex:\s*0 0 auto/, 'el pie no se estira')
    assert.match(pie, /border-top:/, 'el pie lleva línea de separación')
    assert.doesNotMatch(pie, /position:\s*absolute/, 'el pie no se superpone a la lista')

    const nav = cssRule('.drawer-nav')
    assert.match(nav, /flex:\s*1 1 auto/, 'la lista ocupa el espacio libre')
    assert.match(nav, /min-height:\s*0/, 'la lista puede encogerse y hacer scroll')
  })

  it('el pie ofrece «Cerrar Sesión» con su tooltip y abre la confirmación existente', () => {
    const pie = src.slice(src.indexOf('class="drawer-usuario"'), src.indexOf('</q-drawer>'))
    assert.ok(pie.includes('class="q-item--nav"'), 'la opción usa el estilo del menú')
    assert.match(
      pie,
      /<q-item-label>Cerrar Sesión<\/q-item-label>/,
      'falta la etiqueta Cerrar Sesión',
    )
    assert.match(pie, /<q-icon name="logout" \/>/, 'falta el icono de salir')
    assert.match(pie, /@click="abrirDialogoCierre"/, 'la opción abre la confirmación existente')
    assert.match(
      pie,
      /<q-tooltip>Cierra la sesión actual y vuelve a la pantalla de inicio de sesión\.<\/q-tooltip>/,
      'falta el tooltip de la opción',
    )
    assert.ok(
      pie.indexOf('Cerrar Sesión') > pie.indexOf('drawer-usuario__rol'),
      'la opción va debajo del nombre y el rol',
    )
    assert.ok(src.includes('dialogoCierreAbierto'), 'falta el diálogo de confirmación')
  })

  it('el icono de Cerrar Sesión queda alineado con el avatar y la lista', () => {
    const pie = cssRule('.drawer-usuario')
    const relleno = pie.match(/padding:\s*\d+px\s+(\d+)px/)?.[1]
    assert.ok(relleno, 'el pie declara relleno horizontal')

    assert.match(
      cssRule('.drawer-usuario__salir'),
      new RegExp(`margin:\\s*0\\s+-${relleno}px`),
      'la opción compensa el relleno horizontal del pie',
    )

    const pieHtml = src.slice(src.indexOf('class="drawer-usuario"'), src.indexOf('</q-drawer>'))
    assert.match(
      pieHtml,
      /class="drawer-usuario__salir"[\s\S]*?class="q-item--nav"/,
      'la clase de alineación envuelve la opción de cierre',
    )
  })

  it('la opción «Cerrar Sesión» del pie se desactiva mientras se cierra la sesión', () => {
    const clic = src.indexOf('@click="abrirDialogoCierre"')
    assert.ok(clic >= 0, 'falta la opción que abre el cierre')

    const inicioEtiqueta = src.lastIndexOf('<q-item', clic)
    const finEtiqueta = src.indexOf('>', clic)
    assert.ok(inicioEtiqueta >= 0 && finEtiqueta > clic, 'no se encontró la etiqueta de la opción')

    const etiqueta = src.slice(inicioEtiqueta, finEtiqueta + 1)
    assert.match(etiqueta, /:disable="cerrandoSesion"/, 'la opción del pie se desactiva al cerrar')
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
