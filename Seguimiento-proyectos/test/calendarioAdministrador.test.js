// Rebanada 18: calendario del administrador (casos importantes, auditorías y entregas de auditoría).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearCounterService } from '../src/services/counterService.js'
import { crearAuditoriaService } from '../src/services/auditoriaService.js'
import {
  agruparDelDia,
  elementosDelCalendario,
  filtrarPorContador,
  marcasPorDia,
  opcionesDeContador,
  textoDeUrgencia,
  urgenciaDe,
} from '../src/utils/calendarioAdministrador.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

const HOY = '2026-11-17'

const caso = (id, vence, extra = {}) => ({
  id,
  cliente: `Cliente ${id}`,
  estado: 'pendiente',
  prioridad: 'alta',
  importante: true,
  contador_id: 1,
  nombre_contador: 'Ana',
  contador_que_apoya_id: null,
  contador_que_apoya: null,
  fecha_vencimiento: vence,
  ...extra,
})

const auditoria = (id, fechaVencimiento, extra = {}) => ({
  id,
  cliente: `Auditada ${id}`,
  noExpediente: `EXP-${id}`,
  estado: 'En Proceso',
  fechaVencimiento,
  contadores: [{ id: 1, nombre: 'Ana' }],
  ...extra,
})

const entrega = (id, fechaLimite, extra = {}) => ({
  id,
  auditoriaId: 10,
  cliente: 'Auditada 10',
  noExpediente: 'EXP-10',
  evento: `Entrega ${id}`,
  fase: 'Requerimientos',
  fechaLimite,
  estado: 'Pendiente',
  contadores: [{ id: 1, nombre: 'Ana' }],
  ...extra,
})

describe('urgenciaDe', () => {
  it('vencido si la fecha ya pasó, pronto de hoy a 3 días y a tiempo después', () => {
    assert.equal(urgenciaDe('2026-11-16', HOY), 'vencido')
    assert.equal(urgenciaDe('2026-11-17', HOY), 'pronto')
    assert.equal(urgenciaDe('2026-11-20', HOY), 'pronto')
    assert.equal(urgenciaDe('2026-11-21', HOY), 'a-tiempo')
  })

  it('cruza el fin de mes y de año sin desfase', () => {
    assert.equal(urgenciaDe('2027-01-02', '2026-12-30'), 'pronto')
    assert.equal(urgenciaDe('2027-01-03', '2026-12-30'), 'a-tiempo')
  })

  it('tiene un texto por nivel', () => {
    assert.equal(textoDeUrgencia('vencido'), 'Vencido')
    assert.equal(textoDeUrgencia('pronto'), 'Vence pronto')
    assert.equal(textoDeUrgencia('a-tiempo'), 'A tiempo')
  })
})

describe('elementosDelCalendario', () => {
  it('arma casos, auditorías y entregas con su fecha AAAA-MM-DD', () => {
    const elementos = elementosDelCalendario({
      casos: [caso(1, '2026-11-20 00:00:00')],
      auditorias: [auditoria(5, '25-11-2026')],
      entregas: [entrega(7, '2026-11-18')],
    })
    assert.deepEqual(
      elementos.map((e) => [e.tipo, e.vence]),
      [
        ['caso', '2026-11-20'],
        ['auditoria', '2026-11-25'],
        ['entrega', '2026-11-18'],
      ],
    )
  })

  it('no incluye casos finalizados ni auditorías completadas', () => {
    const elementos = elementosDelCalendario({
      casos: [caso(1, '2026-11-20', { estado: 'finalizado' }), caso(2, '2026-11-20')],
      auditorias: [
        auditoria(5, '25-11-2026', { estado: 'Completado' }),
        auditoria(6, '25-11-2026'),
      ],
      entregas: [],
    })
    assert.deepEqual(
      elementos.map((e) => e.id),
      [2, 6],
    )
  })

  it('omite lo que no tiene una fecha real', () => {
    const elementos = elementosDelCalendario({
      casos: [caso(1, null), caso(2, '2026-02-31')],
      auditorias: [auditoria(5, '')],
      entregas: [entrega(7, null)],
    })
    assert.deepEqual(elementos, [])
  })

  it('el caso de un auxiliar se atribuye a su contador y dice «de {auxiliar}»', () => {
    const [propio, escalado] = elementosDelCalendario({
      casos: [
        caso(1, '2026-11-20'),
        caso(2, '2026-11-20', {
          contador_id: 9,
          nombre_contador: 'Aux Beto',
          contador_que_apoya_id: 2,
          contador_que_apoya: 'Carla',
        }),
      ],
      auditorias: [],
      entregas: [],
    })
    assert.deepEqual(propio.contadores, [{ id: 1, nombre: 'Ana' }])
    assert.equal(propio.deAuxiliar, null)
    assert.deepEqual(escalado.contadores, [{ id: 2, nombre: 'Carla' }])
    assert.equal(escalado.deAuxiliar, 'Aux Beto')
  })

  it('conserva el caso original para abrir su ficha y el id de la auditoría para su enlace', () => {
    const original = caso(1, '2026-11-20')
    const [deAuditoria, delCaso, deEntrega] = elementosDelCalendario({
      casos: [original],
      auditorias: [auditoria(5, '25-11-2026')],
      entregas: [entrega(7, '2026-11-18', { auditoriaId: 10 })],
    }).sort((a, b) => a.tipo.localeCompare(b.tipo))
    assert.equal(delCaso.caso, original)
    assert.equal(deEntrega.auditoriaId, 10)
    assert.equal(deAuditoria.auditoriaId, 5)
  })
})

