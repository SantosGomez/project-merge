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
const casoItemSource = read('../src/components/CasoItem.vue')
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
    // Revisión de UI, rebanada 8: sin la selección duplicada de la maqueta.
    assert.doesNotMatch(directorySource, /maqueta\./)
    assert.match(directorySource, /router\.push\(\{ name: 'admin-dashboard' \}\)/)
  })

  it('tiene estados de carga, vacío y error con reintento (RF-35 a RF-37)', () => {
    // Revisión de UI, rebanada 8: carga con esqueleto anunciado y sin la carga simulada de la maqueta.
    assert.match(directorySource, /role="status"[\s\S]*?<q-skeleton/)
    assert.match(directorySource, /ErrorState/)
    assert.match(directorySource, /EmptyState/)
    assert.match(directorySource, /@retry="retry"/)
    assert.doesNotMatch(directorySource, /startScreenLoad/)
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
    assert.match(caseFormSource, /Elige una prioridad\./)
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
    // Revisión de UI, rebanada 3: también es persistente si hay datos sin guardar (pregunta antes de descartar).
    assert.match(caseFormSource, /:persistent="cases\.guardando \|\| hayDatosSinGuardar"/)
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

  it('es un login sencillo: logo de DelGrow, sin cuadro de ayuda ni textos bajo los campos', () => {
    const plantilla = login.split('<script')[0]
    assert.match(plantilla, /<q-img[^>]*src="logos\/PNG\/DELGROW_LOGO-OF\.png"[^>]*alt="DelGrow Business Solutions"/)
    assert.doesNotMatch(plantilla, /Cómo funciona el acceso|login-page__help|<q-list/, 'sin cuadro de ayuda (decisión del usuario)')
    assert.doesNotMatch(plantilla, /\bhint=/, 'sin texto de ayuda bajo los campos')
    assert.match(plantilla, /aria-label="Ayuda sobre el campo contraseña"/, 'el tooltip de cada campo se conserva')
  })

  it('la contraseña se puede mostrar u ocultar con un botón accesible', () => {
    const plantilla = login.split('<script')[0]
    const contrasena = plantilla.slice(plantilla.indexOf('ref="passwordInput"'), plantilla.indexOf('</q-input>', plantilla.indexOf('ref="passwordInput"')))
    assert.match(contrasena, /:type="verContrasena \? 'text' : 'password'"/)
    assert.match(contrasena, /<q-btn[^>]*:aria-label="verContrasena \? 'Ocultar contraseña' : 'Mostrar contraseña'"/)
    assert.match(contrasena, /:aria-pressed="verContrasena"/)
    assert.match(contrasena, /@click="verContrasena = !verContrasena"/)
    assert.match(login, /const verContrasena = ref\(false\)/, 'empieza oculta')
  })

  it('tiene la casilla «Mantener sesión iniciada», desmarcada, con tooltip, y la envía al iniciar sesión', () => {
    const plantilla = login.split('<script')[0]
    const casilla = plantilla.slice(plantilla.indexOf('<q-checkbox'), plantilla.indexOf('</q-checkbox>'))
    assert.match(casilla, /v-model="mantenerSesion"/)
    assert.match(casilla, /label="Mantener sesión iniciada"/)
    assert.match(casilla, /<q-tooltip>[\s\S]*7 días[\s\S]*<\/q-tooltip>/, 'el tooltip explica cuánto dura')
    assert.ok(plantilla.indexOf('<q-checkbox') > plantilla.indexOf('ref="passwordInput"'), 'va después de la contraseña')
    assert.ok(plantilla.indexOf('<q-checkbox') < plantilla.indexOf('type="submit"'), 'y antes del botón')
    assert.match(login, /const mantenerSesion = ref\(false\)/, 'empieza desmarcada')
    assert.match(login, /sesion\.iniciarSesion\(form\.username\.trim\(\), form\.password\.trim\(\), mantenerSesion\.value\)/)
  })

  it('los avisos hablan de correo, no de usuario', () => {
    assert.ok(login.includes('Falta el correo. Escríbelo para iniciar sesión.'), 'aviso de campo vacío')
    assert.ok(
      login.includes('El correo o la contraseña no son correctos. Revísalos y vuelve a intentarlo.'),
      'aviso genérico de credenciales (sin decir cuál falló)',
    )
  })
})

