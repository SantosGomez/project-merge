// Tablero de auditorías en el dashboard del administrador (rebanada 1): indicadores,
// marcas de avance por fase y texto de días; más la verificación estática de las pestañas.

import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import {
  activasPorFase,
  columnasKanban,
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
    assert.match(pagina, /<q-tab-panels\s+v-model="pestana"[\s\S]*?keep-alive/)
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
    assert.match(tablero, /<q-tab-panels\s+v-model="vista"/)
  })

  // Revisión de UI, rebanada 4: la primera vez con loader; al volver, refresco silencioso.
  it('carga las auditorías al mostrarse la pestaña', () => {
    assert.match(tablero, /onActivated\(\(\) => \(fases\.value\.length > 0 \? refrescarEnSilencio\(\) : cargar\(\)\)\)/)
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

// Rebanada 3: Kanban por fase.
test('columnasKanban reparte las auditorías en las 6 fases, por urgencia y concluidas al final', () => {
  const k = (id, fase, semaforo, diasParaVencer = null) => ({
    id,
    faseActual: fase ? { id: fase } : null,
    semaforo,
    diasParaVencer,
  })
  const lista = [
    k(1, 2, 'En tiempo'),
    k(2, 2, 'Concluida'),
    k(3, 2, 'Vencido', -3),
    k(4, 2, 'Crítico', 5),
    k(5, null, 'Atención', 12),
    k(6, 6, 'Concluida'),
  ]

  const columnas = columnasKanban(lista)

  assert.equal(columnas.length, 6)
  assert.deepEqual(
    columnas.map((c) => c.map((a) => a.id)),
    [[5], [3, 4, 1, 2], [], [], [], [6]],
  )
  assert.deepEqual(columnasKanban([]), [[], [], [], [], [], []])
})

describe('Tablero de auditorías: sub-pestaña Kanban', () => {
  const tablero = read('../src/components/TableroAuditorias.vue')
  const kanban = tablero.slice(tablero.indexOf('<q-tab-panel name="kanban"'))

  it('es la tercera sub-pestaña y vive en la URL', () => {
    assert.match(tablero, /name="avance"[\s\S]*?<q-tab name="kanban"/)
    assert.match(tablero, /const VISTAS = \['resumen', 'avance', 'kanban'\]/)
  })

  it('una columna por fase con su conteo y tarjetas que abren la ficha', () => {
    assert.match(kanban, /v-for="\(columna, i\) in columnas"/)
    assert.match(kanban, /fases\[i\]/)
    assert.match(kanban, /columna\.length/)
    assert.match(kanban, /v-for="auditoria in columna"/)
    assert.match(kanban, /@click="verFicha\(auditoria\.id\)"/)
    assert.match(kanban, /@keydown\.enter="verFicha\(auditoria\.id\)"/)
    assert.match(tablero, /columnasKanban\(auditorias\.value\)/)
  })
})

describe('Dashboard: el botón de asignar cambia según la pestaña', () => {
  const pagina = read('../src/pages/AdminDashboardPage.vue')

  it('en «Casos» asigna caso y en «Auditorías» abre el formulario de auditoría', () => {
    assert.match(pagina, /v-if="pestana === 'casos'"[\s\S]*?label="Asignar caso"/)
    assert.match(
      pagina,
      /v-else[\s\S]*?label="Asignar auditoría"[\s\S]*?@click="dialogoAuditoriaAbierto = true"/,
    )
    assert.match(
      pagina,
      /<AuditoriaFormDialog[\s\S]*?v-model="dialogoAuditoriaAbierto"[\s\S]*?:contadores="contadores"[\s\S]*?es-admin[\s\S]*?@registrada="alAsignarAuditoria"/,
    )
  })

  it('al registrar avisa y vuelve a cargar el tablero', () => {
    assert.match(pagina, /<TableroAuditorias ref="tablero"/)
    assert.match(
      pagina,
      /const alAsignarAuditoria = [\s\S]*?Auditoría asignada[\s\S]*?tablero\.value\?\.cargar\(\)/,
    )
    const tablero = read('../src/components/TableroAuditorias.vue')
    assert.match(tablero, /defineExpose\(\{ cargar \}\)/)
  })
})

describe('Dashboard: tiempo real y encabezado por pestaña', () => {
  const pagina = read('../src/pages/AdminDashboardPage.vue')
  const tablero = read('../src/components/TableroAuditorias.vue')

  it('el tablero se recarga en silencio al llegar «auditoria-actualizada» o al reconectar', () => {
    assert.match(tablero, /eventos\.escuchar\('auditoria-actualizada', refrescarEnSilencio\)/)
    assert.match(tablero, /eventos\.escuchar\('reconectado', refrescarEnSilencio\)/)
    assert.match(tablero, /onBeforeUnmount\(/)
    const silencioso = tablero.slice(
      tablero.indexOf('const refrescarEnSilencio'),
      tablero.indexOf('onActivated('),
    )
    assert.match(silencioso, /listarAuditorias\(\)/)
    assert.doesNotMatch(silencioso, /cargando\.value = true/, 'sin loader: la vista no parpadea')
  })

  it('el texto del encabezado cambia con la pestaña', () => {
    assert.match(
      pagina,
      /<p v-if="pestana === 'casos'" class="dashboard-page__lead">\s*Revisa cuántos casos importantes tiene/,
    )
    assert.match(
      pagina,
      /<p v-else class="dashboard-page__lead">\s*Revisa el avance de todas las auditorías/,
    )
  })
})

describe('Kanban: reporte para imprimir o guardar en PDF', () => {
  const tablero = read('../src/components/TableroAuditorias.vue')
  const kanban = tablero.slice(
    tablero.indexOf('<q-tab-panel name="kanban"'),
    tablero.indexOf('</q-tab-panels>'),
  )
  const impresion = tablero.slice(tablero.indexOf('@media print'))

  it('el botón «Imprimir reporte» abre el diálogo de impresión del navegador', () => {
    assert.match(kanban, /label="Imprimir reporte"[\s\S]*?@click="imprimirReporte"/)
    assert.match(tablero, /const imprimirReporte = \(\) => window\.print\(\)/)
  })

  it('el reporte lleva título, fecha de corte y totales, solo en la hoja impresa', () => {
    assert.match(
      kanban,
      /class="reporte-kanban"[\s\S]*?Reporte Kanban de auditorías[\s\S]*?Corte al \{\{ fechaCorte \}\}/,
    )
    assert.match(
      tablero,
      /const fechaCorte = computed\(\(\) => fechaParaFormulario\(hoyLocal\(\)\)\)/,
    )
    assert.match(tablero, /\.reporte-kanban \{\s*display: none;/)
    assert.match(impresion, /\.reporte-kanban \{\s*display: block;/)
  })

  it('al imprimir solo sale el Kanban, en hoja horizontal y con las 6 columnas', () => {
    for (const selector of [
      '.q-drawer',
      '.q-header',
      '.page-header',
      '.q-btn',
      '.q-tabs',
      '.dashboard-page__head',
    ]) {
      assert.ok(impresion.includes(`body:has(.kanban) ${selector}`), `oculta ${selector}`)
    }
    assert.match(tablero, /@page kanban \{\s*size: landscape;/)
    // La página horizontal es de todo el documento: así no hay hojas en blanco antes ni después
    assert.match(impresion, /:global\(body:has\(\.kanban\)\) \{\s*page: kanban;/)
    assert.match(
      impresion,
      /\.kanban \{[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\);[\s\S]*?overflow: visible;/,
    )
    assert.match(impresion, /\.kanban__tarjeta \{[\s\S]*?break-inside: avoid;/)
    // Sin altura mínima de pantalla (hoja en blanco al final) ni el ancho de tableta (720 px)
    assert.match(impresion, /body:has\(\.kanban\) \.q-layout\)[\s\S]*?min-height: 0 !important;/)
    assert.match(
      impresion,
      /body:has\(\.kanban\) \.dashboard-page__inner\) \{\s*max-width: none !important;/,
    )
  })
})
