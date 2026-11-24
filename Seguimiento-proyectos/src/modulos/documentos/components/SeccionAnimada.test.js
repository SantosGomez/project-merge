/**
 * Oráculos de la animación de entrada (Animated Content de vue-bits,
 * 2026-11-23): un envoltorio con el preset elegido, presente en cada vista.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const leer = (ruta) => readFileSync(fileURLToPath(new URL(ruta, import.meta.url)), 'utf8')

const VISTAS = [
  'IndexPage.vue',
  'DashboardPage.vue',
  'ClientesPage.vue',
  'DireccionamientoPage.vue',
  'SeguimientoPage.vue',
  // Unión con status-conta: usuarios, login, contraseña y 404 son las de la app, no se pasaron.
]

describe('animación de entrada de las secciones', () => {
  test('gsap está declarado como dependencia', () => {
    const paquete = JSON.parse(leer('../../../../package.json'))
    assert.ok(paquete.dependencies?.gsap, 'falta gsap en dependencies')
  })

  test('SeccionAnimada aplica el preset: desenfoque 12, distancia 40, 1 s, barrido a la izquierda, orden aleatorio', () => {
    const fuente = leer('./SeccionAnimada.vue')
    assert.match(
      fuente,
      /import AnimatedContent from '@\/modulos\/documentos\/components\/vuebits\/AnimatedContent\.vue'/,
    )
    for (const prop of [
      ':distance="40"',
      ':duration="1"',
      ':blur="12"',
      'wipe="left"',
      'stagger-from="random"',
    ]) {
      assert.ok(fuente.includes(prop), `falta ${prop}`)
    }
  })

  for (const vista of VISTAS) {
    test(`${vista} envuelve sus secciones en SeccionAnimada`, () => {
      const fuente = leer(`../pages/${vista}`)
      assert.match(
        fuente,
        /import SeccionAnimada from '@\/modulos\/documentos\/components\/SeccionAnimada\.vue'/,
      )
      // `(?=[\s>])` y no `\b`: con `\b` también coincide `<q-page-container>`
      // (el guion es límite de palabra) y la prueba pasaba con el envoltorio mal puesto.
      assert.match(fuente, /<q-page(?=[\s>])[^>]*>\s*<SeccionAnimada\b/)
    })
  }
})
