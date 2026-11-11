// Rebanada 05: los textos de ayuda explican quién puede cambiar un equipo y a quién se avisa.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
// Los textos pueden partirse en varias líneas: se normalizan espacios y saltos.
const normalizado = (relativa) => leer(relativa).replace(/\s+/g, ' ')

describe('textos de ayuda de los equipos', () => {
  it('«Mis auxiliares» dice que el despacho también puede cambiar el equipo', () => {
    assert.ok(
      normalizado('../src/pages/ContadorAuxiliaresPage.vue').includes(
        'Tú puedes agregar o quitar auxiliares, y el despacho también puede hacerlo; si lo hace, te llegará un aviso.',
      ),
    )
  })

  it('agregar auxiliares dice a quién se avisa', () => {
    assert.ok(
      normalizado('../src/components/AgregarAuxiliaresDialog.vue').includes(
        'A cada persona que asignes se le avisará, y también a los administradores.',
      ),
    )
  })

  it('quitar un auxiliar dice a quién se avisa', () => {
    assert.ok(
      normalizado('../src/pages/ContadorAuxiliaresPage.vue').includes(
        'dejará de ver tus casos y de poder cambiar su estado. Se le avisará, y también a los administradores.',
      ),
    )
  })

  it('«Contadores que apoya» dice a quién se avisa al guardar y que cada contador ajusta su equipo', () => {
    assert.ok(
      normalizado('../src/components/ContadoresDeAuxiliarDialog.vue').includes(
        'podrá cambiar su estado. Al guardar se avisa a {{ cuenta?.nombre }} y a cada contador que agregues o quites. Cada contador también puede cambiar su equipo desde «Mis auxiliares».',
      ),
    )
  })

  it('el alta de un auxiliar avisa a los contadores y al auxiliar', () => {
    assert.ok(
      normalizado('../src/components/NewUserDialog.vue').includes(
        'podrá cambiar su estado. Se les avisará a ellos y al auxiliar.',
      ),
    )
  })
})
