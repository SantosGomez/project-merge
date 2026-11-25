// Rebanada 06: «Mi perfil». La cuenta propia (GET /auth/perfil) y «Mis auxiliares» comparten
// la vista ContadorAuxiliaresPage; el acceso es desde el nombre al pie del menú lateral.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { crearAuthService } from '../src/services/authService.js'
import { PROFILES } from '../src/utils/constants.js'
import { decidirAcceso } from '../src/utils/accessRules.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const pagina = leer('../src/pages/ContadorAuxiliaresPage.vue')
const plantilla = pagina.split('<script')[0]
const menu = leer('../src/layouts/MaquetaLayout.vue')
const router = leer('../src/router/index.js')
const resumen = leer('../src/pages/ContadorDashboardPage.vue')

const almacenFalso = () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} })

describe('authService.obtenerPerfil', () => {
  it('pide GET /auth/perfil y devuelve los datos de la cuenta', async () => {
    const perfil = { id: 4, nombre: 'Ana', correo: 'ana@delgrow.mx', rol: 'contador', creado_en: '2026-01-05 09:30:00', ultimo_acceso_en: null }
    const llamadas = []
    const api = { get: async (url) => { llamadas.push(url); return { data: perfil } } }

    const servicio = crearAuthService({ api, almacen: almacenFalso() })

    assert.deepEqual(await servicio.obtenerPerfil(), perfil)
    assert.deepEqual(llamadas, ['/auth/perfil'])
  })

  it('propaga el error normalizado', async () => {
    const error = { estado: 'red', mensaje: 'No hay conexión', codigoHttp: 0 }
    const api = { get: async () => { throw error } }

    const servicio = crearAuthService({ api, almacen: almacenFalso() })

    await assert.rejects(() => servicio.obtenerPerfil(), error)
  })
})

describe('ruta «Mi perfil»', () => {
  const bloque = router.slice(router.indexOf("name: 'mi-perfil'"))

  it('es la ruta perfil, pinta la vista existente y es para contador y auxiliar', () => {
    assert.match(router, /path: 'perfil',\s+name: 'mi-perfil',\s+component: ContadorAuxiliaresPage/)
    assert.match(bloque, /perfil: \[PROFILES\.contador, PROFILES\.auxiliar\]/)
    assert.match(bloque, /titulo: 'Mi perfil'/)
  })

  it('contador/auxiliares solo redirige a mi-perfil', () => {
    assert.match(router, /path: 'contador\/auxiliares',[\s\S]*?redirect: \{ name: 'mi-perfil' \}/)
    assert.doesNotMatch(router, /name: 'contador-auxiliares'/)
  })

  it('el auxiliar entra y el administrador no', () => {
    const acceso = (rol) =>
      decidirAcceso({
        ruta: { requiereSesion: true, perfil: [PROFILES.contador, PROFILES.auxiliar] },
        sesion: { autenticado: true, rol },
      }).accion
    assert.equal(acceso('auxiliar'), 'permitir')
    assert.equal(acceso('contador'), 'permitir')
    assert.equal(acceso('administrador'), 'denegar')
  })
})

describe('vista «Mi perfil»: sección «Mi cuenta»', () => {
  it('es la primera sección, una tarjeta con borde y su título de sección', () => {
    assert.match(plantilla, /<q-card[^>]*flat[^>]*bordered[^>]*>/)
    assert.ok(plantilla.indexOf('Mi cuenta') < plantilla.indexOf('Mis auxiliares'))
    assert.match(plantilla, /<h2[^>]*>Mi cuenta<\/h2>/)
  })

  it('ya no tiene su propio h1 «Mis auxiliares»', () => {
    assert.doesNotMatch(plantilla, /<h1/)
  })

  it('muestra avatar con iniciales, nombre, rol legible y los tres datos con su etiqueta', () => {
    assert.match(plantilla, /<q-avatar/)
    assert.match(pagina, /formatearRol/)
    for (const etiqueta of ['Correo', 'Cuenta creada el', 'Último inicio de sesión']) {
      assert.ok(plantilla.includes(etiqueta), `falta la etiqueta ${etiqueta}`)
    }
    assert.match(plantilla, /Sin registro/)
  })

  it('mientras carga usa esqueletos y si falla muestra ErrorState con «Reintentar» solo en esa sección', () => {
    assert.match(plantilla, /<q-skeleton/)
    assert.match(plantilla, /<ErrorState[^>]*perfilError|<ErrorState[^>]*errorPerfil/)
    assert.match(pagina, /obtenerPerfil/)
  })

  it('formatea las fechas sin new Date', () => {
    assert.doesNotMatch(pagina, /new Date\(/)
    assert.match(pagina, /fechaParaFormulario/)
  })
})

describe('vista «Mi perfil»: sección «Mis auxiliares»', () => {
  it('solo la ve el contador y el auxiliar no pide sus datos', () => {
    assert.match(plantilla, /<section[^>]*v-if="session\.esContador"/)
    assert.match(pagina, /if \(session\.esContador\)[\s\S]{0,40}cargarAuxiliares/)
  })

  it('conserva el texto de ayuda, «Agregar auxiliar», la lista y el estado vacío', () => {
    assert.match(plantilla, /label="Agregar auxiliar"/)
    assert.match(plantilla, /Todavía no tienes auxiliares/)
    assert.match(plantilla, /el despacho también puede hacerlo/)
    assert.match(plantilla, /<AgregarAuxiliaresDialog/)
  })
})

describe('vista «Mi perfil»: menú y enlaces', () => {
  it('el menú ya no tiene el ítem «Mis auxiliares»', () => {
    assert.doesNotMatch(menu, /Mis auxiliares/)
    assert.doesNotMatch(menu, /contador-auxiliares/)
  })

  it('el bloque del usuario es un enlace a «Mi perfil» solo para quien trabaja casos', () => {
    const bloque = menu.slice(menu.indexOf('class="drawer-usuario"'), menu.indexOf('drawer-usuario__salir'))
    assert.match(bloque, /:to="\{ name: 'mi-perfil' \}"/)
    assert.match(bloque, /aria-label="Ir a mi perfil"/)
    assert.match(bloque, /:aria-current="paginaActual\('mi-perfil'\)"/)
    assert.match(bloque, /active-class="drawer-usuario__fila--activa"/)
    assert.match(bloque, /v-if="session\.nombreVisible && session\.trabajaCasos"/)
    assert.match(bloque, /<p class="drawer-usuario__nombre">\{\{ session\.nombreVisible \}\}<\/p>/)
    assert.doesNotMatch(bloque, /q-tooltip/, 'el nombre visible no se repite en un tooltip')
  })

  it('para administrador y usuario de sistema el bloque sigue sin enlace', () => {
    const bloque = menu.slice(menu.indexOf('class="drawer-usuario"'), menu.indexOf('drawer-usuario__salir'))
    assert.match(bloque, /<div v-else-if="session\.nombreVisible" class="drawer-usuario__fila"/)
  })

  it('el foco del enlace es celeste como el de los demás ítems', () => {
    assert.match(menu, /\.drawer-usuario__fila--enlace:focus-visible\s*\{[^}]*var\(--q-secondary\)/)
  })

  it('«Ver mis auxiliares» de «Mi equipo» lleva a mi-perfil', () => {
    assert.match(resumen, /label="Ver mis auxiliares"\s+:to="\{ name: 'mi-perfil' \}"/)
    assert.doesNotMatch(resumen, /contador-auxiliares/)
  })
})
