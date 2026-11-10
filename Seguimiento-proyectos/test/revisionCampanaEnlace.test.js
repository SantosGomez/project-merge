// Rebanada 8: campana con enlace a caso
// TDD: pruebas fallan primero porque los items no son clickeables ni navegan

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const campana = leer('../src/components/CampanaAvisos.vue')
const plantilla = campana.split('<script')[0]

describe('CampanaAvisos: enlace al caso', () => {
  it('los items de aviso son clickeables y navegan al caso', () => {
    assert.match(plantilla, /@click="irAlCaso\(aviso\)"/)
    assert.match(campana, /const irAlCaso = \(aviso\) => \{/)
  })

  it('usa router.push con el casoId', () => {
    assert.match(campana, /import.*useRouter/)
    assert.match(campana, /router\.push\(/)
    assert.match(campana, /casoId/)
  })

  it('si no hay casoId (p.ej. aviso de auditoría), no navega o va a auditorías', () => {
    assert.match(campana, /casoId/)
  })
})