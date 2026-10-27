// Contraste de las etiquetas de prioridad (RNF-06, criterio 26). Desde la migración a Quasar los
// colores de PriorityTag.vue salen de la paleta $dg-colores (quasar.variables.scss): aquí se leen
// de la paleta y se calcula la razón de contraste con la fórmula de la WCAG 2.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const MINIMO_TEXTO = 4.5
// El borde es un elemento no textual: WCAG 1.4.11 pide 3:1 con el fondo de la etiqueta.
const MINIMO_BORDE = 3

const variables = readFileSync(new URL('../src/css/quasar.variables.scss', import.meta.url), 'utf8')

/** Color `#rrggbb` de un nombre de la paleta. */
const colorDe = (nombre) => variables.match(new RegExp(`\\n\\s*${nombre}:\\s*(#[0-9a-fA-F]{6})`))?.[1]

/** Luminancia relativa de un color `#rrggbb` según la WCAG 2. */
const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
    .map((canal) => (canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4))

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Razón de contraste entre dos colores `#rrggbb`. */
const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)

  return (claro + 0.05) / (oscuro + 0.05)
}

// Cada prioridad y el gris neutro de una prioridad no prevista: texto, fondo y borde.
const ETIQUETAS = {
  alta: ['prioridad-alta', 'prioridad-alta-fondo', 'prioridad-alta-borde'],
  media: ['prioridad-media', 'prioridad-media-fondo', 'prioridad-media-borde'],
  baja: ['prioridad-baja', 'prioridad-baja-fondo', 'prioridad-baja-borde'],
  desconocida: ['texto-secundario', 'neutro-fondo', 'neutro-borde'],
}

for (const [prioridad, [texto, fondo, borde]] of Object.entries(ETIQUETAS)) {
  test(`la etiqueta ${prioridad} tiene contraste de texto de al menos 4.5:1 (RNF-06)`, () => {
    const [colorTexto, colorFondo] = [colorDe(texto), colorDe(fondo)]

    assert.ok(colorTexto && colorFondo, `la paleta define ${texto} y ${fondo}`)
    assert.ok(
      contraste(colorTexto, colorFondo) >= MINIMO_TEXTO,
      `contraste ${contraste(colorTexto, colorFondo).toFixed(2)}:1 de ${colorTexto} sobre ${colorFondo}`,
    )
  })

  test(`el borde de la etiqueta ${prioridad} se distingue de su fondo (3:1)`, () => {
    const [colorBorde, colorFondo] = [colorDe(borde), colorDe(fondo)]

    assert.ok(colorBorde, `la paleta define ${borde}`)
    assert.ok(
      contraste(colorBorde, colorFondo) >= MINIMO_BORDE,
      `contraste ${contraste(colorBorde, colorFondo).toFixed(2)}:1 de ${colorBorde} sobre ${colorFondo}`,
    )
  })
}
