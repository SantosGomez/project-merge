// Revisión de UI, rebanada 1 (Acceso), grupo A: página 404, «Acceso denegado» sin textos de
// maqueta, bloqueo por intentos y error de red del inicio de sesión, y foco de la casilla.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { ESTADOS_ERROR } from '../src/services/api.js'
import { errorDeConexionLogin } from '../src/utils/mensajesInicioSesion.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const router = leer('../src/router/index.js')
const noEncontrada = leer('../src/pages/[...path].vue')
const plantilla404 = noEncontrada.split('<script')[0]
const aviso = leer('../src/components/AccessDenied.vue')
const login = leer('../src/pages/LoginPage.vue')
const plantillaLogin = login.split('<script')[0]

describe('Página 404', () => {
  it('toda dirección desconocida abre la página 404 dentro del layout del login', () => {
    assert.match(router, /import PaginaNoEncontrada from '\.\.\/pages\/\[\.\.\.path\]\.vue'/)
    const ruta = router.slice(router.indexOf("path: '/:pathMatch(.*)*'"))
    assert.ok(router.includes("path: '/:pathMatch(.*)*'"), 'existe la ruta comodín')
    assert.match(ruta, /component: LoginLayout/)
    assert.match(ruta, /name: 'no-encontrada'/)
    assert.match(ruta, /component: PaginaNoEncontrada/)
    assert.match(ruta, /titulo: 'Página no encontrada'/)
  })

  it('está en español, con un encabezado y una salida clara', () => {
    assert.match(plantilla404, /<h1[^>]*>No encontramos esta página<\/h1>/)
    assert.match(plantilla404, /La dirección no existe o cambió/)
    assert.doesNotMatch(noEncontrada, /Oops|Nothing here|Go Home/, 'sin la plantilla en inglés')
    assert.match(plantilla404, /<q-btn[\s\S]*?:label="destino\.etiqueta"[\s\S]*?:to="destino\.ruta"/)
    assert.match(plantilla404, /<q-tooltip>\{\{ destino\.ayuda \}\}<\/q-tooltip>/)
  })

  it('con sesión lleva a la pantalla principal; sin sesión, al inicio de sesión', () => {
    assert.match(noEncontrada, /useSessionStore\(\)/)
    assert.match(noEncontrada, /sesion\.autenticado && sesion\.pantallaPrincipal/)
    assert.match(noEncontrada, /'Ir a mi pantalla principal'/)
    assert.match(noEncontrada, /'Ir al inicio de sesión'/)
  })

  it('usa la paleta y la tarjeta del login, sin colores de Quasar ni estilos en línea', () => {
    assert.match(plantilla404, /<q-card[^>]*class="no-encontrada__card"/)
    assert.match(plantilla404, /logos\/PNG\/DELGROW_LOGO-OF\.png/)
    assert.doesNotMatch(plantilla404, /style="|bg-blue|text-blue|color="white"/)
    assert.doesNotMatch(noEncontrada, /#[0-9a-fA-F]{3,8}\b/, 'sin hexadecimales')
  })
})

describe('«Acceso denegado» sin textos de maqueta', () => {
  it('lee el rol de la sesión real, no del store de la maqueta', () => {
    assert.doesNotMatch(aviso, /useMaquetaStore|maqueta\.session/)
    assert.match(aviso, /PANTALLA_PRINCIPAL_POR_ROL\[sesion\.rol\]/)
    assert.match(aviso, /formatearRol\(sesion\.rol\)/)
  })

  it('la ayuda habla de la app real: perfil de la cuenta y a quién pedir acceso', () => {
    assert.doesNotMatch(aviso, /maqueta|cuenta de ejemplo/i)
    assert.match(aviso, /Si necesitas ver esta pantalla, pídele al administrador que revise tu perfil\./)
    assert.equal((aviso.split('<script')[0].match(/<q-item[\s>]/g) ?? []).length, 2, 'dos puntos de ayuda')
  })
})

describe('Inicio de sesión: bloqueo por intentos y error de conexión', () => {
  it('el bloqueo por intentos tiene su propio aviso, sin el botón «Reintentar»', () => {
    assert.match(login, /resultado\.error\?\.estado === ESTADOS_ERROR\.DEMASIADOS_INTENTOS/)
    const banner = plantillaLogin.slice(plantillaLogin.indexOf('v-if="errorBloqueo"'))
    const bloque = banner.slice(0, banner.indexOf('</q-banner>'))
    assert.ok(bloque, 'existe el aviso de bloqueo')
    assert.match(bloque, /role="alert"/)
    assert.doesNotMatch(bloque, /Reintentar/)
  })

  it('el error de conexión del login no muestra la ruta técnica de la petición', () => {
    assert.match(login, /errorConexion\.value = errorDeConexionLogin\(resultado\.error\)/)
  })

  it('sin red explica qué hacer en lenguaje llano', () => {
    const error = errorDeConexionLogin({
      estado: ESTADOS_ERROR.RED,
      mensaje: 'Qué ocurrió: No se pudo conectar con el servidor. Sobre: la petición POST /auth/login. Qué hacer: x.',
    })
    assert.doesNotMatch(error.mensaje, /POST|\/auth\/login|petición/)
    assert.match(error.mensaje, /No se pudo conectar con el servidor/)
    assert.match(error.mensaje, /el inicio de sesión/)
    assert.match(error.mensaje, /revisa tu conexión a internet/)
    assert.equal(error.estado, ESTADOS_ERROR.RED)
  })

  it('si el servidor falla sin explicar, el mensaje es del inicio de sesión; si explica, se respeta', () => {
    const sinTexto = errorDeConexionLogin({
      estado: ESTADOS_ERROR.SERVIDOR,
      mensaje: 'Qué ocurrió: El servidor no pudo completar la petición. Sobre: la petición POST /auth/login. Qué hacer: x.',
      datos: null,
    })
    assert.doesNotMatch(sinTexto.mensaje, /POST|petición/)
    assert.match(sinTexto.mensaje, /avisa al administrador/)

    const delBackend = { estado: ESTADOS_ERROR.SERVIDOR, mensaje: 'Base de datos no disponible', datos: { mensaje: 'Base de datos no disponible' } }
    assert.equal(errorDeConexionLogin(delBackend).mensaje, 'Base de datos no disponible')
  })
})

describe('Foco visible en «Mantener sesión iniciada»', () => {
  it('la casilla muestra el mismo anillo de foco que el resto de controles', () => {
    assert.match(login, /\.login-form__mantener:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--dg-foco\)/)
  })
})

// --- Grupo B: legibilidad, textos y áreas táctiles --------------------------------------

const variables = leer('../src/css/quasar.variables.scss')
const cambio = leer('../src/pages/CambiarContrasenaPage.vue')
const plantillaCambio = cambio.split('<script')[0]
const caducada = leer('../src/components/AvisoSesionCaducada.vue')
const plantillaCaducada = caducada.split('<script')[0]
const colorDe = (nombre) => variables.match(new RegExp(String.raw`\$${nombre}:\s*(#[0-9a-fA-F]{6})`))?.[1]
const deLaPaleta = (nombre) =>
  variables
    .match(/\$dg-colores:\s*\(([\s\S]*?)\);/)?.[1]
    .match(new RegExp(String.raw`(?:^|\s)${nombre}:\s*(#[0-9a-fA-F]{6})`))?.[1]

describe('Tooltips y colores de aviso en toda la app', () => {
  it('los tooltips usan la tinta de la paleta y letra legible', () => {
    assert.match(deLaPaleta('texto') ?? '', /^#[0-9a-f]{6}$/i, 'se leyó el color de la paleta')
    assert.equal(colorDe('tooltip-background'), deLaPaleta('texto'), 'fondo = dg-texto')
    assert.match(variables, /\$tooltip-fontsize:\s*0\.8125rem/, '13 px en escritorio')
    assert.match(variables, /\$tooltip-mobile-fontsize:\s*0\.875rem/, '14 px en celular')
  })

  it('los avisos de error y éxito de Quasar son los de la paleta', () => {
    assert.match(colorDe('negative') ?? '', /^#[0-9a-f]{6}$/i, 'se leyó $negative')
    assert.equal(colorDe('negative'), deLaPaleta('error'), '$negative = dg-error')
    assert.equal(colorDe('positive'), deLaPaleta('exito'), '$positive = dg-exito')
  })
})

describe('Textos de acceso en trato de tú y sin jerga', () => {
  it('el login no usa «usted» ni la palabra «Credenciales»', () => {
    assert.doesNotMatch(login, /Debe iniciar sesión|Verifique|Credenciales no válidas/)
    assert.match(login, /'El correo o la contraseña no son correctos\. Revísalos y vuelve a intentarlo\.'/)
    assert.match(plantillaLogin, /Inicia sesión para abrir esta pantalla\./)
    assert.match(plantillaLogin, /Tu sesión se cerró\. Vuelve a iniciar sesión para continuar\./)
  })

  it('el bloqueo por intentos se explica en tú, sin el texto del servidor en usted', () => {
    assert.match(login, /errorBloqueo\.value = MENSAJE_BLOQUEO_LOGIN/)
  })

  it('«Sesión caducada» es un aviso breve, sin «token» ni rótulos de plantilla', () => {
    assert.match(plantillaCaducada, /<h2[^>]*>Tu sesión se cerró<\/h2>/)
    assert.doesNotMatch(caducada, /token|Qué ocurrió:|Sobre qué dato|inicie sesión|su sesión/i)
    assert.match(plantillaCaducada, /Vuelve a iniciar sesión para continuar\./)
    assert.match(plantillaCaducada, /label="Ir al inicio de sesión"/)
  })
})

describe('Requisito de la contraseña nueva visible', () => {
  it('el requisito va como ayuda fija bajo el campo, no solo en un tooltip', () => {
    const campo = plantillaCambio.slice(plantillaCambio.indexOf('ref="nuevaInput"'), plantillaCambio.indexOf('ref="confirmacionInput"'))
    assert.match(campo, /hint="Mínimo 8 caracteres, distinta a la que te dio el administrador\."/)
    assert.doesNotMatch(campo, /cambio-form__help-icon/, 'ya no hace falta el icono de ayuda')
  })

  it('«Confirmar contraseña» no lleva icono de ayuda: su etiqueta se lee completa a 375 px', () => {
    assert.doesNotMatch(plantillaCambio, /cambio-form__help-icon/)
  })
})

describe('Áreas táctiles de 44 px en los botones del ojo', () => {
  it('el ojo de la contraseña mide al menos 44 px en el login y en el cambio', () => {
    for (const [fuente, clase] of [[login, 'login-form__ver-contrasena'], [cambio, 'cambio-form__ver']]) {
      const plantilla = fuente.split('<script')[0]
      const boton = plantilla.slice(plantilla.indexOf(`class="${clase}"`) - 40, plantilla.indexOf(`class="${clase}"`) + 200)
      assert.doesNotMatch(boton, /\bdense\b/, `${clase}: sin dense`)
      assert.match(
        fuente,
        new RegExp(String.raw`\.${clase}\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px`),
        `${clase}: 44 px`,
      )
    }
  })
})

// --- Grupo C: detalles -------------------------------------------------------------------

const indexHtml = leer('../index.html')
const appScss = leer('../src/css/app.scss')

describe('Detalles de las pantallas de acceso', () => {
  it('la pestaña del navegador lleva el nombre de la app', () => {
    assert.match(indexHtml, /<title>Seguimiento de Proyectos<\/title>/)
    assert.match(indexHtml, /<meta name="description" content="Seguimiento de Proyectos · Grupo DelGrow S\.C\." \/>/)
  })

  it('la bienvenida es neutra y los títulos de las tarjetas van en peso 600', () => {
    assert.match(plantillaLogin, /<h1 class="login-page__title">Te damos la bienvenida<\/h1>/)
    for (const [fuente, clase] of [[login, 'login-page__title'], [cambio, 'cambio-page__title']]) {
      assert.match(fuente, new RegExp(String.raw`\.${clase}\s*\{[^}]*font-weight:\s*600`), `${clase}: peso 600`)
    }
  })

  it('el logo, que es lo primero que se ve, carga de inmediato', () => {
    for (const fuente of [login, cambio, noEncontrada]) {
      const logo = fuente.slice(fuente.indexOf('<q-img'), fuente.indexOf('/>', fuente.indexOf('<q-img')))
      assert.match(logo, /loading="eager"/)
      assert.match(logo, /fetchpriority="high"/)
    }
  })

  // Revisión de UI, rebanada 9: usa la clase común `boton-presionable` (app.scss), que ya apaga la
  // escala con movimiento reducido; ya no hay una copia propia del efecto en cada pantalla.
  it('el botón principal responde al presionarlo (sin moverse con movimiento reducido)', () => {
    for (const [fuente, clase] of [[login, 'login-form__submit'], [cambio, 'cambio-form__submit']]) {
      assert.match(fuente, new RegExp(String.raw`class="${clase} control-touch boton-presionable"`), `${clase}: clase común`)
      assert.doesNotMatch(fuente, new RegExp(String.raw`\.${clase}:active`), `${clase}: sin copia propia`)
    }
    assert.match(appScss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.boton-presionable:active:not\(\.disabled\)\s*\{[^}]*transform:\s*none/)
  })

  it('el movimiento reducido apaga las transiciones reales de campos y selectores', () => {
    const reducido = appScss.slice(appScss.indexOf('@media (prefers-reduced-motion: reduce)'))
    assert.ok(appScss.includes('@media (prefers-reduced-motion: reduce)'), 'existe la regla global')
    for (const selector of ['.input-moderno .q-field__control', '.selector-moderno .q-field__control', '.selector-moderno .q-select__dropdown-icon']) {
      assert.ok(reducido.includes(selector), `apaga ${selector}`)
    }
    assert.match(reducido, /transition:\s*none !important/)
  })

  it('la ayuda de «Acceso denegado» ya no lleva el borde lateral decorativo', () => {
    assert.doesNotMatch(aviso, /\.access-denied__help\s*\{[^}]*border-left/)
  })
})
