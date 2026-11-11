// Rebanada 04: el administrador también ve la campana de avisos (para enterarse de los cambios
// de equipo de los contadores). Los usuarios de sistema siguen sin campana.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

// Evalúa el getter `veCampana` tal como está escrito en el store, para cada rol.
function veCampanaPara(rol) {
  const store = leer('../src/stores/session.js')
  const coincidencia = store.match(/veCampana:\s*(\(state\)\s*=>[^\n]+?),?\r?\n/)
  assert.ok(coincidencia, 'el store define el getter veCampana')
  return new Function(`return (${coincidencia[1]})`)()({ rol })
}

describe('La campana de avisos del menú', () => {
  const layout = leer('../src/layouts/MaquetaLayout.vue')

  it('la ven el administrador, el contador y el auxiliar, y no el usuario de sistema', () => {
    assert.equal(veCampanaPara('administrador'), true)
    assert.equal(veCampanaPara('contador'), true)
    assert.equal(veCampanaPara('auxiliar'), true)
    assert.equal(veCampanaPara('usuarios_de_sistema'), false)
  })

  it('aparece en la barra móvil y en el encabezado de escritorio, condicionada por veCampana', () => {
    assert.equal((layout.match(/<CampanaAvisos v-if="session\.veCampana"/g) ?? []).length, 2)
    assert.doesNotMatch(layout, /<CampanaAvisos v-if="session\.trabajaCasos"/)
  })
})
