import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'

import {
  MODULOS,
  RUTA_DOCUMENTOS,
  RUTA_SELECTOR_MODULOS,
  destinoTrasEntrar,
  hayAccesoDocumentos,
  rolDocumentosDe,
  vistaInicialDocumentos,
} from '../src/utils/modulos.js'
import { crearAuthService, normalizarModulos } from '../src/services/authService.js'
import { CLAVES_SESION } from '../src/services/api.js'
import { crearSessionStore } from '../src/stores/session.js'

/*
 * Unión con Proyecto-documentos, fase 4: un login, varios módulos.
 * - A dónde va cada cuenta al entrar, qué rol tiene en documentos y qué vista ve primero.
 * - Los módulos se guardan con la sesión y se refrescan con el perfil.
 * - El router y el menú usan esas reglas.
 */

const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8')

const SEGUIMIENTO = { modulo: 'seguimiento', rol: null }
const doc = (rol) => ({ modulo: 'documentos', rol })

function crearAlmacenFalso() {
  const datos = new Map()
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  }
}

describe('a dónde se entra según los módulos', () => {
  it('con los dos módulos se elige primero; con solo documentos se entra ahí; si no, como siempre', () => {
    assert.equal(
      destinoTrasEntrar([SEGUIMIENTO, doc('contador')], '/contador/casos'),
      RUTA_SELECTOR_MODULOS,
    )
    assert.equal(destinoTrasEntrar([doc('practicante')], '/contador/casos'), RUTA_DOCUMENTOS)
    assert.equal(destinoTrasEntrar([SEGUIMIENTO], '/contador/casos'), '/contador/casos')
    assert.equal(
      destinoTrasEntrar([], '/admin/dashboard'),
      '/admin/dashboard',
      'una sesión vieja sin módulos sigue igual',
    )
  })

  it('un rol de documentos desconocido no cuenta como módulo', () => {
    assert.equal(destinoTrasEntrar([SEGUIMIENTO, doc('jefe')], '/juntas'), '/juntas')
  })
})

describe('rol y permisos dentro de documentos', () => {
  it('el rol se traduce al nombre que usan los permisos de documentos', () => {
    assert.equal(rolDocumentosDe([SEGUIMIENTO, doc('contador')]), 'Contador')
    assert.equal(rolDocumentosDe([doc('administrador')]), 'Administrador')
    assert.equal(rolDocumentosDe([SEGUIMIENTO]), null)
    assert.equal(rolDocumentosDe(undefined), null)
  })

  it('los permisos son los mismos que en el backend', () => {
    const backend = leer('../../Backend/src/modulos/documentos/logica/errores.mjs')
    for (const [accion, roles] of Object.entries({
      registrar_recepcion: ['Recepcionista', 'Administrador', 'Sistemas'],
      ver_directorio: ['Contador', 'Administrador', 'Practicante', 'Sistemas'],
      cambiar_estado: ['Contador', 'Administrador', 'Sistemas'],
      administrar_usuarios: ['Administrador', 'Sistemas'],
      ver_seguimiento: ['Cliente', 'Contador', 'Administrador', 'Practicante', 'Sistemas'],
    })) {
      assert.ok(
        backend.includes(
          `${accion}: Object.freeze(${JSON.stringify(roles).replace(/"/g, "'").replace(/,/g, ', ')})`,
        ),
        accion,
      )
      for (const rol of roles) assert.ok(hayAccesoDocumentos(rol, accion), `${rol} puede ${accion}`)
    }
    assert.equal(hayAccesoDocumentos('Practicante', 'cambiar_estado'), false)
    assert.equal(hayAccesoDocumentos(null, 'ver_seguimiento'), false)
  })

  it('cada rol entra a la primera vista que puede usar', () => {
    assert.equal(vistaInicialDocumentos('Recepcionista'), 'doc-recepcion')
    assert.equal(vistaInicialDocumentos('Administrador'), 'doc-recepcion')
    assert.equal(vistaInicialDocumentos('Contador'), 'doc-dashboard')
    assert.equal(vistaInicialDocumentos('Practicante'), 'doc-dashboard')
    assert.equal(vistaInicialDocumentos('Cliente'), 'doc-seguimiento')
    assert.equal(vistaInicialDocumentos(null), null)
  })
})

