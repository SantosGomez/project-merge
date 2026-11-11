// Revisión de UI, rebanada 2 (Estructura), grupo A: fondo de página, errores de carga en
// lenguaje llano y el menú como navegación con la página actual marcada.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const appScss = leer('../src/css/app.scss')
const indexHtml = leer('../index.html')
const layout = leer('../src/layouts/MaquetaLayout.vue')
const plantillaLayout = layout.split('<script')[0]
const errorState = leer('../src/components/ErrorState.vue')
const api = leer('../src/services/api.js')
const casesStore = leer('../src/stores/cases.js')
const countersStore = leer('../src/stores/counters.js')

describe('Fondo de página explícito', () => {
  it('el cuerpo tiene fondo de la paleta y esquema de color claro', () => {
    assert.match(appScss, /body\s*\{[^}]*background:\s*var\(--dg-superficie\)/)
    assert.match(appScss, /:root\s*\{[^}]*color-scheme:\s*light/)
    assert.match(indexHtml, /<meta name="color-scheme" content="light" \/>/)
  })
})

describe('Errores de carga en lenguaje llano', () => {
  it('api.js y los stores ya no hablan de usted ni muestran la petición técnica', () => {
    for (const [nombre, fuente] of [['api.js', api], ['cases.js', casesStore], ['counters.js', countersStore]]) {
      assert.doesNotMatch(fuente, /Reintente|Verifique|avise al/, `${nombre}: trato de tú`)
    }
    assert.doesNotMatch(api, /la petición \$\{/, 'sin «la petición GET /ruta»')
  })

  it('ErrorState muestra las tres partes con sus etiquetas también cuando el mensaje ya viene completo', () => {
    assert.match(errorState, /separarMensajeError\(props\.detail\)/)
    const plantilla = errorState.split('<script')[0]
    assert.match(plantilla, /\{\{ partes\.queOcurrio \}\}/)
    assert.match(plantilla, /\{\{ partes\.sobreQue \}\}/)
    assert.match(plantilla, /\{\{ partes\.queHacer \}\}/)
  })
})

describe('El menú lateral es la navegación principal', () => {
  it('la lista del menú está dentro de un <nav> con nombre, y el panel ya no se anuncia como complementario', () => {
    const drawer = plantillaLayout.slice(plantillaLayout.indexOf('<q-drawer'), plantillaLayout.indexOf('>', plantillaLayout.indexOf('<q-drawer')))
    assert.doesNotMatch(drawer, /aria-label=/)
    assert.match(plantillaLayout, /<nav aria-label="Navegación principal">\s*<q-list padding>/)
    assert.match(plantillaLayout, /<\/q-list>\s*<\/nav>/)
  })

  it('cada opción marca la página actual con aria-current', () => {
    const opciones = [...plantillaLayout.matchAll(/:to="\{ name: '([\w-]+)' \}"/g)]
    assert.ok(opciones.length >= 7, 'opciones del menú')
    for (const [, nombre] of opciones) {
      assert.ok(
        plantillaLayout.includes(`:aria-current="paginaActual('${nombre}')"`),
        `${nombre}: marca la página actual`,
      )
    }
    assert.match(layout, /const paginaActual = \(nombre\) => \(route\.name === nombre \? 'page' : undefined\)/)
  })

  it('hay un enlace «Saltar al contenido» que lleva al contenido de la página', () => {
    const boton = plantillaLayout.slice(plantillaLayout.lastIndexOf('<q-btn', plantillaLayout.indexOf('saltar-contenido')))
    assert.match(boton.slice(0, boton.indexOf('/>')), /label="Saltar al contenido"/)
    assert.match(boton.slice(0, boton.indexOf('/>')), /@click="saltarAlContenido"/)
    assert.match(plantillaLayout, /<q-page-container\s+id="contenido-principal"\s+tabindex="-1"/)
    assert.ok(
      plantillaLayout.indexOf('saltar-contenido') < plantillaLayout.indexOf('<q-drawer'),
      'es lo primero que recibe el foco',
    )
    assert.match(layout, /\.saltar-contenido:not\(:focus\)\s*\{[^}]*clip/, 'oculto hasta recibir el foco')
  })
})

// --- Grupo B: interacción y accesibilidad -------------------------------------------------

const errorStateB = leer('../src/components/ErrorState.vue')
const emptyState = leer('../src/components/EmptyState.vue')
const declaracionB = (nombre) => {
  const inicio = layout.indexOf(`const ${nombre} =`)
  const fin = layout.indexOf('\nconst ', inicio + 1)
  return inicio === -1 ? '' : layout.slice(inicio, fin === -1 ? undefined : fin)
}
const etiquetaDe = (fuente, nombre) => {
  const inicio = fuente.indexOf(`<${nombre}`)
  return fuente.slice(inicio, fuente.indexOf('>', inicio) + 1)
}

describe('Menú compacto: se despliega con intención', () => {
  it('el cursor lo despliega tras una breve espera y al salir se cancela', () => {
    assert.match(layout, /const ESPERA_CURSOR_MS = 150/)
    const entrada = declaracionB('alEntrarCursor')
    assert.match(entrada, /setTimeout\(\(\) => \{\s*cursorEnMenu\.value = true/)
    assert.match(entrada, /ESPERA_CURSOR_MS/)
    const salida = declaracionB('alSalirCursor')
    assert.match(salida, /clearTimeout\(esperaCursor\)/)
    assert.match(salida, /cursorEnMenu\.value = false/)
  })

  it('con el teclado se despliega al instante, sin animación', () => {
    const drawer = etiquetaDe(plantillaLayout, 'q-drawer')
    // Solo en escritorio: en el celular nunca hay cursor y el menú debe deslizarse.
    assert.match(drawer, /'menu-lateral--al-instante': esEscritorio && !cursorEnMenu/)
    // Quasar pone las clases en .q-drawer__content; la transición está en el <aside class="q-drawer">.
    assert.match(
      layout,
      /:global\(\.q-body--layout-animate \.q-drawer:has\(> \.menu-lateral--al-instante\)\)\s*\{[^}]*transition:\s*none !important/,
    )
  })

  it('con movimiento reducido el menú no se anima', () => {
    const reducido = layout.slice(layout.indexOf('@media (prefers-reduced-motion: reduce)'))
    assert.ok(layout.includes('@media (prefers-reduced-motion: reduce)'))
    // El menú puede compartir la regla con otros selectores (el contenido que lo acompaña).
    assert.match(reducido, /:global\(\.q-body--layout-animate \.q-drawer:has\(> \.menu-lateral\)\)[^{]*\{[^}]*transition:\s*none !important/)
  })
})

describe('Diálogo de cerrar sesión', () => {
  const dialogo = etiquetaDe(plantillaLayout, 'q-dialog')
  const tarjeta = plantillaLayout.slice(plantillaLayout.indexOf('<q-card class="dialogo-cierre"'))
  const tarjetaApertura = tarjeta.slice(0, tarjeta.indexOf('>') + 1)

  // Revisión de UI, rebanada 9: la misma entrada y salida que todos los diálogos (desde 0.95, no desde 0).
  it('aparece con la animación común de los diálogos, no desde escala 0', () => {
    assert.match(dialogo, /transition-show="dialogo-entra"/)
    assert.match(dialogo, /transition-hide="dialogo-sale"/)
    assert.match(dialogo, /:transition-duration="220"/)
  })

  it('el nombre accesible va en el q-dialog y la tarjeta no repite el rol', () => {
    assert.match(dialogo, /aria-labelledby="dialogo-cierre-titulo"/)
    assert.doesNotMatch(tarjetaApertura, /role=|aria-modal|aria-labelledby/)
  })

  it('el foco cae en «Cancelar», la opción segura', () => {
    const cancelar = tarjeta.slice(tarjeta.lastIndexOf('<q-btn', tarjeta.indexOf('label="Cancelar"')), tarjeta.indexOf('label="Cancelar"'))
    assert.match(cancelar, /\bautofocus\b/)
  })
})

describe('Menú del celular', () => {
  it('el botón de menú dice si el menú está abierto y cuál controla', () => {
    const boton = plantillaLayout.slice(plantillaLayout.lastIndexOf('<q-btn', plantillaLayout.indexOf('aria-label="Abrir menú de navegación"')))
    const apertura = boton.slice(0, boton.indexOf('/>'))
    assert.match(apertura, /:aria-expanded="drawerOpen \? 'true' : 'false'"/)
    assert.match(apertura, /aria-controls="menu-lateral"/)
    assert.match(apertura, /ref="botonMenu"/)
    assert.match(etiquetaDe(plantillaLayout, 'q-drawer'), /id="menu-lateral"/)
  })

  it('Escape cierra el menú del celular aunque el foco esté dentro', () => {
    assert.match(etiquetaDe(plantillaLayout, 'q-drawer'), /@keydown\.esc="cerrarMenuMovil"/)
    const cerrar = declaracionB('cerrarMenuMovil')
    assert.match(cerrar, /if \(esEscritorio\.value \|\| !drawerOpen\.value\) return/)
    assert.match(cerrar, /drawerOpen\.value = false/)
  })

  it('al abrir, el foco entra al menú; al cerrar, vuelve al botón', () => {
    const vigilancia = layout.slice(layout.indexOf('() => drawerOpen.value'))
    assert.match(vigilancia, /if \(esEscritorio\.value\) return/)
    assert.match(vigilancia, /#menu-lateral \.q-item--nav/)
    assert.match(vigilancia, /botonMenu\.value\?\.\$el\?\.focus\(\)/)
  })

  it('en el celular el logo sale del recorrido con Tab', () => {
    const logo = plantillaLayout.slice(plantillaLayout.lastIndexOf('<q-btn', plantillaLayout.indexOf('drawer-marca__logo-boton')))
    assert.match(logo.slice(0, logo.indexOf('>')), /:tabindex="esEscritorio \? 0 : -1"/)
  })
})

describe('Títulos de estados y nombres accesibles', () => {
  it('los títulos de vacío, error y del diálogo van en peso 600 y con alto de línea propio', () => {
    for (const [fuente, clase] of [[errorStateB, 'error-state__title'], [emptyState, 'empty-state__title'], [layout, 'dialogo-cierre__titulo']]) {
      const regla = fuente.match(new RegExp(String.raw`\.${clase}\s*\{([^}]*)\}`))?.[1] ?? ''
      assert.match(regla, /font-weight:\s*600/, `${clase}: peso 600`)
      assert.match(regla, /line-height:\s*1\.3/, `${clase}: alto de línea 1.3`)
    }
  })

  it('el nombre accesible de cada opción del menú contiene su texto visible', () => {
    // Cada opción del menú es un <q-item class="q-item--nav"> con su aria-label y su etiqueta visible.
    const opciones = plantillaLayout
      .split(/<q-item\r?\n/)
      .slice(1)
      .map((bloque) => bloque.slice(0, bloque.indexOf('</q-item>')))
      .filter((bloque) => bloque.includes('class="q-item--nav"'))
      .map((bloque) => [bloque, bloque.match(/aria-label="([^"]+)"/)?.[1] ?? '', bloque.match(/<q-item-label>([^<]+)<\/q-item-label>/)?.[1] ?? ''])
    assert.ok(opciones.length >= 7, 'opciones revisadas')
    for (const [, nombre, visible] of opciones) {
      assert.ok(nombre && visible, 'cada opción tiene nombre accesible y texto visible')
      assert.ok(nombre.toLowerCase().includes(visible.trim().toLowerCase()), `«${nombre}» contiene «${visible.trim()}»`)
    }
  })
})

// Grupo C: textos del menú, colores sueltos, borde lateral del error, un solo h1 y fecha de avisos.
const leerC = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const layoutC = leerC('../src/layouts/MaquetaLayout.vue')
const plantillaC = layoutC.split('<script')[0]
const estilosC = layoutC.slice(layoutC.indexOf('<style'))
const reglaDe = (fuente, clase) => fuente.match(new RegExp(String.raw`\.${clase}\s*\{([^}]*)\}`))?.[1]

describe('Grupo C: textos del menú en tú y sin ambigüedad', () => {
  it('«Cerrar sesión» en minúscula y el diálogo de cierre en tú', () => {
    assert.doesNotMatch(plantillaC, /Cerrar Sesión/)
    assert.match(plantillaC, /<q-item-label>Cerrar sesión<\/q-item-label>/)
    assert.doesNotMatch(plantillaC, /Tendrá que/)
    assert.match(plantillaC, /<p class="dialogo-cierre__texto">Tendrás que iniciar sesión de nuevo\.<\/p>/)
  })

  it('el menú del administrador dice «Resumen del equipo» y la pantalla se titula igual', () => {
    assert.doesNotMatch(plantillaC, /Dashboard admin|dashboard admin/)
    assert.match(plantillaC, /<q-item-label>Resumen del equipo<\/q-item-label>/)
    assert.match(plantillaC, /aria-label="Ir al resumen del equipo"/)
    const router = leerC('../src/router/index.js')
    assert.match(router, /titulo: 'Resumen del equipo'/)
    assert.doesNotMatch(router, /titulo: 'Dashboard del administrador'/)
  })

  it('la sección del contador se llama «Mi trabajo» (ya no repite «Mis casos»)', () => {
    assert.match(plantillaC, /<q-item-label header>Mi trabajo<\/q-item-label>/)
    assert.doesNotMatch(plantillaC, /<q-item-label header>Mis casos<\/q-item-label>/)
  })

  // Rebanada 3: el contador ve los casos que registra y los que le asigna el administrador.
  it('el vacío de «Mis casos» menciona los casos registrados y los asignados', () => {
    const misCasos = leerC('../src/pages/MyCasesPage.vue').split('<script')[0]
    const vacio = misCasos.match(/title="Todavía no tienes casos"\s*message="([^"]+)"/)?.[1]
    assert.ok(vacio, 'existe el vacío de «Mis casos»')
    assert.match(vacio, /Registra el primero/)
    assert.match(vacio, /te asigne el administrador/)
  })
})

describe('Grupo C: colores desde la paleta', () => {
  it('ScreenLoader usa el texto secundario de la paleta', () => {
    const loader = leerC('../src/components/ScreenLoader.vue')
    assert.doesNotMatch(loader, /#[0-9a-fA-F]{3,6}\b/)
    assert.match(reglaDe(loader, 'screen-loader__text') ?? '', /color:\s*var\(--dg-texto-secundario\)/)
  })

  it('el layout no tiene rgba sueltos: el borde y el fondo activo del menú están en la paleta', () => {
    assert.doesNotMatch(estilosC, /rgba\(/)
    assert.match(reglaDe(estilosC, 'drawer-usuario') ?? '', /border-top:\s*1px solid var\(--dg-borde-menu\)/)
    assert.match(reglaDe(estilosC, 'q-item--nav-activo') ?? '', /background:\s*var\(--dg-fondo-menu-activo\)/)
    const variables = leerC('../src/css/quasar.variables.scss')
    assert.match(variables, /borde-menu:\s*rgba\(255, 255, 255, 0\.16\)/)
    assert.match(variables, /fondo-menu-activo:\s*rgba\(255, 255, 255, 0\.1\)/)
  })

  it('los títulos del encabezado y del diálogo de cierre usan el color de texto de la paleta', () => {
    for (const clase of ['page-header__title', 'dialogo-cierre__titulo']) {
      assert.match(reglaDe(estilosC, clase) ?? '', /color:\s*var\(--dg-texto\)/, clase)
    }
  })
})

describe('Grupo C: aviso de error sin franja lateral', () => {
  it('ErrorState tiene un borde parejo, sin el borde izquierdo de 6 px', () => {
    const regla = reglaDe(leerC('../src/components/ErrorState.vue'), 'error-state')
    assert.ok(regla, 'existe la regla .error-state')
    assert.doesNotMatch(regla, /border-left/)
    assert.match(regla, /border:\s*1px solid/)
  })
})

describe('Grupo C: un solo h1 por pantalla (el del encabezado)', () => {
  for (const pagina of ['AdminDashboardPage', 'ContadorDashboardPage', 'AuditoriaFichaPage']) {
    it(`${pagina} no repite el h1 del encabezado: su título va en h2`, () => {
      const plantilla = leerC(`../src/pages/${pagina}.vue`).split('<script')[0]
      assert.doesNotMatch(plantilla, /<h1[\s>]/)
      assert.match(plantilla, /<h2 class="(dashboard-page__title|ficha__cliente)">/)
    })
  }
})

describe('Grupo C: fecha de los avisos de la campana', () => {
  it('la fecha usa el texto tenue de la paleta (no el gris de Quasar)', () => {
    const campana = leerC('../src/components/CampanaAvisos.vue')
    assert.match(campana.split('<script')[0], /<q-item-label caption class="campana-avisos__fecha">/)
    assert.match(reglaDe(campana, 'campana-avisos__fecha') ?? '', /color:\s*var\(--dg-texto-tenue\)/)
  })
})
