// Pruebas del store de contadores (RF-11 a RF-16, RF-24, RF-34 a RF-36).
// Sin red: se inyecta un servicio de contadores falso que registra las llamadas.

import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { crearCountersStore } from '../src/stores/counters.js'

// --- ayudas ----------------------------------------------------------------

const CEROS = () => ({ pendiente: 0, en_proceso: 0, finalizado: 0 })

const ERROR_RED = {
  estado: 'red',
  mensaje: 'Qué ocurrió: no hay conexión. Sobre: los contadores. Qué hacer: verifique su conexión.',
  codigoHttp: null,
  datos: null,
}

const ERROR_DETALLE = {
  estado: 'servidor',
  mensaje: 'Qué ocurrió: el servidor falló. Sobre: el detalle del contador. Qué hacer: reintente.',
  codigoHttp: 500,
  datos: null,
}

const caso = (extra = {}) => ({
  id: 9,
  cliente: 'Distribuidora Ñandú',
  estado: 'pendiente',
  prioridad: 'alta',
  contador_id: 3,
  ...extra,
})

// Servicio falso de contadores.
const crearServicioFalso = ({ contadores = [], conteos = {}, casos = {}, errores = {} } = {}) => {
  const llamadas = []
  return {
    llamadas,
    async listCounters() {
      llamadas.push({ accion: 'listar' })
      if (errores.listar) {
        throw errores.listar
      }
      return contadores
    },
    async getConteosPorEstado(id) {
      llamadas.push({ accion: 'conteos', id })
      if (errores.conteos) {
        throw errores.conteos
      }
      return conteos[id] ?? CEROS()
    },
    async getCasosPorContador(id) {
      llamadas.push({ accion: 'casos', id })
      if (errores.casos) {
        throw errores.casos
      }
      return casos[id] ?? []
    },
  }
}

const montarStore = (servicio) => {
  const useStore = crearCountersStore({ counterService: servicio })
  return useStore()
}

