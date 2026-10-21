// Pruebas del store de la maqueta. Pinia funciona en Node sin navegador ni paquetes nuevos,
// así que estas pruebas comprueban el estado en memoria y la delegación en src/utils/.
// La navegación no se prueba aquí: pertenece al router (T5).

import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { exampleCases } from '../src/services/exampleData.js'
import {
  LOADING_DELAY_MS,
  SCREEN_IDS,
  STORE_ERROR_CODES,
  useMaquetaStore,
} from '../src/stores/maqueta.js'

let store

beforeEach(() => {
  setActivePinia(createPinia())
  store = useMaquetaStore()
  store.resetToSeed()
})

const findCase = (caseId) => store.cases.find((oneCase) => oneCase.id === caseId)

describe('estado inicial de la maqueta', () => {
  it('arranca sin sesión, con la semilla y sin pantallas cargando', () => {
    assert.equal(store.session, null)
    assert.equal(store.isAuthenticated, false)
    assert.equal(store.selectedCounterId, null)
    assert.equal(store.sessionExpired, false)
    assert.equal(store.cases.length, exampleCases.length)

    for (const screenId of Object.values(SCREEN_IDS)) {
      assert.deepEqual(store.screens[screenId], { loading: false, error: false })
    }
  })

  it('no comparte los objetos de la semilla', () => {
    assert.notEqual(store.cases, exampleCases)
    assert.notEqual(store.cases[0], exampleCases[0])
  })
})

describe('inicio de sesión', () => {
  it('señala el usuario faltante y no abre sesión', () => {
    const result = store.login('', 'admin123')

    assert.equal(result.valid, false)
    assert.deepEqual(result.missing, ['username'])
    assert.equal(result.errorCode, null)
    assert.equal(store.session, null)
  })

  it('trata una contraseña con solo espacios como faltante', () => {
    const result = store.login('admin', '   ')

    assert.equal(result.valid, false)
    assert.deepEqual(result.missing, ['password'])
    assert.equal(store.session, null)
  })

  it('devuelve credenciales no válidas sin abrir sesión y sin decir qué dato falló', () => {
    const result = store.login('Admin', 'admin123')

    assert.equal(result.valid, false)
    assert.deepEqual(result.missing, [])
    assert.equal(result.errorCode, STORE_ERROR_CODES.invalidCredentials)
    assert.equal(store.session, null)
    assert.equal(store.isAuthenticated, false)
  })

  it('abre sesión de administrador sin contador asignado', () => {
    const result = store.login('admin', 'admin123')

    assert.equal(result.valid, true)
    assert.equal(result.profile, 'administrador')
    assert.equal(store.session.profile, 'administrador')
    assert.equal(store.session.account, 'admin')
    assert.equal(store.session.counterId, null)
    assert.equal(store.isAdmin, true)
    assert.equal(store.isCounter, false)
  })

  it('abre sesión de contador asignado a su contador del equipo', () => {
    const result = store.login('contador', 'contador123')

    assert.equal(result.valid, true)
    assert.equal(store.session.profile, 'contador')
    assert.equal(store.session.account, 'contador')
    assert.equal(store.session.counterId, 'c-01')
    assert.equal(store.isCounter, true)
  })

  it('reemplaza la sesión anterior al entrar con otra cuenta válida', () => {
    store.login('contador', 'contador123')
    store.login('admin', 'admin123')

    assert.equal(store.session.profile, 'administrador')
    assert.equal(store.session.account, 'admin')
  })

  it('limpia selección y estados de pantalla al iniciar sesión', () => {
    store.selectCounter('c-02')
    store.simulateError(SCREEN_IDS.myCases)

    store.login('admin', 'admin123')

    assert.equal(store.selectedCounterId, null)
    assert.deepEqual(store.screens[SCREEN_IDS.myCases], { loading: false, error: false })
  })

  it('quita el aviso de caducidad al iniciar sesión de nuevo', () => {
    store.simulateExpiry()
    assert.equal(store.sessionExpired, true)

    store.login('contador', 'contador123')

    assert.equal(store.sessionExpired, false)
    assert.equal(store.isAuthenticated, true)
  })
})

