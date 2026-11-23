// Revisión de UI, rebanada 2: servicios y store de auxiliares.
// A: errores de tres partes y mensajes en tú. B: carga, guardado y errores.
// TDD: las pruebas fallan primero porque AuxiliarService y AuxiliaresStore no existen.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'

// El módulo aún no existe: importarlo debe lanzar MODULE_NOT_FOUND (en rojo).
const crearAuxiliarService = (await import('../src/services/auxiliarService.js')).crearAuxiliarService
const crearAuxiliaresStore = (await import('../src/stores/auxiliares.js')).crearAuxiliaresStore

const montarStore = (servicio) => {
  const useStore = crearAuxiliaresStore({ auxiliarService: servicio })
  return useStore()
}

const esErrorDeTresPartes = (error) => {
  assert.ok(error && error.mensaje, 'el error debe traer mensaje')
  assert.ok(error.mensaje.includes('Qué ocurrió:'), 'falta qué ocurrió (RNF-01)')
  assert.ok(error.mensaje.includes('Sobre:'), 'falta sobre qué (RNF-01)')
  assert.ok(error.mensaje.includes('Qué hacer:'), 'falta qué hacer (RNF-01)')
  return true
}

beforeEach(() => {
  setActivePinia(createPinia())
})

const apiFalso = {
  get: async () => ({
    data: { auxiliares: [{ id: 2, nombre: 'Auxiliar Dos' }], contadores: [{ id: 2, nombre: 'Auxiliar Dos' }] },
  }),
  post: async () => ({ data: { mensaje: 'Auxiliar asignado.' } }),
  delete: async () => ({ data: { mensaje: 'Auxiliar quitado.' } }),
}

describe('Grupo A: servicio de auxiliares', () => {
  it('listarAuxiliares devuelve la lista de auxiliares del contador', async () => {
    const servicio = crearAuxiliarService({ api: apiFalso })
    const aux = await servicio.listarAuxiliares(1)
    assert.ok(Array.isArray(aux), 'devuelve un array')
    assert.strictEqual(aux.length, 1)
    assert.strictEqual(aux[0].id, 2)
    assert.strictEqual(aux[0].nombre, 'Auxiliar Dos')
  })

  it('asignarAuxiliar llama a POST y devuelve el mensaje', async () => {
    const servicio = crearAuxiliarService({ api: apiFalso })
    const resultado = await servicio.asignarAuxiliar(1, 2)
    assert.strictEqual(resultado.mensaje, 'Auxiliar asignado.')
  })

  it('quitarAuxiliar llama a DELETE y devuelve el mensaje', async () => {
    const servicio = crearAuxiliarService({ api: apiFalso })
    const resultado = await servicio.quitarAuxiliar(1, 2)
    assert.strictEqual(resultado.mensaje, 'Auxiliar quitado.')
  })

  it('listarContadoresQueMeTienenComoAuxiliar devuelve contadores', async () => {
    const servicio = crearAuxiliarService({ api: apiFalso })
    const contadores = await servicio.listarContadoresQueMeTienenComoAuxiliar(1)
    assert.ok(Array.isArray(contadores))
    assert.strictEqual(contadores[0].id, 2)
  })
})

describe('Grupo B: store de auxiliares', () => {
  it('cargarAuxiliares llena el estado y marca cargando', async () => {
    const store = montarStore({ listarAuxiliares: async () => [{ id: 2, nombre: 'Aux' }] })
    assert.strictEqual(store.cargando, false)
    assert.strictEqual(store.auxiliares.length, 0)

    const resultado = await store.cargarAuxiliares(1)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(store.cargando, false)
    assert.strictEqual(store.auxiliares.length, 1)
    assert.strictEqual(store.auxiliares[0].nombre, 'Aux')
    assert.strictEqual(store.error, null)
  })

  it('al fallar la carga, error tiene tres partes y no se vacía la lista previa', async () => {
    const servicioFallo = { listarAuxiliares: async () => { throw new Error('caída') } }
    const store = montarStore(servicioFallo)
    store.auxiliares = [{ id: 5, nombre: 'Previo' }]

    const resultado = await store.cargarAuxiliares(1)

    assert.strictEqual(resultado.ok, false)
    assert.strictEqual(store.cargando, false)
    assert.ok(store.error, 'se guarda el error')
    esErrorDeTresPartes(store.error)
    assert.strictEqual(store.auxiliares.length, 1, 'la lista previa se conserva')
  })

  it('asignarAuxiliar deshabilita mientras guarda y limpia el error', async () => {
    let llamada = 0
    const servicio = {
      asignarAuxiliar: async () => { llamada += 1; return { mensaje: 'Ok.' } },
      listarAuxiliares: async () => [],
    }
    const store = montarStore(servicio)
    store.guardando = false
    store.error = { mensaje: 'error previo' }

    const resultado = await store.asignarAuxiliar(1, 2)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(store.guardando, false)
    assert.strictEqual(store.error, null)
    assert.strictEqual(llamada, 1)
  })

  it('quitarAuxiliar devuelve ok y limpia el error', async () => {
    const servicio = {
      quitarAuxiliar: async () => ({ mensaje: 'Quitado.' }),
      listarAuxiliares: async () => [],
    }
    const store = montarStore(servicio)

    const resultado = await store.quitarAuxiliar(1, 2)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(store.error, null)
  })
})