describe('filtro por contador', () => {
  const elementos = elementosDelCalendario({
    casos: [caso(1, '2026-11-20')],
    auditorias: [
      auditoria(5, '25-11-2026', {
        contadores: [
          { id: 1, nombre: 'Ana' },
          { id: 2, nombre: 'Carla' },
        ],
      }),
    ],
    entregas: [entrega(7, '2026-11-18', { contadores: [{ id: 3, nombre: 'Beto' }] })],
  })

  it('sin contador elegido deja todo', () => {
    assert.equal(filtrarPorContador(elementos, null).length, 3)
  })

  it('con contador elegido deja solo lo suyo, también en auditorías compartidas', () => {
    assert.deepEqual(
      filtrarPorContador(elementos, 1).map((e) => e.tipo),
      ['caso', 'auditoria'],
    )
    assert.deepEqual(
      filtrarPorContador(elementos, 3).map((e) => e.tipo),
      ['entrega'],
    )
  })

  it('las opciones son los contadores que aparecen, sin repetir y por nombre', () => {
    assert.deepEqual(opcionesDeContador(elementos), [
      { id: 1, nombre: 'Ana' },
      { id: 3, nombre: 'Beto' },
      { id: 2, nombre: 'Carla' },
    ])
  })
})

describe('marcasPorDia', () => {
  it('cada día toma la urgencia más alta de lo que vence ese día', () => {
    const elementos = elementosDelCalendario({
      casos: [caso(1, '2026-11-10'), caso(2, '2026-11-30')],
      auditorias: [auditoria(5, '30-11-2026')],
      entregas: [entrega(7, '2026-11-18'), entrega(8, '2026-11-18')],
    })
    assert.deepEqual(marcasPorDia(elementos, HOY), {
      '2026-11-10': 'vencido',
      '2026-11-18': 'pronto',
      '2026-11-30': 'a-tiempo',
    })
  })

  it('sin elementos no hay marcas', () => {
    assert.deepEqual(marcasPorDia([], HOY), {})
  })
})

describe('agruparDelDia', () => {
  const elementos = elementosDelCalendario({
    casos: [caso(1, '2026-11-18'), caso(2, '2026-11-18'), caso(3, '2026-11-19')],
    auditorias: [auditoria(5, '18-11-2026')],
    entregas: [entrega(7, '2026-11-18')],
  })

  it('separa en casos, auditorías y entregas solo del día pedido', () => {
    const grupos = agruparDelDia(elementos, '2026-11-18')
    assert.equal(grupos.casos.length, 2)
    assert.equal(grupos.auditorias.length, 1)
    assert.equal(grupos.entregas.length, 1)
  })

  it('un día sin nada devuelve los tres grupos vacíos', () => {
    assert.deepEqual(agruparDelDia(elementos, '2026-12-01'), {
      casos: [],
      auditorias: [],
      entregas: [],
    })
  })

  it('dentro de un grupo, por nombre del cliente', () => {
    const desordenados = elementosDelCalendario({
      casos: [
        caso(1, '2026-11-18', { cliente: 'Zeta' }),
        caso(2, '2026-11-18', { cliente: 'Álamo' }),
      ],
      auditorias: [],
      entregas: [],
    })
    assert.deepEqual(
      agruparDelDia(desordenados, '2026-11-18').casos.map((e) => e.titulo),
      ['Álamo', 'Zeta'],
    )
  })
})

