// Tablero de auditorías en el dashboard del administrador (rebanada 1): indicadores,
// marcas de avance por fase y texto de días; más la verificación estática de las pestañas.

import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  activasPorFase,
  indicadoresAuditorias,
  marcasDeFases,
  tablaTipoFase,
  textoDiasPlazo,
} from '../src/utils/tableroAuditorias.js'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

test('indicadoresAuditorias cuenta activas (todo lo no concluido) y cada semáforo urgente', () => {
  const lista = [
    'Vencido',
    'Vencido',
    'Crítico',
    'Atención',
    'En tiempo',
    'Concluida',
    'Concluida',
  ].map((semaforo, i) => ({ id: i + 1, semaforo }))

  assert.deepEqual(indicadoresAuditorias(lista), {
    activas: 5,
    vencidas: 2,
    criticas: 1,
    atencion: 1,
  })
  assert.deepEqual(indicadoresAuditorias([]), { activas: 0, vencidas: 0, criticas: 0, atencion: 0 })
})

test('marcasDeFases: cumplidas antes de la actual, la actual y pendientes después', () => {
  assert.deepEqual(marcasDeFases(3, 'Atención'), [
    'cumplida',
    'cumplida',
    'actual',
    'pendiente',
    'pendiente',
    'pendiente',
  ])
  assert.deepEqual(marcasDeFases(null, 'En tiempo'), [
    'actual',
    'pendiente',
    'pendiente',
    'pendiente',
    'pendiente',
    'pendiente',
  ])
  // Concluida: la fase en la que terminó también cuenta como cumplida (como en el boceto).
  assert.deepEqual(marcasDeFases(5, 'Concluida'), [
    'cumplida',
    'cumplida',
    'cumplida',
    'cumplida',
    'cumplida',
    'pendiente',
  ])
})

test('textoDiasPlazo describe los días sin números negativos', () => {
  assert.equal(textoDiasPlazo(0), 'vence hoy')
  assert.equal(textoDiasPlazo(1), 'en 1 día')
  assert.equal(textoDiasPlazo(15), 'en 15 días')
  assert.equal(textoDiasPlazo(-1), 'venció hace 1 día')
  assert.equal(textoDiasPlazo(-8), 'venció hace 8 días')
  assert.equal(textoDiasPlazo(null), '—')
})