describe('Rebanada 41: recarga en silencio de los auxiliares («Mi perfil»)', () => {
  it('actualiza la lista sin pasar por «cargando»', async () => {
    let cargandoDurante = null
    const store = montarStore({
      listarAuxiliares: async () => {
        cargandoDurante = store.cargando
        return [{ id: 3, nombre: 'Auxiliar Tres' }]
      },
    })
    store.auxiliares = [{ id: 2, nombre: 'Auxiliar Dos' }]

    const resultado = await store.refrescarAuxiliaresEnSilencio(1)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(cargandoDurante, false)
    assert.deepStrictEqual(store.auxiliares, [{ id: 3, nombre: 'Auxiliar Tres' }])
  })

  it('un fallo conserva la lista y no muestra error', async () => {
    const store = montarStore({
      listarAuxiliares: async () => {
        throw new Error('sin red')
      },
    })
    store.auxiliares = [{ id: 2, nombre: 'Auxiliar Dos' }]

    const resultado = await store.refrescarAuxiliaresEnSilencio(1)

    assert.strictEqual(resultado.ok, false)
    assert.strictEqual(store.error, null)
    assert.deepStrictEqual(store.auxiliares, [{ id: 2, nombre: 'Auxiliar Dos' }])
  })

  it('una carga completa iniciada después gana sobre la recarga en silencio', async () => {
    let soltar
    let llamada = 0
    const store = montarStore({
      listarAuxiliares: async () => {
        llamada += 1
        if (llamada === 1) {
          await new Promise((r) => (soltar = r))
          return [{ id: 9, nombre: 'Vieja' }]
        }
        return [{ id: 3, nombre: 'Nueva' }]
      },
    })

    const silenciosa = store.refrescarAuxiliaresEnSilencio(1)
    await store.cargarAuxiliares(1)
    soltar()
    await silenciosa

    assert.deepStrictEqual(store.auxiliares, [{ id: 3, nombre: 'Nueva' }])
  })
})

describe('Rebanada 41: la recarga en silencio no deja colgada una carga completa', () => {
  it('con una carga completa en curso no hace nada y esa carga termina', async () => {
    let soltar
    let llamadas = 0
    const store = montarStore({
      listarAuxiliares: async () => {
        llamadas += 1
        await new Promise((r) => (soltar = r))
        return [{ id: 3, nombre: 'Nueva' }]
      },
    })

    const completa = store.cargarAuxiliares(1)
    const resultado = await store.refrescarAuxiliaresEnSilencio(1)
    soltar()
    await completa

    assert.strictEqual(resultado.descartado, true)
    assert.strictEqual(llamadas, 1)
    assert.strictEqual(store.cargando, false)
    assert.deepStrictEqual(store.auxiliares, [{ id: 3, nombre: 'Nueva' }])
  })
})

describe('Rebanada 41: la recarga en silencio correcta quita un error anterior', () => {
  it('tras un fallo de la carga inicial, un refresco exitoso deja de mostrar el error', async () => {
    let falla = true
    const store = montarStore({
      listarAuxiliares: async () => {
        if (falla) throw new Error('sin red')
        return [{ id: 3, nombre: 'Nueva' }]
      },
    })
    await store.cargarAuxiliares(1)
    assert.ok(store.error, 'la carga inicial deja el error')

    falla = false
    await store.refrescarAuxiliaresEnSilencio(1)

    assert.strictEqual(store.error, null)
    assert.deepStrictEqual(store.auxiliares, [{ id: 3, nombre: 'Nueva' }])
  })
})
