// Rebanada 7: cierre de los huecos de las rebanadas 2 y 5.
// A: el servicio pide los contadores disponibles.
// B: el store usa el servicio real y mantiene la lista de disponibles.
// C: la página de auxiliares deja de tener la lista vacía y entrega ids, no objetos.
// TDD: las pruebas fallan primero porque nada de esto existe o está cableado.

import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { createPinia, setActivePinia } from 'pinia'

const { crearAuxiliarService } = await import('../src/services/auxiliarService.js')
const { crearAuxiliaresStore, useAuxiliaresStore } = await import('../src/stores/auxiliares.js')
const { api } = await import('../src/services/api.js')

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const pagina = leer('../src/pages/ContadorAuxiliaresPage.vue')
const plantilla = pagina.split('<script')[0]
const estilos = pagina.slice(pagina.indexOf('<style'))
const misCasos = leer('../src/pages/MyCasesPage.vue')

const montarStore = (servicio) => {
  const useStore = crearAuxiliaresStore({ auxiliarService: servicio })
  return useStore()
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('Grupo A: servicio de auxiliares', () => {
  it('listarDisponibles pide los contadores asignables del contador', async () => {
    let rutaEnviada = null
    const apiFalsa = {
      get: async (ruta) => {
        rutaEnviada = ruta
        return { data: { contadores: [{ id: 4, nombre: 'Contador Cuatro' }] } }
      },
    }
    const servicio = crearAuxiliarService({ api: apiFalsa })

    const contadores = await servicio.listarDisponibles(3)

    assert.strictEqual(rutaEnviada, '/contadores/3/auxiliares-disponibles')
    assert.deepStrictEqual(contadores, [{ id: 4, nombre: 'Contador Cuatro' }])
  })
})

describe('Grupo B: store de auxiliares', () => {
  it('cargarDisponibles llena la lista y apaga la carga', async () => {
    const store = montarStore({
      listarDisponibles: async () => [{ id: 4, nombre: 'Contador Cuatro' }],
    })

    const resultado = await store.cargarDisponibles(3)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(store.cargandoDisponibles, false)
    assert.deepStrictEqual(store.disponibles, [{ id: 4, nombre: 'Contador Cuatro' }])
    assert.strictEqual(store.errorDisponibles, null)
  })

  it('si falla la carga de disponibles, guarda un error de tres partes', async () => {
    const store = montarStore({
      listarDisponibles: async () => {
        throw new Error('caída')
      },
    })

    const resultado = await store.cargarDisponibles(3)

    assert.strictEqual(resultado.ok, false)
    assert.strictEqual(store.cargandoDisponibles, false)
    assert.ok(store.errorDisponibles.mensaje.includes('Qué ocurrió'))
    assert.ok(store.errorDisponibles.mensaje.includes('Sobre:'))
    assert.ok(store.errorDisponibles.mensaje.includes('Qué hacer:'))
  })

  it('al asignar, recarga auxiliares y disponibles', async () => {
    let disponiblesLlamados = 0
    const servicio = {
      asignarAuxiliar: async () => ({ mensaje: 'Ok.' }),
      listarAuxiliares: async () => [{ id: 4, nombre: 'Contador Cuatro' }],
      listarDisponibles: async () => {
        disponiblesLlamados += 1
        return []
      },
    }
    const store = montarStore(servicio)

    const resultado = await store.asignarAuxiliar(3, 4)

    assert.strictEqual(resultado.ok, true)
    assert.strictEqual(disponiblesLlamados, 1, 'la lista de disponibles se actualiza tras asignar')
  })

  it('el store por defecto usa el servicio real', async () => {
    const adaptadorAnterior = api.defaults.adapter
    const rutas = []
    api.defaults.adapter = async (config) => {
      rutas.push(config.url)
      return {
        data: config.url.includes('disponibles')
          ? { contadores: [{ id: 4, nombre: 'Contador Cuatro' }] }
          : { auxiliares: [{ id: 4, nombre: 'Contador Cuatro' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }

    try {
      const store = useAuxiliaresStore()
      const auxiliares = await store.cargarAuxiliares(3)
      const disponibles = await store.cargarDisponibles(3)

      assert.strictEqual(auxiliares.ok, true, 'la carga real no truena')
      assert.strictEqual(disponibles.ok, true)
      assert.deepStrictEqual(rutas, [
        '/contadores/3/auxiliares',
        '/contadores/3/auxiliares-disponibles',
      ])
    } finally {
      api.defaults.adapter = adaptadorAnterior
    }
  })
})

describe('Grupo C: página de gestión de auxiliares', () => {
  it('no tiene la lista de contadores vacía de relleno', () => {
    assert.doesNotMatch(pagina, /contadoresDisponibles/)
    assert.doesNotMatch(pagina, /return \[\]/)
  })

  it('carga los contadores disponibles desde el store', () => {
    assert.match(pagina, /cargarDisponibles/)
    assert.match(pagina, /auxiliares\.disponibles/)
  })

  it('entrega el id del contador, no la opción completa', () => {
    assert.match(plantilla, /emit-value/)
    assert.match(plantilla, /map-options/)
  })

  it('compara los ids como números', () => {
    assert.match(pagina, /const idPropio = Number\(session\.id\)/)
  })

  it('usa clases propias para los campos, no etiquetas de Quasar', () => {
    assert.match(plantilla, /class="input-moderno auxiliares-page__campo"/)
    assert.match(plantilla, /class="selector-moderno auxiliares-page__campo"/)
    assert.match(estilos, /\.auxiliares-page__campo\s*\{/)
    assert.doesNotMatch(estilos, /\.auxiliares-page__asignar q-(input|select)/)
  })

  it('el selector «Registrar caso para» de Mis casos también entrega el id', () => {
    const bloque = misCasos.slice(misCasos.indexOf('Registrar caso para') - 900, misCasos.indexOf('Registrar caso para'))
    assert.match(bloque, /emit-value/)
    assert.match(bloque, /map-options/)
  })
})
