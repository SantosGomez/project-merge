import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const PLANTILLA = fs.readFileSync(
  fileURLToPath(new URL('./DireccionamientoPage.vue', import.meta.url)),
  'utf8',
)

const ESTILOS = PLANTILLA.slice(PLANTILLA.indexOf('<style'))

const entre = (inicio, cierre) => {
  const desde = PLANTILLA.indexOf(inicio)
  return PLANTILLA.slice(desde, PLANTILLA.indexOf(cierre, desde))
}

describe('Direccionamiento — rebanada 5: filtros modernos, encabezado y métricas responsivas', () => {
  test('el encabezado envuelve en móvil en vez de encogerse', () => {
    const bloque = entre('<!-- Encabezado -->', '<!-- Tarjetas:')
    assert.match(bloque, /class="col-12 col-sm"/)
    assert.match(bloque, /class="col-12 col-sm-auto/)
  })

  test('las métricas pasan a 2 por fila en tablet y 3 en escritorio', () => {
    const bloque = entre('<!-- Tarjetas:', '<!-- Filtros y Tabla -->')
    const columnas = bloque.match(/col-12 col-sm-6 col-md-4/g) || []
    assert.equal(columnas.length, 3, 'Las 3 tarjetas deben usar col-12 col-sm-6 col-md-4')
    assert.ok(!/col-12 col-sm-4/.test(bloque))
  })

  test('el buscador usa el estilo moderno compartido', () => {
    const bloque = entre('v-model="busqueda"', '</q-input>')
    assert.match(bloque, /class="[^"]*input-busqueda-moderno/)
  })

  test('los filtros de cliente y contador usan el patrón moderno', () => {
    for (const campo of ['filtroCliente', 'filtroContador']) {
      const bloque = entre(`v-model="${campo}"`, '</q-select>')
      assert.match(bloque, /class="[^"]*selector-moderno/, `${campo} sin selector-moderno`)
      assert.match(bloque, /dropdown-icon="expand_more"/, `${campo} sin chevron`)
      assert.match(bloque, /popup-content-class="menu-seleccion-custom"/, `${campo} sin menú`)
      assert.match(bloque, /#selected-item="scope"/, `${campo} sin #selected-item`)
      assert.match(bloque, /#option="\{ itemProps, opt, selected \}"/, `${campo} sin #option`)
      assert.match(bloque, /opcion-seleccionada/, `${campo} sin marca de opción`)
    }
  })

  test('el selector del contador que recibe la entrega usa el patrón completo', () => {
    const bloque = entre('v-model="contadorEntrega"', '</q-select>')
    assert.match(bloque, /class="[^"]*selector-moderno/)
    assert.match(bloque, /dropdown-icon="expand_more"/)
    assert.match(bloque, /popup-content-class="menu-seleccion-custom"/)
    assert.match(bloque, /#selected-item="scope"/)
    assert.match(bloque, /#option="\{ itemProps, opt, selected \}"/)
    assert.match(bloque, /emit-value/)
    assert.match(bloque, /map-options/)
    assert.match(bloque, /scope\.opt\?\.label \?\? scope\.opt/)
  })

  test('los filtros no desbordan en móvil: anchos elásticos con tope', () => {
    const bloque = ESTILOS.slice(
      ESTILOS.indexOf('.filtro-cliente,'),
      ESTILOS.indexOf('.style-signature-canvas'),
    )
    assert.match(bloque, /flex:/)
    assert.match(bloque, /max-width:\s*100%/)
  })

  test('la prioridad y la situación usan las píldoras claras compartidas (el texto sigue visible)', () => {
    assert.match(PLANTILLA, /estiloDePrioridadDocumento\(props\.value\)\.chip/)
    assert.doesNotMatch(PLANTILLA, /getPrioridadFondo|getPrioridadTexto|fondo-prioridad-baja/)
    assert.doesNotMatch(PLANTILLA, /class="bg-(positive|info) text-primary/)
    assert.match(PLANTILLA, /chip-doc chip-doc--completado/)
    assert.match(PLANTILLA, /chip-doc chip-doc--en-proceso/)
  })
})
