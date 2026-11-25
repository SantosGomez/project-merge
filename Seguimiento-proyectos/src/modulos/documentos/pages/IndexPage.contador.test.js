import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = fs.readFileSync(fileURLToPath(new URL('./IndexPage.vue', import.meta.url)), 'utf8')
const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')
const CODIGO = PLANTILLA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const campoContador = () => {
  const desde = PLANTILLA.indexOf('v-model="form.contadorAsignado"')
  assert.notEqual(desde, -1, 'no se encontró el selector del contador')
  return PLANTILLA.slice(
    PLANTILLA.lastIndexOf('<q-select', desde),
    PLANTILLA.indexOf('</q-select>', desde),
  )
}

describe('Recepción — contador asignado obligatorio (rebanada 44)', () => {
  test('ya no es opcional: etiqueta visible con asterisco, sin «(opcional)», y regla', () => {
    const campo = campoContador()
    assert.doesNotMatch(campo, /\(opcional\)/i)
    // La etiqueta va en la propiedad `label` (como «Prioridad *»): el slot #label no se pintaba
    assert.match(campo, /\slabel="Contador asignado \*"/)
    assert.match(campo, /:rules="\[\(val\) => !!val \|\| '[^']+'\]"/)
  })

  test('las opciones son { value: id, label: nombre } con emit-value y map-options', () => {
    const campo = campoContador()
    assert.match(campo, /emit-value/)
    assert.match(campo, /map-options/)
    assert.match(
      CODIGO,
      /opcionesContadores = computed\(\(\) =>\s*catalogos\.contadores\.map\(\(c\) => \(\{ value: c\.id, label: c\.nombre \}\)\)/,
    )
  })

  test('el formulario envía contadorId al guardar', () => {
    const inicio = CODIGO.indexOf('const datos = {')
    const bloque = CODIGO.slice(inicio, CODIGO.indexOf('adjuntos:', inicio))
    assert.match(bloque, /contadorId: form\.contadorAsignado/)
  })

  test('al elegir cliente se propone su contador habitual y no queda el nombre fijo de la maqueta', () => {
    assert.doesNotMatch(CODIGO, /Carlos Ruiz/)
    const inicio = CODIGO.indexOf('const onClienteChange')
    const bloque = CODIGO.slice(inicio, CODIGO.indexOf('\n}', inicio))
    assert.match(bloque, /contadorPropuesto\(/)
    assert.match(bloque, /catalogos\.clientes\.find/)
    assert.match(bloque, /catalogos\.contadores/)
    assert.match(
      CODIGO,
      /contadorPropuesto[^\n]*from '@\/modulos\/documentos\/composables\/autollenado\.js'|from '@\/modulos\/documentos\/composables\/autollenado\.js'/,
    )
  })

  test('el autollenado también propone el contador porque llama a onClienteChange tras la plantilla', () => {
    const inicio = CODIGO.indexOf('const onAutollenadoConfirmar')
    const bloque = CODIGO.slice(inicio, CODIGO.indexOf('mostrarAutollenado.value = false', inicio))
    assert.ok(bloque.indexOf('aplicarPlantilla') < bloque.indexOf('onClienteChange'))
  })
})
