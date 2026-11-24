/*
 * Selector de vistas con píldora elástica (idea de Rubber Segment de Vue Bits, sin dependencias):
 * la píldora se estira desde la opción anterior hasta la nueva, se aplasta un poco al llegar y se asienta.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { fotogramasDeSegmento } from '../src/utils/segmentoElastico.js'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

describe('fotogramasDeSegmento', () => {
  const dia = { left: 0, width: 60 }
  const mes = { left: 120, width: 60 }

  it('hacia la derecha: se estira hasta cubrir las dos opciones, se aplasta 3 px y se asienta', () => {
    const fotogramas = fotogramasDeSegmento(dia, mes)
    assert.deepEqual(
      fotogramas.map(({ left, width }) => ({ left, width })),
      [
        { left: '0px', width: '60px' },
        { left: '0px', width: '180px' },
        { left: '123px', width: '57px' },
        { left: '120px', width: '60px' },
      ],
    )
    assert.equal(fotogramas[0].offset, 0)
    assert.equal(fotogramas.at(-1).offset, 1)
  })

  it('hacia la izquierda: el borde que se queda atrás es el derecho', () => {
    const fotogramas = fotogramasDeSegmento(mes, dia)
    assert.deepEqual(
      fotogramas.map(({ left, width }) => ({ left, width })),
      [
        { left: '120px', width: '60px' },
        { left: '0px', width: '180px' },
        { left: '0px', width: '57px' },
        { left: '0px', width: '60px' },
      ],
    )
  })

  it('estirar 0 es un deslizamiento simple y aplastar 0 quita el rebote', () => {
    const fotogramas = fotogramasDeSegmento(dia, mes, { estirar: 0, aplastar: 0 })
    assert.deepEqual(
      fotogramas.map(({ left, width }) => ({ left, width })),
      [
        { left: '0px', width: '60px' },
        { left: '120px', width: '60px' },
      ],
    )
  })

  it('si la opción no cambia, no hay animación', () => {
    assert.deepEqual(fotogramasDeSegmento(dia, dia), [])
  })
})

describe('selector de vistas de «Mi Calendario»', () => {
  const barra = leer('../src/components/BarraPeriodo.vue')

  it('los dos selectores (escritorio y celular) siguen siendo q-btn-toggle con la píldora elástica', () => {
    assert.match(barra, /import \{ vSegmentoElastico \} from '\.\.\/utils\/segmentoElastico\.js'/)
    const selectores = barra.match(/<q-btn-toggle[\s\S]*?\/>/g) ?? []
    assert.equal(selectores.length, 2)
    for (const selector of selectores) assert.match(selector, /v-segmento-elastico/)
  })

  it('la píldora es del color de la opción activa de antes ($primary) y no lleva colores sueltos', () => {
    const estilos = barra.slice(barra.indexOf('<style'))
    assert.match(estilos, /\.segmento-elastico__pildora[\s\S]*?background:\s*var\(--q-primary\)/)
    assert.doesNotMatch(barra, /#[0-9a-fA-F]{3,8}\b|rgba?\(/)
  })

  it('con «reducir movimiento» la píldora se coloca sin animar', () => {
    const utilidad = leer('../src/utils/segmentoElastico.js')
    assert.match(utilidad, /prefers-reduced-motion: reduce/)
  })
})
