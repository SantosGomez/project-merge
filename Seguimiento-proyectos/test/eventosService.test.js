// Pruebas del servicio de tiempo real (Server-Sent Events). Sin red ni navegador:
// se inyectan una api falsa, un EventSource falso y un programador de temporizadores.

import test from 'node:test'
import assert from 'node:assert/strict'

import { ESTADOS_ERROR } from '../src/services/api.js'
import { crearEventosService } from '../src/services/eventosService.js'

// --- ayudas ----------------------------------------------------------------

// EventSource falso: guarda cada conexión abierta y deja disparar sus eventos a mano.
const crearEventSourceFalso = () => {
  const abiertas = []
  class EventSourceFalso {
    constructor(url) {
      this.url = url
      this.oyentes = {}
      this.cerrada = false
      this.onerror = null
      abiertas.push(this)
    }
    addEventListener(nombre, funcion) {
      this.oyentes[nombre] = funcion
    }
    close() {
      this.cerrada = true
    }
    disparar(nombre, datos = {}) {
      this.oyentes[nombre]?.({ data: JSON.stringify(datos) })
    }
    fallar() {
      this.onerror?.()
    }
  }
  return { EventSourceFalso, abiertas }
}

// Api falsa: cada POST /eventos/pase entrega un pase distinto, o falla si se indica.
const crearApiFalsa = () => {
  const api = { pedidos: 0, error: null }
  api.post = async (url) => {
    assert.equal(url, '/eventos/pase')
    api.pedidos += 1
    if (api.error) throw api.error
    return { data: { pase: `pase-${api.pedidos}` } }
  }
  return api
}

// Programador falso: guarda los reintentos y los dispara a mano.
const crearProgramadorFalso = () => {
  const pendientes = []
  return {
    pendientes,
    programar: (funcion, ms) => {
      const tarea = { funcion, ms }
      pendientes.push(tarea)
      return tarea
    },
    cancelar: (tarea) => {
      const indice = pendientes.indexOf(tarea)
      if (indice >= 0) pendientes.splice(indice, 1)
    },
    async ejecutar() {
      const tarea = pendientes.shift()
      await tarea.funcion()
      return tarea
    },
  }
}

const esperarTareas = () => new Promise((listo) => setImmediate(listo))

const montar = () => {
  const api = crearApiFalsa()
  const { EventSourceFalso, abiertas } = crearEventSourceFalso()
  const programador = crearProgramadorFalso()
  const servicio = crearEventosService({
    api,
    EventSourceClase: EventSourceFalso,
    programar: programador.programar,
    cancelar: programador.cancelar,
    urlBase: '/api',
  })
  return { servicio, api, abiertas, programador }
}

// --- conexión ----------------------------------------------------------------

test('conectar pide un pase y abre /eventos con él, sin el token en la URL', async () => {
  const { servicio, api, abiertas } = montar()

  servicio.conectar()
  await esperarTareas()

  assert.equal(api.pedidos, 1)
  assert.equal(abiertas.length, 1)
  assert.equal(abiertas[0].url, '/api/eventos?pase=pase-1')
})

test('conectar dos veces no abre dos conexiones', async () => {
  const { servicio, abiertas } = montar()
  servicio.conectar()
  servicio.conectar()
  await esperarTareas()
  assert.equal(abiertas.length, 1)
})

test('los avisos del servidor llegan a quien los escucha, y se puede dejar de escuchar', async () => {
  const { servicio, abiertas } = montar()
  const recibidos = []
  const dejar = servicio.escuchar('caso-actualizado', (datos) => recibidos.push(datos))
  servicio.escuchar('aviso-nuevo', (datos) => recibidos.push({ aviso: datos }))

  servicio.conectar()
  await esperarTareas()
  abiertas[0].disparar('caso-actualizado', { casoId: 7, contadorId: 3 })
  abiertas[0].disparar('aviso-nuevo', { casoId: 7 })
  dejar()
  abiertas[0].disparar('caso-actualizado', { casoId: 8, contadorId: 3 })

  assert.deepEqual(recibidos, [{ casoId: 7, contadorId: 3 }, { aviso: { casoId: 7 } }])
})

