// Cascarón de Ajustes (rebanadas 52 y 52b): una pantalla con las pestañas «Clientes» y «Usuarios»,
// el endpoint de solo lectura de clientes, la ruta con su redirección y el menú.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { crearAjustesService } from '../src/services/ajustesService.js'
import { decidirAcceso } from '../src/utils/accessRules.js'
import { PROFILES } from '../src/utils/constants.js'
import { hayAccesoDocumentos } from '../src/utils/modulos.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8').replace(/\r\n/g, '\n')

describe('Ajustes: servicio de clientes', () => {
  it('pide GET /ajustes/clientes y devuelve la lista', async () => {
    const llamadas = []
    const api = {
      async get(url) {
        llamadas.push(url)
        return { data: { clientes: [{ id: 1, nombre: 'Cliente' }] } }
      },
    }
    const clientes = await crearAjustesService({ api }).listarClientes()
    assert.deepEqual(llamadas, ['/ajustes/clientes'])
    assert.deepEqual(clientes, [{ id: 1, nombre: 'Cliente' }])
  })

  it('rechaza una respuesta que no trae la lista', async () => {
    const api = { get: async () => ({ data: {} }) }
    await assert.rejects(
      () => crearAjustesService({ api }).listarClientes(),
      (error) => error.estado === 'respuesta_inesperada' && /lista de clientes/.test(error.mensaje),
    )
  })
})

