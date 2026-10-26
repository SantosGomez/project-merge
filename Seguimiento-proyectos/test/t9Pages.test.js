/*
 * Verificación estática y por comportamiento de T9 (P-3 y P-4).
 * No monta Vue: usa el store de T4 (Pinia funciona en Node) y la lectura de los .vue.
 * No instala paquetes nuevos.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { createPinia, setActivePinia } from 'pinia'

import { useMaquetaStore } from '../src/stores/maqueta.js'
import { CASE_ERROR_CODES } from '../src/utils/caseRules.js'
import { STATUSES } from '../src/utils/constants.js'
import { exampleCounters } from '../src/services/exampleData.js'

const read = (relativePath) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')

const directorySource = read('../src/pages/CountersDirectoryPage.vue')
const caseFormSource = read('../src/components/CaseFormDialog.vue')
const myCasesSource = read('../src/pages/MyCasesPage.vue')
const quasarConfig = readFileSync(fileURLToPath(new URL('../quasar.config.js', import.meta.url)), 'utf8')

/** Devuelve la regla CSS de un selector dentro del bloque <style scoped> del archivo. */
const cssRule = (source, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'gs')
  const matches = [...source.matchAll(pattern)]

  return matches.map((match) => match[1]).join(' | ')
}

describe('Directorio de usuarios (rebanada 1) — revisión estática de P-3 (RF-16, RF-17, RNF-9, RNF-10)', () => {
  it('es una tabla de cuentas con nombre, correo, rol y último acceso, sin conteos ni casos (RF-16)', () => {
    assert.match(directorySource, /Directorio de usuarios/)
    assert.match(directorySource, /<q-table/, 'usa QTable')
    for (const etiqueta of ['Nombre', 'Correo', 'Rol', 'Último acceso']) {
      assert.ok(directorySource.includes(`label: '${etiqueta}'`), `columna «${etiqueta}»`)
    }
    assert.match(directorySource, /row-key="id"/)
    assert.match(directorySource, /listarUsuarios\(\)/, 'las filas salen del servicio de usuarios')
    assert.match(directorySource, /usuarioAFila/, 'cada cuenta se adapta con usuarioAFila')
    assert.doesNotMatch(directorySource, /countsFor/)
    assert.doesNotMatch(directorySource, /CounterCountsRow/)
    assert.doesNotMatch(directorySource, /CaseRow/)
  })

  it('en pantallas angostas cada cuenta es una tarjeta, con la tabla paginada', () => {
    assert.match(directorySource, /:grid="\$q\.screen\.lt\.sm"/, 'tarjetas en celular')
    assert.match(directorySource, /<template #item=/, 'tarjeta propia para cada cuenta')
    assert.match(directorySource, /:rows-per-page-options=/, 'paginación elegible')
    assert.match(directorySource, /no-data-label=/, 'texto propio cuando no hay filas')
  })

  it('«Ver casos» solo aparece en contadores, los selecciona y abre P-2 (RF-17)', () => {
    assert.match(directorySource, /v-if="[\w.]*puedeVerCasos && session\.esAdministrador"/, 'solo contadores y solo para el administrador')
    assert.match(directorySource, /@click="selectCounter\([\w.]*id\)"/)
    assert.match(directorySource, /Ver casos/)
    assert.match(directorySource, /maqueta\.selectCounter\(counterId\)/)
    assert.match(directorySource, /router\.push\(\{ name: 'admin-dashboard' \}\)/)
  })

  it('tiene estados de carga, vacío y error con reintento (RF-35 a RF-37)', () => {
    assert.match(directorySource, /ScreenLoader/)
    assert.match(directorySource, /ErrorState/)
    assert.match(directorySource, /EmptyState/)
    assert.match(directorySource, /@retry="retry"/)
    assert.match(directorySource, /startScreenLoad\(SCREEN_IDS\.directory\)/)
  })

  it('los nombres y correos largos se muestran completos y se parten en varias líneas (RNF-9, RNF-10)', () => {
    const celda = cssRule(directorySource, '.directory-cell')
    assert.match(celda, /overflow-wrap: anywhere/, 'el texto puede partirse')
    assert.match(celda, /white-space: normal/, 'no queda en una sola línea')
    assert.doesNotMatch(directorySource, /text-overflow:\s*ellipsis/, 'no se recorta con puntos suspensivos')
  })

  it('Quasar usa el idioma español para los textos de la tabla', () => {
    assert.match(quasarConfig, /^\s*lang: 'es',/m, 'framework.lang es')
  })
})

describe('T9 — registro de caso en diálogo (P-4, RF-19 a RF-25, RF-43)', () => {
  it('el diálogo pide cliente y prioridad y muestra estado y contador de solo lectura (RF-19, RF-20)', () => {
    assert.match(caseFormSource, /<q-dialog/)
    assert.match(caseFormSource, /Registrar caso/)
    assert.match(caseFormSource, /v-model="client"/)
    assert.match(caseFormSource, /v-model="priority"/)
    assert.match(caseFormSource, /PriorityTag/)

    assert.match(caseFormSource, /readonly-info/)
    assert.match(caseFormSource, /<dt>Estado<\/dt>/)
    assert.match(caseFormSource, /<dt>Contador asignado<\/dt>/)
    // El bloque de solo lectura no contiene entradas de formulario.
    const block = caseFormSource.slice(
      caseFormSource.indexOf('<dl class="readonly-info">'),
      caseFormSource.indexOf('</dl>'),
    )
    assert.doesNotMatch(block, /q-input|q-select|<input|<select/)
  })

  it('valida con los códigos de CASE_ERROR_CODES y mensajes en español (RF-22 a RF-24)', () => {
    assert.match(caseFormSource, /CASE_ERROR_CODES\.clientRequired/)
    assert.match(caseFormSource, /CASE_ERROR_CODES\.clientTooLong/)
    assert.match(caseFormSource, /CASE_ERROR_CODES\.priorityRequired/)
    assert.match(caseFormSource, /El cliente es obligatorio\./)
    assert.match(caseFormSource, /El cliente supera los 80 caracteres permitidos\./)
    assert.match(caseFormSource, /Se debe elegir una prioridad\./)
  })

  it('registra con el store, limpia y cierra el diálogo al confirmar (RF-21)', () => {
    assert.match(caseFormSource, /cases\.crearCaso\(/)
    assert.match(caseFormSource, /client\.value = ''/)
    assert.match(caseFormSource, /priority\.value = ''/)
    assert.match(caseFormSource, /dialogoAbierto\.value = false/)
    assert.match(caseFormSource, /emit\('registrado'/)
  })

  it('se cierra al registrar y ofrece Cancelar, sin el atajo «Ver mis casos» (RF-44)', () => {
    assert.match(caseFormSource, /label="Cancelar"/)
    assert.doesNotMatch(caseFormSource, /Ver mis casos/)
  })

  it('no se puede cerrar mientras se guarda y los errores se reintentan sin perder lo escrito', () => {
    assert.match(caseFormSource, /:persistent="cases\.guardando"/)
    assert.match(caseFormSource, /:disable="cases\.guardando"/)
    assert.match(caseFormSource, /<ErrorState/)
    assert.match(caseFormSource, /@retry="submitCase"/)
  })

  it('el diálogo tiene nombre accesible y enfoca el cliente al abrirse', () => {
    const inicio = caseFormSource.indexOf('<q-dialog')
    const apertura = caseFormSource.slice(inicio, caseFormSource.indexOf('>', inicio) + 1)
    assert.match(apertura, /aria-labelledby="registro-caso-titulo"/)
    assert.doesNotMatch(apertura, /role="dialog"/, 'el rol lo pone Quasar, no se duplica')
    assert.match(caseFormSource, /id="registro-caso-titulo"/)
    assert.match(caseFormSource, /clienteInput\.value\?\.focus\(\)/)
  })

  it('no fija anchos que desborden en pantallas de 360 px', () => {
    // Los contenedores permiten encogerse: ningún ancho fijo en píxeles.
    for (const selector of ['.registro-caso', '.registro-caso__form', '.form-group']) {
      const rule = cssRule(caseFormSource, selector)
      assert.doesNotMatch(rule, /(?:^|[\s;])width:\s*\d+px/, `${selector} no fija el ancho`)
      assert.match(rule, /min-width: 0/, `${selector} puede encogerse`)
    }

    // La fila de solo lectura se reparte en varias líneas si no cabe.
    const rowRule = cssRule(caseFormSource, '.readonly-row')
    assert.match(rowRule, /flex-wrap: wrap/)
    const valueRule = cssRule(caseFormSource, '.readonly-row dd')
    assert.match(valueRule, /overflow-wrap: anywhere/)
    assert.match(valueRule, /min-width: 0/)
  })
})

describe('Mis casos — registro en diálogo (P-5)', () => {
  it('el botón de la cabecera y el estado vacío abren el diálogo en vez de navegar', () => {
    assert.match(myCasesSource, /<CaseFormDialog/)
    assert.match(myCasesSource, /v-model="dialogoRegistroAbierto"/)
    assert.match(myCasesSource, /@click="abrirRegistro"/)
    assert.match(myCasesSource, /@action="abrirRegistro"/)
    assert.doesNotMatch(myCasesSource, /name: 'contador-registro'/)
    assert.doesNotMatch(myCasesSource, /useRouter|router\.push/, 'ya no navega a otra pantalla')
  })

  it('al registrar muestra el aviso y recarga la lista si estaba en error', () => {
    assert.match(myCasesSource, /@registrado="alRegistrar"/)
    assert.match(myCasesSource, /Caso registrado\./)
    assert.match(myCasesSource, /if \(cases\.error\)/)
    assert.match(myCasesSource, /cases\.reintentar\(\)/)
  })

  it('el botón de registro se desactiva mientras hay otro guardado en curso', () => {
    const inicio = myCasesSource.indexOf('class="my-cases-page__register-btn')
    const boton = myCasesSource.slice(inicio, myCasesSource.indexOf('</q-btn>', inicio))
    assert.match(boton, /:disable="cases\.guardando"/)
    assert.match(boton, /<q-tooltip>/)
  })
})

describe('Registro de caso unificado (historia 10) — verificación estática', () => {
  const rutas = read('../src/router/index.js')

  it('la pantalla antigua ya no existe y su ruta redirige a Mis casos', () => {
    assert.equal(
      existsSync(fileURLToPath(new URL('../src/pages/NewCasePage.vue', import.meta.url))),
      false,
      'se retiró la pantalla de registro',
    )
    assert.match(
      rutas,
      /path: 'contador\/registro',[\s\S]*?redirect: \{ name: 'contador-casos' \}/,
      'la dirección antigua lleva a Mis casos',
    )
  })

  it('Mis casos ya no muestra «Volver» hacia el registro', () => {
    const inicio = rutas.indexOf("path: 'contador/casos'")
    const ruta = rutas.slice(rutas.lastIndexOf('{', inicio), rutas.indexOf('\n      },', inicio))
    assert.match(ruta, /titulo: 'Mis casos'/, 'título de la pantalla')
    assert.doesNotMatch(ruta, /volverA:/, 'es la pantalla principal del contador')
  })
})

describe('T9 — comportamiento del store usado por P-4', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sin cliente o con solo espacios no agrega el caso (RF-22)', () => {
    const store = useMaquetaStore()
    store.login('contador', 'contador123')
    const before = store.cases.length

    for (const client of ['', '   ', '\t\n']) {
      const result = store.registerCase({ client, priority: 'alta' })
      assert.equal(result.valid, false)
      assert.equal(result.errorCode, CASE_ERROR_CODES.clientRequired)
    }

    assert.equal(store.cases.length, before, 'no se agregó ningún caso')
  })

  it('con 81 caracteres no agrega el caso (RF-24)', () => {
    const store = useMaquetaStore()
    store.login('contador', 'contador123')
    const before = store.cases.length

    const result = store.registerCase({ client: 'a'.repeat(81), priority: 'alta' })

    assert.equal(result.valid, false)
    assert.equal(result.errorCode, CASE_ERROR_CODES.clientTooLong)
    assert.equal(store.cases.length, before)
  })

  it('sin prioridad no agrega el caso (RF-23)', () => {
    const store = useMaquetaStore()
    store.login('contador', 'contador123')
    const before = store.cases.length

    const result = store.registerCase({ client: 'Cliente', priority: '' })

    assert.equal(result.valid, false)
    assert.equal(result.errorCode, CASE_ERROR_CODES.priorityRequired)
    assert.equal(store.cases.length, before)
  })

  it('con 80 caracteres y prioridad elegida agrega el caso en Pendiente (RF-19, RF-21, RF-25)', () => {
    const store = useMaquetaStore()
    store.login('contador', 'contador123')
    const before = store.cases.length

    const result = store.registerCase({ client: 'a'.repeat(80), priority: 'alta' })

    assert.equal(result.valid, true)
    assert.equal(result.case.status, STATUSES[0], 'nace en Pendiente (RF-19, RF-26)')
    assert.equal(result.case.priority, 'alta')
    assert.equal(result.case.counterId, store.currentCounterId, 'asignado al contador conectado')
    assert.equal(store.cases.length, before + 1)
    assert.equal(store.myCases.length, 1, 'aparece en la lista de P-5 (RF-25)')
    assert.equal(store.countsFor(store.currentCounterId).pendiente, 1, 'se refleja en P-2 (RF-25)')
  })
})

