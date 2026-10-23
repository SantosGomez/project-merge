// Contraste de las etiquetas de prioridad (RNF-06, criterio 26): lee los colores reales de
// PriorityTag.vue y calcula la razón de contraste con la fórmula de la WCAG 2.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const MINIMO_WCAG = 4.5

const css = readFileSync(new URL('../src/components/PriorityTag.vue', import.meta.url), 'utf8')

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

/** Colores de texto y de fondo declarados para una clase de color de la etiqueta. */
const coloresDe = (color) => {
  const bloque = css.match(new RegExp(`\\.priority-tag--${color}\\s*\\{([^}]*)\\}`))

  assert.ok(bloque, `PriorityTag.vue declara la clase priority-tag--${color}`)

  return {
    texto: bloque[1].match(/(?<![-\w])color:\s*(#[0-9a-fA-F]{6})/)?.[1],
    fondo: bloque[1].match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1],
  }
}

for (const color of ['red', 'amber', 'green', 'unknown']) {
  test(`la etiqueta ${color} tiene contraste de texto de al menos 4.5:1 (RNF-06)`, () => {
    const { texto, fondo } = coloresDe(color)

    assert.ok(texto && fondo, 'la clase declara color de texto y de fondo en formato #rrggbb')
    assert.ok(
      contraste(texto, fondo) >= MINIMO_WCAG,
      `contraste ${contraste(texto, fondo).toFixed(2)}:1 de ${texto} sobre ${fondo}`,
    )
  })
}
