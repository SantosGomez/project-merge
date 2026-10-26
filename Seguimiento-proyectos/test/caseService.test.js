// Pruebas del servicio de casos (RF-15, RF-18 a RF-22, RF-27 a RF-31, RF-36).
// Sin red: se inyecta una api falsa que registra las llamadas y devuelve
// respuestas con la forma real del backend.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearCaseService } from '../src/services/caseService.js'

// --- ayudas ----------------------------------------------------------------

// Api falsa con manejadores por método; registra todas las llamadas.
const crearApiFalsa = (manejadores = {}) => {
  const llamadas = []
  const responder = async (metodo, url, cuerpo) => {
    llamadas.push({ metodo, url, cuerpo })
    const manejador = manejadores[metodo]
    if (!manejador) {
      throw new Error(`sin manejador para ${metodo}`)
    }
    return manejador(url, cuerpo)
  }
  return {
    llamadas,
    get: (url) => responder('GET', url),
    post: (url, cuerpo) => responder('POST', url, cuerpo),
    patch: (url, cuerpo) => responder('PATCH', url, cuerpo),
  }
}

// Caso tal como lo devuelve el backend (estado y prioridad capitalizados).
const casoDeBackend = (extra = {}) => ({
  id: 9,
  cliente: 'Distribuidora Ñandú',
  estado: 'Pendiente',
  prioridad: 'Alta',
  contador_id: 3,
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

// --- getMisCasos (RF-15, RF-27, RF-32) ------------------------------------

test('getMisCasos hace GET /casos/mis-casos y traduce estado y prioridad', async () => {
  const api = crearApiFalsa({
    GET: async () => ({
      data: {
        casos: [
          casoDeBackend(),
          casoDeBackend({ id: 10, estado: 'En proceso', prioridad: 'Media' }),
        ],
      },
    }),
  })
  const servicio = crearCaseService({ api })

  const casos = await servicio.getMisCasos()

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/casos/mis-casos', cuerpo: undefined }])
  assert.equal(casos[0].estado, 'pendiente')
  assert.equal(casos[0].prioridad, 'alta')
  assert.equal(casos[1].estado, 'en_proceso')
  assert.equal(casos[1].prioridad, 'media')
})

test('getMisCasos devuelve [] cuando el contador no tiene casos', async () => {
  const servicio = crearCaseService({
    api: crearApiFalsa({
      GET: async () => ({ data: { mensaje: 'No tiene casos registrados aún', casos: [] } }),
    }),
  })

  assert.deepEqual(await servicio.getMisCasos(), [])
})

test('getMisCasos rechaza con tres partes si un caso no se puede traducir', async () => {
  const servicio = crearCaseService({
    api: crearApiFalsa({
      GET: async () => ({ data: { casos: [casoDeBackend({ prioridad: 'Urgente' })] } }),
    }),
  })

  await assert.rejects(servicio.getMisCasos(), esErrorDeTresPartes('respuesta_inesperada'))
})

// --- crearCaso (RF-18 a RF-21, RF-25) -------------------------------------

test('crearCaso envía POST /casos con la prioridad del backend tal como llega del plan', async () => {
  const api = crearApiFalsa({
    POST: async () => ({
      data: { mensaje: 'Caso registrado correctamente', caso: casoDeBackend() },
    }),
  })
  const servicio = crearCaseService({ api })

  const caso = await servicio.crearCaso('  Distribuidora Ñandú ', 'Alta')

  assert.deepEqual(api.llamadas, [
    {
      metodo: 'POST',
      url: '/casos',
      cuerpo: { cliente: '  Distribuidora Ñandú ', prioridad: 'Alta' },
    },
  ])
  assert.equal(caso.estado, 'pendiente')
  assert.equal(caso.prioridad, 'alta')
})

test('crearCaso traduce el código interno de prioridad a la forma del backend', async () => {
  const api = crearApiFalsa({
    POST: async () => ({ data: { caso: casoDeBackend({ prioridad: 'Baja' }) } }),
  })
  const servicio = crearCaseService({ api })

  await servicio.crearCaso('Cliente', 'baja')

  assert.equal(api.llamadas[0].cuerpo.prioridad, 'Baja')
})

test('crearCaso rechaza con tres partes y no llama al backend si la prioridad no es válida', async () => {
  const api = crearApiFalsa({ POST: async () => ({ data: {} }) })
  const servicio = crearCaseService({ api })

  await assert.rejects(
    servicio.crearCaso('Cliente', 'Urgente'),
    esErrorDeTresPartes('datos_invalidos'),
  )
  assert.equal(api.llamadas.length, 0, 'no se envía una petición con datos inválidos')
})

test('crearCaso rechaza con tres partes si la respuesta no trae un caso traducible', async () => {
  const servicio = crearCaseService({
    api: crearApiFalsa({
      POST: async () => ({ data: { mensaje: 'Caso registrado correctamente' } }),
    }),
  })

  await assert.rejects(
    servicio.crearCaso('Cliente', 'Alta'),
    esErrorDeTresPartes('respuesta_inesperada'),
  )
})

test('crearCaso convierte la fecha del formulario (DD-MM-AAAA) a la forma de la API', async () => {
  const api = crearApiFalsa({
    POST: async () => ({ data: { caso: casoDeBackend() } }),
  })
  const servicio = crearCaseService({ api })

  await servicio.crearCaso('Cliente', 'Alta', '31-12-2026')

  assert.equal(
    api.llamadas[0].cuerpo.fecha_inicio,
    '2026-12-31',
    'la API recibe AAAA-MM-DD, no el formato del formulario',
  )
})

test('crearCaso rechaza con tres partes y no llama al backend si la fecha no es válida', async () => {
  const api = crearApiFalsa({ POST: async () => ({ data: {} }) })
  const servicio = crearCaseService({ api })

  await assert.rejects(
    servicio.crearCaso('Cliente', 'Alta', '31-02-2026'),
    esErrorDeTresPartes('datos_invalidos'),
  )
  assert.equal(api.llamadas.length, 0, 'no se envía una petición con una fecha imposible')
})

test('crearCaso no envía fecha_inicio cuando no se indica', async () => {
  const api = crearApiFalsa({
    POST: async () => ({ data: { caso: casoDeBackend() } }),
  })
  const servicio = crearCaseService({ api })

  await servicio.crearCaso('Cliente', 'Alta')

  assert.equal('fecha_inicio' in api.llamadas[0].cuerpo, false, 'sin fecha, el backend usa hoy')
})

test('crearCaso envía descripción y observaciones cuando se indican', async () => {
  const api = crearApiFalsa({
    POST: async () => ({ data: { caso: casoDeBackend() } }),
  })
  const servicio = crearCaseService({ api })

  await servicio.crearCaso('Cliente', 'Alta', '31-12-2026', 'Cliente distribuidora zona centro', 'Lunes 9 a 14.')

  assert.deepEqual(api.llamadas[0].cuerpo, {
    cliente: 'Cliente',
    prioridad: 'Alta',
    fecha_inicio: '2026-12-31',
    descripcion: 'Cliente distribuidora zona centro',
    observaciones: 'Lunes 9 a 14.',
  })
})

test('crearCaso no envía descripción ni observaciones cuando están vacías', async () => {
  const api = crearApiFalsa({
    POST: async () => ({ data: { caso: casoDeBackend() } }),
  })
  const servicio = crearCaseService({ api })

  await servicio.crearCaso('Cliente', 'Alta', '31-12-2026', undefined, undefined)

  assert.equal('descripcion' in api.llamadas[0].cuerpo, false, 'descripción vacía no se envía')
  assert.equal('observaciones' in api.llamadas[0].cuerpo, false, 'observaciones vacías no se envían')
})

// --- actualizarCaso (RF-22, RF-29, RF-30, RF-31) --------------------------

test('actualizarCaso hace PATCH /casos/:id con estado y prioridad traducidos', async () => {
  const api = crearApiFalsa({
    PATCH: async () => ({
      data: {
        mensaje: 'Caso actualizado correctamente',
        caso: casoDeBackend({ estado: 'En proceso', prioridad: 'Baja' }),
      },
    }),
  })
  const servicio = crearCaseService({ api })

  const caso = await servicio.actualizarCaso(9, { estado: 'en_proceso', prioridad: 'baja' })

  assert.deepEqual(api.llamadas, [
    { metodo: 'PATCH', url: '/casos/9', cuerpo: { estado: 'En proceso', prioridad: 'Baja' } },
  ])
  assert.equal(caso.estado, 'en_proceso')
  assert.equal(caso.prioridad, 'baja')
})

test('actualizarCaso envía solo el campo indicado', async () => {
  const api = crearApiFalsa({
    PATCH: async () => ({ data: { caso: casoDeBackend({ estado: 'Finalizado' }) } }),
  })
  const servicio = crearCaseService({ api })

  await servicio.actualizarCaso(9, { estado: 'finalizado' })

  assert.deepEqual(api.llamadas[0].cuerpo, { estado: 'Finalizado' })
})

test('actualizarCaso rechaza con tres partes y no llama al backend si el estado es desconocido', async () => {
  const api = crearApiFalsa({ PATCH: async () => ({ data: {} }) })
  const servicio = crearCaseService({ api })

  await assert.rejects(
    servicio.actualizarCaso(9, { estado: 'Urgente' }),
    esErrorDeTresPartes('datos_invalidos'),
  )
  assert.equal(api.llamadas.length, 0)
})

test('actualizarCaso rechaza con tres partes si no se indica ningún cambio', async () => {
  const api = crearApiFalsa({ PATCH: async () => ({ data: {} }) })
  const servicio = crearCaseService({ api })

  await assert.rejects(servicio.actualizarCaso(9, {}), esErrorDeTresPartes('datos_invalidos'))
  assert.equal(api.llamadas.length, 0)
})

test('actualizarCaso rechaza con tres partes si la respuesta no trae un caso traducible', async () => {
  const servicio = crearCaseService({
    api: crearApiFalsa({
      PATCH: async () => ({ data: { caso: casoDeBackend({ estado: 'Raro' }) } }),
    }),
  })

  await assert.rejects(
    servicio.actualizarCaso(9, { estado: 'pendiente' }),
    esErrorDeTresPartes('respuesta_inesperada'),
  )
})

test('actualizarCaso propaga el error normalizado de la api (por ejemplo 404)', async () => {
  const error = {
    estado: 'no_encontrado',
    mensaje: 'No se encontró el caso sobre ID del caso: Verifique que el ID sea correcto',
    codigoHttp: 404,
    datos: null,
  }
  const servicio = crearCaseService({
    api: crearApiFalsa({
      PATCH: async () => {
        throw error
      },
    }),
  })

  await assert.rejects(servicio.actualizarCaso(9, { prioridad: 'alta' }), (recibido) => {
    assert.equal(recibido, error)
    return true
  })
})