describe('T9 — flujo de P-3 hacia P-2 (RF-16, RF-17)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('elegir un contador deja la selección lista para el detalle de P-2', () => {
    const store = useMaquetaStore()
    store.login('admin', 'admin123')
    const counter = exampleCounters.find((one) => one.id === 'c-02')

    assert.ok(counter, 'el directorio muestra contadores de ejemplo (RF-18)')
    store.selectCounter(counter.id)

    assert.equal(store.selectedCounterId, counter.id)
    const counts = store.countsFor(counter.id)
    assert.equal(typeof counts.pendiente, 'number', 'P-2 puede calcular los conteos del detalle')
  })
})

describe('Login por correo — verificación estática de P-1', () => {
  const login = read('../src/pages/LoginPage.vue')
  const campo = login.slice(login.indexOf('ref="usernameInput"'), login.indexOf('</q-input>', login.indexOf('ref="usernameInput"')))

  it('el primer campo pide el correo, con teclado y autocompletado de correo', () => {
    assert.match(campo, /label="Correo"/, 'la etiqueta dice Correo')
    assert.match(campo, /type="email"/, 'abre el teclado de correo en celular')
    assert.match(campo, /autocomplete="email"/, 'el navegador sugiere el correo')
    assert.match(campo, /aria-label="Ayuda sobre el campo correo"/, 'ayuda accesible del campo')
    assert.doesNotMatch(campo, /label="Usuario"/, 'ya no pide el usuario')
  })

  it('los avisos hablan de correo, no de usuario', () => {
    assert.ok(login.includes('Falta el correo. Escríbelo para iniciar sesión.'), 'aviso de campo vacío')
    assert.ok(
      login.includes('Credenciales no válidas. Verifique el correo y la contraseña e intente de nuevo.'),
      'aviso genérico de credenciales',
    )
  })
})

