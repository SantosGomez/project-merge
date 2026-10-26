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
const caseRowSource = read('../src/components/CaseRow.vue')
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
    // El estado de un caso nuevo se muestra fijo (Pendiente) en la fila 2, sin control para elegirlo.
    assert.match(caseFormSource, /class="estado-fijo"[^>]*>\s*\{\{ statusLabel \}\}/)
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
    // Sin caso (registro) el formulario vuelve a quedar vacío.
    assert.match(caseFormSource, /client\.value = caso\?\.cliente \?\? ''/)
    assert.match(caseFormSource, /priority\.value = caso\?\.prioridad \?\? ''/)
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

describe('Mis casos (rebanada 6) — un solo flujo para guardar cambios', () => {
  // Cuerpo de la función guardarCambio, para revisar su orden interno.
  const inicioGuardar = myCasesSource.indexOf('const guardarCambio')
  const cuerpoGuardar = myCasesSource.slice(inicioGuardar, myCasesSource.indexOf('\n}\n', inicioGuardar))
  const inicioRetry = myCasesSource.indexOf('const retry')
  const cuerpoRetry = myCasesSource.slice(inicioRetry, myCasesSource.indexOf('\n}\n', inicioRetry))

  it('estado y prioridad usan la misma función, sin copias', () => {
    assert.ok(inicioGuardar > 0, 'existe guardarCambio')
    assert.doesNotMatch(myCasesSource, /const changeStatus|const changePriority/, 'no quedan las funciones duplicadas')
    assert.strictEqual(myCasesSource.match(/cases\.actualizarCaso\(/g).length, 1, 'un solo punto llama a actualizarCaso')
    assert.match(myCasesSource, /guardarCambio\(item\.id, \{ estado: v \}\)/)
    assert.match(myCasesSource, /guardarCambio\(item\.id, \{ prioridad: v \}\)/)
  })

  it('al empezar un cambio se borra el aviso anterior', () => {
    const borra = cuerpoGuardar.indexOf("confirmation.value = ''")
    assert.ok(borra > 0, 'guardarCambio borra el aviso')
    assert.ok(borra < cuerpoGuardar.indexOf('cases.actualizarCaso('), 'lo borra antes de guardar')
  })

  it('reintentar repite el último cambio tal cual, sin ramas por campo', () => {
    assert.match(cuerpoRetry, /guardarCambio\(/)
    assert.doesNotMatch(cuerpoRetry, /cambios\.estado|cambios\.prioridad/)
  })
})

describe('Editar caso — fila con fechas y botón «Editar»', () => {
  it('la fila muestra Inicio, Vence y la descripción solo cuando existen', () => {
    assert.match(caseRowSource, /v-if="caseItem\.startDate"[\s\S]*?>Inicio</)
    assert.match(caseRowSource, /v-if="caseItem\.dueDate"[\s\S]*?>Vence</)
    assert.match(caseRowSource, /v-if="caseItem\.description"[^>]*class="case-row__description"|class="case-row__description"[^>]*v-if="caseItem\.description"/)
    assert.match(cssRule(caseRowSource, '.case-row__description'), /-webkit-line-clamp:\s*2/, 'la descripción se recorta a 2 líneas')
  })

  it('cada fila de «Mis casos» tiene un botón «Editar» con ayuda que abre el diálogo', () => {
    const inicio = myCasesSource.indexOf('class="case-edit-btn')
    assert.ok(inicio > 0, 'existe el botón de editar')
    const boton = myCasesSource.slice(inicio, myCasesSource.indexOf('</q-btn>', inicio))
    assert.match(boton, /label="Editar"/)
    assert.match(boton, /icon="edit"/)
    assert.match(boton, /aria-haspopup="dialog"/)
    assert.match(boton, /:disable="cases\.guardando"/)
    assert.match(boton, /@click="abrirEdicion\(item\.id\)"/)
    assert.match(boton, /<q-tooltip>Abre el formulario para cambiar la información del caso\.<\/q-tooltip>/)
  })

  it('el diálogo recibe el caso a editar y al guardar avisa «Cambios guardados.»', () => {
    assert.match(myCasesSource, /<CaseFormDialog[^>]*:caso="casoEnEdicion"/)
    assert.match(myCasesSource, /@guardado="alGuardarEdicion"/)
    assert.match(myCasesSource, /Cambios guardados\./)
  })

  it('el tablero del administrador sigue sin acciones en la fila', () => {
    const admin = read('../src/pages/AdminDashboardPage.vue')
    assert.match(admin, /<CaseRow[\s\S]*?readonly/)
    assert.doesNotMatch(admin, /abrirEdicion/)
  })
})

describe('Editar caso — CaseFormDialog en modo edición', () => {
  it('recibe el caso por prop y cambia título, ayuda y botón', () => {
    assert.match(caseFormSource, /defineProps\(\{[\s\S]*?caso:/)
    assert.match(caseFormSource, /const modoEdicion = computed\(\(\) => props\.caso !== null\)/)
    assert.match(caseFormSource, /'Editar caso'/)
    assert.match(caseFormSource, /'Guardar cambios'/)
    assert.match(caseFormSource, /El vencimiento se recalcula al guardar si cambias la prioridad o la fecha de inicio/)
  })

  it('en edición el estado se elige con un selector y se muestra el vencimiento', () => {
    assert.match(caseFormSource, /<q-select[\s\S]*?for="estado-field"[\s\S]*?:options="statusOptions"/)
    assert.match(caseFormSource, /<dt>Vence<\/dt>/)
  })

  it('la fecha de inicio ya no lleva el asterisco de obligatorio en el registro', () => {
    assert.doesNotMatch(caseFormSource, /<span aria-label="opcional">\*<\/span>/)
    assert.match(caseFormSource, /La fecha de inicio es obligatoria al editar/)
  })

  it('guarda solo los cambios con actualizarCaso, avisa «guardado» y no deja guardar sin cambios', () => {
    assert.match(caseFormSource, /cambiosDelCaso\(props\.caso,/)
    assert.match(caseFormSource, /cases\.actualizarCaso\(props\.caso\.id, cambios\.value\)/)
    assert.match(caseFormSource, /emit\('guardado'/)
    assert.match(caseFormSource, /:disable="cases\.guardando \|\| \(modoEdicion && !hayCambios\)"/)
    assert.match(caseFormSource, /Aún no cambias ningún dato/)
  })
})

describe('Formulario de caso más horizontal: filas 2, 2, 1', () => {
  // Orden de los campos en el código: es el orden de lectura de la cuadrícula.
  const posicion = (texto) => caseFormSource.indexOf(texto)

  it('los campos van en orden Cliente, Prioridad, Fecha de inicio, Estado, Descripción y Observaciones', () => {
    const orden = [
      'for="client-field"',
      'for="priority-field"',
      'for="fecha-inicio-field"',
      'class="form-group registro-caso__estado"',
      'for="descripcion-field"',
      'for="observaciones-field"',
    ].map(posicion)
    assert.ok(orden.every((valor) => valor > 0), 'todos los campos existen')
    assert.deepEqual([...orden].sort((a, b) => a - b), orden, 'están en el orden de las filas')
  })

  it('el estado ocupa su lugar en la fila 2 también al registrar (Pendiente, sin elegirse)', () => {
    const inicio = posicion('class="form-group registro-caso__estado"')
    const grupo = caseFormSource.slice(inicio, caseFormSource.indexOf('</div>\n\n', inicio))
    assert.match(grupo, /v-if="modoEdicion"/, 'en edición es un selector')
    assert.match(grupo, /v-else[\s\S]*?\{\{ statusLabel \}\}/, 'al registrar muestra Pendiente')
  })

  it('en pantallas medianas y grandes el cuerpo es una cuadrícula de dos columnas y el diálogo es más ancho', () => {
    assert.match(caseFormSource, /@media \(min-width: 700px\)\s*\{\s*\.registro-caso__body\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
    assert.match(cssRule(caseFormSource, '.registro-caso__body'), /display: grid/)
    assert.match(cssRule(caseFormSource, '.registro-caso'), /width: min\(860px, calc\(100vw - 32px\)\)/)
    assert.match(cssRule(caseFormSource, '.registro-caso'), /max-width: none !important/, 'quita el tope de 560 px de Quasar')
    assert.match(cssRule(caseFormSource, '.registro-caso__ancho-completo'), /grid-column: 1 \/ -1/)
  })
})