describe('servicios', () => {
  it('getCasosImportantesCalendario pide /contadores/casos-importantes y traduce estado y prioridad', async () => {
    const pedidos = []
    const api = {
      get: async (url) => {
        pedidos.push(url)
        return {
          data: {
            casos: [
              {
                id: 1,
                estado: 'En proceso',
                prioridad: 'Alta',
                cliente: 'X',
                fecha_vencimiento: '2026-11-20',
              },
            ],
          },
        }
      },
    }
    const casos = await crearCounterService({ api }).getCasosImportantesCalendario()
    assert.deepEqual(pedidos, ['/contadores/casos-importantes'])
    assert.equal(casos[0].estado, 'en_proceso')
    assert.equal(casos[0].prioridad, 'alta')
  })

  it('listarEntregasCalendario pide /auditorias/calendario y pasa a camelCase', async () => {
    const pedidos = []
    const api = {
      get: async (url) => {
        pedidos.push(url)
        return {
          data: {
            eventos: [
              {
                id: 3,
                auditoria_id: 10,
                cliente: 'C',
                no_expediente: 'E',
                evento: 'Req',
                fase: 'F',
                fecha_limite: '2026-11-18',
                estado: 'Pendiente',
                contadores: [{ id: 1, nombre: 'Ana' }],
              },
            ],
          },
        }
      },
    }
    const entregas = await crearAuditoriaService({ api }).listarEntregasCalendario()
    assert.deepEqual(pedidos, ['/auditorias/calendario'])
    assert.deepEqual(entregas, [
      {
        id: 3,
        auditoriaId: 10,
        cliente: 'C',
        noExpediente: 'E',
        evento: 'Req',
        fase: 'F',
        fechaLimite: '2026-11-18',
        estado: 'Pendiente',
        contadores: [{ id: 1, nombre: 'Ana' }],
      },
    ])
  })

  it('una respuesta sin lista da el error de tres partes', async () => {
    const api = { get: async () => ({ data: {} }) }
    await assert.rejects(crearAuditoriaService({ api }).listarEntregasCalendario(), (error) =>
      Boolean(error.mensaje),
    )
    await assert.rejects(crearCounterService({ api }).getCasosImportantesCalendario(), (error) =>
      Boolean(error.mensaje),
    )
  })
})

describe('pestaña «Calendario» y componente', () => {
  const pagina = leer('../src/pages/AdminDashboardPage.vue')

  it('el dashboard tiene la pestaña calendario en la dirección', () => {
    assert.match(pagina, /PESTANAS = \['casos', 'auditorias', 'calendario'\]/)
    assert.match(pagina, /<q-tab name="calendario"/)
    assert.match(pagina, /<q-tab-panel name="calendario"/)
    assert.match(pagina, /<CalendarioAdministrador/)
  })

  it('el componente existe y usa q-date con eventos, filtro, «Hoy» y reintentar', () => {
    const ruta = '../src/components/CalendarioAdministrador.vue'
    assert.ok(existsSync(fileURLToPath(new URL(ruta, import.meta.url))))
    const plantilla = plantillaDe(leer(ruta))
    assert.match(plantilla, /<q-date/)
    assert.match(plantilla, /:events=/)
    assert.match(plantilla, /<q-select/)
    assert.match(plantilla, /Todos los contadores/)
    assert.match(plantilla, /label="Hoy"/)
    assert.match(plantilla, /Nada vence este día\./)
    assert.match(plantilla, /@retry=|Reintentar/)
    assert.match(plantilla, /CasoDetalleDialog/)
    assert.match(leer(ruta), /auditoria-ficha/)
  })

  it('el componente relee en visibilitychange y no usa new Date con texto', () => {
    const fuente = leer('../src/components/CalendarioAdministrador.vue')
    assert.match(fuente, /visibilitychange/)
    assert.doesNotMatch(fuente, /new Date\(['"`]/)
    assert.doesNotMatch(fuente, /#[0-9a-fA-F]{6}\b/)
  })
})
