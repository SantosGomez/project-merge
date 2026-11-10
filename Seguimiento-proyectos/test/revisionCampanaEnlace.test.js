// Campana con enlace al caso (rebanada 8, corregida el 2026-11-10 tras la auditoría):
// tocar un aviso lleva al contador a «Mis casos» con el caso a la vista (filtro y página
// ajustados) y resaltado. Las pruebas exigen el destino y la ubicación, no solo palabras.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { destinoDeAviso } from '../src/utils/avisos.js'
import { FILTROS_INICIALES, ubicarCaso } from '../src/utils/filtrosCasos.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const HOY = '2026-11-10'

// Caso interno mínimo: el orden de la lista es por vencimiento y luego por id.
const caso = (id, datos = {}) => ({
  id,
  cliente: `Cliente ${id}`,
  estado: 'pendiente',
  prioridad: 'media',
  importante: 0,
  fecha_vencimiento: `2026-12-${String(id).padStart(2, '0')}`,
  ...datos,
})

describe('destinoDeAviso: adónde lleva un aviso de la campana', () => {
  it('lleva al contador a «Mis casos» con el caso indicado, sin arrastrar otros filtros', () => {
    assert.deepEqual(destinoDeAviso({ casoId: 42 }, 'contador'), {
      name: 'contador-casos',
      query: { casoId: '42' },
    })
  })

  it('un aviso sin caso (p. ej. del chat de auditoría) no lleva a ningún lado', () => {
    assert.equal(destinoDeAviso({ casoId: null }, 'contador'), null)
    assert.equal(destinoDeAviso({}, 'contador'), null)
  })

  it('fuera del rol contador no hay enlace: no existe una vista del caso a la cual llevar', () => {
    assert.equal(destinoDeAviso({ casoId: 42 }, 'administrador'), null)
  })
})

describe('ubicarCaso: filtro y página para que el caso del aviso quede a la vista', () => {
  const quince = Array.from({ length: 15 }, (_, i) => caso(i + 1))

  it('si el caso cumple los filtros actuales, los conserva y elige su página', () => {
    const filtros = { ...FILTROS_INICIALES }
    const resultado = ubicarCaso(quince, '12', filtros, HOY, 10)

    assert.equal(resultado.filtros, filtros, 'no cambia los filtros del usuario')
    assert.equal(resultado.pagina, 2, 'el caso 12 de 15 está en la segunda página de 10')
  })

  it('si los filtros lo ocultan (p. ej. ya Finalizado), muestra todos los estados', () => {
    const casos = [...quince, caso(16, { estado: 'finalizado' })]
    const resultado = ubicarCaso(casos, 16, { ...FILTROS_INICIALES }, HOY, 10)

    assert.deepEqual(resultado.filtros, { ...FILTROS_INICIALES, estado: 'todos' })
    assert.equal(resultado.pagina, 2)
  })

  it('si el caso ya no está en la lista, devuelve null', () => {
    assert.equal(ubicarCaso(quince, 99, { ...FILTROS_INICIALES }, HOY, 10), null)
    assert.equal(ubicarCaso(quince, undefined, { ...FILTROS_INICIALES }, HOY, 10), null)
  })
})

describe('CampanaAvisos y «Mis casos»: el enlace se usa', () => {
  const campana = leer('../src/components/CampanaAvisos.vue')
  const plantillaCampana = campana.split('<script')[0]
  const misCasos = leer('../src/pages/MyCasesPage.vue')

  it('el aviso con caso es clicable con teclado y cierra el menú al navegar', () => {
    assert.match(plantillaCampana, /:clickable="Boolean\(destinoDeAviso\(aviso, session\.rol\)\)"/)
    assert.match(plantillaCampana, /v-close-popup="Boolean\(destinoDeAviso\(aviso, session\.rol\)\)"/)
  })

  it('la campana navega con destinoDeAviso y «Mis casos» lee casoId con ubicarCaso', () => {
    assert.match(campana, /destinoDeAviso\(aviso, session\.rol\)/)
    assert.doesNotMatch(campana, /\.\.\.route\.query/, 'no arrastra la consulta de la pantalla actual')
    assert.match(misCasos, /route\.query\.casoId/)
    assert.match(misCasos, /ubicarCaso\(/)
  })
})
