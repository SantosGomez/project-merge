import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('.', import.meta.url))
const PAGINA = fs.readFileSync(`${RAIZ}IndexPage.vue`, 'utf8')
const SELECTOR = fs.readFileSync(`${RAIZ}../components/SelectorClienteDialogo.vue`, 'utf8')

const bloquesSelect = () =>
  [...PAGINA.matchAll(/<q-select\b[\s\S]*?<\/q-select>/g)].map((m) => m[0])

const entre = (fuente, inicio, cierre) => {
  const desde = fuente.indexOf(inicio)
  return fuente.slice(desde, fuente.indexOf(cierre, desde))
}

describe('Recepción — rebanada 4: selectores modernos y formulario responsivo', () => {
  test('los seis selectores del formulario usan el patrón moderno completo', () => {
    const bloques = bloquesSelect()
    assert.ok(bloques.length >= 6, `Se esperaban al menos 6 q-select, hay ${bloques.length}`)
    bloques.forEach((bloque, i) => {
      const campo = bloque.match(/v-model="(form\.[a-zA-Z]+)"/)?.[1] || `#${i}`
      assert.match(bloque, /class="[^"]*selector-moderno/, `${campo} sin selector-moderno`)
      assert.match(bloque, /options-dense/, `${campo} sin options-dense`)
      assert.match(bloque, /dropdown-icon="expand_more"/, `${campo} sin chevron`)
      assert.match(
        bloque,
        /popup-content-class="menu-seleccion-custom"/,
        `${campo} sin menú flotante`,
      )
      assert.match(bloque, /transition-show="jump-down"/, `${campo} sin transición de entrada`)
      assert.match(bloque, /transition-hide="jump-up"/, `${campo} sin transición de salida`)
      assert.match(bloque, /#selected-item="scope"/, `${campo} sin #selected-item`)
      assert.match(bloque, /#option="\{ itemProps, opt, selected \}"/, `${campo} sin #option`)
      assert.match(bloque, /opcion-seleccionada/, `${campo} sin marca de opción elegida`)
    })
  })

  test('la prioridad conserva el semáforo y el texto (el color no es el único canal)', () => {
    const bloque = entre(PAGINA, 'v-model="form.prioridad"', '</q-select>')
    assert.match(bloque, /getPrioridadFondo/)
    assert.match(bloque, /opt\?\.label \?\? opt|opt\?\.value \?\? opt/)
    assert.match(bloque, /punto-estado-sm/)
  })

  test('el campo de cliente usa el estilo moderno de selectores', () => {
    const bloque = entre(PAGINA, 'ref="campoCliente"', '</q-input>')
    assert.match(bloque, /class="[^"]*selector-moderno/)
  })

  test('la fila de prioridad, SLA y contador pasa a 2 por fila en tablet', () => {
    const bloque = entre(PAGINA, '3. Prioridad y entrega', '<!-- Archivos y firmas')
    const columnas = bloque.match(/col-12 col-sm-6 col-md-4/g) || []
    assert.equal(columnas.length, 3, 'Las tres columnas deben usar col-12 col-sm-6 col-md-4')
  })

  test('el buscador del modal de clientes usa el estilo moderno', () => {
    const bloque = entre(SELECTOR, 'v-model="termino"', '</q-input>')
    assert.match(bloque, /class="[^"]*input-busqueda-moderno/)
  })

  test('el modal de clientes sigue siendo a pantalla completa en móvil', () => {
    assert.match(SELECTOR, /:maximized="\$q\.screen\.lt\.sm"/)
    assert.match(SELECTOR, /col-12 col-sm-6 col-md-4 col-lg-3/)
  })
})
