/**
 * Oráculos de `pages/SeguimientoPage.vue`: el portal ya no es maqueta, muestra
 * todos los expedientes encontrados con los estados traducidos y enseña el
 * motivo que da el servidor cuando algo falla.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8')

/** Quita comentarios para que las frases que documentan un defecto no cuenten como código. */
function soloCodigo(fuente) {
  return fuente
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

const CODIGO = soloCodigo(leer('./SeguimientoPage.vue'))

describe('SeguimientoPage: portal de seguimiento', () => {
  test('no enseña folios inventados', () => {
    assert.ok(!CODIGO.includes('DCA-REC-'), 'sigue mostrando un folio que no existe')
  })

  test('muestra todos los expedientes, no solo el primero', () => {
    assert.ok(!CODIGO.includes('expedientes[0]'), 'descarta todo menos el primer expediente')
    assert.match(CODIGO, /v-for="exp(ediente)? in expedientes"/)
  })

  test('traduce los estados con el mismo módulo que el Dashboard', () => {
    assert.ok(CODIGO.includes('estiloDeEstadoDocumento'), 'pinta el ENUM crudo del servidor')
  })

  test('los errores enseñan el motivo del servidor', () => {
    assert.ok(CODIGO.includes('mensajeParaUsuario('), 'oculta el motivo con un texto genérico')
  })

  test('el Cliente ve sus documentos al entrar, sin tener que buscar', () => {
    assert.match(CODIGO, /onMounted\([\s\S]{0,80}esCliente\.value[\s\S]{0,40}consultar\(''\)/)
  })

  test('el encabezado resume por estado y lo que necesita al cliente va primero', () => {
    assert.ok(CODIGO.includes('resumirSeguimiento('), 'no hay resumen por estado')
    assert.ok(CODIGO.includes('ordenarPorAtencion('), 'la lista no prioriza lo pendiente')
  })
})

describe('Codificación de las vistas', () => {
  // Defecto real (2026-11-04): SeguimientoPage.vue se guardó con BOM y con el
  // UTF-8 leído como Windows-1252, así que el portal pintaba «TodavÃ­a» y «â€”».
  // Ni el lint ni el build lo detectan: compilan el texto roto sin quejarse.
  test('SeguimientoPage.vue no empieza con BOM', () => {
    assert.notEqual(leer('./SeguimientoPage.vue').charCodeAt(0), 0xfeff)
  })

  test('SeguimientoPage.vue no tiene acentos duplicados (mojibake)', () => {
    const lineas = leer('./SeguimientoPage.vue')
      .split('\n')
      .filter((l) => /Ã[\u0080-¿]|â€|Â[«»·¿]/.test(l))
    assert.deepEqual(lineas, [], 'hay texto con la codificación rota')
  })

  test('los textos de la vista se leen bien', () => {
    const fuente = leer('./SeguimientoPage.vue')
    assert.ok(fuente.includes('Todavía no hay documentos registrados a tu nombre'))
    assert.ok(fuente.includes('Folio de recepción'))
  })
})
