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