describe('Dashboard del administrador: pestañas «Casos | Auditorías»', () => {
  const pagina = read('../src/pages/AdminDashboardPage.vue')

  it('usa q-tabs con q-tab-panels y la pestaña vive en la URL', () => {
    assert.match(
      pagina,
      /<q-tabs[\s\S]*?v-model="pestana"[\s\S]*?name="casos"[\s\S]*?name="auditorias"/,
    )
    assert.match(pagina, /<q-tab-panels v-model="pestana"[\s\S]*?keep-alive/)
    assert.match(pagina, /route\.query\.tab/)
    assert.match(pagina, /router\.replace\(/)
  })

  it('lo de casos queda dentro de su pestaña y el tablero en la de auditorías', () => {
    const casos = pagina.slice(
      pagina.indexOf('<q-tab-panel name="casos"'),
      pagina.indexOf('<q-tab-panel name="auditorias"'),
    )
    assert.match(casos, /<ResumenEquipo/)
    assert.match(casos, /class="dashboard-page__grid"/)
    assert.match(pagina, /<q-tab-panel name="auditorias"[\s\S]*?<TableroAuditorias/)
  })
})

describe('Tablero de auditorías: sub-pestañas Resumen y Avance', () => {
  const tablero = read('../src/components/TableroAuditorias.vue')

  it('tiene sub-pestañas resumen y avance', () => {
    assert.match(
      tablero,
      /<q-tabs[\s\S]*?v-model="vista"[\s\S]*?name="resumen"[\s\S]*?name="avance"/,
    )
    assert.match(tablero, /<q-tab-panels v-model="vista"/)
  })

  it('carga las auditorías al mostrarse la pestaña', () => {
    assert.match(tablero, /onActivated\(cargar\)/)
    assert.match(tablero, /listarAuditorias\(\)/)
  })

  it('el avance lleva las columnas del boceto y abre la ficha al hacer clic', () => {
    const avance = tablero.slice(tablero.indexOf('<q-tab-panel name="avance"'))
    const tabla = avance.slice(avance.indexOf('<thead>'), avance.indexOf('</thead>'))
    const encabezados = [...tabla.matchAll(/<th\b[^>]*>([^<]+)</g)].map((m) => m[1].trim())
    assert.deepEqual(encabezados.slice(0, 3), ['Cliente', 'Tipo', 'Dependencia'])
    assert.deepEqual(encabezados.slice(-4), [
      'Próximo vencimiento',
      '¿Qué vence?',
      'Días',
      'Semáforo',
    ])
    assert.match(tablero, /v-for="fase in fases"/)
    assert.match(tablero, /@click="verFicha\(auditoria\.id\)"/)
    assert.match(tablero, /name: 'auditoria-ficha'/)
  })
})

// Rebanada 2: gráficas del Resumen.
const aud = (id, tipoAud, fase, semaforo = 'En tiempo') => ({
  id,
  tipoAud,
  faseActual: { id: fase },
  semaforo,
})

test('activasPorFase cuenta solo las no concluidas en cada una de las 6 fases', () => {
  const lista = [
    aud(1, 'Visita', 1),
    aud(2, 'Visita', 3),
    aud(3, 'Gabinete', 3, 'Vencido'),
    aud(4, 'Gabinete', 6),
    aud(5, 'Gabinete', 5, 'Concluida'),
    { id: 6, tipoAud: 'Visita', faseActual: null, semaforo: 'En tiempo' },
  ]

  assert.deepEqual(activasPorFase(lista), [2, 0, 2, 0, 0, 1])
  assert.deepEqual(activasPorFase([]), [0, 0, 0, 0, 0, 0])
})

test('tablaTipoFase agrupa por tipo sin importar mayúsculas ni acentos y suma el total', () => {
  const lista = [
    aud(1, 'Visita Domiciliaria', 1),
    aud(2, 'visita domiciliaria ', 3, 'Crítico'),
    aud(3, 'Revisión de Gabinete', 2),
    aud(4, 'Revision de gabinete', 2, 'Concluida'),
  ]

  const { filas, total } = tablaTipoFase(lista)

  assert.deepEqual(
    filas.map((f) => [f.tipo, f.activas, f.concluidas, f.total, f.fases.join('')]),
    [
      ['Revisión de Gabinete', 1, 1, 2, '010000'],
      ['Visita Domiciliaria', 2, 0, 2, '101000'],
    ],
    'ordenadas por tipo; se muestra la primera forma escrita',
  )
  assert.deepEqual(total, { activas: 3, concluidas: 1, total: 4, fases: [1, 1, 1, 0, 0, 0] })
  assert.deepEqual(tablaTipoFase([]), {
    filas: [],
    total: { activas: 0, concluidas: 0, total: 0, fases: [0, 0, 0, 0, 0, 0] },
  })
})

describe('Tablero de auditorías: gráficas en Resumen', () => {
  const tablero = read('../src/components/TableroAuditorias.vue')
  const resumen = tablero.slice(
    tablero.indexOf('<q-tab-panel name="resumen"'),
    tablero.indexOf('<q-tab-panel name="avance"'),
  )

  it('barras con q-linear-progress por semáforo y por fase', () => {
    assert.match(resumen, /Auditorías por semáforo/)
    assert.match(resumen, /Activas por fase/)
    assert.equal(
      (resumen.match(/<q-linear-progress/g) ?? []).length,
      2,
      'una barra por renglón de cada gráfica',
    )
    assert.match(tablero, /contarPorSemaforo\(auditorias\.value\)/)
    assert.match(tablero, /activasPorFase\(auditorias\.value\)/)
  })

  it('la tabla «Activas por tipo y fase» lleva las columnas del boceto y su total', () => {
    const tabla = resumen.slice(
      resumen.indexOf('<q-markup-table'),
      resumen.indexOf('</q-markup-table>'),
    )
    const encabezados = [...tabla.matchAll(/<th\b[^>]*>([^<]+)</g)].map((m) => m[1].trim())
    assert.deepEqual(encabezados.slice(0, 4), [
      'Tipo de auditoría',
      'Activas',
      'Concluidas',
      'Total',
    ])
    assert.match(tabla, /v-for="fase in fases"/)
    assert.match(tabla, /tablaTipo\.total/)
  })
})
