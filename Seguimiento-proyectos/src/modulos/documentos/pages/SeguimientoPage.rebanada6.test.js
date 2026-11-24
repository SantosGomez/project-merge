import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const PLANTILLA = fs.readFileSync(
  fileURLToPath(new URL('./SeguimientoPage.vue', import.meta.url)),
  'utf8',
)

describe('Seguimiento — rebanada 6: buscador y resumen responsivos', () => {
  test('los bloques de resumen pasan a 2 por fila en tablet y 3 en escritorio', () => {
    const bloque = PLANTILLA.slice(
      PLANTILLA.indexOf('<!-- Encabezado:'),
      PLANTILLA.indexOf('<!-- Buscador:'),
    )
    const columnas = bloque.match(/col-12 col-sm-6 col-md-4/g) || []
    assert.equal(columnas.length, 3, 'Los 3 bloques deben usar col-12 col-sm-6 col-md-4')
  })

  test('el buscador usa el estilo moderno compartido', () => {
    const bloque = PLANTILLA.slice(
      PLANTILLA.indexOf('v-model="queryBusqueda"'),
      PLANTILLA.indexOf('</q-input>', PLANTILLA.indexOf('v-model="queryBusqueda"')),
    )
    assert.match(bloque, /class="[^"]*input-busqueda-moderno/)
  })

  test('el buscador y el botón se apilan en móvil en vez de comprimirse', () => {
    const bloque = PLANTILLA.slice(
      PLANTILLA.indexOf('<!-- Buscador:'),
      PLANTILLA.indexOf('<!-- Aviso del servidor'),
    )
    // El contenedor usa `row q-col-gutter-sm`, que ya envuelve en móvil;
    // el input ocupa la fila (`col`) y el botón es `col-auto`.
    assert.match(bloque, /class="col"/)
    assert.match(bloque, /class="col-auto"/)
  })

  test('el buscador conserva su aria-label y el icono de búsqueda', () => {
    const bloque = PLANTILLA.slice(
      PLANTILLA.indexOf('v-model="queryBusqueda"'),
      PLANTILLA.indexOf('</q-input>', PLANTILLA.indexOf('v-model="queryBusqueda"')),
    )
    assert.match(bloque, /aria-label=/)
    assert.match(bloque, /name="search"/)
  })
})
