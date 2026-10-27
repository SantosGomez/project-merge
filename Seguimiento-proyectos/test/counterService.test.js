// Pruebas del servicio de contadores (RF-11 a RF-16, RF-24, RF-36).
// Sin red: se inyecta una api falsa que registra las llamadas.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearCounterService } from '../src/services/counterService.js'

// --- ayudas ----------------------------------------------------------------

// Api falsa: registra las llamadas y responde o falla con lo indicado.
const crearApiFalsa = ({ datos, error } = {}) => {
  const llamadas = []
  return {
    llamadas,
    async get(url) {
      llamadas.push({ metodo: 'GET', url })
      if (error) {
        throw error
      }
      return { data: datos }
    },
  }
}

// Caso tal como lo devuelve el backend (estado y prioridad capitalizados).
const casoDeBackend = (extra = {}) => ({
  id: 9,
  cliente: 'Distribuidora Ñandú',
  estado: 'Pendiente',
  prioridad: 'Alta',
  contador_id: 7,
  creado_en: '2026-10-22 09:00:00',
  ...extra,
})

// Comprueba que el error es de tres partes (RNF-01) con el estado esperado.
const esErrorDeTresPartes = (estado) => (error) => {
  assert.equal(error.estado, estado)
  assert.ok(error.mensaje.includes('Qué ocurrió:'), 'falta la parte de qué ocurrió (RNF-01)')
  assert.ok(error.mensaje.includes('Sobre:'), 'falta la parte de sobre qué (RNF-01)')
  assert.ok(error.mensaje.includes('Qué hacer:'), 'falta la parte de qué hacer (RNF-01)')
  return true
}

// --- listCounters (RF-11, RF-12, RF-16) ------------------------------------

test('listCounters hace GET /contadores y devuelve la lista { id, nombre }', async () => {
  const contadores = [
    { id: 3, nombre: 'ana' },
    { id: 4, nombre: 'luis' },
  ]
  const api = crearApiFalsa({ datos: { contadores } })
  const servicio = crearCounterService({ api })

  const resultado = await servicio.listCounters()

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/contadores' }])
  assert.deepEqual(resultado, contadores)
})

test('listCounters devuelve [] cuando no hay contadores registrados', async () => {
  const servicio = crearCounterService({
    api: crearApiFalsa({ datos: { mensaje: 'No hay contadores registrados', contadores: [] } }),
  })

  assert.deepEqual(await servicio.listCounters(), [])
})

test('listCounters rechaza con tres partes si la respuesta no trae una lista', async () => {
  const servicio = crearCounterService({ api: crearApiFalsa({ datos: { mensaje: 'raro' } }) })

  await assert.rejects(servicio.listCounters(), esErrorDeTresPartes('respuesta_inesperada'))
})

test('listCounters propaga el error normalizado de la api (por ejemplo 403)', async () => {
  const error = {
    estado: 'sin_permiso',
    mensaje: 'Rol insuficiente.',
    codigoHttp: 403,
    datos: null,
  }
  const servicio = crearCounterService({ api: crearApiFalsa({ error }) })

  await assert.rejects(servicio.listCounters(), (recibido) => {
    assert.equal(recibido, error)
    return true
  })
})

// --- getConteosPorEstado (RF-13) ------------------------------------------

test('getConteosPorEstado hace GET /contadores/:id/conteos y conserva los ceros', async () => {
  const api = crearApiFalsa({
    datos: { contador_id: '7', pendiente: 2, en_proceso: 0, finalizado: 5 },
  })
  const servicio = crearCounterService({ api })

  const conteos = await servicio.getConteosPorEstado(7)

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/contadores/7/conteos' }])
  assert.deepEqual(conteos, { pendiente: 2, en_proceso: 0, finalizado: 5 })
})

// --- getCasosPorContador (RF-14, RF-15) -----------------------------------

test('getCasosPorContador hace GET /contadores/:id/casos y traduce los casos', async () => {
  const api = crearApiFalsa({
    datos: {
      casos: [casoDeBackend(), casoDeBackend({ id: 10, estado: 'En proceso', prioridad: 'Baja' })],
    },
  })
  const servicio = crearCounterService({ api })

  const casos = await servicio.getCasosPorContador(7)

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/contadores/7/casos' }])
  assert.equal(casos.length, 2)
  assert.equal(casos[0].estado, 'pendiente')
  assert.equal(casos[0].prioridad, 'alta')
  assert.equal(casos[1].estado, 'en_proceso')
  assert.equal(casos[1].prioridad, 'baja')
})

test('getCasosPorContador devuelve [] cuando el contador no tiene casos', async () => {
  const servicio = crearCounterService({
    api: crearApiFalsa({ datos: { mensaje: 'El contador no tiene casos registrados', casos: [] } }),
  })

  assert.deepEqual(await servicio.getCasosPorContador(7), [])
})

test('getCasosPorContador rechaza con tres partes si un caso trae un estado desconocido', async () => {
  const servicio = crearCounterService({
    api: crearApiFalsa({ datos: { casos: [casoDeBackend({ estado: 'Urgente' })] } }),
  })

  await assert.rejects(servicio.getCasosPorContador(7), esErrorDeTresPartes('respuesta_inesperada'))
})

test('getCasosPorContador rechaza con tres partes si la respuesta no trae casos', async () => {
  const servicio = crearCounterService({ api: crearApiFalsa({ datos: { mensaje: 'raro' } }) })

  await assert.rejects(servicio.getCasosPorContador(7), esErrorDeTresPartes('respuesta_inesperada'))
})

// --- Dashboard: resumen del equipo (KPIs) ------------------------------------

test('getResumenEquipo hace GET /contadores/resumen y devuelve el total del equipo como números', async () => {
  const api = crearApiFalsa({
    datos: {
      equipo: { pendiente: '3', en_proceso: 2, finalizado: 7, abiertos: 5, vencidos: 1, alta_abiertos: 2 },
      por_contador: [],
    },
  })
  const servicio = crearCounterService({ api })

  const resumen = await servicio.getResumenEquipo()

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/contadores/resumen' }])
  assert.deepEqual(resumen, { pendiente: 3, en_proceso: 2, finalizado: 7, abiertos: 5, vencidos: 1, alta_abiertos: 2 })
})

test('getResumenEquipo rechaza con tres partes si la respuesta no trae el total del equipo', async () => {
  const servicio = crearCounterService({ api: crearApiFalsa({ datos: { por_contador: [] } }) })
  await assert.rejects(servicio.getResumenEquipo(), esErrorDeTresPartes('respuesta_inesperada'))
})

// --- solo casos importantes (dashboard del administrador) ------------------

test('getConteosPorEstado, getCasosPorContador y getResumenEquipo piden solo los importantes con soloImportantes', async () => {
  const api = crearApiFalsa({ datos: { pendiente: 1, en_proceso: 0, finalizado: 0, casos: [], equipo: {} } })
  const servicio = crearCounterService({ api })

  await servicio.getConteosPorEstado(7, { soloImportantes: true })
  await servicio.getCasosPorContador(7, { soloImportantes: true })
  await servicio.getResumenEquipo({ soloImportantes: true })

  assert.deepEqual(api.llamadas.map((llamada) => llamada.url), [
    '/contadores/7/conteos?importantes=true',
    '/contadores/7/casos?importantes=true',
    '/contadores/resumen?importantes=true',
  ])
})
