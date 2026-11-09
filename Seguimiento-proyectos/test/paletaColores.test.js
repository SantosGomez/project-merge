// Paleta de colores de la app (migración a Quasar, rebanada 1): los colores viven en
// `quasar.variables.scss` como un mapa `$dg-colores` y `app.scss` los publica como variables CSS
// (`--dg-*`) y como clases de color de Quasar (`text-dg-*`, `bg-dg-*`), para usarlos en
// `color="dg-..."` de los componentes en vez de escribir el hexadecimal en cada archivo.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')
const variables = leer('../src/css/quasar.variables.scss')
const appScss = leer('../src/css/app.scss')

/** Colores del mapa `$dg-colores: ( nombre: #rrggbb, ... )`. */
const paleta = () => {
  const bloque = variables.match(/\$dg-colores:\s*\(([\s\S]*?)\);/)?.[1] ?? ''
  return Object.fromEntries([...bloque.matchAll(/([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}

const luminancia = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((inicio) => parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
    .map((canal) => (canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

// Colores que ya usan las vistas, agrupados por su papel.
const NOMBRES = [
  'texto', 'texto-secundario', 'texto-tenue', 'foco', 'acento',
  'borde', 'borde-fuerte', 'borde-discontinuo',
  'superficie', 'fondo-panel', 'fondo-suave', 'fondo-hover', 'fondo-seleccion',
  'error', 'error-oscuro', 'error-fondo', 'exito', 'exito-fondo',
  'importante', 'importante-texto', 'importante-fondo',
  'estado-pendiente', 'estado-en-proceso', 'estado-finalizado',
  'prioridad-alta', 'prioridad-alta-fondo', 'prioridad-alta-borde',
  'prioridad-media', 'prioridad-media-fondo', 'prioridad-media-borde',
  'prioridad-baja', 'prioridad-baja-fondo', 'prioridad-baja-borde',
  // Rebanada 2: gris neutro, avisos del login, error de campo y textos sobre el menú oscuro
  'neutro-fondo', 'neutro-borde',
  'aviso-texto', 'aviso-fondo', 'aviso-borde',
  'info-texto', 'info-fondo', 'info-borde',
  'exito-oscuro', 'exito-borde', 'error-campo',
  'texto-claro', 'texto-claro-tenue',
  // Rebanada 3: texto y borde suave del aviso de error de carga (ErrorState)
  'error-texto', 'error-borde-suave',
  // Rebanada 4: fondo de la tarjeta KPI en alerta (Vencidos)
  'error-fondo-suave',
  // Rebanada 5: aviso general de error de los diálogos de usuario
  'error-aviso-texto', 'error-aviso-fondo',
  // Revisión de UI, rebanada 3: fondo de la fila de un caso importante (antes #fffaf0 suelto)
  'importante-fondo-suave',
]

test('la paleta $dg-colores define cada color por su papel en formato #rrggbb', () => {
  assert.deepEqual(Object.keys(paleta()).sort(), [...NOMBRES].sort())
})

test('los colores conservan los valores que ya usaban las vistas (no cambia nada en pantalla)', () => {
  const p = paleta()
  assert.equal(p.texto, '#102a43')
  assert.equal(p['texto-secundario'], '#334e68')
  assert.equal(p.acento, '#1f5f99')
  assert.equal(p.foco, '#0b5cad')
  assert.equal(p.error, '#a3231b')
  assert.equal(p['estado-pendiente'], '#b45309')
  assert.equal(p['estado-finalizado'], '#2f855a')
  assert.equal(p['prioridad-alta'], '#b71c1c')
})

// Texto sobre su fondo: mínimo 4.5:1 (WCAG 2, texto normal).
const PARES_DE_TEXTO = [
  ['texto', 'superficie'], ['texto-secundario', 'superficie'], ['texto-tenue', 'superficie'],
  ['texto', 'fondo-panel'], ['texto-secundario', 'fondo-panel'], ['texto', 'fondo-seleccion'],
  ['acento', 'superficie'], ['error', 'superficie'], ['error-oscuro', 'error-fondo'],
  ['exito', 'exito-fondo'], ['importante-texto', 'importante-fondo'],
  ['prioridad-alta', 'prioridad-alta-fondo'], ['prioridad-media', 'prioridad-media-fondo'],
  ['prioridad-baja', 'prioridad-baja-fondo'],
  ['texto-secundario', 'neutro-fondo'], ['aviso-texto', 'aviso-fondo'], ['info-texto', 'info-fondo'],
  ['exito-oscuro', 'exito-fondo'], ['error-oscuro', 'error-fondo'], ['error-campo', 'superficie'],
  ['error-texto', 'error-fondo'],
  ['error', 'error-fondo-suave'], ['texto-secundario', 'error-fondo-suave'],
  ['error-aviso-texto', 'error-aviso-fondo'],
  // Revisión de UI, rebanada 1: tooltips (texto claro sobre la tinta) y avisos de Quasar
  ['texto-claro', 'texto'], ['texto-claro', 'error'], ['texto-claro', 'exito'],
  // Revisión de UI, rebanada 3: fila de caso importante y etiqueta «Vencido»
  ['texto', 'importante-fondo-suave'], ['texto-secundario', 'importante-fondo-suave'],
  ['texto-tenue', 'importante-fondo-suave'], ['importante-texto', 'importante-fondo-suave'],
  ['error', 'error-fondo'],
]

// Textos del menú lateral sobre su fondo oscuro ($primary de Quasar).
const primario = () => variables.match(/\$primary:\s*(#[0-9a-fA-F]{6})/)?.[1]

for (const texto of ['texto-claro', 'texto-claro-tenue']) {
  test(`«${texto}» sobre el menú ($primary) tiene contraste de al menos 4.5:1`, () => {
    const razon = contraste(paleta()[texto], primario())
    assert.ok(razon >= 4.5, `contraste ${razon.toFixed(2)}:1`)
  })
}

for (const [texto, fondo] of PARES_DE_TEXTO) {
  test(`«${texto}» sobre «${fondo}» tiene contraste de al menos 4.5:1`, () => {
    const p = paleta()
    const razon = contraste(p[texto], p[fondo])
    assert.ok(razon >= 4.5, `contraste ${razon.toFixed(2)}:1`)
  })
}

test('app.scss publica la paleta como variables CSS y como clases de color de Quasar', () => {
  assert.match(appScss, /@each \$nombre, \$color in \$dg-colores/)
  assert.match(appScss, /--dg-#\{\$nombre\}:\s*#\{\$color\}/, 'variable CSS --dg-*')
  assert.match(appScss, /\.text-dg-#\{\$nombre\}\s*\{[^}]*color:\s*var\(--dg-#\{\$nombre\}\)/, 'clase text-dg-*')
  assert.match(appScss, /\.bg-dg-#\{\$nombre\}\s*\{[^}]*background:\s*var\(--dg-#\{\$nombre\}\)/, 'clase bg-dg-*')
})