describe('Contadores por nombre (rebanada 5a) — verificación estática', () => {
  const dashboard = read('../src/pages/AdminDashboardPage.vue')

  it('el dashboard nombra al contador seleccionado con su nombre, no con su usuario', () => {
    assert.match(dashboard, /Casos de \{\{ contadorSeleccionado\.nombre \}\}/, 'texto del detalle')
    assert.match(dashboard, /El contador \$\{contadorSeleccionado\.nombre\} no tiene casos/, 'aviso sin casos')
    assert.doesNotMatch(dashboard, /contadorSeleccionado\.usuario/, 'ya no lee el usuario')
  })
})

describe('Sesión sin usuario (rebanada 5b) — verificación estática', () => {
  const rutas = read('../src/router/index.js')

  it('el registro de casos muestra como contador asignado el nombre de la sesión', () => {
    assert.match(
      caseFormSource,
      /session\.nombreVisible \? \{ id: session\.id, name: session\.nombreVisible \} : null/,
      'contador asignado con el nombre',
    )
    assert.doesNotMatch(caseFormSource, /session\.usuario/, 'ya no lee el usuario de la sesión')
  })

  it('el guard copia el nombre de la sesión a la identidad de la maqueta', () => {
    assert.match(rutas, /account: sesion\.nombreVisible/, 'la cuenta de la maqueta es el nombre')
    assert.doesNotMatch(rutas, /sesion\.usuario/, 'ya no lee el usuario de la sesión')
  })
})
