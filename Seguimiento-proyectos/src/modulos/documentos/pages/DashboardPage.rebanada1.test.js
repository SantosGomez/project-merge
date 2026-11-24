import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const PLANTILLA = fs.readFileSync(new URL('./DashboardPage.vue', import.meta.url), 'utf8')

describe('Dashboard — rebanada 1: filtros que se envuelven y encabezado apilable', () => {
  test('la barra de filtros usa .barra-filtros (flex-wrap)', () => {
    const inicio = PLANTILLA.indexOf('<!-- Búsqueda y Filtros -->')
    const fin = PLANTILLA.indexOf('</q-card-section>', inicio)
    const bloque = PLANTILLA.slice(inicio, fin)
    assert.ok(
      /class="[^"]*barra-filtros[^"]*"/.test(bloque),
      'La barra de filtros debe llevar la clase barra-filtros',
    )
  })

  test('los controles del encabezado (título + select/botones) usan columnas que se envuelven', () => {
    const inicio = PLANTILLA.indexOf('<!-- Encabezado -->')
    const fin = PLANTILLA.indexOf('</div>', PLANTILLA.indexOf('Nueva Recepción', inicio))
    const bloque = PLANTILLA.slice(inicio, fin)
    assert.ok(
      /col-12\s+col-sm\b/.test(bloque) || /col-12\s+col-md\b/.test(bloque),
      'El bloque de texto del encabezado debe usar col-12 col-* para envolverse',
    )
    assert.ok(
      /col-12\s+col-sm-auto\b/.test(bloque) || /col-12\s+col-md-auto\b/.test(bloque),
      'El bloque de controles del encabezado debe usar col-12 col-*-auto',
    )
  })

  test('los selectores de estado y tipo del Dashboard ya llevan el patrón completo', () => {
    assert.match(PLANTILLA, /selector-filtro-estado[\S\s]{0,1200}#selected-item="scope"/)
    assert.match(
      PLANTILLA,
      /selector-filtro-estado[\S\s]{0,1200}#option="{ itemProps, opt, selected }"/,
    )
    assert.match(PLANTILLA, /selector-filtro-tipo[\S\s]{0,1200}#selected-item="scope"/)
    assert.match(
      PLANTILLA,
      /selector-filtro-tipo[\S\s]{0,1200}#option="{ itemProps, opt, selected }"/,
    )
  })
})
