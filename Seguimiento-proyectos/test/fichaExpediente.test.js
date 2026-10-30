/*
 * Ficha tipo expediente — verificación estática: historia como tabla e «Imprimir ficha».
 * No monta Vue; comprueba cadenas clave de la bitácora y de la ficha.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

describe('Bitácora: historia como tabla', () => {
  const bitacora = read('../src/components/BitacoraAuditoria.vue')

  it('se elige entre línea de tiempo y tabla', () => {
    assert.match(bitacora, /<q-btn-toggle[\s\S]*?v-model="vista"/)
    assert.match(bitacora, /value: 'linea'[\s\S]*?value: 'tabla'/)
    assert.match(bitacora, /const vista = ref\('linea'\)/)
  })

  it('la tabla lleva las columnas del boceto, en orden', () => {
    const tabla = bitacora.slice(
      bitacora.indexOf('<q-markup-table'),
      bitacora.indexOf('</q-markup-table>'),
    )
    const encabezados = [...tabla.matchAll(/<th\b[^>]*>([^<]+)</g)].map((m) => m[1].trim())
    assert.deepEqual(encabezados, [
      'Fecha',
      'Evento',
      'Fase',
      'Folio',
      'Descripción',
      'Fecha límite',
      'Entrega',
      'Estado',
      '¿En tiempo?',
      'Comentarios',
    ])
    assert.match(tabla, /entregaEnTiempo\(ev\)/)
  })

  it('al imprimir siempre sale la tabla y no la línea de tiempo', () => {
    assert.match(bitacora, /:class="\{ 'bitacora__solo-impresion': vista !== 'tabla' \}"/)
    assert.match(
      bitacora,
      /@media print[\s\S]*?\.bitacora__solo-impresion[\s\S]*?display: (table|block)/,
    )
    assert.match(bitacora, /@media print[\s\S]*?\.bitacora__timeline[\s\S]*?display: none/)
  })
})

describe('Ficha: «Imprimir ficha»', () => {
  const ficha = read('../src/pages/AuditoriaFichaPage.vue')

  it('el botón imprime con el diálogo del navegador', () => {
    assert.match(ficha, /label="Imprimir ficha"[\s\S]*?@click="imprimir"/)
    assert.match(ficha, /const imprimir = \(\) => window\.print\(\)/)
  })

  it('al imprimir se ocultan el menú, la barra y los botones, solo en esta pantalla', () => {
    const impresion = ficha.slice(ficha.indexOf('@media print'))
    for (const selector of ['.q-drawer', '.q-header', '.q-btn']) {
      assert.ok(impresion.includes(`body:has(.ficha) ${selector}`), `oculta ${selector}`)
    }
  })
})

describe('Ficha: dos columnas en pantallas anchas', () => {
  const ficha = read('../src/pages/AuditoriaFichaPage.vue')

  it('la ficha usa todo el ancho y agrupa datos generales y bitácora', () => {
    assert.doesNotMatch(
      ficha.slice(ficha.indexOf('.ficha {'), ficha.indexOf('}', ficha.indexOf('.ficha {'))),
      /max-width/,
    )
    assert.match(
      ficha,
      /<div class="ficha__cuerpo">\s*<q-card flat bordered class="ficha__seccion ficha__datos-generales">/,
    )
    assert.match(ficha, /class="ficha__seccion ficha__bitacora"[\s\S]*?<BitacoraAuditoria/)
  })

  it('desde 1280 px los datos generales van a la derecha, fijos al bajar', () => {
    const ancho = ficha.slice(ficha.indexOf('@media (min-width: 1280px)'))
    assert.match(
      ancho,
      /\.ficha__cuerpo \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 380px\)/,
    )
    assert.match(ancho, /\.ficha__datos-generales \{[\s\S]*?position: sticky/)
  })
})

describe('Bitácora: eventos en un scroll area desde 1024 px', () => {
  const bitacora = read('../src/components/BitacoraAuditoria.vue')

  it('los eventos van en QScrollArea de 600 px solo en escritorio', () => {
    assert.match(bitacora, /import \{ QScrollArea, useQuasar \} from 'quasar'/)
    assert.match(bitacora, /const conScroll = computed\(\(\) => \$q\.screen\.width >= 1024\)/)
    assert.match(
      bitacora,
      /<component\s+:is="conScroll \? QScrollArea : 'div'"[\s\S]*?class="bitacora__scroll"[\s\S]*?<q-timeline/,
    )
    assert.match(bitacora, /\.bitacora__scroll--fija \{\s*height: 600px;/)
  })

  it('el encabezado y el formulario quedan fuera del scroll', () => {
    const scroll = bitacora.indexOf('class="bitacora__scroll"')
    assert.ok(bitacora.indexOf('<q-btn-toggle') < scroll, 'el selector de vista queda arriba')
    assert.ok(bitacora.indexOf('bitacora__form-card') < scroll, 'el formulario queda arriba')
  })

  it('al imprimir el scroll area se suelta y sale la bitácora completa', () => {
    const impresion = bitacora.slice(bitacora.indexOf('@media print'))
    assert.match(
      impresion,
      /\.bitacora__scroll \{[\s\S]*?height: auto !important;[\s\S]*?contain: none/,
    )
    assert.match(impresion, /:deep\(\.q-scrollarea__content\)[\s\S]*?position: static !important/)
  })
})