describe('los módulos viajan con la sesión', () => {
  it('normalizarModulos deja solo lo bien formado', () => {
    assert.deepEqual(
      normalizarModulos([
        SEGUIMIENTO,
        doc('contador'),
        { modulo: '' },
        null,
        { rol: 'x' },
        { modulo: 'otro', rol: 5 },
      ]),
      [SEGUIMIENTO, doc('contador'), { modulo: 'otro', rol: null }],
    )
    assert.deepEqual(normalizarModulos('no es lista'), [])
  })

  it('el login guarda los módulos y una sesión sin ellos no deja clave', async () => {
    const almacen = crearAlmacenFalso()
    const api = {
      post: async () => ({
        data: { rol: 'contador', id: 3, nombre: 'Ana', modulos: [SEGUIMIENTO, doc('contador')] },
      }),
    }
    const servicio = crearAuthService({ api, almacen })
    const sesion = await servicio.login('ana@delgrow.mx', 'x')
    assert.deepEqual(sesion.modulos, [SEGUIMIENTO, doc('contador')])
    assert.deepEqual(servicio.getModulos(), [SEGUIMIENTO, doc('contador')])

    servicio.setModulos([])
    assert.equal(almacen.getItem(CLAVES_SESION.modulos), null)
  })

  it('un valor roto en el almacén cuenta como ningún módulo', () => {
    const almacen = crearAlmacenFalso()
    almacen.setItem(CLAVES_SESION.modulos, '{roto')
    assert.deepEqual(crearAuthService({ api: {}, almacen }).getModulos(), [])
  })

  it('el store expone el rol de documentos, si hay varios módulos y si tiene uno', () => {
    setActivePinia(createPinia())
    const almacen = crearAlmacenFalso()
    const authService = crearAuthService({ api: {}, almacen })
    authService.setSesion({
      rol: 'auxiliar',
      id: 8,
      nombre: 'Pedro',
      modulos: [SEGUIMIENTO, doc('practicante')],
    })
    const store = crearSessionStore({
      authService,
      registrarOnActividad: () => {},
      registrarOnSesionExpirada: () => {},
    })()
    assert.equal(store.rolDocumentos, 'Practicante')
    assert.equal(store.variosModulos, true)
    assert.equal(store.tieneModulo(MODULOS.seguimiento), true)
    store.limpiarEstadoLocal()
    assert.deepEqual(store.modulos, [])
    assert.equal(store.rolDocumentos, null)
  })
})

describe('router y menú de la app unida', () => {
  const router = leer('../src/router/index.js')
  const layout = leer('../src/layouts/MaquetaLayout.vue')

  it('hay selector de módulos y una ruta por vista de documentos, cada una con su permiso', () => {
    assert.match(router, /path: '\/modulos'[\s\S]*?name: 'modulos'/)
    for (const [nombre, accion] of [
      ['doc-recepcion', 'registrar_recepcion'],
      ['doc-direccionamiento', 'registrar_recepcion'],
      ['doc-dashboard', 'ver_directorio'],
      ['doc-clientes', 'ver_directorio'],
      ['doc-seguimiento', 'ver_seguimiento'],
      ['doc-accesos', 'administrar_usuarios'],
    ]) {
      assert.match(
        router,
        new RegExp(`rutaDocumentos\\('[\\w-]+', '${nombre}', [^\\n]*'${accion}'`),
        nombre,
      )
    }
  })

  it('la guardia niega la vista de documentos sin permiso y manda a documentos a quien no tiene seguimiento', () => {
    assert.match(
      router,
      /if \(!hayAccesoDocumentos\(sesion\.rolDocumentos, to\.meta\.accion\)\) \{\s*accessDenied\.value = true/,
    )
    assert.match(
      router,
      /!sesion\.tieneModulo\(MODULOS\.seguimiento\)\) \{\s*return \{ name: 'documentos', replace: true \}/,
    )
  })

  it('el menú cambia con el módulo y ofrece cambiar de módulo a quien tiene varios', () => {
    assert.match(layout, /<template v-if="!enDocumentos">/)
    assert.match(layout, /<template v-if="enDocumentos">/)
    assert.match(
      layout,
      /<template v-if="session\.variosModulos">[\s\S]*?:to="\{ name: 'modulos' \}"/,
    )
    assert.match(
      layout,
      /const enDocumentos = computed\(\(\) => route\.meta\?\.modulo === MODULOS\.documentos\)/,
    )
    assert.match(
      layout,
      /\.filter\(\(o\) => o\.permitida\)/,
      'solo las vistas que su rol puede usar',
    )
  })

  it('el cliente HTTP de documentos manda la cabecera anti-CSRF y avisa la sesión caducada', () => {
    const cliente = leer('../src/modulos/documentos/servicios/cliente.js')
    assert.match(
      cliente,
      /const CABECERAS_APP = Object\.freeze\(\{ \[CABECERA_CSRF\.nombre\]: CABECERA_CSRF\.valor \}\)/,
    )
    assert.equal(
      cliente.split('...CABECERAS_APP').length - 1,
      2,
      'en peticiones JSON y en la subida de archivos',
    )
    assert.match(cliente, /avisarSesionExpirada\(\{ estado: ESTADOS_ERROR\.SIN_SESION/)
    const api = leer('../src/modulos/documentos/servicios/api.js')
    assert.doesNotMatch(api, /\/api\//, 'todas las rutas van a /doc del backend unido')
  })

  it('el aviso de Acceso denegado muestra el rol de documentos y vuelve al inicio del módulo', () => {
    const aviso = leer('../src/components/AccessDenied.vue')
    assert.match(
      aviso,
      /const enDocumentos = computed\(\(\) => route\.meta\?\.modulo === MODULOS\.documentos\)/,
    )
    assert.match(aviso, /Tu rol en Recepción de documentos es/)
    assert.match(aviso, /vistaInicialDocumentos\(sesion\.rolDocumentos\)/)
  })
})
