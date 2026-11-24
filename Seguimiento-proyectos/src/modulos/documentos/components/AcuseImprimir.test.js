/**
 * Oráculos de `AcuseImprimir.vue` para las correcciones de la feature de
 * impresión del acuse (Fase 6, vuelta 1 de 2): import estático,
 * cadena de construcción, z-index y protección de clics múltiples.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = readFileSync(fileURLToPath(new URL('./AcuseImprimir.vue', import.meta.url)), 'utf8')

/** Elimina comentarios para no confundir el oráculo con su documentación. */
function soloCodigo(fuente) {
  return fuente
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const CODIGO = soloCodigo(FUENTE)

describe('Corrección del import de html2pdf.js', () => {
  test('no usa import dinámico `await import(' + "'html2pdf.js'" + ')`', () => {
    assert.ok(
      !/await\s+import\s*\(\s*['"]html2pdf\.js['"]\s*\)/.test(CODIGO),
      'el import dinámico que fallaba en el dev server debe desaparecer',
    )
  })

  test('usa import estático de html2pdf.js', () => {
    assert.match(CODIGO, /import\s+html2pdf\s+from\s+['"]html2pdf\.js['"]/)
  })
})

describe('Cadena de construcción del PDF', () => {
  test('la cadena `.from().set().save()` va encadenada sin `await` intermedio', () => {
    // El defecto era `await html2pdf()` aislado antes de `.from()`; ahora la
    // expresión es una sola cadena (o se asigna y luego se guarda).
    assert.ok(
      /await\s+html2pdf\(\)\s*\.from\(/.test(CODIGO) || /await\s+[\w$]+\.save\(\)/.test(CODIGO),
      'la cadena debe ser continua: html2pdf -> from -> set -> save',
    )
  })
})

describe('Captura de la zona de impresión', () => {
  test('.zona-impresion no lleva z-index: -1', () => {
    const inicio = CODIGO.indexOf('.zona-impresion')
    assert.ok(inicio !== -1, 'no se encontró la clase .zona-impresion')
    const bloqueEstilo = CODIGO.slice(inicio, CODIGO.indexOf('}', inicio) + 1)
    assert.ok(
      !/z-index:\s*-1/.test(bloqueEstilo),
      'z-index: -1 ocultaría el elemento detrás del body y rompería html2canvas',
    )
  })
})

describe('Protección contra clics múltiples', () => {
  test('existe la bandera `generando`', () => {
    assert.match(CODIGO, /const\s+generando\s+=\s+ref\(false\)/)
  })

  test('el botón tiene `:disable="generando"`', () => {
    assert.match(FUENTE, /:disable="generando"/)
  })

  test('la guarda `if (generando.value) return` va antes del trabajo', () => {
    const cuerpo = CODIGO.slice(CODIGO.indexOf('const imprimirPdf'))
    const posGuarda = cuerpo.indexOf('if (generando.value) return')
    const posTrabajo = cuerpo.indexOf('.from(')
    assert.ok(posGuarda !== -1, 'falta la guarda de reentrada')
    assert.ok(posGuarda < posTrabajo, 'la guarda debe ir antes de iniciar el PDF')
  })
})

// Defecto real (2026-11-04): el acuse salía en BLANCO, al imprimirlo y al
// guardarlo. `html2pdf` clona el elemento de `.from()` dentro de su propio
// contenedor y lo fotografía ahí; el clon conservaba la clase `.zona-impresion`
// (`position: fixed; left: -10000px`), así que quedaba fuera del contenedor y la
// foto salía vacía. El PDF se genera desde la hoja interior, que no se desplaza.
describe('El PDF no sale en blanco', () => {
  test('no se fotografía la zona desplazada fuera de la pantalla', () => {
    assert.doesNotMatch(CODIGO, /\.from\(\s*zonaImpresion/)
  })

  test('se fotografía la hoja interior (.pagina-acuse)', () => {
    assert.match(CODIGO, /<div ref="paginaAcuse" class="pagina-acuse">/)
    assert.match(CODIGO, /\.from\(paginaAcuse\.value\)/)
  })

  test('la hoja lleva su propia tipografía y color (el clon no hereda de la zona)', () => {
    const inicio = CODIGO.indexOf('.pagina-acuse {')
    const bloque = CODIGO.slice(inicio, CODIGO.indexOf('}', inicio))
    assert.match(bloque, /font-family:/)
    assert.match(bloque, /color:/)
  })

  test('imprimir y guardar usan la misma configuración del PDF', () => {
    assert.match(CODIGO, /const opcionesPdf = /)
    assert.equal(
      (CODIGO.match(/jsPDF:/g) || []).length,
      1,
      'la configuración debe estar una sola vez',
    )
  })

  test('expone generarPdf, que devuelve el PDF como Blob para guardarlo', () => {
    assert.match(CODIGO, /defineExpose\(\{ generarPdf \}\)/)
    assert.match(CODIGO, /outputPdf\('blob'\)/)
  })
})

// Fase 1 (2026-11-13): el botón «Imprimir Acuse» llevaba un tooltip que repetía
// el aria-label y el label visible; la acción ya la comunican los dos.
describe('Botón de imprimir sin tooltip redundante', () => {
  test('el botón conserva su etiqueta visible', () => {
    assert.match(CODIGO, /label="Imprimir Acuse"/)
  })

  test('el botón conserva su aria-label en español', () => {
    assert.match(CODIGO, /aria-label="Imprimir acuse digital de recepción"/)
  })

  test('no queda ningún q-tooltip en el componente', () => {
    assert.doesNotMatch(CODIGO, /<q-tooltip/)
  })
})
