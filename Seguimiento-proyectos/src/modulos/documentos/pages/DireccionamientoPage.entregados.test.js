/**
 * Rebanada 47 (vuelta 2): Direccionamiento muestra una sola tabla; el toggle «Mostrar entregados»
 * agrega los entregados del mes elegido. Pruebas de texto sobre la plantilla y el servicio:
 * node no carga `.vue`.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const leer = (ruta) => fs.readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8')
const PAGINA = leer('./DireccionamientoPage.vue')
const API = leer('../servicios/api.js')

const entre = (inicio, cierre, fuente = PAGINA) => {
  const desde = fuente.indexOf(inicio)
  assert.notEqual(desde, -1, `no se encontró «${inicio}»`)
  const hasta = fuente.indexOf(cierre, desde)
  assert.notEqual(hasta, -1, `no se encontró «${cierre}»`)
  return fuente.slice(desde, hasta)
}

const TABLA = () => entre('<q-table', '</q-table>')
const COLUMNAS = () => entre('const columns = [', '\n]\n')

describe('servicio obtenerEntregados', () => {
  test('pide /doc/documentos/entregados con el mes codificado', () => {
    assert.match(API, /export async function obtenerEntregados\s*\(\s*mes\s*\)/)
    assert.match(
      API,
      /get\(`\$\{BASE_DOC\}\/documentos\/entregados\?mes=\$\{encodeURIComponent\(mes\)\}`\)/,
    )
  })
})

describe('una sola tabla, sin pestañas', () => {
  test('no quedan pestañas ni ?tab en la página', () => {
    for (const rastro of ['q-tabs', 'q-tab-panel', 'tabDeQuery', 'query.tab', 'useRoute']) {
      assert.ok(!PAGINA.includes(rastro), `sigue habiendo «${rastro}»`)
    }
    assert.equal((PAGINA.match(/<q-table\b/g) || []).length, 1)
  })

  test('el toggle «Mostrar entregados» está en la barra de filtros, apagado y con tooltip claro', () => {
    const barra = entre('<!-- Filtros y Tabla -->', '<q-table')
    assert.match(barra, /<q-toggle[^>]*v-model="mostrarEntregados"/)
    assert.match(barra, /label="Mostrar entregados"/)
    assert.match(
      barra,
      /Agrega\s+a\s+la\s+tabla\s+los\s+documentos\s+que\s+ya\s+se\s+entregaron\s+al\s+contador/,
    )
    assert.match(PAGINA, /const mostrarEntregados = ref\(false\)/)
  })

  test('el selector «Mes de entrega» solo aparece con el toggle encendido', () => {
    const selector = entre('v-model="mesEntrega"', '</q-select>')
    const apertura = PAGINA.lastIndexOf('<q-select', PAGINA.indexOf('v-model="mesEntrega"'))
    assert.match(
      PAGINA.slice(apertura, apertura + 120),
      /v-if="mostrarEntregados"|^<q-select\s+v-if/,
    )
    assert.match(selector, /label="Mes de entrega"/)
    assert.match(selector, /class="[^"]*selector-moderno/)
    assert.match(PAGINA, /ultimosPeriodos\(new Date\(\), 12\)/)
  })
})

describe('filas combinadas', () => {
  test('la tabla usa las filas combinadas y filtradas con la lógica pura', () => {
    assert.match(TABLA(), /:rows="filasTabla"/)
    assert.match(
      PAGINA,
      /combinarFilas\(\s*rowsFiltrados\.value,\s*mostrarEntregados\.value \? entregadosFiltrados\.value : \[\],?\s*\)/,
    )
    assert.match(PAGINA, /filtrarFilas\(entregados\.value,/)
  })

  test('los entregados solo se piden con el toggle encendido y se recargan al cambiar de mes', () => {
    assert.match(PAGINA, /obtenerEntregados\(mesEntrega\.value\)/)
    assert.match(PAGINA, /watch\(\[mostrarEntregados,\s*mesEntrega\]/)
    assert.match(PAGINA, /if \(!mostrarEntregados\.value\)/)
  })

  test('al confirmar una entrega se recargan los pendientes y, con el toggle, los entregados', () => {
    const cuerpo = entre('const confirmarEntrega = async', '// Carga inicial')
    assert.match(cuerpo, /cargarPendientes\(\)/)
    assert.match(cuerpo, /cargarEntregados\(\)/)
  })

  test('la situación se escribe con texto: «Por entregar» o «Entregado el …»', () => {
    const celda = entre('#body-cell-situacion', '</template>')
    assert.match(celda, /Por entregar/)
    assert.match(celda, /Entregado el/)
    assert.match(celda, /formatearFechaHora\(props\.row\.fechaEntrega\)/)
  })

  test('una fila entregada solo tiene «Ver detalle»: el botón de firma es de los por entregar', () => {
    const acciones = entre('#body-cell-acciones', '</q-td>')
    assert.match(acciones, /v-if="props\.row\.situacion === 'por-entregar'"[\s\S]*icon="draw"/)
    assert.match(acciones, /verDetalle\(props\.row\)/)
    assert.match(acciones, /<q-tooltip>Ver detalle del documento<\/q-tooltip>/)
  })

  test('las tarjetas y la relación imprimible siguen siendo solo de lo pendiente', () => {
    assert.match(PAGINA, /resumirPendientes\(rows\.value,/)
    assert.match(entre('<table class="tabla-relacion"', '</table>'), /v-for="row in rowsFiltrados"/)
  })

  test('mensajes claros con y sin entregados', () => {
    assert.match(TABLA(), /no-results-label=/)
    assert.match(PAGINA, /:no-data-label="mensajeTablaVacia"/)
    assert.match(PAGINA, /No hay documentos pendientes de entrega/)
  })
})

describe('tabla sin desborde', () => {
  test('Acciones nunca se oculta', () => {
    const bloque = entre("name: 'acciones'", '}', COLUMNAS())
    assert.doesNotMatch(bloque, /ocultar-/)
  })

  test('las columnas secundarias se ocultan por ancho', () => {
    for (const nombre of [
      'folio',
      'tipo',
      'situacion',
      'fechaRecepcion',
      'prioridad',
      'contador',
    ]) {
      const bloque = entre(`name: '${nombre}'`, '},', COLUMNAS())
      assert.match(bloque, /ocultar-(en-xs|bajo-lg|bajo-md|bajo-xl)/, nombre)
    }
  })

  test('en móvil la situación y el folio pasan a un subtítulo bajo el cliente', () => {
    const celda = entre('#body-cell-cliente', '</template>')
    assert.match(celda, /solo-en-xs/)
    assert.match(celda, /props\.row\.folio/)
  })
})

describe('detalle de una entrega', () => {
  test('muestra fecha de entrega, quién entregó y la observación', () => {
    const detalle = entre('<!-- Diálogo de Detalle del Documento -->', '</q-dialog>')
    for (const campo of ['fechaEntrega', 'entregadoPor', 'comentarios']) {
      assert.ok(detalle.includes(`documentoSeleccionado.${campo}`), campo)
    }
    assert.match(detalle, /Entregado el:/)
    assert.match(detalle, /Entregado por:/)
    assert.match(detalle, /Observación de la entrega:/)
  })

  test('no interpreta fechas AAAA-MM-DD con new Date (se correría un día)', () => {
    assert.ok(!/new Date\('\d{4}-\d{2}-\d{2}'\)/.test(PAGINA))
  })
})
