// Pruebas del store de casos propios del contador (RF-15, RF-18 a RF-22, RF-27 a RF-33, RF-36).
// Sin red: se inyecta un servicio de casos falso que registra las llamadas.

import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { crearCasesStore } from '../src/stores/cases.js'

// --- ayudas ----------------------------------------------------------------

const ERROR_RED = {
  estado: 'red',
  mensaje: 'Qué ocurrió: no hay conexión. Sobre: sus casos. Qué hacer: verifique su conexión.',
  codigoHttp: null,
  datos: null,
}

const ERROR_REGISTRO = {
  estado: 'solicitud_invalida',
  mensaje:
    'Qué ocurrió: el cliente no es válido. Sobre: el registro del caso. Qué hacer: corrija el dato.',
  codigoHttp: 400,
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

// Servicio falso de casos.
const crearServicioFalso = ({ casos = [], errores = {}, casoCreado, casoActualizado } = {}) => {
  const llamadas = []
  return {
    llamadas,
    async getMisCasos() {
      llamadas.push({ accion: 'listar' })
      if (errores.listar) {
        throw errores.listar
      }
      return casos
    },
    async crearCaso(cliente, prioridad) {
      llamadas.push({ accion: 'crear', cliente, prioridad })
      if (errores.crear) {
        throw errores.crear
      }
      return casoCreado ?? caso({ id: 99, cliente, prioridad })
    },
    async actualizarCaso(id, cambios) {
      llamadas.push({ accion: 'actualizar', id, cambios })
      if (errores.actualizar) {
        throw errores.actualizar
      }
      return casoActualizado ?? caso({ id, ...cambios })
    },
  }
}

const montarStore = (servicio) => {
  const useStore = crearCasesStore({ caseService: servicio })
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

// --- estado inicial y carga (RF-27, RF-33, RF-34) ------------------------

test('estado inicial: sin casos, sin error y pantalla vacía', () => {
  const store = montarStore(crearServicioFalso())

  assert.deepEqual(store.casos, [])
  assert.equal(store.cargando, false)
  assert.equal(store.guardando, false)
  assert.equal(store.error, null)
  assert.equal(store.estadoPantalla, 'vacio')
})

test('cargarCasos obtiene los casos propios y deja la pantalla en contenido (RF-27)', async () => {
  const servicio = crearServicioFalso({
    casos: [caso(), caso({ id: 10, estado: 'en_proceso', prioridad: 'baja' })],
  })
  const store = montarStore(servicio)

  const resultado = await store.cargarCasos()

  assert.equal(resultado.ok, true)
  assert.deepEqual(servicio.llamadas, [{ accion: 'listar' }])
  assert.equal(store.casos.length, 2)
  assert.equal(store.estadoPantalla, 'contenido')
})

test('mientras carga muestra el estado de carga y no datos anteriores (RF-34)', async () => {
  let resolver = null
  const servicio = {
    async getMisCasos() {
      return new Promise((resolverPromesa) => {
        resolver = resolverPromesa
      })
    },
    async crearCaso() {
      return caso()
    },
    async actualizarCaso() {
      return caso()
    },
  }
  const store = montarStore(servicio)

  const promesa = store.cargarCasos()
  await new Promise((listo) => setImmediate(listo))

  assert.equal(store.cargando, true)
  assert.equal(store.estadoPantalla, 'cargando')
  assert.deepEqual(store.casos, [])

  resolver([caso()])
  await promesa

  assert.equal(store.estadoPantalla, 'contenido')
})

test('sin casos: pantalla en vacío (RF-33)', async () => {
  const store = montarStore(crearServicioFalso({ casos: [] }))

  await store.cargarCasos()

  assert.equal(store.estadoPantalla, 'vacio')
})

test('si falla la carga: error de tres partes y sin casos (RF-36)', async () => {
  const store = montarStore(crearServicioFalso({ errores: { listar: ERROR_RED } }))

  const resultado = await store.cargarCasos()

  assert.equal(resultado.ok, false)
  assert.deepEqual(store.error, ERROR_RED)
  assert.ok(esErrorDeTresPartes(store.error))
  assert.deepEqual(store.casos, [])
  assert.equal(store.estadoPantalla, 'error')
})

// --- registro de un caso (RF-18 a RF-22, RF-24) -------------------------

test('crearCaso agrega el caso devuelto a la lista local', async () => {
  const servicio = crearServicioFalso({
    casos: [caso({ id: 9 })],
    casoCreado: caso({ id: 99, cliente: 'Cliente nuevo', prioridad: 'media' }),
  })
  const store = montarStore(servicio)
  await store.cargarCasos()

  const resultado = await store.crearCaso('Cliente nuevo', 'media')

  assert.equal(resultado.ok, true)
  assert.deepEqual(servicio.llamadas.slice(-1), [
    { accion: 'crear', cliente: 'Cliente nuevo', prioridad: 'media' },
  ])
  assert.equal(store.casos.length, 2)
  assert.equal(store.casos[1].id, 99)
  assert.equal(store.casos[1].cliente, 'Cliente nuevo')
  assert.equal(store.guardando, false)
  assert.equal(store.estadoPantalla, 'contenido')
})

test('crearCaso con error no agrega nada y devuelve el error para P-4', async () => {
  const servicio = crearServicioFalso({
    casos: [caso({ id: 9 })],
    errores: { crear: ERROR_REGISTRO },
  })
  const store = montarStore(servicio)
  await store.cargarCasos()

  const resultado = await store.crearCaso('cliente malo', 'alta')

  assert.equal(resultado.ok, false)
  assert.equal(resultado.error, ERROR_REGISTRO)
  assert.equal(store.casos.length, 1, 'la lista no cambia')
  assert.equal(store.guardando, false)
})

test('mientras registra marca guardando y no deja el indicador encendido', async () => {
  let resolver = null
  const servicio = {
    async getMisCasos() {
      return []
    },
    async crearCaso() {
      return new Promise((resolverPromesa) => {
        resolver = resolverPromesa
      })
    },
    async actualizarCaso() {
      return caso()
    },
  }
  const store = montarStore(servicio)

  const promesa = store.crearCaso('Cliente', 'alta')
  await new Promise((listo) => setImmediate(listo))
  assert.equal(store.guardando, true)

  resolver(caso({ id: 99, cliente: 'Cliente' }))
  await promesa

  assert.equal(store.guardando, false)
})

// --- actualización de un caso (RF-29 a RF-31, RF-37) --------------------

test('actualizarCaso reemplaza el caso de la lista con el devuelto por el backend', async () => {
  const servicio = crearServicioFalso({
    casos: [caso({ id: 9, estado: 'pendiente' }), caso({ id: 10, estado: 'pendiente' })],
    casoActualizado: caso({ id: 9, estado: 'finalizado', prioridad: 'baja' }),
  })
  const store = montarStore(servicio)
  await store.cargarCasos()

  const resultado = await store.actualizarCaso(9, { estado: 'finalizado', prioridad: 'baja' })

  assert.equal(resultado.ok, true)
  assert.deepEqual(servicio.llamadas.slice(-1), [
    { accion: 'actualizar', id: 9, cambios: { estado: 'finalizado', prioridad: 'baja' } },
  ])
  assert.equal(store.casos.length, 2)
  assert.equal(store.casos[0].estado, 'finalizado')
  assert.equal(store.casos[0].prioridad, 'baja')
  assert.equal(store.casos[1].estado, 'pendiente', 'los demás casos no cambian')
})

test('actualizarCaso permite cambiar un caso Finalizado sin restricción (RF-31)', async () => {
  const servicio = crearServicioFalso({
    casos: [caso({ id: 9, estado: 'finalizado', prioridad: 'alta' })],
    casoActualizado: caso({ id: 9, estado: 'pendiente', prioridad: 'alta' }),
  })
  const store = montarStore(servicio)
  await store.cargarCasos()

  await store.actualizarCaso(9, { estado: 'pendiente' })

  assert.equal(store.casos[0].estado, 'pendiente')
})

test('si falla la actualización, la lista local no cambia y se devuelve el error', async () => {
  const servicio = crearServicioFalso({
    casos: [caso({ id: 9, estado: 'pendiente' })],
    errores: { actualizar: ERROR_RED },
  })
  const store = montarStore(servicio)
  await store.cargarCasos()

  const resultado = await store.actualizarCaso(9, { estado: 'finalizado' })

  assert.equal(resultado.ok, false)
  assert.equal(resultado.error, ERROR_RED)
  assert.equal(store.casos[0].estado, 'pendiente')
  assert.equal(store.guardando, false)
})

// --- reintento y reinicio -------------------------------------------------

test('reintentar vuelve a cargar y limpia el error', async () => {
  let fallar = true
  let llamadas = 0
  const servicio = {
    async getMisCasos() {
      llamadas += 1
      if (fallar) {
        throw ERROR_RED
      }
      return [caso()]
    },
    async crearCaso() {
      return caso()
    },
    async actualizarCaso() {
      return caso()
    },
  }
  const store = montarStore(servicio)
  await store.cargarCasos()
  assert.equal(store.estadoPantalla, 'error')

  fallar = false
  await store.reintentar()

  assert.equal(llamadas, 2)
  assert.equal(store.error, null)
  assert.equal(store.estadoPantalla, 'contenido')
})

test('reiniciar deja el store sin datos de otro perfil (RNF-05)', async () => {
  const store = montarStore(crearServicioFalso({ casos: [caso()] }))
  await store.cargarCasos()

  store.reiniciar()

  assert.deepEqual(store.casos, [])
  assert.equal(store.cargando, false)
  assert.equal(store.guardando, false)
  assert.equal(store.error, null)
  assert.equal(store.estadoPantalla, 'vacio')
})

// --- guardia de versi�n (T9) ---

test('una respuesta tard�a tras reiniciar no repuebla casos (guardia de versi�n)', async () => {
  const llamadas = []
  let resolverPrimera = null
  const servicio = {
    async getMisCasos() {
      llamadas.push('listar')
      if (llamadas.length === 1) {
        return new Promise((resolver) => {
          resolverPrimera = resolver
        })
      }
      return [{ id: 7, cliente: 'nuevo', estado: 'pendiente', prioridad: 'alta', contador_id: 3 }]
    },
    async crearCaso(cliente, prioridad) {
      return { id: 99, cliente, prioridad, estado: 'pendiente', contador_id: 3 }
    },
    async actualizarCaso(id, cambios) {
      return { id, ...cambios, estado: cambios.estado ?? 'pendiente', prioridad: cambios.prioridad ?? 'alta', contador_id: 3, cliente: 'X' }
    },
  }
  const store = montarStore(servicio)

  const promesaA = store.cargarCasos()
  await new Promise((listo) => setImmediate(listo))

  store.reiniciar()

  const promesaB = store.cargarCasos()
  await promesaB

  assert.equal(store.casos.length, 1)
  assert.equal(store.casos[0].cliente, 'nuevo')

  resolverPrimera([{ id: 5, cliente: 'antiguo', estado: 'pendiente', prioridad: 'alta', contador_id: 3 }])
  await promesaA.catch(() => {})

  assert.equal(store.casos.length, 1, 'la respuesta tard�a no repuebla')
  assert.equal(store.casos[0].cliente, 'nuevo')
  assert.equal(store.cargando, false)
})

test('un error tard�o tras reiniciar no deja error (guardia de versi�n)', async () => {
  let rechazarPrimera = null
  const servicio = {
    async getMisCasos() {
      return new Promise((resolver, rechazar) => {
        rechazarPrimera = rechazar
      })
    },
    async crearCaso() {
      return { id: 1, cliente: 'X', estado: 'pendiente', prioridad: 'alta', contador_id: 3 }
    },
    async actualizarCaso(id, cambios) {
      return { id, ...cambios, estado: 'pendiente', prioridad: 'alta', contador_id: 3, cliente: 'X' }
    },
  }
  const store = montarStore(servicio)

  const promesaA = store.cargarCasos()
  await new Promise((listo) => setImmediate(listo))

  store.reiniciar()

  rechazarPrimera(ERROR_RED)
  await promesaA.catch(() => {})

  assert.deepEqual(store.casos, [])
  assert.equal(store.error, null)
})

test('una escritura tard�a tras reiniciar no modifica la lista (guardia de versi�n)', async () => {
  let resolverPrimera = null
  const llamadasCrear = []
  const servicio = {
    async getMisCasos() {
      return []
    },
    async crearCaso(cliente, prioridad) {
      llamadasCrear.push(cliente)
      if (llamadasCrear.length === 1) {
        return new Promise((resolver) => {
          resolverPrimera = resolver
        })
      }
      return { id: 77, cliente, prioridad, estado: 'pendiente', contador_id: 3 }
    },
    async actualizarCaso() {
      return { id: 1, estado: 'finalizado', prioridad: 'alta', contador_id: 3, cliente: 'X' }
    },
  }
  const store = montarStore(servicio)
  await store.cargarCasos()

  const promesaA = store.crearCaso('lento', 'alta')
  await new Promise((listo) => setImmediate(listo))

  store.reiniciar()

  const promesaB = store.crearCaso('nuevo', 'media')
  // promesaB resolves immediately? crearCaso returns promise from servicio which is immediate? 
  // servicio.crearCaso is not delayed now; but version incremented by reiniciar, so B's version is new.
  // Need make B immediate: override not possible; instead resolve A late and check not appended.
  resolverPrimera({ id: 99, cliente: 'lento', estado: 'pendiente', prioridad: 'alta', contador_id: 3 })
  await promesaA.catch(() => {})
  await promesaB.catch(() => {})

  // After reiniciar, casos is empty; B may have appended if it ran. Check no 'lento'.
  assert.ok(!store.casos.some((c) => c.cliente === 'lento'), 'la escritura tard�a no se aplica')
})

test('crearCaso pasa la fecha de vencimiento al servicio', async () => {
  let recibido
  const store = montarStore({
    async getMisCasos() {
      return []
    },
    async crearCaso(...argumentos) {
      recibido = argumentos
      return { id: 1, cliente: 'C', prioridad: 'alta', estado: 'pendiente', contador_id: 3 }
    },
  })

  await store.crearCaso('C', 'alta', '01-12-2026', undefined, undefined, false, '15-01-2027')

  assert.deepEqual(recibido, ['C', 'alta', '01-12-2026', undefined, undefined, false, '15-01-2027'])
})

// --- tiempo real: refresco sin parpadeo ------------------------------------

test('refrescarEnSilencio vuelve a pedir mis casos sin vaciar la lista ni mostrar la carga', async () => {
  const servicio = crearServicioFalso({ casos: [caso({ id: 9 })] })
  const store = montarStore(servicio)
  await store.cargarCasos()

  servicio.getMisCasos = async () => [caso({ id: 9, prioridad: 'baja' }), caso({ id: 10 })]
  const promesa = store.refrescarEnSilencio()
  assert.equal(store.cargando, false)
  assert.equal(store.casos.length, 1, 'mientras tanto se ve la lista anterior')
  await promesa

  assert.equal(store.casos.length, 2)
  assert.equal(store.casos[0].prioridad, 'baja')
})

test('refrescarEnSilencio ignora un fallo y no refresca mientras se guarda un cambio', async () => {
  const servicio = crearServicioFalso({ casos: [caso({ id: 9 })] })
  const store = montarStore(servicio)
  await store.cargarCasos()

  servicio.getMisCasos = async () => {
    throw new Error('sin red')
  }
  await store.refrescarEnSilencio()
  assert.equal(store.error, null)
  assert.equal(store.casos.length, 1)

  let pedidos = 0
  servicio.getMisCasos = async () => {
    pedidos += 1
    return []
  }
  store.guardando = true
  await store.refrescarEnSilencio()
  assert.equal(pedidos, 0, 'no pisa un cambio que se está guardando')
})