describe('Ajustes: ruta y acceso', () => {
  const router = leer('../src/router/index.js')
  const bloqueAjustes = () => {
    const inicio = router.indexOf("name: 'ajustes'")
    assert.ok(inicio >= 0, 'falta la ruta ajustes')
    return router.slice(inicio, router.indexOf("titulo: 'Ajustes'", inicio))
  }

  it('la ruta /ajustes la abren administrador, sistemas y recepcionista', () => {
    const bloque = bloqueAjustes()
    const perfiles = [...bloque.matchAll(/PROFILES\.(\w+)/g)].map(([, clave]) => PROFILES[clave])
    assert.deepEqual(perfiles.sort(), ['administrador', 'recepcionista', 'usuarios_de_sistema'])
    for (const rol of perfiles) {
      const decision = decidirAcceso({
        ruta: { requiereSesion: true, perfil: perfiles },
        sesion: { autenticado: true, rol },
      })
      assert.equal(decision.accion, 'permitir', rol)
    }
    for (const rol of ['contador', 'auxiliar']) {
      const decision = decidirAcceso({
        ruta: { requiereSesion: true, perfil: perfiles },
        sesion: { autenticado: true, rol },
      })
      assert.equal(decision.accion, 'denegar', rol)
    }
  })

  it('/ajustes es una ruta de nivel superior con su propio layout, sin el menú de módulo', () => {
    assert.match(
      router,
      /path: '\/ajustes',\s*component: AjustesLayout,\s*children: \[\s*\{\s*path: '',\s*name: 'ajustes'/,
    )
    assert.doesNotMatch(router, /path: 'ajustes'/, 'ya no cuelga de MaquetaLayout')
    const layout = leer('../src/layouts/AjustesLayout.vue')
    assert.match(layout, /<q-layout/)
    assert.match(layout, /<q-page-container/)
    assert.match(layout, /<router-view/)
    assert.doesNotMatch(layout, /MenuDock|MaquetaLayout/)
  })

  it('admin/directorio muestra el directorio a la recepcionista y manda a Ajustes al administrador y a sistemas', () => {
    const inicio = router.indexOf("path: 'admin/directorio'")
    assert.ok(inicio >= 0)
    const bloque = router.slice(inicio, router.indexOf('\n      },', inicio))
    assert.match(bloque, /name: 'admin-directorio'/)
    assert.match(bloque, /component: CountersDirectoryPage/)
    assert.match(bloque, /perfil: \[PROFILES\.recepcionista\]/)
    assert.match(bloque, /beforeEnter:/)
    assert.match(bloque, /esAdministrador \|\| \w+\.esUsuarioSistema/)
    assert.match(bloque, /\{ name: 'ajustes', query: \{ tab: 'usuarios' \}/)
  })

  it('el dashboard del administrador y los volverA apuntan a Ajustes', () => {
    assert.doesNotMatch(router, /volverA: 'admin-directorio'/)
    assert.match(leer('../src/pages/AdminDashboardPage.vue'), /:to="\{ name: 'ajustes'/)
  })
})

describe('Ajustes: layout propio', () => {
  it('trae el título, «Volver a módulos» con tooltip y muestra el bloqueo de ruta', () => {
    const layout = leer('../src/layouts/AjustesLayout.vue')
    assert.match(layout, /<h1[^>]*>Ajustes<\/h1>/)
    assert.match(layout, /label="Volver a módulos"/)
    assert.match(layout, /:to="\{ name: 'modulos' \}"/)
    assert.match(layout, /<q-tooltip>[^<]*<\/q-tooltip>/)
    assert.match(layout, /boton-presionable/)
    assert.match(layout, /<AccessDenied/)
    assert.doesNotMatch(layout, /transition:\s*all/)
    assert.doesNotMatch(layout, /#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('Ajustes: menú de Seguimiento (dock y menú lateral)', () => {
  const layout = leer('../src/layouts/MaquetaLayout.vue')

  it('«Ajustes» ya no está en el menú de Seguimiento: se abre desde el selector de módulos', () => {
    assert.doesNotMatch(layout, /name: 'ajustes'/)
    assert.doesNotMatch(layout, /Ir a Ajustes/)
    assert.doesNotMatch(layout, /<q-item-label>Ajustes<\/q-item-label>/)
  })

  it('«Directorio» queda solo para la recepcionista, igual en el dock y en el menú lateral', () => {
    assert.equal((layout.match(/<q-item-label>Directorio<\/q-item-label>/g) ?? []).length, 1)
    assert.equal((layout.match(/:to="\{ name: 'admin-directorio' \}"/g) ?? []).length, 1)
    assert.equal((layout.match(/aria-label="Ir al directorio de usuarios"/g) ?? []).length, 1)
    assert.equal(
      (
        layout.match(
          /opcion\('admin-directorio', 'Directorio', 'Consultar cuentas del equipo', 'group', 'admin-directorio', 'Ir al directorio de usuarios'\)/g,
        ) ?? []
      ).length,
      1,
    )
    const inicio = layout.indexOf('<template v-if="session.esRecepcionista">')
    const seccion = layout.slice(inicio, layout.indexOf('</template>', inicio))
    assert.match(seccion, /name: 'admin-directorio'/)
    assert.match(seccion, /Consultar cuentas del equipo/)
    assert.match(seccion, /<q-icon name="group" \/>/)
    assert.doesNotMatch(seccion, /q-tooltip/)
  })

  it('sistemas ya no tiene sección propia en el menú de Seguimiento', () => {
    assert.doesNotMatch(layout, /session\.esUsuarioSistema/)
  })
})

describe('Ajustes: pantalla con pestañas', () => {
  it('existen la página, la lista de clientes y el servicio', () => {
    assert.ok(existsSync(ruta('../src/pages/AjustesPage.vue')))
    assert.ok(existsSync(ruta('../src/components/AjustesClientes.vue')))
  })

  it('la página tiene q-tabs «Clientes» y «Usuarios», por omisión Usuarios y ?tab en la URL', () => {
    const pagina = leer('../src/pages/AjustesPage.vue')
    assert.match(pagina, /<q-tabs/)
    assert.match(pagina, /name="clientes"[^>]*label="Clientes"/)
    assert.match(pagina, /name="usuarios"[^>]*label="Usuarios"/)
    assert.match(pagina, /route\.query\.tab/)
    assert.match(pagina, /return 'usuarios'/)
    assert.match(pagina, /<CountersDirectoryPage/)
    assert.match(pagina, /<AjustesClientes/)
  })

  it('la pestaña «Clientes» solo la ven administrador y sistemas', () => {
    const pagina = leer('../src/pages/AjustesPage.vue')
    assert.match(pagina, /session\.esAdministrador \|\| session\.esUsuarioSistema/)
    assert.match(pagina, /<q-tab v-if="veClientes" name="clientes"/)
    assert.match(pagina, /<q-tab-panel v-if="veClientes" name="clientes"/)
    assert.match(pagina, /veClientes\.value && route\.query\.tab === 'clientes'/)
  })

  it('el cambio de pestaña es instantáneo (sin animación) y respeta el movimiento reducido', () => {
    const pagina = leer('../src/pages/AjustesPage.vue')
    assert.doesNotMatch(pagina, /\banimated\b/)
    assert.doesNotMatch(pagina, /transition:\s*all/)
  })

  it('la lista de clientes es de solo lectura, con búsqueda y los dos textos vacíos', () => {
    const lista = leer('../src/components/AjustesClientes.vue')
    assert.match(lista, /<q-table/)
    assert.match(lista, /no-data-label="/)
    assert.match(lista, /no-results-label="/)
    assert.match(lista, /Sin contador/)
    assert.match(lista, /Activo/)
    assert.match(lista, /Inactivo/)
    assert.match(lista, /<q-input/)
    assert.doesNotMatch(lista, /type="submit"|@submit|<q-form|\.post\(|\.patch\(/)
    assert.doesNotMatch(lista, /transition:\s*all/)
    assert.doesNotMatch(lista, /#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('Ajustes: pestaña «Acceso a módulos» (criterio 13)', () => {
  const pagina = leer('../src/pages/AjustesPage.vue')
  const router = leer('../src/router/index.js')
  const layout = leer('../src/layouts/MaquetaLayout.vue')

  it('la pestaña reutiliza AccesoDocumentosPage y solo la ve quien administra usuarios en documentos', () => {
    assert.match(pagina, /<q-tab v-if="veAccesos" name="accesos"[^>]*label="Acceso a módulos"/)
    assert.match(pagina, /<q-tab-panel v-if="veAccesos" name="accesos"/)
    assert.match(pagina, /<AccesoDocumentosPage/)
    assert.match(
      pagina,
      /veAccesos = computed\(\(\) =>\s*hayAccesoDocumentos\(session\.rolDocumentos, 'administrar_usuarios'\)/,
    )
    assert.match(pagina, /veAccesos\.value && route\.query\.tab === 'accesos'/)
  })

  it('el permiso es el mismo que usa documentos: Administrador y Sistemas', () => {
    assert.equal(hayAccesoDocumentos('Administrador', 'administrar_usuarios'), true)
    assert.equal(hayAccesoDocumentos('Sistemas', 'administrar_usuarios'), true)
    for (const rol of ['Contador', 'Recepcionista', 'Practicante', 'Cliente', null]) {
      assert.equal(hayAccesoDocumentos(rol, 'administrar_usuarios'), false, String(rol))
    }
  })

  it('«Acceso al módulo» sale del menú de documentos y /documentos/accesos lleva a Ajustes', () => {
    assert.doesNotMatch(layout, /Acceso al módulo/)
    assert.doesNotMatch(layout, /opcion\('doc-accesos'/)
    const inicio = router.indexOf("path: 'documentos/accesos'")
    assert.ok(inicio >= 0)
    const bloque = router.slice(inicio, router.indexOf('\n', inicio))
    assert.match(bloque, /redirect: \{ name: 'ajustes', query: \{ tab: 'accesos' \} \}/)
    assert.doesNotMatch(router, /AccesoDocumentosPage/)
  })

  it('la pantalla de accesos ya no repite el título ni anida un q-page, y conserva su lógica y avisos', () => {
    const accesos = leer('../src/modulos/documentos/pages/AccesoDocumentosPage.vue')
    assert.doesNotMatch(accesos, /<q-page/)
    assert.doesNotMatch(accesos, /<h1/)
    assert.match(accesos, /<section class="acceso-page" aria-label="Acceso a módulos">/)
    assert.match(accesos, /role="alert"/)
    assert.match(accesos, /:aria-label="`Rol en documentos de \$\{props\.row\.nombre\}`"/)
    assert.match(accesos, /cambiarAccesoDocumentos\(fila\.id, rol\)/)
    assert.match(accesos, /no-data-label="[^"]+"/)
    assert.match(accesos, /no-results-label="[^"]+"/)
  })

  it('la tabla no desborda en móvil: columnas secundarias ocultas y textos recortados con tooltip', () => {
    const accesos = leer('../src/modulos/documentos/pages/AccesoDocumentosPage.vue')
    assert.match(accesos, /name: 'correo'[^}]*classes: 'gt-sm'[^}]*headerClasses: 'gt-sm'/)
    assert.match(accesos, /name: 'alias'[^}]*classes: 'gt-sm'[^}]*headerClasses: 'gt-sm'/)
    assert.match(accesos, /#body-cell-nombre/)
    assert.match(accesos, /#body-cell-correo/)
    assert.equal((accesos.match(/<q-tooltip/g) ?? []).length >= 2, true)
    assert.match(accesos, /text-overflow: ellipsis/)
    assert.doesNotMatch(accesos, /min-width: 180px/)
  })
})
