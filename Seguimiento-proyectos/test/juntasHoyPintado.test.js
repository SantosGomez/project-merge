// «Mi Calendario»: la celda de hoy va pintada completa con el acento (rebanada 39).
// Verificación estática de los archivos: clases y colores de la paleta, como las demás pruebas de estilos.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const estilosDe = (texto) => texto.slice(texto.indexOf('<style'))
const plantillaDe = (texto) => texto.split('<script')[0]

// Cuerpo de la primera regla cuyo selector contiene `selector` (sin llaves anidadas).
const reglaDe = (estilos, selector) => {
  const inicio = estilos.indexOf(selector)
  assert.notEqual(inicio, -1, `falta la regla ${selector}`)
  const abre = estilos.indexOf('{', inicio)
  return estilos.slice(abre + 1, estilos.indexOf('}', abre))
}

const calendario = leer('../src/components/CalendarioJuntas.vue')
const semana = leer('../src/components/SemanaCalendario.vue')

describe('Semana y Día de escritorio (QCalendar)', () => {
  const estilos = estilosDe(calendario)
  const selector = '.calendario-juntas :deep(.q-calendar-day__head--day.q-current-day)'

  it('la cabecera de hoy se pinta completa con el azul marino ($primary) y texto blanco', () => {
    const regla = reglaDe(estilos, selector)
    assert.match(regla, /background:\s*var\(--q-primary\)/)
    assert.match(regla, /color:\s*var\(--dg-superficie\)/)
  })

  it('quita el círculo alrededor del número y deja el texto del botón en blanco', () => {
    const regla = reglaDe(
      estilos,
      `.calendario-juntas :deep(.q-calendar-day__head--day.q-current-day .q-calendar__button)`,
    )
    assert.match(regla, /border:\s*none/)
    assert.match(regla, /color:\s*inherit/)
  })

  it('el foco de teclado se ve en blanco sobre el marino', () => {
    assert.match(
      reglaDe(estilos, '.q-current-day .q-calendar__button:focus-visible)'),
      /outline:[^;]*var\(--dg-superficie\)/,
    )
  })

  it('un texto solo para lectores de pantalla dice «Hoy»', () => {
    assert.match(
      plantillaDe(calendario),
      /v-if="scope\.timestamp\.current"[^>]*class="sr-only"[^>]*>Hoy</,
    )
  })
})

describe('Semana y Día del celular (SemanaCalendario)', () => {
  const estilos = estilosDe(calendario)
  const tira = '.calendario-juntas__tira :deep('

  it('el día de hoy se pinta completo con el azul marino ($primary) y texto blanco', () => {
    const regla = reglaDe(estilos, tira + '.semana__dia--hoy)')
    assert.match(regla, /background:\s*var\(--q-primary\)/)
    assert.match(regla, /border-color:\s*var\(--q-primary\)/)
    assert.match(regla, /color:\s*var\(--dg-superficie\)/)
  })

  it('el nombre del día de hoy también va en blanco', () => {
    assert.match(
      reglaDe(estilos, tira + '.semana__dia--hoy .semana__nombre)'),
      /color:\s*var\(--dg-superficie\)/,
    )
  })

  it('si el día elegido es hoy se distingue con un aro interior', () => {
    assert.match(
      reglaDe(estilos, tira + '.semana__dia--hoy.semana__dia--elegido)'),
      /box-shadow:\s*inset[^;]*var\(--dg-superficie\)/,
    )
  })

  it('el día elegido que no es hoy conserva su fondo de selección', () => {
    assert.match(
      reglaDe(estilosDe(semana), '.semana__dia--elegido {'),
      /background:\s*var\(--dg-fondo-seleccion\)/,
    )
  })

  it('el calendario del administrador no usa la tira de «Mi Calendario»', () => {
    assert.doesNotMatch(
      leer('../src/components/CalendarioAdministrador.vue'),
      /calendario-juntas__tira/,
    )
  })

  it('la etiqueta accesible del día de hoy dice «(hoy)»', () => {
    assert.match(semana, /dia === props\.hoy \? ' \(hoy\)' : ''/)
  })

  it('no usa hexadecimales sueltos', () => {
    assert.doesNotMatch(estilos + estilosDe(semana), /#[0-9a-fA-F]{3,6}\b/)
  })
})
