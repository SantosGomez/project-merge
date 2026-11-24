import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('.', import.meta.url))
const COMPONENTE = fs.readFileSync(`${RAIZ}AutollenadoDialogo.vue`, 'utf8')

const PLANTILLA = COMPONENTE.replace(/<!--[\s\S]*?-->/g, '')
const CODIGO = COMPONENTE.replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const bloqueSelect = (marca) => {
  const inicio = PLANTILLA.indexOf(marca)
  assert.notEqual(inicio, -1, `no se encontró el q-select de ${marca}`)
  const fin = PLANTILLA.indexOf('</q-select>', inicio)
  return PLANTILLA.slice(inicio, fin)
}

describe('AutollenadoDialogo — modal de cliente frecuente y tipo de recepción', () => {
  test('es un modal controlado por v-model', () => {
    assert.match(PLANTILLA, /<q-dialog/)
    assert.match(PLANTILLA, /:model-value="modelValue"/)
    assert.match(CODIGO, /update:modelValue/)
  })

  test('declara las props y los eventos que usa IndexPage', () => {
    assert.match(CODIGO, /clientes: \{ type: Array, default: \(\) => \[\] \}/)
    assert.match(CODIGO, /tipos: \{ type: Array, default: \(\) => \[\] \}/)
    assert.match(CODIGO, /'confirmar'/)
  })

  test('el selector de cliente sigue el patrón moderno completo', () => {
    const bloque = bloqueSelect('v-model="clienteElegido"')
    assert.match(bloque, /class="[^"]*selector-moderno/)
    assert.match(bloque, /options-dense/)
    assert.match(bloque, /dropdown-icon="expand_more"/)
    assert.match(bloque, /popup-content-class="menu-seleccion-custom"/)
    assert.match(bloque, /transition-show="jump-down"/)
    assert.match(bloque, /transition-hide="jump-up"/)
    assert.match(bloque, /#selected-item="scope"/)
    assert.match(bloque, /#option="\{ itemProps, opt, selected \}"/)
    assert.match(bloque, /opcion-seleccionada/)
    assert.match(bloque, /emit-value/)
    assert.match(bloque, /map-options/)
  })

  test('el selector de tipo de recepción sigue el mismo patrón', () => {
    const bloque = bloqueSelect('v-model="tipoElegido"')
    assert.match(bloque, /class="[^"]*selector-moderno/)
    assert.match(bloque, /options-dense/)
    assert.match(bloque, /popup-content-class="menu-seleccion-custom"/)
    assert.match(bloque, /#selected-item="scope"/)
    assert.match(bloque, /#option="\{ itemProps, opt, selected \}"/)
  })

  test('los dos selectores tienen tooltip de ayuda', () => {
    const tooltips = PLANTILLA.match(/<q-tooltip[\s>]/g) || []
    assert.ok(tooltips.length >= 2, 'faltan los tooltips de los dos selectores')
  })

  test('Aplicar se deshabilita hasta elegir cliente y tipo', () => {
    assert.match(CODIGO, /const puedeAplicar = computed/)
    assert.match(PLANTILLA, /label="Aplicar"/)
    assert.match(PLANTILLA, /:disable="!puedeAplicar"/)
  })

  test('confirmar emite el cliente y el tipo elegidos, y cierra el modal', () => {
    assert.match(CODIGO, /emit\('confirmar', \{[\s\S]*?clienteId[\s\S]*?tipoRecepcion[\s\S]*?\}\)/)
    assert.match(CODIGO, /emit\('update:modelValue', false\)/)
  })

  test('al abrirse limpia la selección anterior', () => {
    assert.match(CODIGO, /watch\(\s*\(\) => props\.modelValue/)
  })
})
