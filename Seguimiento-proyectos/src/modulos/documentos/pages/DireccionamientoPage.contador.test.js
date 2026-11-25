import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = fs.readFileSync(
  fileURLToPath(new URL('./DireccionamientoPage.vue', import.meta.url)),
  'utf8',
)
const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')
const CODIGO = PLANTILLA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('Direccionamiento — el contador asignado es el que recibe (rebanada 44)', () => {
  test('con contador asignado se muestra como texto fijo, con icono y nombre, sin selector', () => {
    const desde = PLANTILLA.indexOf('v-if="contadorFijo"')
    assert.notEqual(desde, -1, 'falta el bloque de contador fijo')
    const bloque = PLANTILLA.slice(desde, PLANTILLA.indexOf('<q-select', desde))
    assert.match(bloque, /Contador que recibe la documentación/)
    assert.match(bloque, /<q-icon[^>]*aria-hidden="true"/)
    assert.match(bloque, /\{\{ documentoSeleccionado\.contador \}\}/)
    assert.doesNotMatch(bloque, /<q-select/)
  })

  test('el selector solo aparece si el documento no trae contador (v-else)', () => {
    const desde = PLANTILLA.indexOf('v-model="contadorEntrega"')
    const apertura = PLANTILLA.slice(PLANTILLA.lastIndexOf('<q-select', desde), desde)
    assert.match(apertura, /v-else/)
  })

  test('contadorFijo depende de que el documento traiga contadorId', () => {
    assert.match(
      CODIGO,
      /const contadorFijo = computed\(\(\) =>[^\n]*documentoSeleccionado\.value\?\.contadorId/,
    )
  })

  test('la notificación de éxito usa el nombre del contador fijo', () => {
    const inicio = CODIGO.indexOf('const nombreContador')
    const bloque = CODIGO.slice(inicio, CODIGO.indexOf('await entregarDocumento', inicio))
    assert.match(bloque, /contadorFijo\.value/)
    assert.match(bloque, /documentoSeleccionado\.value\.contador/)
  })

  test('el encabezado de la tabla y de la relación imprimible dice «Contador asignado»', () => {
    assert.doesNotMatch(PLANTILLA, /Contador sugerido/)
    assert.match(PLANTILLA, /<th>Contador asignado<\/th>/)
    assert.match(CODIGO, /label: 'Contador asignado'/)
  })
})
