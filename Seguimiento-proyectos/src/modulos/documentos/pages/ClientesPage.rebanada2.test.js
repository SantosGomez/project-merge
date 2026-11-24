import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const PLANTILLA = fs.readFileSync(
  fileURLToPath(new URL('./ClientesPage.vue', import.meta.url)),
  'utf8',
)

// Devuelve el trozo de plantilla que va desde el selector de periodo hasta
// el cierre de la tarjeta de filtros, para no confundirlo con otros q-select.
const bloquePeriodo = () => {
  const inicio = PLANTILLA.indexOf('v-model="periodo"')
  const fin = PLANTILLA.indexOf('</q-input>', inicio)
  return PLANTILLA.slice(inicio, fin)
}

describe('Clientes — rebanada 2: selector moderno, buscador y acciones legibles', () => {
  test('el selector de periodo lleva el patrón moderno completo', () => {
    const bloque = bloquePeriodo()
    assert.match(bloque, /class="[^"]*selector-moderno/)
    assert.match(bloque, /options-dense/)
    assert.match(bloque, /dropdown-icon="expand_more"/)
    assert.match(bloque, /popup-content-class="menu-seleccion-custom"/)
    assert.match(bloque, /transition-show="jump-down"/)
    assert.match(bloque, /transition-hide="jump-up"/)
    assert.match(bloque, /#prepend/)
    assert.match(bloque, /#selected-item="scope"/)
    assert.match(bloque, /scope\.opt\?\.label \?\? scope\.opt/)
    assert.match(bloque, /#option="\{ itemProps, opt, selected \}"/)
    assert.match(bloque, /opcion-seleccionada/)
  })

  test('el selector conserva emit-value y map-options (el periodo es "YYYY-MM")', () => {
    const bloque = bloquePeriodo()
    assert.match(bloque, /emit-value/)
    assert.match(bloque, /map-options/)
  })

  test('el buscador usa el estilo moderno compartido', () => {
    const inicio = PLANTILLA.indexOf('v-model="busqueda"')
    const bloque = PLANTILLA.slice(inicio, PLANTILLA.indexOf('</q-input>', inicio))
    assert.match(bloque, /class="[^"]*input-busqueda-moderno/)
  })

  test('el recordatorio usa un color legible: nunca $secondary como icono plano', () => {
    const inicio = PLANTILLA.indexOf('<!-- Acciones -->')
    const bloque = PLANTILLA.slice(inicio, PLANTILLA.indexOf('</q-table>', inicio))
    assert.ok(
      !/color="secondary"/.test(bloque),
      'Ningún botón de acción debe usar color="secondary" (2.14:1 sobre blanco)',
    )
    assert.match(
      bloque,
      /icon="send"[\S\s]{0,160}color="primary"/,
      'El botón de recordatorio debe usar color="primary"',
    )
  })

  test('el encabezado envuelve en móvil en vez de encogerse', () => {
    const inicio = PLANTILLA.indexOf('<!-- Encabezado -->')
    const fin = PLANTILLA.indexOf('<!-- Filtros -->', inicio)
    const bloque = PLANTILLA.slice(inicio, fin)
    assert.match(bloque, /class="col-12 col-sm"/)
    assert.match(bloque, /class="col-12 col-sm-auto/)
  })

  test('la tabla mantiene las columnas responsivas que ocultan datos en móvil', () => {
    assert.match(PLANTILLA, /:class="\['badge-semaforo'/)
    assert.match(PLANTILLA, /ocultar-en-xs/)
    assert.match(PLANTILLA, /mensajeTablaVacia/)
  })
})
