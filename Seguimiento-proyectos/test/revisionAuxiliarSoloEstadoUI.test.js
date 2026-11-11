// Rebanada 7: el auxiliar solo cambia el estado de los casos de otro contador.
// En «Mis casos», la estrella de Importante y el botón Editar se ocultan en esos casos;
// el selector de estado sigue disponible y lo explica un tooltip.
// TDD: las pruebas fallan primero porque los controles de edición siguen visibles.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const casoItem = leer('../src/components/CasoItem.vue')
const plantilla = casoItem.split('<script')[0]

// 2026-11-10: el permiso lo decide el backend (`solo_estado` → `soloEstado`): el auxiliar solo
// cambia el estado de los casos del dueño; el dueño edita completos los de su auxiliar.
describe('CasoItem: edición limitada para el auxiliar', () => {
  it('limita la edición según el dato soloEstado del backend, no por ser de otro contador', () => {
    assert.match(casoItem, /const soloCambiaEstado = computed\(\(\) => props\.caso\.soloEstado === true\)/)
  })

  it('no muestra la estrella de Importante cuando solo se cambia el estado', () => {
    assert.match(plantilla, /<q-item-section v-if="!soloLectura && !soloCambiaEstado && puedeMarcarImportante"/)
  })

  it('no muestra el botón Editar cuando solo se cambia el estado', () => {
    assert.match(plantilla, /v-if="!soloCambiaEstado"[\s\S]*?label="Editar"/)
  })

  it('el tooltip de «de …» distingue el caso de tu auxiliar del caso del contador al que apoyas', () => {
    assert.match(casoItem, /Este caso es de tu auxiliar: puedes editarlo completo\./)
    assert.match(casoItem, /Este caso es del contador al que apoyas: solo puedes cambiar su estado\./)
  })

  it('mantiene el selector de estado y explica el límite', () => {
    assert.match(plantilla, /label="Estado"/)
    assert.match(casoItem, /solo puedes cambiar el estado/i)
  })
})
