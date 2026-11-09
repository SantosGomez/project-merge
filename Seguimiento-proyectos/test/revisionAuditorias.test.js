// Revisión de UI, rebanada 6 («Auditorías: lista y registro»).
// A: textos y semáforo «En atención». B: carga y filtro activo.
// C: paleta y accesibilidad. D: movimiento y prefers-reduced-motion.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) =>
  readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))

const tabla = leer('../src/components/AuditoriasTabla.vue')
const item = leer('../src/components/AuditoriaItem.vue')
const pagina = leer('../src/pages/AuditoriasPage.vue')
const dialogo = leer('../src/components/AuditoriaFormDialog.vue')

describe('Grupo A: textos y semáforo', () => {
  it('el semáforo «Atención» se muestra como «En atención» en tabla e ítem (etiquetaSemaforo)', () => {
    assert.match(
      plantillaDe(tabla),
      new RegExp(String.raw`{{ etiquetaSemaforo\(props\.row\.semaforo\) }}`)
    )
    assert.match(
      plantillaDe(item),
      new RegExp(String.raw`{{ etiquetaSemaforo\(auditoria\.semaforo\) }}`)
    )
    // El valor de filtro sigue siendo 'Atención' (solo cambia la etiqueta visible).
    assert.match(pagina, /valor: 'Atención'/)
  })

  it('los títulos de sección del formulario están en español', () => {
    assert.match(dialogo, /Identificación/)
    assert.match(dialogo, /Periodo y fechas/)
    assert.match(dialogo, /Estatus y asignación/)
    assert.match(dialogo, new RegExp(String.raw`Notas \(opcional\)`))
  })
})

describe('Grupo B: comportamiento y estados de carga', () => {
  it('muestra q-skeleton mientras carga la lista inicial', () => {
    assert.match(pagina, /q-skeleton/)
    const carga = pagina.slice(
      pagina.indexOf('v-if="cargando"'),
      pagina.indexOf('v-else-if="errorCarga"')
    )
    assert.match(carga, /q-skeleton/)
  })

  it('la tabla recibe el filtro de semáforo activo y lo refleja con aria-pressed', () => {
    assert.match(pagina, /:filtro-semaforo="filtroSemaforo"/)
    assert.match(tabla, /filtroSemaforo/)
    assert.match(
      plantillaDe(tabla),
      /aria-pressed="[\s\S]*?filtroSemaforo[\s\S]*?===[\s\S]*?semaforo[\s\S]*?"/
    )
  })
})

describe('Grupo C: paleta y accesibilidad', () => {
  it('el chip de estado de la tabla lleva tooltip de ayuda', () => {
    const estado = tabla.slice(
      tabla.indexOf('#body-cell-estado'),
      tabla.indexOf('#body-cell-fase')
    )
    assert.match(estado, /q-tooltip/)
  })
})

describe('Grupo D: movimiento', () => {
  it('los selectores y el calendario respetan prefers-reduced-motion', () => {
    const estilos = estilosDe(dialogo)
    assert.match(estilos, /prefers-reduced-motion/)
  })
})
