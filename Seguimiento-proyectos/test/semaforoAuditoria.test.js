// Semáforo de auditorías en un solo lugar: clase CSS, textos de ayuda y días en palabras
// (utils/semaforoAuditoria.js) y colores como variables CSS globales (src/css/app.scss).

import test, { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { SEMAFOROS } from '../src/utils/listaAuditorias.js'
import { AYUDA_SEMAFORO, claseSemaforo, textoDiasPlazo } from '../src/utils/semaforoAuditoria.js'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const CLASES = ['vencido', 'critico', 'atencion', 'en-tiempo', 'concluida']

test('claseSemaforo da la clase CSS de cada semáforo; uno desconocido cuenta como «En tiempo»', () => {
  assert.deepEqual(SEMAFOROS.map(claseSemaforo), CLASES)
  assert.equal(claseSemaforo(undefined), 'en-tiempo')
})

test('cada semáforo tiene su texto de ayuda', () => {
  assert.deepEqual(Object.keys(AYUDA_SEMAFORO), SEMAFOROS)
  assert.ok(Object.values(AYUDA_SEMAFORO).every((texto) => texto.length > 0))
})

test('textoDiasPlazo sigue disponible donde ya se usaba', async () => {
  const { textoDiasPlazo: delTablero } = await import('../src/utils/tableroAuditorias.js')
  assert.equal(delTablero, textoDiasPlazo)
  assert.equal(textoDiasPlazo(-2), 'venció hace 2 días')
})

describe('Colores del semáforo: un solo lugar', () => {
  const estilos = read('../src/css/app.scss')

  it('app.scss define las variables de color de cada semáforo con la paleta', () => {
    for (const clase of CLASES) {
      const regla = estilos.slice(estilos.indexOf(`.semaforo--${clase} {`))
      assert.ok(estilos.includes(`.semaforo--${clase} {`), `existe .semaforo--${clase}`)
      const cuerpo = regla.slice(0, regla.indexOf('}'))
      for (const variable of ['--semaforo-color', '--semaforo-fondo', '--semaforo-texto']) {
        assert.match(
          cuerpo,
          new RegExp(`${variable}: var\\(--dg-[a-z-]+\\)`),
          `${clase} define ${variable}`,
        )
      }
    }
    assert.match(
      estilos,
      /\.semaforo-etiqueta \{[\s\S]*?background: var\(--semaforo-fondo\);[\s\S]*?color: var\(--semaforo-texto\)/,
    )
  })

  const archivos = [
    '../src/components/AuditoriaItem.vue',
    '../src/components/AuditoriasTabla.vue',
    '../src/components/TableroAuditorias.vue',
    '../src/pages/AuditoriaFichaPage.vue',
    '../src/pages/AuditoriasPage.vue',
  ]

  for (const archivo of archivos) {
    it(`${archivo.split('/').pop()} ya no define sus propios colores ni mapas del semáforo`, () => {
      const codigo = read(archivo)
      assert.doesNotMatch(
        codigo,
        /--(vencido|critico|atencion|en-tiempo|concluida) \{/,
        'sin reglas de color por semáforo',
      )
      assert.doesNotMatch(codigo, /const (SEMAFORO_CLASE|AYUDA_SEMAFORO|COLOR_SEMAFORO) = \{/)
      assert.doesNotMatch(codigo, /const textoDias = /)
      assert.match(codigo, /semaforo--\$\{/, 'usa la clase global semaforo--<clave>')
    })
  }
})