describe('registro de un caso', () => {
  it('no registra sin sesión y no toca los casos', () => {
    const result = store.registerCase({ client: 'Cliente Nuevo', priority: 'alta' })

    assert.equal(result.valid, false)
    assert.equal(result.errorCode, STORE_ERROR_CODES.noSession)
    assert.equal(store.cases.length, exampleCases.length)
  })

  it('delega en caseRules los motivos de rechazo y no agrega', () => {
    store.login('contador', 'contador123')

    assert.equal(
      store.registerCase({ client: '   ', priority: 'alta' }).errorCode,
      'client_required',
    )
    assert.equal(
      store.registerCase({ client: 'a'.repeat(81), priority: 'alta' }).errorCode,
      'client_too_long',
    )
    assert.equal(
      store.registerCase({ client: 'Cliente', priority: '' }).errorCode,
      'priority_required',
    )
    assert.equal(store.cases.length, exampleCases.length)
  })

  it('acepta 80 caracteres y asigna el caso al contador conectado en estado Pendiente', () => {
    store.login('contador', 'contador123')

    const result = store.registerCase({ client: 'a'.repeat(80), priority: 'alta' })

    assert.equal(result.valid, true)
    assert.equal(result.case.status, 'pendiente')
    assert.equal(result.case.counterId, 'c-01')
    assert.equal(result.case.id, 'case-38')
    assert.equal(store.cases.length, exampleCases.length + 1)
    assert.equal(store.myCases.length, 1)
    assert.deepEqual(store.countsFor('c-01'), { pendiente: 1, en_proceso: 0, finalizado: 0 })
  })

  it('recorta los espacios extremos del cliente y no altera la semilla', () => {
    store.login('contador', 'contador123')

    const result = store.registerCase({ client: '  Cliente con espacios  ', priority: 'baja' })

    assert.equal(result.case.client, 'Cliente con espacios')
    assert.equal(exampleCases.length, 37)
  })
})

describe('cambios de estado y prioridad', () => {
  it('cambia el estado de un caso Finalizado y actualiza los conteos', () => {
    store.changeCaseStatus('case-03', 'pendiente')

    assert.equal(findCase('case-03').status, 'pendiente')
    assert.deepEqual(store.countsFor('c-02'), { pendiente: 6, en_proceso: 5, finalizado: 4 })
    assert.equal(exampleCases[2].status, 'finalizado')
  })

  it('cambia la prioridad sin tocar el estado', () => {
    store.changeCasePriority('case-03', 'alta')

    assert.equal(findCase('case-03').priority, 'alta')
    assert.equal(findCase('case-03').status, 'finalizado')
    assert.equal(exampleCases[2].priority, 'baja')
  })

  it('no se rompe con un caso o un valor inexistente', () => {
    const before = store.cases.length

    store.changeCaseStatus('case-inexistente', 'pendiente')
    store.changeCaseStatus('case-01', 'estado-invalido')
    store.changeCasePriority('case-01', 'prioridad-invalida')

    assert.equal(store.cases.length, before)
    assert.equal(findCase('case-01').status, 'pendiente')
    assert.equal(findCase('case-01').priority, 'alta')
  })
})

