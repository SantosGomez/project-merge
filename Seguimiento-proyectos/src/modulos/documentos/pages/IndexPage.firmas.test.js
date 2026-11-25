/**
 * Oráculos de `pages/IndexPage.vue` para la rebanada 49: firmas alineadas con el
 * dedo y formulario limpio tras registrar. Son pruebas de fuente (un `.vue` no se
 * puede importar en `node --test`), igual que `IndexPage.test.js`.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = readFileSync(fileURLToPath(new URL('./IndexPage.vue', import.meta.url)), 'utf8')
const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')
const CODIGO = FUENTE.replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const cuenta = (texto, patron) => (texto.match(patron) ?? []).length

function cuerpoDe(inicioTexto, finTexto) {
  const inicio = CODIGO.indexOf(inicioTexto)
  assert.notEqual(inicio, -1, `no se encontró ${inicioTexto}`)
  const fin = CODIGO.indexOf(finTexto, inicio)
  return CODIGO.slice(inicio, fin === -1 ? undefined : fin)
}

describe('rebanada 49 · lienzos de firma', () => {
  test('los lienzos se inicializan en un solo lugar', () => {
    assert.equal(cuenta(CODIGO, /getContext\('2d'\)/g), 1)
    assert.doesNotMatch(CODIGO, /\.width = \w+\.offsetWidth/)
  })

  test('se miden con ResizeObserver y se desconectan al desmontar', () => {
    assert.equal(cuenta(CODIGO, /new ResizeObserver/g), 1)
    assert.match(CODIGO, /onBeforeUnmount\(/)
    assert.match(CODIGO, /\.disconnect\(\)/)
  })

  test('usa medidasDelLienzo, la escala del dispositivo y repinta el trazo', () => {
    assert.match(CODIGO, /from '@\/modulos\/documentos\/composables\/lienzoFirma\.js'/)
    assert.match(CODIGO, /medidasDelLienzo\(/)
    assert.match(CODIGO, /posicionEnLienzo\(/)
    assert.match(CODIGO, /devicePixelRatio/)
    assert.match(CODIGO, /setTransform\(/)
    assert.match(CODIGO, /repintar/)
  })

  test('dibuja con eventos de puntero y captura el puntero', () => {
    assert.equal(cuenta(PLANTILLA, /@pointerdown=/g), 2)
    assert.equal(cuenta(PLANTILLA, /@pointermove=/g), 2)
    assert.equal(cuenta(PLANTILLA, /@pointerup=/g), 2)
    assert.equal(cuenta(PLANTILLA, /@pointercancel=/g), 2)
    assert.doesNotMatch(PLANTILLA, /@mousedown|@touchstart|@mousemove|@touchmove/)
    assert.match(CODIGO, /setPointerCapture\(/)
    assert.match(FUENTE, /touch-action:\s*none/)
  })

  test('un toque sin movimiento deja un punto', () => {
    assert.match(CODIGO, /\.arc\(/)
  })

  test('la tinta sigue saliendo de --q-primary y las firmas se leen antes del payload', () => {
    assert.match(CODIGO, /--q-primary/)
    const cuerpo = cuerpoDe('const onSubmit', 'const resetForm')
    assert.ok(cuerpo.indexOf('canvasCliente.value.toDataURL()') !== -1)
    assert.ok(cuerpo.indexOf('toDataURL()') < cuerpo.indexOf('firmaCliente: firmaClienteCapturada'))
  })

  test('los botones «Limpiar» de las firmas miden al menos 44 px', () => {
    const botones = PLANTILLA.match(/<q-btn[^>]*limpiarFirma\w+[^>]*>/g) ?? []
    assert.equal(botones.length, 2)
    for (const b of botones) assert.match(b, /control-touch/)
  })
})

describe('rebanada 49 · limpieza tras registrar', () => {
  test('el formulario se limpia siempre tras un registro con folio', () => {
    const cuerpo = cuerpoDe('const onSubmit', 'const resetForm')
    assert.doesNotMatch(cuerpo, /archivosRechazados\.length === 0\s*\)\s*\{\s*resetForm/)
    assert.match(cuerpo, /resetForm\(\)/)
    assert.match(cuerpo, /archivosRechazados\.length > 0/, 'el aviso de descartados se conserva')
  })

  test('resetForm limpia observaciones y conserva empresa, cliente, tipo, periodo, prioridad y vía', () => {
    const reset = cuerpoDe('const resetForm', '</script>')
    assert.match(reset, /form\.observaciones = ''/)
    for (const campo of ['empresa', 'cliente', 'tipo', 'periodo', 'prioridad', 'via']) {
      assert.doesNotMatch(
        reset,
        new RegExp(String.raw`form\.${campo}\w* =`),
        `no debe limpiar ${campo}`,
      )
    }
  })

  test('las firmas van al final: archivos, observaciones, firmas y luego los botones', () => {
    const archivos = PLANTILLA.indexOf('<q-file')
    const observaciones = PLANTILLA.indexOf('label="Observaciones"')
    const firmaCliente = PLANTILLA.indexOf('ref="canvasCliente"')
    const firmaRecepcion = PLANTILLA.indexOf('ref="canvasRecepcion"')
    const registrar = PLANTILLA.indexOf('label="Registrar y Acuse"')
    for (const [nombre, pos] of Object.entries({
      archivos,
      observaciones,
      firmaCliente,
      registrar,
    })) {
      assert.notEqual(pos, -1, `falta ${nombre} en la plantilla`)
    }
    assert.ok(archivos < observaciones, 'Observaciones debe ir después de los archivos')
    assert.ok(observaciones < firmaCliente, 'Las firmas deben ir después de las observaciones')
    assert.ok(firmaRecepcion < registrar, 'Las firmas deben ir antes de los botones')
  })

  test('Autollenar y las firmas tienen aire: margen bajo el encabezado de la sección 1 y bajo Observaciones', () => {
    // Las filas `q-col-gutter-md` suben 16 px con margen negativo; sin margen propio,
    // el botón Autollenar y la caja de Observaciones quedaban pegados a lo de abajo.
    const boton = PLANTILLA.indexOf('label="Autollenar"')
    const filaEncabezado = PLANTILLA.lastIndexOf('<div class="row items-center', boton)
    const etiquetaFila = PLANTILLA.slice(filaEncabezado, PLANTILLA.indexOf('>', filaEncabezado))
    assert.match(
      etiquetaFila,
      /q-mb-(sm|md)/,
      'el encabezado con Autollenar necesita margen inferior',
    )

    const obs = PLANTILLA.indexOf('v-model="form.observaciones"')
    const inicioObs = PLANTILLA.lastIndexOf('<q-input', obs)
    const etiquetaObs = PLANTILLA.slice(inicioObs, PLANTILLA.indexOf('/>', obs))
    assert.match(
      etiquetaObs,
      /class="[^"]*q-mb-md/,
      'Observaciones necesita margen antes de las firmas',
    )
  })
})