const esErrorDeTresPartes = (error) => {
  assert.ok(error && error.mensaje, 'el error debe traer mensaje')
  assert.ok(error.mensaje.includes('Qué ocurrió:'), 'falta qué ocurrió (RNF-01)')
  assert.ok(error.mensaje.includes('Qué hacer:'), 'falta qué hacer (RNF-01)')
  return true
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// --- estado inicial y carga (RF-11, RF-12, RF-34) ------------------------

test('estado inicial: sin contadores, sin conteos y pantalla vacía', () => {
  const store = montarStore(crearServicioFalso())

  assert.deepEqual(store.contadores, [])
  assert.deepEqual(store.conteosPorId, {})
  assert.equal(store.contadorSeleccionadoId, null)
  assert.deepEqual(store.casosDetalle, [])
  assert.equal(store.estadoPantalla, 'vacio')
})

test('cargarContadores obtiene la lista y N conteos con ceros incluidos (RF-12)', async () => {
  const servicio = crearServicioFalso({
    contadores: [
      { id: 3, usuario: 'ana' },
      { id: 4, usuario: 'luis' },
    ],
    conteos: {
      3: { pendiente: 2, en_proceso: 0, finalizado: 5 },
      4: { pendiente: 0, en_proceso: 1, finalizado: 0 },
    },
  })
  const store = montarStore(servicio)

  const resultado = await store.cargarContadores()

  assert.equal(resultado.ok, true)
  assert.deepEqual(servicio.llamadas, [
    { accion: 'listar' },
    { accion: 'conteos', id: 3 },
    { accion: 'conteos', id: 4 },
  ])
  assert.equal(store.contadores.length, 2)
  assert.deepEqual(store.conteosDe(3), { pendiente: 2, en_proceso: 0, finalizado: 5 })
  assert.deepEqual(store.conteosDe(4), { pendiente: 0, en_proceso: 1, finalizado: 0 })
  assert.equal(store.estadoPantalla, 'contenido')
})

test('conteosDe devuelve los tres conteos en cero para un contador sin datos', () => {
  const store = montarStore(crearServicioFalso())

  assert.deepEqual(store.conteosDe(999), CEROS())
})

test('lanza las N peticiones de conteos en paralelo y muestra carga hasta terminar', async () => {
  const pendientes = []
  const llamadas = []
  const servicio = {
    async listCounters() {
      llamadas.push({ accion: 'listar' })
      return [{ id: 1 }, { id: 2 }, { id: 3 }]
    },
    getConteosPorEstado(id) {
      llamadas.push({ accion: 'conteos', id })
      return new Promise((resolver) => {
        pendientes.push({ id, resolver })
      })
    },
    async getCasosPorContador() {
      return []
    },
  }
  const store = montarStore(servicio)

  const promesa = store.cargarContadores()
  await new Promise((resolver) => setImmediate(resolver))

  assert.equal(pendientes.length, 3, 'las tres peticiones se lanzan sin esperar unas a otras')
  assert.equal(store.estadoPantalla, 'cargando')
  assert.deepEqual(store.contadores, [], 'no se muestran datos incompletos')

  for (const pendiente of pendientes) {
    pendiente.resolver({ pendiente: pendiente.id, en_proceso: 0, finalizado: 0 })
  }
  await promesa

  assert.equal(store.estadoPantalla, 'contenido')
})

test('si un conteo falla: error completo, sin conteos parciales y sin lista (RF-36)', async () => {
  const servicio = crearServicioFalso({
    contadores: [
      { id: 3, usuario: 'ana' },
      { id: 4, usuario: 'luis' },
    ],
    conteos: { 3: { pendiente: 2, en_proceso: 0, finalizado: 0 } },
    errores: { conteos: ERROR_RED },
  })
  const store = montarStore(servicio)

  const resultado = await store.cargarContadores()

  assert.equal(resultado.ok, false)
  assert.deepEqual(store.error, ERROR_RED)
  assert.deepEqual(store.contadores, [], 'no se conserva una lista parcial')
  assert.deepEqual(store.conteosPorId, {}, 'no se conservan conteos parciales')
  assert.equal(store.estadoPantalla, 'error')
})

test('si falla la lista: error, sin contar y pantalla en error', async () => {
  const servicio = crearServicioFalso({ errores: { listar: ERROR_RED } })
  const store = montarStore(servicio)

  const resultado = await store.cargarContadores()

  assert.equal(resultado.ok, false)
  assert.equal(store.estadoPantalla, 'error')
  assert.equal(servicio.llamadas.filter((llamada) => llamada.accion === 'conteos').length, 0)
})

test('una lista vacía deja la pantalla en vacío (RF-14)', async () => {
  const store = montarStore(crearServicioFalso({ contadores: [] }))

  await store.cargarContadores()

  assert.equal(store.contadores.length, 0)
  assert.equal(store.estadoPantalla, 'vacio')
})

// --- selección y detalle (RF-13, RF-15, RF-36) ---------------------------

test('seleccionarContador carga su detalle y al cambiar de contador reemplaza el anterior (RF-15)', async () => {
  const servicio = crearServicioFalso({
    contadores: [
      { id: 3, usuario: 'ana' },
      { id: 4, usuario: 'luis' },
    ],
    casos: {
      3: [caso({ id: 9, cliente: 'Cliente de ana' })],
      4: [caso({ id: 10, cliente: 'Cliente de luis' })],
    },
  })
  const store = montarStore(servicio)
  await store.cargarContadores()

  await store.seleccionarContador(3)
  assert.equal(store.contadorSeleccionadoId, 3)
  assert.deepEqual(
    store.casosDetalle.map((uno) => uno.cliente),
    ['Cliente de ana'],
  )

  await store.seleccionarContador(4)

  assert.equal(store.contadorSeleccionadoId, 4)
  assert.deepEqual(
    store.casosDetalle.map((uno) => uno.cliente),
    ['Cliente de luis'],
    'el detalle anterior se reemplaza',
  )
  assert.deepEqual(servicio.llamadas.slice(-1), [{ accion: 'casos', id: 4 }])
})

test('al elegir otro contador el detalle anterior desaparece mientras carga', async () => {
  let resolverDetalle = null
  const servicio = {
    async listCounters() {
      return [{ id: 3 }, { id: 4 }]
    },
    async getConteosPorEstado() {
      return CEROS()
    },
    async getCasosPorContador(id) {
      if (id === 3) {
        return [caso({ id: 9, cliente: 'Cliente de ana' })]
      }
      return new Promise((resolver) => {
        resolverDetalle = resolver
      })
    },
  }
  const store = montarStore(servicio)
  await store.cargarContadores()
  await store.seleccionarContador(3)

  const promesa = store.seleccionarContador(4)

  assert.equal(store.estadoDetalle, 'cargando')
  assert.deepEqual(store.casosDetalle, [], 'no se muestra el detalle del contador anterior')

  resolverDetalle([])
  await promesa
})

test('detalle vacío: estadoDetalle en vacío con el contador seleccionado (RF-14)', async () => {
  const servicio = crearServicioFalso({
    contadores: [{ id: 3, usuario: 'ana' }],
    casos: { 3: [] },
  })
  const store = montarStore(servicio)
  await store.cargarContadores()

  await store.seleccionarContador(3)

  assert.equal(store.estadoDetalle, 'vacio')
})

test('si falla el detalle: no se conserva la selección y se informa el error (RF-36)', async () => {
  const servicio = crearServicioFalso({
    contadores: [{ id: 3, usuario: 'ana' }],
    errores: { casos: ERROR_DETALLE },
  })
  const store = montarStore(servicio)
  await store.cargarContadores()

  const resultado = await store.seleccionarContador(3)

  assert.equal(resultado.ok, false)
  assert.equal(store.contadorSeleccionadoId, null, 'P-2 vuelve sin contador seleccionado')
  assert.deepEqual(store.casosDetalle, [])
  assert.deepEqual(store.error, ERROR_DETALLE)
  assert.ok(esErrorDeTresPartes(store.error))
  assert.equal(store.estadoPantalla, 'error')
})

// --- reintento y reinicio -------------------------------------------------

test('reintentar repite la carga, limpia el error y recupera el contenido', async () => {
  let fallar = true
  const llamadas = []
  const servicio = {
    async listCounters() {
      llamadas.push('listar')
      if (fallar) {
        throw ERROR_RED
      }
      return [{ id: 3, usuario: 'ana' }]
    },
    async getConteosPorEstado() {
      return { pendiente: 1, en_proceso: 0, finalizado: 0 }
    },
    async getCasosPorContador() {
      return []
    },
  }
  const store = montarStore(servicio)
  await store.cargarContadores()
  assert.equal(store.estadoPantalla, 'error')

  fallar = false
  await store.reintentar()

  assert.equal(store.error, null)
  assert.equal(store.estadoPantalla, 'contenido')
  assert.deepEqual(store.conteosDe(3), { pendiente: 1, en_proceso: 0, finalizado: 0 })
  assert.deepEqual(llamadas, ['listar', 'listar'])
})

test('reiniciar deja el store sin datos de otro perfil (RNF-05)', async () => {
  const servicio = crearServicioFalso({
    contadores: [{ id: 3, usuario: 'ana' }],
    casos: { 3: [caso()] },
  })
  const store = montarStore(servicio)
  await store.cargarContadores()
  await store.seleccionarContador(3)

  store.reiniciar()

  assert.deepEqual(store.contadores, [])
  assert.deepEqual(store.conteosPorId, {})
  assert.equal(store.contadorSeleccionadoId, null)
  assert.deepEqual(store.casosDetalle, [])
  assert.equal(store.error, null)
  assert.equal(store.cargando, false)
  assert.equal(store.estadoPantalla, 'vacio')
})

// --- guardia de versi�n (T9) ---

test('una respuesta tard�a tras reiniciar no repuebla contadores (guardia de versi�n)', async () => {
  const llamadasListar = []
  let resolverPrimera = null
  const servicio = {
    async listCounters() {
      llamadasListar.push('listar')
      if (llamadasListar.length === 1) {
        return new Promise((resolver) => {
          resolverPrimera = resolver
        })
      }
      return [{ id: 3, usuario: 'nuevo' }]
    },
    async getConteosPorEstado() {
      return { pendiente: 1, en_proceso: 0, finalizado: 0 }
    },
    async getCasosPorContador() {
      return []
    },
  }
  const store = montarStore(servicio)

  const promesaA = store.cargarContadores()
  await new Promise((listo) => setImmediate(listo))

  store.reiniciar()

  const promesaB = store.cargarContadores()
  await promesaB

  assert.equal(store.contadores.length, 1)
  assert.equal(store.contadores[0].usuario, 'nuevo')

  resolverPrimera([{ id: 99, usuario: 'antiguo' }])
  await promesaA.catch(() => {})

  assert.equal(store.contadores.length, 1, 'la respuesta tard�a no repuebla')
  assert.equal(store.contadores[0].usuario, 'nuevo')
  assert.equal(store.cargando, false)
})

test('un error tard�o tras reiniciar no deja error (guardia de versi�n)', async () => {
  let resolverPrimera = null
  let rechazarPrimera = null
  const servicio = {
    async listCounters() {
      return new Promise((resolver, rechazar) => {
        resolverPrimera = resolver
        rechazarPrimera = rechazar
      })
    },
    async getConteosPorEstado() {
      return { pendiente: 0, en_proceso: 0, finalizado: 0 }
    },
    async getCasosPorContador() {
      return []
    },
  }
  const store = montarStore(servicio)

  const promesaA = store.cargarContadores()
  await new Promise((listo) => setImmediate(listo))

  store.reiniciar()

  rechazarPrimera(ERROR_RED)

  await promesaA.catch(() => {})

  assert.deepEqual(store.contadores, [])
  assert.equal(store.error, null)
})