describe('simulación de error y reintento', () => {
  it('sustituye la pantalla por el error', () => {
    store.simulateError(SCREEN_IDS.myCases)

    assert.deepEqual(store.screens[SCREEN_IDS.myCases], { loading: false, error: true })
  })

  it('reintenta con una carga nueva y vuelve a mostrar el contenido', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    store.simulateError(SCREEN_IDS.myCases)

    store.retryScreen(SCREEN_IDS.myCases)

    assert.deepEqual(store.screens[SCREEN_IDS.myCases], { loading: true, error: false })

    t.mock.timers.tick(LOADING_DELAY_MS)

    assert.deepEqual(store.screens[SCREEN_IDS.myCases], { loading: false, error: false })
  })

  it('en P-2 pierde el contador seleccionado al reintentar', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    store.selectCounter('c-02')
    store.simulateError(SCREEN_IDS.dashboard)

    store.retryScreen(SCREEN_IDS.dashboard)

    assert.equal(store.selectedCounterId, null)
    assert.equal(store.screens[SCREEN_IDS.dashboard].loading, true)
  })

  it('el error interrumpe la carga en curso y no llega a mostrar datos', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    store.startScreenLoad(SCREEN_IDS.myCases)

    store.simulateError(SCREEN_IDS.myCases)
    t.mock.timers.tick(LOADING_DELAY_MS)

    assert.deepEqual(store.screens[SCREEN_IDS.myCases], { loading: false, error: true })
  })

  it('ignora una pantalla desconocida', () => {
    assert.doesNotThrow(() => store.simulateError('p-inexistente'))
    assert.doesNotThrow(() => store.retryScreen('p-inexistente'))
    assert.doesNotThrow(() => store.startScreenLoad('p-inexistente'))
  })

  it('marca la carga durante aproximadamente un segundo', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    store.startScreenLoad(SCREEN_IDS.directory)

    assert.equal(store.screens[SCREEN_IDS.directory].loading, true)

    t.mock.timers.tick(LOADING_DELAY_MS - 1)
    assert.equal(store.screens[SCREEN_IDS.directory].loading, true)

    t.mock.timers.tick(1)
    assert.equal(store.screens[SCREEN_IDS.directory].loading, false)
  })
})

describe('simulación de caducidad', () => {
  it('cierra la sesión, deja las pantallas sin datos y activa el aviso', () => {
    store.login('admin', 'admin123')
    store.selectCounter('c-02')
    store.simulateError(SCREEN_IDS.dashboard)

    store.simulateExpiry()

    assert.equal(store.session, null)
    assert.equal(store.isAuthenticated, false)
    assert.equal(store.sessionExpired, true)
    assert.equal(store.selectedCounterId, null)

    for (const screenId of Object.values(SCREEN_IDS)) {
      assert.deepEqual(store.screens[screenId], { loading: false, error: false })
    }
  })

  it('conserva los cambios hechos mientras la maqueta sigue abierta', () => {
    store.login('contador', 'contador123')
    store.registerCase({ client: 'Cliente que sobrevive', priority: 'media' })

    store.simulateExpiry()
    store.login('contador', 'contador123')

    assert.equal(store.myCases.length, 1)
    assert.equal(store.myCases[0].client, 'Cliente que sobrevive')
  })

  it('cancela una carga en curso al caducar la sesión', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    store.login('contador', 'contador123')
    store.startScreenLoad(SCREEN_IDS.myCases)

    store.simulateExpiry()
    t.mock.timers.tick(LOADING_DELAY_MS)

    assert.deepEqual(store.screens[SCREEN_IDS.myCases], { loading: false, error: false })
    assert.equal(store.session, null)
  })
})

describe('cierre de sesión y reinicio', () => {
  it('cerrar sesión no borra los casos', () => {
    store.login('contador', 'contador123')
    store.registerCase({ client: 'Cliente persistente', priority: 'alta' })

    store.logout()

    assert.equal(store.session, null)
    assert.equal(store.sessionExpired, false)
    assert.equal(store.cases.length, exampleCases.length + 1)
    assert.equal(store.selectedCounterId, null)
  })

  it('reinicia todo a la semilla de exampleData', () => {
    store.login('contador', 'contador123')
    store.registerCase({ client: 'Cliente temporal', priority: 'alta' })
    store.selectCounter('c-02')
    store.simulateError(SCREEN_IDS.myCases)
    store.simulateExpiry()

    store.resetToSeed()

    assert.equal(store.session, null)
    assert.equal(store.sessionExpired, false)
    assert.equal(store.selectedCounterId, null)
    assert.equal(store.cases.length, exampleCases.length)
    assert.deepEqual(
      store.cases.map((oneCase) => oneCase.id),
      exampleCases.map((oneCase) => oneCase.id),
    )

    for (const screenId of Object.values(SCREEN_IDS)) {
      assert.deepEqual(store.screens[screenId], { loading: false, error: false })
    }
  })

  it('cancela una carga en curso al reiniciar', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    store.startScreenLoad(SCREEN_IDS.dashboard)

    store.resetToSeed()
    t.mock.timers.tick(LOADING_DELAY_MS)

    assert.equal(store.screens[SCREEN_IDS.dashboard].loading, false)
  })
})
