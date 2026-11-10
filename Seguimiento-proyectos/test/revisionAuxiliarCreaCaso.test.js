// Revisión de UI, rebanada 6: el auxiliar crea un caso para su contador.
// A: servicio y store llaman al endpoint correcto y manejan errores.
// TDD: las pruebas fallan primero porque crearCasoComoAuxiliar no existe en servicio ni store.

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'

const crearAuxiliarService = (await import('../src/services/auxiliarService.js')).crearAuxiliarService
const crearAuxiliaresStore = (await import('../src/stores/auxiliares.js')).crearAuxiliaresStore

const montarStore = (servicio) => {
  const useStore = crearAuxiliaresStore({ auxiliarService: servicio })
  return useStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('Grupo A: servicio crearCasoComoAuxiliar', () => {
  it('llama a POST /casos/para-auxiliar con contador_id y datos del caso', async () => {
    let cuerpoEnviado = null
    let rutaEnviada = null
    const api = {
      post: async (ruta, cuerpo) => {
        rutaEnviada = ruta
        cuerpoEnviado = cuerpo
        return { data: { mensaje: 'Caso creado correctamente', caso: { id: 7 } } }
      },
    }
    const servicio = crearAuxiliarService({ api })
    const resultado = await servicio.crearCasoComoAuxiliar(3, {
      cliente: 'zz_test cliente',
      prioridad: 'Alta',
      fecha_inicio: '2026-11-02',
      fecha_vencimiento: '2026-11-20',
    })

    assert.strictEqual(rutaEnviada, '/casos/para-auxiliar')
    assert.deepStrictEqual(cuerpoEnviado, {
      contador_id: 3,
      cliente: 'zz_test cliente',
      prioridad: 'Alta',
      fecha_inicio: '2026-11-02',
      fecha_vencimiento: '2026-11-20',
    })
    assert.strictEqual(resultado.mensaje, 'Caso creado correctamente')
    assert.strictEqual(resultado.caso.id, 7)
  })
})

describe('Grupo B: store crearCasoComoAuxiliar', () => {
  it('crea el caso y limpia el error', async () => {
    const servicio = {
      crearCasoComoAuxiliar: async () => ({ mensaje: 'Ok.', caso: { id: 7 } }),
    }
    const store = montarStore(servicio)
    store.error = { mensaje: 'error previo' }

    const resultado = await store.crearCasoComoAuxiliar(3, { cliente: 'zz_test' })

    assert.strictEqual(resultado.ok, true)
    assert.deepStrictEqual(resultado.caso, { id: 7 })
    assert.strictEqual(store.error, null)
    assert.strictEqual(store.guardando, false)
  })

  it('si falla, devuelve error de tres partes y no queda guardando', async () => {
    const servicio = {
      crearCasoComoAuxiliar: async () => {
        throw new Error('caída')
      },
    }
    const store = montarStore(servicio)

    const resultado = await store.crearCasoComoAuxiliar(3, { cliente: 'zz_test' })

    assert.strictEqual(resultado.ok, false)
    assert.ok(store.error, 'se guarda el error')
    assert.ok(store.error.mensaje.includes('Qué ocurrió:'), 'tiene formato de tres partes')
    assert.ok(store.error.mensaje.includes('Sobre:'), 'tiene formato de tres partes')
    assert.ok(store.error.mensaje.includes('Qué hacer:'), 'tiene formato de tres partes')
    assert.strictEqual(store.guardando, false)
  })
})
