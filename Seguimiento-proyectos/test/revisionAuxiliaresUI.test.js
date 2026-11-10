// Revisión de UI, rebanada 5: gestión de auxiliares (lista y registro).
// A: página de auxiliares con búsqueda y lista. B: menú y ruta.
// TDD: las pruebas fallan primero porque la página y el ítem de menú no existen.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) =>
  readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const pagina = leer('../src/pages/ContadorAuxiliaresPage.vue')
const menu = leer('../src/layouts/MaquetaLayout.vue')
const router = leer('../src/router/index.js')

describe('Grupo A: página de gestión de auxiliares', () => {
  it('existe la página ContadorAuxiliaresPage', () => {
    assert.ok(pagina.length > 0, 'la página debe existir')
  })

  it('título de la página es "Mis auxiliares"', () => {
    assert.match(pagina, /Mis auxiliares/)
  })

  it('tiene un buscador para encontrar contadores a asignar como auxiliares', () => {
    assert.match(pagina, /buscar/i)
    assert.match(pagina, /q-input|q-select/)
  })

  it('muestra la lista de auxiliares actuales del contador', () => {
    assert.match(pagina, /auxiliar/i)
  })

  it('tiene botón para quitar un auxiliar', () => {
    assert.match(pagina, /quitar|eliminar|borrar/i)
  })

  it('usa solo componentes de Quasar', () => {
    assert.doesNotMatch(pagina, /<input[^>]*>/)
    assert.doesNotMatch(pagina, /<button[^>]*>/)
  })

  it('no tiene hexadecimales sueltos en estilos', () => {
    const estilos = pagina.slice(pagina.indexOf('<style'))
    assert.doesNotMatch(estilos, /#[0-9a-fA-F]{3,6}\b/)
  })
})

describe('Grupo B: menú y ruta', () => {
  it('el menú del contador tiene ítem "Mis auxiliares"', () => {
    assert.match(menu, /Mis auxiliares/)
  })

  it('el ítem de menú apunta a la ruta contador-auxiliares', () => {
    assert.match(menu, /contador-auxiliares/)
  })

  it('el router tiene la ruta contador/auxiliares', () => {
    assert.match(router, /contador\/auxiliares/)
    assert.match(router, /name: 'contador-auxiliares'/)
  })
})
