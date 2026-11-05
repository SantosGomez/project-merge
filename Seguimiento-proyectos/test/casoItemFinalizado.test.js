// Pruebas estáticas: un caso Finalizado se pinta en verde en «Mis casos» (contador)
// y en el detalle de casos del dashboard del administrador (solo lectura).
// El texto «Finalizado» sigue visible: el color nunca es el único indicador.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')

const casoItem = leer('../src/components/CasoItem.vue')
const plantilla = casoItem.split('<script')[0]
const estilos = casoItem.slice(casoItem.indexOf('<style'))

const bloqueDe = (selector) => {
  const encontrado = estilos.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  return encontrado ? encontrado[1] : ''
}

describe('Caso Finalizado en «Mis casos» y en el dashboard del administrador', () => {
  it('el verde aplica en ambas vistas cuando el estado es finalizado', () => {
    assert.match(
      casoItem,
      /const esFinalizado = computed\(\(\) => props\.caso\.status === 'finalizado'\)/,
      'la condición ya no excluye la vista de solo lectura'
    )
    assert.match(plantilla, /'caso-item--finalizado': esFinalizado/)
  })

  it('el verde gana sobre la marca «Importante»', () => {
    const importante = estilos.indexOf('.caso-item--importante {')
    const finalizado = estilos.indexOf('.caso-item--finalizado {')
    assert.ok(importante > 0, 'existe la regla de Importante')
    assert.ok(finalizado > importante, 'la regla verde va después para sobrescribir el ámbar')
  })

  it('usa solo colores de la paleta, sin hexadecimales sueltos', () => {
    const bloque = bloqueDe('.caso-item--finalizado')
    assert.match(bloque, /background:\s*var\(--dg-exito-fondo\)/)
    assert.match(bloque, /border-left-color:\s*var\(--dg-estado-finalizado\)/)
    assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}/, 'sin hexadecimales en el componente')
  })

  it('el estado se ve en verde y sigue mostrando el texto «Finalizado»', () => {
    assert.match(plantilla, /:color="esFinalizado \? 'dg-exito' : 'primary'"/)
    assert.match(
      bloqueDe('.caso-item--finalizado .caso-item__estado:not(.caso-item__prioridad)'),
      /color:\s*var\(--dg-exito\)/
    )
    assert.match(plantilla, /label="Estado"/, 'el selector sigue etiquetado')
    assert.match(plantilla, /option-label="label"/, 'el estado se muestra como texto, no solo color')
  })

  it('en la vista del administrador el texto del estado se pinta en verde', () => {
    assert.match(plantilla, /class="caso-item__estado-fijo"/, 'el estado sigue visible como texto')
    const bloque = bloqueDe('.caso-item--finalizado .caso-item__estado-fijo')
    assert.match(bloque, /color:\s*var\(--dg-exito\)/)
    assert.match(bloque, /border-color:\s*var\(--dg-exito-borde\)/)
    assert.doesNotMatch(bloque, /#[0-9a-fA-F]{3,8}/, 'sin hexadecimales en el componente')
  })

  it('el selector de prioridad del administrador no se pinta de verde', () => {
    assert.match(plantilla, /class="caso-item__estado caso-item__prioridad selector-moderno"/)
    assert.doesNotMatch(estilos, /\.caso-item--finalizado \.caso-item__estado\s*\{/)
  })
})
