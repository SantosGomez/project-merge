/**
 * Oráculos de `pages/DashboardPage.vue`: cada rol ve solo los botones que puede
 * usar (2026-11-04). Antes el Contador veía «Nueva Recepción» y al pulsarlo
 * recibía un aviso de permiso; el Practicante veía «Cambiar estado» y el
 * servidor se lo rechazaba.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = readFileSync(fileURLToPath(new URL('./DashboardPage.vue', import.meta.url)), 'utf8')

/** Las etiquetas `<q-btn ...>` de la plantilla, con todos sus atributos. */
const botones = FUENTE.match(/<q-btn\b[^>]*>/g) ?? []

describe('DashboardPage: botones según el rol', () => {
  test('«Nueva Recepción» solo para quien puede registrar recepciones', () => {
    const nueva = botones.filter((b) => b.includes('Nueva Recepción'))
    assert.equal(nueva.length, 1)
    assert.match(nueva[0], /v-if="puedeRecepcionar"/)
    assert.match(FUENTE, /puedeRecepcionar = computed\(\(\) => puede\('registrar_recepcion'\)\)/)
  })

  test('todo botón que abre el cambio de estado sale solo si quien mira puede cambiar ESE documento', () => {
    const cambian = botones.filter((b) => b.includes('cambiarEstado('))
    assert.ok(cambian.length >= 3, `se esperaban los tres botones, hay ${cambian.length}`)
    for (const boton of cambian) {
      assert.match(boton, /v-if="puedeCambiarDocumento\(/, boton)
    }
    assert.match(FUENTE, /puedeCambiarEstado = computed\(\(\) => puede\('cambiar_estado'\)\)/)
  })

  test('la lista de estados nuevos sale de la regla del servidor, no de una lista de la vista', () => {
    assert.match(
      FUENTE,
      /from '\.\.\/logica\/estadosDocumento\.js'/,
      'la regla de transiciones es la del Backend (copia idéntica en logica/, principio 3)',
    )
    assert.match(FUENTE, /estadosPermitidos\(docCambio\.value, usuarioSesion\.value\)/)
    assert.match(
      FUENTE,
      /puedeCambiarEstado\.value && estadosPermitidos\(row, usuarioSesion\.value\)\.length > 0/,
    )
  })

  test('el permiso sale de la tabla de permisos y del rol de la sesión, no de un rol escrito a mano', () => {
    assert.match(FUENTE, /hayAcceso\(sesion\.usuario\.value\?\.rol, accion\)/)
    assert.doesNotMatch(FUENTE, /rol\s*===\s*'(Contador|Practicante|Administrador)'/)
  })
})
