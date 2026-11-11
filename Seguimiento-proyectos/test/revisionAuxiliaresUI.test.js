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

  // Rediseño 2026-11-10: «Agregar auxiliar» abre un diálogo con la lista y un filtro opcional.
  it('tiene un botón para agregar auxiliares desde una lista', () => {
    assert.match(pagina, /label="Agregar auxiliar"/)
    assert.match(pagina, /<AgregarAuxiliaresDialog/)
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
  // Rebanada 06: «Mis auxiliares» ya no es un ítem del menú; vive en «Mi perfil» (nombre al pie del menú).
  it('el menú ya no tiene ítem "Mis auxiliares" y el nombre del pie lleva a mi-perfil', () => {
    assert.doesNotMatch(menu, /Mis auxiliares/)
    assert.match(menu, /:to="\{ name: 'mi-perfil' \}"/)
  })

  it('el router pinta la vista en perfil y contador/auxiliares solo redirige', () => {
    assert.match(router, /path: 'perfil',\s+name: 'mi-perfil'/)
    assert.match(router, /path: 'contador\/auxiliares',[\s\S]*?redirect: \{ name: 'mi-perfil' \}/)
    assert.doesNotMatch(router, /name: 'contador-auxiliares'/)
  })
})
