// Tablero de auditorías en el dashboard del administrador (rebanada 1): indicadores,
// marcas de avance por fase y texto de días; más la verificación estática de las pestañas.

import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  indicadoresAuditorias,
  marcasDeFases,
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
    const tabla = tablero.slice(tablero.indexOf('<thead>'), tablero.indexOf('</thead>'))
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
