// Rebanada 18: calendario del administrador (casos importantes, auditorías y entregas de auditoría).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearCounterService } from '../src/services/counterService.js'
import { crearAuditoriaService } from '../src/services/auditoriaService.js'
import {
  RANGOS,
  agruparDelDia,
  agruparPorPestana,
  cifrasDeAtencion,
  consultaConVista,
  diasDeTira,
  elementosDeRango,
  elementosDelCalendario,
  encabezadoDeDia,
  etiquetaCortaDeDia,
  leerVista,
  pestanaDelDia,
  etiquetaLargaDeDia,
  TEXTO_AYUDA_MODO_DIA,
  resumenParaLector,
  tituloDeRango,
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

describe('rebanada 19: cifras de la franja y rangos', () => {
  const fuentes = () =>
    elementosDelCalendario({
      casos: [
        caso(1, '2026-11-10'), // vencido
        caso(2, '2026-11-17'), // hoy
        caso(3, '2026-11-24'), // último día de la semana (hoy + 7)
        caso(4, '2026-11-25'), // fuera de la semana
        caso(5, '2026-11-01', { estado: 'finalizado' }), // no cuenta
      ],
      auditorias: [auditoria(6, '2026-11-12'), auditoria(7, '2026-11-18')],
      entregas: [entrega(8, '2026-11-16'), entrega(9, '2026-11-20'), entrega(10, '2026-12-30')],
    })

  it('cuenta vencidos, hoy, semana (hoy a 7 días) y entregas pendientes de la semana', () => {
    assert.deepEqual(cifrasDeAtencion(fuentes(), HOY), {
      vencidos: 3, // caso 1, auditoría 6, entrega 8
      hoy: 1, // caso 2
      semana: 4, // casos 2 y 3, auditoría 7, entrega 9
      entregas: 1, // entrega 9 (la 8 está vencida; la 10 queda fuera)
    })
  })

  it('sin elementos todas las cifras son 0', () => {
    assert.deepEqual(cifrasDeAtencion([], HOY), { vencidos: 0, hoy: 0, semana: 0, entregas: 0 })
  })

  it('RANGOS lista los cuatro rangos válidos', () => {
    assert.deepEqual([...RANGOS], ['vencidos', 'hoy', 'semana', 'entregas'])
  })

  it('elementosDeRango devuelve los mismos elementos que cuenta cada cifra, por fecha', () => {
    const cifras = cifrasDeAtencion(fuentes(), HOY)
    for (const rango of RANGOS) {
      assert.equal(elementosDeRango(fuentes(), rango, HOY).length, cifras[rango], rango)
    }
    assert.deepEqual(
      elementosDeRango(fuentes(), 'vencidos', HOY).map((e) => e.clave),
      ['caso-1', 'auditoria-6', 'entrega-8'],
    )
    assert.deepEqual(
      elementosDeRango(fuentes(), 'entregas', HOY).map((e) => e.clave),
      ['entrega-9'],
    )
  })

  it('cruza el fin de año sin desfase', () => {
    const elementos = elementosDelCalendario({
      casos: [caso(1, '2027-01-06'), caso(2, '2027-01-07')],
    })
    assert.equal(cifrasDeAtencion(elementos, '2026-12-30').semana, 1)
  })

  it('cada rango tiene su título', () => {
    assert.equal(tituloDeRango('vencidos'), 'Lo vencido hasta hoy')
    assert.equal(tituloDeRango('hoy'), 'Lo que vence hoy')
    assert.equal(tituloDeRango('semana'), 'Lo que vence en los próximos 7 días')
    assert.equal(tituloDeRango('entregas'), 'Entregas de auditoría de los próximos 7 días')
  })
})

describe('rebanada 19: pestañas del modo día', () => {
  const elementos = elementosDelCalendario({
    casos: [caso(1, '2026-11-18', { cliente: 'B' }), caso(2, '2026-11-18', { cliente: 'A' })],
    auditorias: [auditoria(3, '2026-11-18')],
    entregas: [entrega(4, '2026-11-18')],
  })

  it('agrupa en Casos y Auditorías (vencimientos y entregas en dos subgrupos)', () => {
    const grupos = agruparPorPestana(elementos)
    assert.deepEqual(
      grupos.casos.map((e) => e.id),
      [1, 2],
    )
    assert.deepEqual(
      grupos.vencimientos.map((e) => e.id),
      [3],
    )
    assert.deepEqual(
      grupos.entregas.map((e) => e.id),
      [4],
    )
    assert.deepEqual(
      grupos.auditorias.map((e) => e.clave),
      ['auditoria-3', 'entrega-4'],
    )
  })

  it('si la pestaña elegida queda vacía abre la otra; si ambas, se queda donde estaba', () => {
    const soloCasos = agruparPorPestana(elementos.filter((e) => e.tipo === 'caso'))
    const soloAuditorias = agruparPorPestana(elementos.filter((e) => e.tipo !== 'caso'))
    assert.equal(pestanaDelDia(soloCasos, 'auditorias'), 'casos')
    assert.equal(pestanaDelDia(soloAuditorias, 'casos'), 'auditorias')
    assert.equal(pestanaDelDia(agruparPorPestana(elementos), 'auditorias'), 'auditorias')
    assert.equal(pestanaDelDia(agruparPorPestana([]), 'auditorias'), 'auditorias')
  })

  it('el encabezado y el chip del día se escriben en español', () => {
    assert.equal(encabezadoDeDia('2026-11-12'), 'Lo que vence el 12 de noviembre')
    assert.equal(etiquetaCortaDeDia('2026-11-12'), '12 nov')
    assert.equal(etiquetaCortaDeDia('2026-05-03'), '3 may')
  })
})

describe('rebanada 19: estado en la dirección', () => {
  it('lee un día real o un rango válido; el día gana si vienen los dos', () => {
    assert.deepEqual(leerVista({ dia: '2026-11-12' }), { dia: '2026-11-12', rango: null })
    assert.deepEqual(leerVista({ rango: 'semana' }), { dia: null, rango: 'semana' })
    assert.deepEqual(leerVista({ dia: '2026-11-12', rango: 'hoy' }), {
      dia: '2026-11-12',
      rango: null,
    })
  })

  it('ignora valores inválidos, repetidos o inexistentes (vista general)', () => {
    const general = { dia: null, rango: null }
    assert.deepEqual(leerVista({}), general)
    assert.deepEqual(leerVista({ dia: '2026-02-31' }), general)
    assert.deepEqual(leerVista({ dia: 'ayer' }), general)
    assert.deepEqual(leerVista({ rango: 'siempre' }), general)
    assert.deepEqual(leerVista({ dia: ['2026-11-12', '2026-11-13'] }), general)
  })

  it('escribe el día o el rango sin perder el resto de la consulta y sin dejar el otro', () => {
    assert.deepEqual(consultaConVista({ tab: 'auditorias', rango: 'hoy' }, { dia: '2026-11-12' }), {
      tab: 'auditorias',
      dia: '2026-11-12',
    })
    assert.deepEqual(consultaConVista({ dia: '2026-11-12' }, { rango: 'vencidos' }), {
      rango: 'vencidos',
    })
    assert.deepEqual(consultaConVista({ tab: 'casos', dia: '2026-11-12' }, null), { tab: 'casos' })
  })
})

describe('rebanada 19: tira de la semana', () => {
  it('son 3 semanas de lunes a domingo: la anterior, la del día elegido y la siguiente', () => {
    const dias = diasDeTira('2026-11-17')
    assert.equal(dias.length, 21)
    assert.equal(dias[0], '2026-11-09')
    assert.equal(dias[7], '2026-11-16')
    assert.equal(dias[20], '2026-11-29')
  })

  it('cruza el fin de año sin desfase', () => {
    const dias = diasDeTira('2027-01-01')
    assert.equal(dias[7], '2026-12-28')
    assert.equal(dias[20], '2027-01-10')
  })
})

describe('rebanada 19: dashboard con calendario principal', () => {
  const pagina = leer('../src/pages/AdminDashboardPage.vue')
  const plantilla = plantillaDe(pagina)

  it('ya no hay pestaña «Calendario»: solo Casos y Auditorías', () => {
    assert.match(pagina, /PESTANAS = \['casos', 'auditorias'\]/)
    assert.doesNotMatch(plantilla, /<q-tab name="calendario"/)
    assert.doesNotMatch(plantilla, /<q-tab-panel name="calendario"/)
  })

  it('tiene la franja, el calendario y el modo día', () => {
    assert.match(plantilla, /<ResumenAtencion/)
    assert.match(plantilla, /<CalendarioAdministrador/)
    assert.match(plantilla, /<VencimientosDelDia/)
    assert.match(pagina, /leerVista/)
    assert.match(pagina, /consultaConVista/)
    assert.match(pagina, /visibilitychange/)
  })

  it('los botones de asignar no salen en modo día', () => {
    assert.match(plantilla, /<template v-if="!enModoDia">\s*<q-btn\s+v-if="pestana === 'casos'"/)
    assert.match(plantilla, /v-else-if="pestana === 'auditorias'"[\s\S]*?<\/template>\s*<\/div>/)
  })

  it('los componentes nuevos existen y respetan las convenciones', () => {
    for (const nombre of ['ResumenAtencion', 'VencimientosDelDia', 'SemanaCalendario']) {
      const ruta = `../src/components/${nombre}.vue`
      assert.ok(existsSync(fileURLToPath(new URL(ruta, import.meta.url))), nombre)
      const fuente = leer(ruta)
      assert.doesNotMatch(fuente, /new Date\(['"`]/, nombre)
      assert.doesNotMatch(fuente, /#[0-9a-fA-F]{6}\b/, nombre)
    }
    const franja = leer('../src/components/ResumenAtencion.vue')
    for (const texto of [
      'Requiere atención',
      'Vencidos',
      'Vencen hoy',
      'Esta semana',
      'Entregas pendientes',
      'casos importantes',
    ]) {
      assert.match(franja, new RegExp(texto), texto)
    }
    const dia = leer('../src/components/VencimientosDelDia.vue')
    assert.match(dia, /Nada vence este día\./)
    assert.match(dia, /Volver a la vista general/)
    assert.match(dia, /CasoDetalleDialog/)
    const semana = plantillaDe(leer('../src/components/SemanaCalendario.vue'))
    assert.match(semana, /Ver mes/)
  })

  it('el calendario queda compacto: emite el día y ya no lista lo del día', () => {
    const fuente = leer('../src/components/CalendarioAdministrador.vue')
    assert.match(fuente, /elegir-dia/)
    assert.match(plantillaDe(fuente), /<SemanaCalendario/)
    assert.doesNotMatch(plantillaDe(fuente), /Nada vence este día\./)
    assert.doesNotMatch(plantillaDe(fuente), /CasoDetalleDialog/)
  })

  it('el calendario compacto no pide datos: los recibe del dashboard (una sola carga)', () => {
    const fuente = leer('../src/components/CalendarioAdministrador.vue')
    assert.doesNotMatch(fuente, /listarAuditorias|getCasosImportantesCalendario/)
  })

  it('el dashboard pide los tres endpoints una vez', () => {
    assert.match(pagina, /getCasosImportantesCalendario/)
    assert.match(pagina, /listarAuditorias/)
    assert.match(pagina, /listarEntregasCalendario/)
  })
})

describe('rebanada 19: ficha del caso para el administrador', () => {
  const fuente = leer('../src/components/CasoDetalleDialog.vue')

  it('para el administrador la ayuda no menciona «Editar»', () => {
    assert.match(fuente, /esAdministrador/)
    assert.match(fuente, /Ficha de solo lectura\. Es un caso importante del contador/)
  })

  it('para el contador y el auxiliar el texto no cambia', () => {
    assert.match(fuente, /Ficha de solo lectura: para cambiar algo usa «Editar»\./)
  })
})

describe('rebanada 19, vuelta 1: correcciones', () => {
  const pagina = leer('../src/pages/AdminDashboardPage.vue')
  const venc = leer('../src/components/VencimientosDelDia.vue')
  const franja = leer('../src/components/ResumenAtencion.vue')
  const semana = leer('../src/components/SemanaCalendario.vue')

  it('el resumen para lector cuenta casos y auditorías (con sus entregas)', () => {
    const elementos = elementosDelCalendario({
      casos: [caso(1, '2026-11-12')],
      auditorias: [auditoria(2, '2026-11-12')],
      entregas: [entrega(3, '2026-11-12')],
    })
    assert.equal(
      resumenParaLector('12 de noviembre', elementos),
      '12 de noviembre: 1 caso y 2 auditorías',
    )
    assert.equal(
      resumenParaLector(
        'Vencidos',
        elementos.filter((e) => e.tipo === 'caso'),
      ),
      'Vencidos: 1 caso',
    )
    assert.equal(resumenParaLector('Vencidos', []), 'Vencidos: nada que mostrar')
    assert.equal(etiquetaLargaDeDia('2026-11-12'), '12 de noviembre')
  })

  it('el aria-live sale de la sección y vive en una línea sr-only siempre montada en la página', () => {
    assert.doesNotMatch(plantillaDe(venc), /aria-live/)
    assert.match(
      plantillaDe(pagina),
      /class="sr-only"[^>]*role="status"|role="status"[^>]*class="sr-only"/,
    )
    assert.match(pagina, /resumenParaLector/)
  })

  it('el cambio de modo espera a la ruta y lleva el encabezado a la vista', () => {
    assert.match(pagina, /await router\.replace/)
    assert.match(venc, /scrollIntoView/)
    assert.match(pagina, /vencimientos\.value\?\.enfocar/)
    assert.match(pagina, /requestAnimationFrame/)
  })

  it('al volver el foco regresa al control que abrió el modo', () => {
    assert.match(pagina, /origenDeVista/)
    assert.match(franja, /data-rango/)
  })

  it('las dos columnas empiezan en 1280 px y la tira se usa por debajo', () => {
    assert.match(pagina, /\$q\.screen\.width < 1280/)
    assert.match(pagina, /@media \(min-width: 1280px\)[\s\S]*?dashboard-page__cuerpo/)
    assert.match(pagina, /const pantallaChica = computed\(\(\) => \$q\.screen\.lt\.md\)/)
  })

  it('la tira queda alineada al lunes y los lunes hacen snap', () => {
    assert.match(semana, /scroll-snap-align: start/)
    assert.match(semana, /semana__dia--lunes/)
  })

  it('cada cifra dice qué cuenta', () => {
    assert.match(franja, /casos, auditorías y entregas/)
    assert.match(franja, /entregas de auditoría/)
    assert.match(franja, /atencion__detalle/)
  })

  it('el día se escribe en minúscula a media frase', () => {
    assert.match(venc, /toLowerCase\(\)/)
  })

  it('el texto de ayuda del modo día explica cómo volver', () => {
    assert.match(pagina, /{{ TEXTO_AYUDA_MODO_DIA }}/)
    assert.doesNotMatch(TEXTO_AYUDA_MODO_DIA, /\bToca\b|la ✕/)
    assert.equal(
      TEXTO_AYUDA_MODO_DIA,
      'Para volver a la vista general, quita la fecha elegida o pulsa la tecla Esc.',
    )
  })

  it('el chip tiene una sola parada de tabulación', () => {
    assert.doesNotMatch(plantillaDe(venc), /<q-chip[^>]*clickable/)
    assert.match(plantillaDe(venc), /remove-aria-label="Volver a la vista general"/)
  })
})
