// Migración a componentes de Quasar (plan en MEMORY.md, regla en AGENTS.md): cada rebanada agrega
// aquí los archivos que ya migró. Un archivo migrado no usa colores hexadecimales sueltos (salen de
// la paleta $dg-colores) ni los elementos nativos que Quasar ya resuelve (listas y botones).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const leer = (ruta) => readFileSync(new URL(`../src/${ruta}`, import.meta.url), 'utf8')

const MIGRADOS = [
  // Rebanada 2: etiqueta de prioridad, botón del logo y listas de ayuda
  'components/PriorityTag.vue',
  'components/AccessDenied.vue',
  'components/AvisoSesionCaducada.vue',
  'pages/LoginPage.vue',
  'layouts/MaquetaLayout.vue',
]

describe('Archivos migrados a Quasar', () => {
  for (const ruta of MIGRADOS) {
    it(`${ruta} toma los colores de la paleta, sin hexadecimales sueltos`, () => {
      const hexadecimales = leer(ruta).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []
      assert.deepEqual(hexadecimales, [], 'usar var(--dg-*), text-dg-*/bg-dg-* o color="dg-..."')
    })

    it(`${ruta} usa q-list, q-item y q-btn en vez de ul, li y button nativos`, () => {
      const plantilla = leer(ruta).split('<script')[0]
      assert.doesNotMatch(plantilla, /<(ul|ol|li|button)[\s>]/)
    })
  }
})

describe('Rebanada 2: piezas pequeñas', () => {
  it('PriorityTag es un q-chip con los colores de la paleta de cada prioridad', () => {
    const etiqueta = leer('components/PriorityTag.vue')
    assert.match(etiqueta, /<q-chip/)
    assert.match(etiqueta, /`dg-prioridad-\$\{props\.priority\}`/, 'texto de la prioridad')
    assert.match(etiqueta, /`dg-prioridad-\$\{props\.priority\}-fondo`/, 'fondo de la prioridad')
    assert.match(etiqueta, /var\(--dg-prioridad-(alta|media|baja)-borde\)/, 'borde de la prioridad')
    assert.match(etiqueta, /tabindex="0"/, 'recibe foco para leer su ayuda con teclado')
    assert.match(etiqueta, /:aria-label="etiquetaAccesible"/)
    assert.match(etiqueta, /<q-tooltip v-if="tooltip">/)
  })

  it('las ayudas de login, acceso denegado y sesión caducada son q-list con un q-item por punto', () => {
    for (const ruta of ['pages/LoginPage.vue', 'components/AccessDenied.vue', 'components/AvisoSesionCaducada.vue']) {
      const plantilla = leer(ruta).split('<script')[0]
      assert.match(plantilla, /<q-list[^>]*dense/, `${ruta}: lista de Quasar`)
      assert.equal((plantilla.match(/<q-item[\s>]/g) ?? []).length, 3, `${ruta}: los tres puntos de ayuda`)
    }
  })
})
