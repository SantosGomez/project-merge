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

describe('CasoItem: edición limitada para el auxiliar', () => {
  it('distingue los casos que pertenecen a otro contador', () => {
    assert.match(casoItem, /const esCasoDeOtroContador = computed\(/)
    assert.match(casoItem, /String\(props\.caso\.counterId\) !== String\(props\.contadorAutenticadoId\)/)
  })

  it('no muestra la estrella de Importante en casos ajenos', () => {
    assert.match(
      plantilla,
      /<q-item-section v-if="!soloLectura && !esCasoDeOtroContador"/
    )
  })

  it('no muestra el botón Editar en casos ajenos', () => {
    assert.match(plantilla, /v-if="!esCasoDeOtroContador"[\s\S]*?label="Editar"/)
  })

  it('mantiene el selector de estado y explica el límite', () => {
    assert.match(plantilla, /label="Estado"/)
    assert.match(casoItem, /solo puedes cambiar el estado/i)
  })
})