describe('Contadores por nombre (rebanada 5a) — verificación estática', () => {
  const dashboard = read('../src/pages/AdminDashboardPage.vue')
  const rutaDetalle = '../src/components/DetalleContador.vue'
  const detalle = existsSync(fileURLToPath(new URL(rutaDetalle, import.meta.url))) ? read(rutaDetalle) : ''

  it('el dashboard nombra al contador seleccionado con su nombre, no con su usuario', () => {
    // Revisión de UI, rebanada 5: el título del panel ya dice «Casos importantes de …».
    assert.match(detalle, /se le avisará a \{\{ contador\.nombre \}\}/, 'texto del detalle')
    assert.match(detalle, /\$\{contador\.nombre\} no tiene casos/, 'aviso sin casos')
    assert.doesNotMatch(dashboard + detalle, /contador(Seleccionado)?\.usuario/, 'ya no lee el usuario')
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

  // La prioridad ya no tiene selector en la fila (se cambia en «Editar»); estado e importante comparten la función.
  it('estado e importante usan la misma función, sin copias', () => {
    assert.ok(inicioGuardar > 0, 'existe guardarCambio')
    assert.doesNotMatch(myCasesSource, /const changeStatus|const changePriority/, 'no quedan las funciones duplicadas')
    assert.strictEqual(myCasesSource.match(/cases\.actualizarCaso\(/g).length, 1, 'un solo punto llama a actualizarCaso')
    assert.match(myCasesSource, /guardarCambio\(item\.id, \{ estado: v \}\)/)
    assert.match(myCasesSource, /guardarCambio\(item\.id, \{ importante: !item\.important \}\)/)
  })

  // Los avisos son notificaciones de Quasar (plugin Notify), que se van solas.
  it('al guardar avisa con una notificación de éxito o de error', () => {
    const guardar = cuerpoGuardar.indexOf('cases.actualizarCaso(')
    // Revisión de UI, rebanada 3: el aviso de éxito dice qué cambió (y dónde quedó un caso Finalizado).
    assert.ok(cuerpoGuardar.indexOf("$q.notify({ type: 'positive', message: avisoDeExito(cliente, cambios) })") > guardar, 'avisa el éxito después de guardar')
    assert.match(cuerpoGuardar, /\$q\.notify\(\{\s*type: 'negative'/, 'avisa el error')
    assert.doesNotMatch(myCasesSource, /confirmation/, 'sin el aviso fijo anterior')
  })

  it('el plugin Notify está habilitado (sin él, $q.notify falla al guardar)', () => {
    assert.match(quasarConfig, /plugins: \[[^\]]*'Notify'/)
  })

  // Revisión de UI, rebanada 3: «Reintentar» va en el aviso del fallo; el de la pantalla solo recarga la lista.
  it('reintentar repite el último cambio tal cual, sin ramas por campo', () => {
    assert.match(cuerpoGuardar, /handler: \(\) => guardarCambio\(caseId, cambios\)/)
    assert.match(myCasesSource, /const retry = \(\) => cases\.reintentar\(\)/)
    assert.doesNotMatch(cuerpoRetry, /cambios\.estado|cambios\.prioridad/)
  })
})

describe('Editar caso — fila con fechas y botón «Editar»', () => {
  // La fila de caso es CasoItem.vue (Mis casos y, en solo lectura, el dashboard del admin).
  it('la fila muestra Inicio, Vence y la descripción solo cuando existen', () => {
    assert.match(casoItemSource, /v-if="caso\.startDate"[\s\S]*?Inicio \{\{ caso\.startDate \}\}/)
    assert.match(casoItemSource, /v-if="caso\.dueDate"[\s\S]*?Vence \{\{ caso\.dueDate \}\}/)
    assert.match(casoItemSource, /v-if="caso\.description"[^>]*lines="2"/, 'la descripción se recorta a 2 líneas')
  })

  // Desde el rediseño con QList, el botón vive en CasoItem.vue y la página atiende su evento.
  it('cada fila de «Mis casos» tiene un botón «Editar» con ayuda que abre el diálogo', () => {
    const inicio = casoItemSource.indexOf('label="Editar"')
    assert.ok(inicio > 0, 'existe el botón de editar')
    const boton = casoItemSource.slice(casoItemSource.lastIndexOf('<q-btn', inicio), casoItemSource.indexOf('</q-btn>', inicio))
    assert.match(boton, /icon="edit"/)
    assert.match(boton, /aria-haspopup="dialog"/)
    assert.match(boton, /:disable="deshabilitado"/)
    assert.match(boton, /@click="emit\('editar'\)"/)
    assert.match(boton, /<q-tooltip>Abre el formulario para cambiar la información del caso/)
    assert.match(myCasesSource, /:deshabilitado="guardandoId === item\.id"/)
    assert.match(myCasesSource, /@editar="abrirEdicion\(item\.id\)"/)
  })

  it('el diálogo recibe el caso a editar y al guardar avisa «Cambios guardados.»', () => {
    assert.match(myCasesSource, /<CaseFormDialog[^>]*:caso="casoEnEdicion"/)
    assert.match(myCasesSource, /@guardado="alGuardarEdicion"/)
    assert.match(myCasesSource, /Cambios guardados\./)
  })

  it('el tablero del administrador sigue sin acciones en la fila', () => {
    const admin = read('../src/pages/AdminDashboardPage.vue')
    const rutaDetalle = '../src/components/DetalleContador.vue'
    const detalle = existsSync(fileURLToPath(new URL(rutaDetalle, import.meta.url))) ? read(rutaDetalle) : ''
    assert.match(detalle, /<CasoItem[^>]*solo-lectura/)
    assert.doesNotMatch(admin, /abrirEdicion|guardarCambio/)
    // En solo lectura no hay estrella, selector de estado ni «Editar».
    assert.match(casoItemSource, /<q-item-section v-if="!soloLectura" avatar/)
    assert.match(casoItemSource, /<q-item-section v-else side class="caso-item__acciones">\s*<q-select/)
  })
})

describe('Editar caso — CaseFormDialog en modo edición', () => {
  it('recibe el caso por prop y cambia título, ayuda y botón', () => {
    assert.match(caseFormSource, /defineProps\(\{[\s\S]*?caso:/)
    assert.match(caseFormSource, /const modoEdicion = computed\(\(\) => props\.caso !== null\)/)
    assert.match(caseFormSource, /'Editar caso'/)
    assert.match(caseFormSource, /'Guardar cambios'/)
    assert.doesNotMatch(caseFormSource, /recalcula/, 'el vencimiento ya no depende de la prioridad')
  })

  it('en edición el estado se elige con un selector', () => {
    assert.match(caseFormSource, /<q-select[\s\S]*?for="estado-field"[\s\S]*?:options="statusOptions"/)
    assert.doesNotMatch(caseFormSource, /<dt>Vence<\/dt>/, 'el vencimiento ya es un campo, no un dato de solo lectura')
  })

  it('la fecha de vencimiento la captura el contador: obligatoria, con tooltip y validada', () => {
    const inicio = caseFormSource.indexOf('for="fecha-vencimiento-field"')
    assert.ok(inicio > 0, 'existe el campo de vencimiento')
    const campo = caseFormSource.slice(caseFormSource.lastIndexOf('<div class="form-group', inicio), caseFormSource.indexOf('</div>', inicio))
    assert.match(campo, /Fecha de vencimiento <span aria-hidden="true" class="required-mark">\*<\/span>/)
    assert.match(campo, /v-model="fechaVencimiento"/)
    assert.match(campo, /placeholder="DD-MM-AAAA"/)
    assert.match(campo, /<q-tooltip>/)
    assert.match(caseFormSource, /validarFechaVencimiento\(\s*fechaVencimiento\.value,\s*inicioValido \? fechaLimpia : '',\s*hoyLocal\(\),?\s*\)/)
    assert.match(caseFormSource, /fechaVencimiento: fechaVencimiento\.value/, 'en edición se compara con el guardado')
    assert.match(caseFormSource, /fechaVencimiento\.value = fechaParaFormulario\(caso\?\.fecha_vencimiento\)/)
  })

  it('las dos fechas se pueden elegir en un calendario q-date (DD-MM-YYYY) o escribir a mano', () => {
    for (const [campo, modelo] of [['fecha-inicio-field', 'fechaInicio'], ['fecha-vencimiento-field', 'fechaVencimiento']]) {
      const inicio = caseFormSource.indexOf(`for="${campo}"`)
      const grupo = caseFormSource.slice(inicio, caseFormSource.indexOf('</q-input>', inicio))
      assert.match(grupo, /<q-icon\s[^>]*name="event"[\s\S]*?<q-popup-proxy[\s\S]*?<q-date/, `${campo}: ícono que abre el calendario`)
      assert.match(grupo, new RegExp(`<q-date[^>]*v-model="${modelo}"[^>]*mask="DD-MM-YYYY"`), `${campo}: mismo formato del campo`)
      assert.match(grupo, /aria-label="Abrir calendario/, `${campo}: nombre accesible`)
      assert.match(grupo, /<q-tooltip>/, `${campo}: tooltip del ícono`)
      assert.match(grupo, /v-close-popup/, `${campo}: botón para cerrar el calendario`)
    }
    assert.match(caseFormSource, /:options="permitirVencimiento"/, 'el calendario del vencimiento bloquea días antes del inicio')
    assert.match(caseFormSource, /:default-year-month="mesInicialVencimiento"/, 'y abre en el mes de la fecha de inicio')
    assert.match(caseFormSource, /:breakpoint="700"/, 'en pantallas chicas se abre centrado')
    assert.match(caseFormSource, /diaPermitidoParaVencimiento\(dia, fechaInicio\.value, hoyLocal\(\)\)/)
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
    assert.match(caseFormSource, /Todavía no has cambiado ningún dato/)
  })
})

describe('Formulario de caso más horizontal: filas 2, 2, 1', () => {
  // Orden de los campos en el código: es el orden de lectura de la cuadrícula.
  const posicion = (texto) => caseFormSource.indexOf(texto)

  it('los campos van en orden Cliente, Prioridad, Fecha de inicio, Vencimiento, Estado, Importante, Descripción y Observaciones', () => {
    const orden = [
      'for="client-field"',
      'for="priority-field"',
      'for="fecha-inicio-field"',
      'for="fecha-vencimiento-field"',
      'class="form-group registro-caso__estado"',
      'v-model="importante"',
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

describe('Dashboard: tarjetas KPI del equipo (rediseño, rebanada 1)', () => {
  const pagina = read('../src/pages/AdminDashboardPage.vue')
  const existeComponente = existsSync(fileURLToPath(new URL('../src/components/ResumenEquipo.vue', import.meta.url)))
  const componente = existeComponente ? read('../src/components/ResumenEquipo.vue') : ''

  it('las tarjetas van arriba, fuera de los estados de la lista: si la lista falla, el resumen sigue', () => {
    const plantilla = pagina.slice(0, pagina.indexOf('</template>\n\n<script'))
    const resumen = plantilla.indexOf('<ResumenEquipo')
    assert.ok(resumen >= 0, 'la página usa ResumenEquipo')
    assert.ok(resumen < plantilla.indexOf('<ScreenLoader'), 'antes de la carga de la lista')
    assert.match(plantilla, /<ResumenEquipo\s[^>]*:resumen="resumen"[^>]*:cargando="cargandoResumen"[^>]*:error="errorResumen"[^>]*@reintentar="cargarResumen"/)
  })

  it('el resumen se pide aparte con getResumenEquipo y su error no toca el store de la lista', () => {
    const cargar = pagina.slice(pagina.indexOf('const cargarResumen'), pagina.indexOf('\n}', pagina.indexOf('const cargarResumen')))
    assert.match(cargar, /resumen\.value = await getResumenEquipo\(\{ soloImportantes: true \}\)/)
    assert.match(cargar, /errorResumen\.value = fallo/)
    assert.doesNotMatch(cargar, /contadoresStore/)
    assert.match(pagina, /onMounted\(async \(\) => \{\s*cargarResumen\(\)/, 'se lanza sin esperar a la lista')
  })

  it('ResumenEquipo pinta una tarjeta por cada elemento de tarjetasResumen, con tooltip y estados de carga y error', () => {
    assert.ok(existeComponente, 'existe components/ResumenEquipo.vue')
    assert.match(
      componente,
      /tarjetasResumen\(props\.resumen, \{\s*propios: props\.propios,\s*seleccionable: props\.seleccionable,?\s*\}\)/,
    )
    assert.match(componente, /v-for="tarjeta in tarjetas"/)
    assert.match(componente, /<q-tooltip[^>]*>\{\{ tarjeta\.ayuda \}\}<\/q-tooltip>/)
    assert.match(componente, /<ScreenLoader/)
    assert.match(componente, /<ErrorState[\s\S]*?@retry="emit\('reintentar'\)"/)
    assert.match(componente, /aria-labelledby="resumen-equipo-titulo"/)
  })

  it('la cuadrícula tiene una columna por tarjeta (3 en el admin, 4 en «Mi resumen»)', () => {
    assert.match(componente, /'--columnas-tarjetas': tarjetas\.length/)
    assert.match(componente, /grid-template-columns: repeat\(var\(--columnas-tarjetas, 3\), minmax\(0, 1fr\)\)/)
  })

  it('con seleccionable las tarjetas y la dona avisan qué se eligió y marcan la activa', () => {
    const dona = read('../src/components/DonaEstados.vue')
    const miResumen = read('../src/pages/ContadorDashboardPage.vue')

    assert.match(componente, /emit\('seleccionar', tarjeta\.clave\)/, 'la tarjeta avisa su clave')
    assert.match(
      componente,
      /<DonaEstados[\s\S]*?:seleccionable="seleccionable"[\s\S]*?:activa="activa"[\s\S]*?@seleccionar="\(estado\) => emit\('seleccionar', estado\)"/,
    )
    assert.match(componente, /role="seleccionable \? 'button' : undefined"/, 'solo es botón con seleccionable')
    // «Presionado» solo donde la tarjeta filtra (admin); en «Mi resumen» lleva a otra pantalla.
    assert.match(componente, /aria-pressed="seleccionable && !propios \? String\(activa === tarjeta\.clave\) : undefined"/)
    assert.match(componente, /seleccionable: \{ type: Boolean, default: false \}/, 'no es clicable por defecto')
    assert.match(dona, /seleccionable: \{ type: Boolean, default: false \}/, 'la dona no es clicable por defecto')
    assert.match(dona, /emit\('seleccionar', segmento\.clave\)/)
    assert.match(dona, /:active="activa === segmento\.clave"/)

    assert.match(
      miResumen,
      /router\.push\(\{ name: 'contador-casos', query: \{ filtro \} \}\)/,
      '«Mi resumen» abre «Mis casos» con el filtro',
    )
    assert.match(miResumen, /<ResumenEquipo[\s\S]*?seleccionable[\s\S]*?@seleccionar="abrirMisCasos"/)
  })

  it('«Mi resumen» muestra la agenda de casos y la edita con el mismo formulario de «Mis casos»', () => {
    const rutaAgenda = '../src/components/AgendaCasos.vue'
    assert.ok(existsSync(fileURLToPath(new URL(rutaAgenda, import.meta.url))), 'existe AgendaCasos.vue')
    const agenda = read(rutaAgenda)
    const miResumen = read('../src/pages/ContadorDashboardPage.vue')

    assert.match(agenda, /<PriorityTag/, 'usa la etiqueta de prioridad de «Mis casos»')
    assert.match(agenda, /textoDiasPlazo\(diasParaVencerCaso\(caso, hoy\)\)/)
    assert.match(agenda, /emit\('editar', caso\.id\)/)
    assert.doesNotMatch(agenda, /#[0-9a-f]{3,6}\b/i, 'sin colores sueltos')

    assert.match(miResumen, /agendaCasos\(cases\.casos, hoy\.value\)/)
    assert.match(miResumen, /<AgendaCasos[\s\S]*?:casos="agenda"[\s\S]*?@editar="abrirEdicion"/)
    assert.match(miResumen, /<CaseFormDialog[\s\S]*?v-model="dialogoEdicionAbierto"[\s\S]*?:caso="casoEnEdicion"[\s\S]*?@guardado=/)
  })

  it('en el dashboard del admin las tarjetas y la dona filtran la lista de contadores', () => {
    assert.match(
      pagina,
      /<ResumenEquipo[\s\S]*?seleccionable[\s\S]*?:activa="filtroKpi"[\s\S]*?@seleccionar="alternarFiltroKpi"/,
    )
    assert.match(pagina, /contadoresPorKpi\(/, 'la lista usa contadoresPorKpi')
    assert.match(pagina, /:cifra="filtroKpi \?/, 'cada fila muestra la cifra del filtro')
    assert.match(pagina, /Filtrando:/, 'se ve qué filtro está activo')
  })
})

describe('Dashboard: dona «Casos por estado» (rediseño, rebanada 2)', () => {
  const ruta = '../src/components/DonaEstados.vue'
  const existe = existsSync(fileURLToPath(new URL(ruta, import.meta.url)))
  const dona = existe ? read(ruta) : ''
  const resumen = read('../src/components/ResumenEquipo.vue')

  it('dibuja un arco por estado con la geometría de segmentosDona y el total al centro', () => {
    assert.ok(existe, 'existe components/DonaEstados.vue')
    assert.match(dona, /segmentosDona\(props\.resumen\)/)
    assert.match(dona, /v-for="segmento in dona\.segmentos"/)
    assert.match(dona, /pathLength="100"/)
    assert.match(dona, /:stroke-dasharray="`\$\{segmento\.arco\} \$\{100 - segmento\.arco\}`"/)
    assert.match(dona, /:stroke-dashoffset="-segmento\.desplazamiento"/)
    assert.match(dona, /\{\{ dona\.total \}\}/)
  })

  it('es accesible: el SVG es una imagen con el resumen en texto y la leyenda trae número y porcentaje', () => {
    assert.match(dona, /<svg[^>]*role="img"[^>]*:aria-label="descripcion"/)
    assert.match(dona, /\{\{ segmento\.etiqueta \}\}/)
    assert.match(dona, /\{\{ segmento\.valor \}\}/)
    assert.match(dona, /\{\{ segmento\.porcentaje \}\}%/)
  })

  it('sin casos muestra «Sin casos registrados» en lugar de la dona', () => {
    assert.match(dona, /v-if="dona\.total === 0"[^>]*>\s*Sin casos registrados/)
  })

  it('ResumenEquipo la muestra con los mismos datos, junto a las tarjetas', () => {
    assert.match(resumen, /<DonaEstados\s+:resumen="resumen"[\s\S]*?\/>/)
    assert.match(resumen, /import DonaEstados from '\.\/DonaEstados\.vue'/)
  })
})

describe('Dashboard: detalle del contador en diálogo en celular y tableta', () => {
  const pagina = read('../src/pages/AdminDashboardPage.vue')
  const plantilla = pagina.split('<script')[0]
  const ruta = '../src/components/DetalleContador.vue'
  const existe = existsSync(fileURLToPath(new URL(ruta, import.meta.url)))
  const detalle = existe ? read(ruta) : ''

  it('DetalleContador pinta el detalle una sola vez: carga, vacío, filtros, casos y paginación', () => {
    assert.ok(existe, 'existe components/DetalleContador.vue')
    assert.match(detalle, /defineModel\('filtros'/)
    assert.match(detalle, /<ScreenLoader/)
    assert.match(detalle, /<EmptyState/)
    assert.match(detalle, /<FiltrosCasos[^>]*v-model="filtros"/)
    assert.match(detalle, /<q-pagination[\s\S]*?emit\('cambiar-pagina', p\)/)
  })

  it('en escritorio el detalle sigue en el panel al lado de la lista', () => {
    assert.match(pagina, /import DetalleContador from '\.\.\/components\/DetalleContador\.vue'/)
    assert.match(pagina, /const pantallaChica = computed\(\(\) => \$q\.screen\.lt\.md\)/)
    assert.match(plantilla, /<section\s+v-if="!pantallaChica"[\s\S]*?<DetalleContador/)
  })

  it('en celular y tableta el detalle se abre en un q-dialog que sube desde abajo, con botón para cerrar', () => {
    assert.match(plantilla, /<q-dialog\s+v-if="pantallaChica"\s+v-model="dialogoDetalle"\s+position="bottom"/)
    assert.match(plantilla, /<q-dialog[\s\S]*?<DetalleContador[\s\S]*?<\/q-dialog>/)
    assert.match(plantilla, /<q-btn[^>]*v-close-popup[^>]*aria-label="Cerrar el detalle de casos"/)
    assert.match(pagina, /if \(pantallaChica\.value\) dialogoDetalle\.value = true/)
    assert.doesNotMatch(pagina, /scrollIntoView/, 'ya no baja la página hasta el detalle')
  })

  it('si la selección se pierde (error y reintento) el diálogo se cierra', () => {
    assert.match(pagina, /watch\(contadorSeleccionado, \(contador\) => \{\s*if \(!contador\) dialogoDetalle\.value = false/)
  })
})