test('el aviso «auditoria-actualizada» también llega a quien lo escucha', async () => {
  const { servicio, abiertas } = montar()
  const recibidos = []
  servicio.escuchar('auditoria-actualizada', (datos) => recibidos.push(datos))

  servicio.conectar()
  await esperarTareas()
  abiertas[0].disparar('auditoria-actualizada', { auditoriaId: 4 })

  assert.deepEqual(recibidos, [{ auditoriaId: 4 }])
})

// --- reconexión ----------------------------------------------------------------

test('si la conexión se cae, se reconecta con un pase nuevo esperando cada vez más (máximo 60 s)', async () => {
  const { servicio, api, abiertas, programador } = montar()
  servicio.conectar()
  await esperarTareas()

  const esperas = []
  for (let intento = 0; intento < 6; intento += 1) {
    abiertas.at(-1).fallar()
    assert.equal(abiertas.at(-1).cerrada, true, 'la conexión caída se cierra')
    esperas.push((await programador.ejecutar()).ms)
    await esperarTareas()
  }

  assert.deepEqual(esperas, [5000, 10000, 20000, 40000, 60000, 60000])
  assert.equal(api.pedidos, 7, 'cada reconexión usa un pase nuevo')
  assert.equal(abiertas.at(-1).url, '/api/eventos?pase=pase-7')
})

test('al reconectarse avisa «reconectado» para recuperar lo que se perdió; la primera vez no', async () => {
  const { servicio, abiertas, programador } = montar()
  let reconexiones = 0
  servicio.escuchar('reconectado', () => {
    reconexiones += 1
  })
  servicio.conectar()
  await esperarTareas()

  abiertas[0].disparar('conectado')
  assert.equal(reconexiones, 0)

  abiertas[0].fallar()
  await programador.ejecutar()
  await esperarTareas()
  abiertas[1].disparar('conectado')
  assert.equal(reconexiones, 1)

  // Tras conectar, la espera vuelve a empezar en 5 s
  abiertas[1].fallar()
  assert.equal(programador.pendientes[0].ms, 5000)
})

test('si el pase falla por red se reintenta; si la sesión ya no vale, se detiene', async () => {
  const { servicio, api, abiertas, programador } = montar()
  api.error = { estado: ESTADOS_ERROR.RED }
  servicio.conectar()
  await esperarTareas()
  assert.equal(abiertas.length, 0)
  assert.equal(programador.pendientes.length, 1, 'sin red se vuelve a intentar')

  api.error = { estado: ESTADOS_ERROR.SIN_SESION }
  await programador.ejecutar()
  await esperarTareas()
  assert.equal(programador.pendientes.length, 0, 'sin sesión no tiene caso reintentar')
})

test('«sesion-cerrada» del servidor cierra la conexión, no reintenta y avisa', async () => {
  const { servicio, abiertas, programador } = montar()
  let avisada = false
  servicio.escuchar('sesion-cerrada', () => {
    avisada = true
  })
  servicio.conectar()
  await esperarTareas()

  abiertas[0].disparar('sesion-cerrada')
  abiertas[0].fallar()

  assert.equal(avisada, true)
  assert.equal(abiertas[0].cerrada, true)
  assert.equal(programador.pendientes.length, 0)
})

test('desconectar cierra la conexión y cancela un reintento pendiente', async () => {
  const { servicio, abiertas, programador, api } = montar()
  servicio.conectar()
  await esperarTareas()
  abiertas[0].fallar()
  assert.equal(programador.pendientes.length, 1)

  servicio.desconectar()
  assert.equal(programador.pendientes.length, 0)

  servicio.conectar()
  await esperarTareas()
  servicio.desconectar()
  assert.equal(abiertas.at(-1).cerrada, true)
  assert.equal(api.pedidos, 2)
})

test('si se desconecta mientras se pedía el pase, no abre la conexión', async () => {
  const { servicio, abiertas } = montar()
  servicio.conectar()
  servicio.desconectar()
  await esperarTareas()
  assert.equal(abiertas.length, 0)
})
