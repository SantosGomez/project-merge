// Rebanada 09: el auxiliar ve a quién apoya en «Mi perfil» (sección «Contador que apoyas»).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const pagina = leer('../src/pages/ContadorAuxiliaresPage.vue')
const plantilla = pagina.split('<script')[0]
const seccion = plantilla.slice(plantilla.indexOf('perfil-titulo-contador') - 40, plantilla.indexOf('perfil-titulo-cartera'))

describe('vista «Mi perfil»: sección «Contador que apoyas»', () => {
  it('solo la ve el auxiliar y va antes de la cartera, dentro de la columna derecha', () => {
    assert.match(plantilla, /<section[^>]*v-if="session\.esAuxiliar"[^>]*aria-labelledby="perfil-titulo-contador"/)
    assert.match(plantilla, /<h2[^>]*>Contador que apoyas<\/h2>/)
    assert.ok(plantilla.indexOf('perfil-page__derecha') < plantilla.indexOf('Contador que apoyas'))
    assert.ok(plantilla.indexOf('Contador que apoyas') < plantilla.indexOf('Mi cartera de clientes'))
  })

  it('muestra avatar con iniciales, nombre y el texto de apoyo', () => {
    assert.match(seccion, /<q-avatar[^>]*>\{\{ inicialesDe\(contador\.nombre\) \}\}<\/q-avatar>/)
    assert.match(seccion, /Apoyas a \{\{ contador\.nombre \}\} con sus casos: ves sus casos y puedes cambiar su estado\./)
  })

  it('cargando usa esqueleto y el error es ErrorState con reintento', () => {
    assert.match(seccion, /<q-skeleton/)
    assert.match(seccion, /<ErrorState[\s\S]*@retry="cargarContadoresQueApoyo"/)
  })

  it('sin contadores muestra el estado vacío y ningún botón', () => {
    assert.match(seccion, /title="Todavía no apoyas a ningún contador"/)
    assert.match(seccion, /message="El despacho o un contador puede agregarte a su equipo; te llegará un aviso\."/)
    assert.doesNotMatch(seccion, /<q-btn/)
  })

  it('pide los datos al store solo si es auxiliar', () => {
    assert.match(pagina, /listarContadoresQueMeTienenComoAuxiliar\(Number\(session\.id\)\)/)
    assert.match(pagina, /if \(session\.esAuxiliar\)[\s\S]{0,40}cargarContadoresQueApoyo\(\)/)
  })
})
