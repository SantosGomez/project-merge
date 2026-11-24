/**
 * Oráculos de `pages/DireccionamientoPage.vue`: la vista ya no es maqueta y
 * consume datos reales, con bandera de reentrada en la entrega.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = readFileSync(
  fileURLToPath(new URL('./DireccionamientoPage.vue', import.meta.url)),
  'utf8',
)

function soloCodigo(fuente) {
  return fuente
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const CODIGO = soloCodigo(FUENTE)

describe('DireccionamientoPage ya no es maqueta', () => {
  test('no contiene los datos de prueba del mock', () => {
    assert.ok(!CODIGO.includes('Comercializadora del Norte'), 'sigue habiendo clientes inventados')
    assert.ok(!CODIGO.includes('DCA-2026-0841'), 'sigue habiendo folios inventados')
  })

  test('carga los pendientes reales y el catálogo de contadores', () => {
    assert.ok(CODIGO.includes('obtenerDireccionamiento()'), 'no llama a obtenerDireccionamiento')
    assert.ok(CODIGO.includes('obtenerCatalogos()'), 'no carga los contadores reales')
  })

  test('entrega con bandera de reentrada y lee las firmas antes de enviar', () => {
    assert.ok(CODIGO.includes('if (guardando.value) return'), 'falta la guarda de reentrada')
    const inicio = CODIGO.indexOf('const confirmarEntrega')
    const fin = CODIGO.indexOf('onMounted', inicio)
    const cuerpo = CODIGO.slice(inicio, fin === -1 ? undefined : fin)
    const idxToData = cuerpo.indexOf('toDataURL()')
    const idxEnviar = cuerpo.indexOf('entregarDocumento(')
    assert.notEqual(idxToData, -1, 'no se lee el lienzo')
    assert.notEqual(idxEnviar, -1, 'no se envía la entrega')
    assert.ok(idxToData < idxEnviar, 'se envía antes de leer las firmas')
  })
})

// Revisión de la Fase 2 de tooltips (2026-11-23): a tres botones con texto
// visible se les puso un `aria-label` distinto, que sustituye a ese texto para
// el lector de pantalla. «Imprimir la relación…» ya no contenía «Imprimir
// Relación» (WCAG 2.5.3, la etiqueta debe estar en el nombre) y ninguno decía
// lo mismo que su tooltip. Un botón con `label` visible no lleva `aria-label`.
describe('Botones con texto visible', () => {
  const botones = [...soloCodigo(FUENTE).matchAll(/<q-btn\b[^>]*>/g)].map((m) => m[0])

  for (const etiqueta of [
    'Actualizar',
    'Imprimir Relación',
    'Confirmar Entrega y Generar Constancia',
  ]) {
    test(`«${etiqueta}» no lleva aria-label que sustituya su texto`, () => {
      const boton = botones.find((b) => b.includes(`label="${etiqueta}"`))
      assert.ok(boton, `no se encontró el botón «${etiqueta}»`)
      assert.doesNotMatch(boton, /\saria-label=/)
    })
  }
})
