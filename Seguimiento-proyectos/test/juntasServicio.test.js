// Servicio de juntas (rebanada 21b): cada función llama a su ruta de `/juntas` con el cuerpo
// que pide la API y valida la forma de la respuesta. Sin red: se inyecta una api falsa.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { crearJuntaService } from '../src/services/juntaService.js'

const crearApiFalsa = (respuestas = {}) => {
  const llamadas = []
  const responder = async (metodo, url, segundo) => {
    llamadas.push({ metodo, url, segundo })
    return { data: respuestas[metodo] }
  }
  return {
    llamadas,
    get: (url, config) => responder('GET', url, config),
    post: (url, cuerpo) => responder('POST', url, cuerpo),
    patch: (url, cuerpo) => responder('PATCH', url, cuerpo),
    delete: (url) => responder('DELETE', url),
  }
}

const junta = {
  id: 5,
  titulo: 'Revisión',
  inicio: '2026-11-18 09:00:00',
  fin: '2026-11-18 10:00:00',
}

describe('juntaService', () => {
  it('listar pide GET /juntas con el rango y devuelve la lista', async () => {
    const api = crearApiFalsa({ GET: { juntas: [junta] } })
    const juntas = await crearJuntaService({ api }).listar({
      desde: '2026-11-16',
      hasta: '2026-11-22',
    })
    assert.deepEqual(juntas, [junta])
    assert.deepEqual(api.llamadas, [
      {
        metodo: 'GET',
        url: '/juntas',
        segundo: { params: { desde: '2026-11-16', hasta: '2026-11-22' } },
      },
    ])
  })

  it('listar rechaza una respuesta sin la lista de juntas', async () => {
    const api = crearApiFalsa({ GET: { otra: 1 } })
    await assert.rejects(crearJuntaService({ api }).listar({ desde: 'a', hasta: 'b' }), (error) => {
      assert.equal(error.estado, 'respuesta_inesperada')
      assert.match(error.mensaje, /tus juntas/)
      return true
    })
  })

  it('obtener pide GET /juntas/:id y devuelve la junta', async () => {
    const api = crearApiFalsa({ GET: { junta } })
    assert.deepEqual(await crearJuntaService({ api }).obtener(5), junta)
    assert.equal(api.llamadas[0].url, '/juntas/5')
  })

  it('crear envía el cuerpo recortado por POST /juntas y devuelve la junta creada', async () => {
    const api = crearApiFalsa({ POST: { junta } })
    const creada = await crearJuntaService({ api }).crear({
      titulo: '  Revisión  ',
      descripcion: ' Cierre de mes ',
      inicio: '2026-11-18 09:00',
      fin: '2026-11-18 10:00',
      participantes: [4, 7],
    })
    assert.deepEqual(creada, junta)
    assert.deepEqual(api.llamadas[0], {
      metodo: 'POST',
      url: '/juntas',
      segundo: {
        titulo: 'Revisión',
        descripcion: 'Cierre de mes',
        inicio: '2026-11-18 09:00',
        fin: '2026-11-18 10:00',
        participantes: [4, 7],
        privada: false,
        cliente: '',
        modalidad: null,
        lugar: '',
      },
    })
  })

  it('crear y actualizar envían cliente y lugar recortados y la modalidad solo si es válida', async () => {
    const api = crearApiFalsa({ POST: { junta }, PATCH: { junta } })
    const servicio = crearJuntaService({ api })
    const base = { titulo: 'a', inicio: 'x', fin: 'y', participantes: [] }
    await servicio.crear({ ...base, cliente: ' Acme SA ', modalidad: 'virtual', lugar: ' Teams ' })
    await servicio.actualizar(5, { ...base, modalidad: 'hibrida' })
    assert.deepEqual(
      api.llamadas.map((l) => [l.segundo.cliente, l.segundo.modalidad, l.segundo.lugar]),
      [
        ['Acme SA', 'virtual', 'Teams'],
        ['', null, ''],
      ],
    )
  })

  it('crear y actualizar envían privada como booleano (false si no se indica)', async () => {
    const api = crearApiFalsa({ POST: { junta }, PATCH: { junta } })
    const servicio = crearJuntaService({ api })
    const base = { titulo: 'a', inicio: 'x', fin: 'y', participantes: [4] }
    await servicio.crear({ ...base, privada: true })
    await servicio.actualizar(5, { ...base, privada: 'si' })
    await servicio.crear(base)
    assert.deepEqual(
      api.llamadas.map((llamada) => llamada.segundo.privada),
      [true, false, false],
    )
  })

  it('crear con organizadorId envía organizador_id; sin él, el cuerpo no lo trae', async () => {
    const api = crearApiFalsa({ POST: { junta } })
    const servicio = crearJuntaService({ api })
    const base = { titulo: 'a', inicio: 'x', fin: 'y', participantes: [4] }
    await servicio.crear({ ...base, organizadorId: 9 })
    await servicio.crear(base)
    assert.equal(api.llamadas[0].segundo.organizador_id, 9)
    assert.equal('organizador_id' in api.llamadas[1].segundo, false)
  })

  it('actualizar nunca envía organizador_id', async () => {
    const api = crearApiFalsa({ PATCH: { junta } })
    await crearJuntaService({ api }).actualizar(5, {
      titulo: 'a',
      inicio: 'x',
      fin: 'y',
      participantes: [],
      organizadorId: 9,
    })
    assert.equal('organizador_id' in api.llamadas[0].segundo, false)
  })

  it('agendaDe pide GET /juntas/agenda/:id con el rango y devuelve usuario y juntas', async () => {
    const usuario = { id: 3, nombre: 'Ana', rol: 'administrador' }
    const ocupada = { id: null, titulo: 'Ocupado', ocupado: true }
    const api = crearApiFalsa({ GET: { usuario, juntas: [ocupada] } })
    const agenda = await crearJuntaService({ api }).agendaDe(3, {
      desde: '2026-11-16',
      hasta: '2026-11-22',
    })
    assert.deepEqual(agenda, { usuario, juntas: [ocupada] })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'GET',
      url: '/juntas/agenda/3',
      segundo: { params: { desde: '2026-11-16', hasta: '2026-11-22' } },
    })
  })

  it('agendaDe rechaza una respuesta sin usuario o sin la lista de juntas', async () => {
    for (const data of [
      { juntas: [] },
      { usuario: { id: 3 } },
      { usuario: { id: 3 }, juntas: 1 },
    ]) {
      await assert.rejects(
        crearJuntaService({ api: crearApiFalsa({ GET: data }) }).agendaDe(3, {
          desde: 'a',
          hasta: 'b',
        }),
        (e) => e.estado === 'respuesta_inesperada',
      )
    }
  })

  it('actualizar envía el cuerpo completo por PATCH /juntas/:id', async () => {
    const api = crearApiFalsa({ PATCH: { junta } })
    await crearJuntaService({ api }).actualizar(5, {
      titulo: 'Revisión',
      descripcion: '',
      inicio: '2026-11-18 09:00',
      fin: '2026-11-18 10:00',
      participantes: [4],
    })
    assert.equal(api.llamadas[0].metodo, 'PATCH')
    assert.equal(api.llamadas[0].url, '/juntas/5')
    assert.deepEqual(Object.keys(api.llamadas[0].segundo), [
      'titulo',
      'descripcion',
      'inicio',
      'fin',
      'participantes',
      'privada',
      'cliente',
      'modalidad',
      'lugar',
    ])
  })

  it('borrar pide DELETE /juntas/:id y exige la confirmación del servidor', async () => {
    const api = crearApiFalsa({ DELETE: { ok: true } })
    await crearJuntaService({ api }).borrar(5)
    assert.deepEqual(api.llamadas[0], { metodo: 'DELETE', url: '/juntas/5', segundo: undefined })

    const sinConfirmar = crearApiFalsa({ DELETE: {} })
    await assert.rejects(
      crearJuntaService({ api: sinConfirmar }).borrar(5),
      (e) => e.estado === 'respuesta_inesperada',
    )
  })

  it('participantesDisponibles pide la lista de invitables', async () => {
    const usuarios = [{ id: 4, nombre: 'Ana', rol: 'contador' }]
    const api = crearApiFalsa({ GET: { usuarios } })
    assert.deepEqual(await crearJuntaService({ api }).participantesDisponibles(), usuarios)
    assert.equal(api.llamadas[0].url, '/juntas/participantes-disponibles')
  })
})
