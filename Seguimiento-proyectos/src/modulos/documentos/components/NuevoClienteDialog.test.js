import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const COMPONENTE = fs.readFileSync(
  fileURLToPath(new URL('./NuevoClienteDialog.vue', import.meta.url)),
  'utf8',
)
const PLANTILLA = COMPONENTE.replace(/<!--[\s\S]*?-->/g, '')

describe('NuevoClienteDialog — modo edición del cliente', () => {
  test('recibe el cliente a editar como prop opcional', () => {
    assert.match(COMPONENTE, /cliente: \{ type: Object, default: null \}/)
  })

  test('el título y el botón cambian al editar', () => {
    assert.match(PLANTILLA, /Editar cliente/)
    assert.match(PLANTILLA, /Guardar cambios/)
    assert.match(PLANTILLA, /Nuevo cliente/)
    assert.match(PLANTILLA, /Guardar cliente/)
  })

  test('el interruptor «Cliente activo» solo aparece al editar', () => {
    const inicio = PLANTILLA.indexOf('Cliente activo')
    assert.notEqual(inicio, -1)
    const bloque = PLANTILLA.slice(Math.max(0, inicio - 400), inicio + 400)
    assert.match(bloque, /<q-toggle/)
    assert.match(bloque, /v-if="esEdicion"/)
  })

  test('precarga los datos del cliente al abrir', () => {
    assert.match(COMPONENTE, /esEdicion/)
    assert.match(COMPONENTE, /props\.cliente\.razonSocial/)
    assert.match(COMPONENTE, /props\.cliente\.contadorId/)
    assert.match(COMPONENTE, /props\.cliente\.activo/)
  })

  test('al editar guarda con editarClienteDocumento y envía activo', () => {
    assert.match(
      COMPONENTE,
      /editarClienteDocumento\(props\.cliente\.id, \{ \.\.\.payload, activo: form\.activo \}\)/,
    )
  })

  test('sin cambios, «Guardar cambios» cierra sin enviar nada', () => {
    assert.match(COMPONENTE, /if \(esEdicion\.value && !hayDatosSinGuardar\.value\)/)
  })

  test('conserva el patrón de formularios: descartar, persistent y shake', () => {
    assert.match(COMPONENTE, /¿Descartar los cambios\?/)
    assert.match(PLANTILLA, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(PLANTILLA, /@shake="pedirDescartar"/)
    assert.match(PLANTILLA, /aria-hidden="true" class="text-negative">\*/)
  })

  test('el modo edición no marca cambios si los datos siguen igual que el cliente', () => {
    assert.match(COMPONENTE, /datosIniciales/)
  })

  test('al fallar la validación enfoca el primer campo con error', () => {
    assert.match(COMPONENTE, /enfocarPrimerError/)
    assert.match(COMPONENTE, /if \(!validarFormulario\(\)\) \{\s*enfocarPrimerError\(\)/)
    assert.match(COMPONENTE, /document\.getElementById\(`doc-cliente-\$\{/)
  })
})
