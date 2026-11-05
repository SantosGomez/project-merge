// Revisión de UI, rebanada 2 (Estructura), grupo A: fondo de página, errores de carga en
// lenguaje llano y el menú como navegación con la página actual marcada.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const appScss = leer('../src/css/app.scss')
const indexHtml = leer('../index.html')
const layout = leer('../src/layouts/MaquetaLayout.vue')
const plantillaLayout = layout.split('<script')[0]
const errorState = leer('../src/components/ErrorState.vue')
const api = leer('../src/services/api.js')
const casesStore = leer('../src/stores/cases.js')
const countersStore = leer('../src/stores/counters.js')

describe('Fondo de página explícito', () => {
  it('el cuerpo tiene fondo de la paleta y esquema de color claro', () => {
    assert.match(appScss, /body\s*\{[^}]*background:\s*var\(--dg-superficie\)/)
    assert.match(appScss, /:root\s*\{[^}]*color-scheme:\s*light/)
    assert.match(indexHtml, /<meta name="color-scheme" content="light" \/>/)
  })
})

describe('Errores de carga en lenguaje llano', () => {
  it('api.js y los stores ya no hablan de usted ni muestran la petición técnica', () => {
    for (const [nombre, fuente] of [['api.js', api], ['cases.js', casesStore], ['counters.js', countersStore]]) {
      assert.doesNotMatch(fuente, /Reintente|Verifique|avise al/, `${nombre}: trato de tú`)
    }
    assert.doesNotMatch(api, /la petición \$\{/, 'sin «la petición GET /ruta»')
  })

  it('ErrorState muestra las tres partes con sus etiquetas también cuando el mensaje ya viene completo', () => {
    assert.match(errorState, /separarMensajeError\(props\.detail\)/)
    const plantilla = errorState.split('<script')[0]
    assert.match(plantilla, /\{\{ partes\.queOcurrio \}\}/)
    assert.match(plantilla, /\{\{ partes\.sobreQue \}\}/)
    assert.match(plantilla, /\{\{ partes\.queHacer \}\}/)
  })
})

describe('El menú lateral es la navegación principal', () => {
  it('la lista del menú está dentro de un <nav> con nombre, y el panel ya no se anuncia como complementario', () => {
    const drawer = plantillaLayout.slice(plantillaLayout.indexOf('<q-drawer'), plantillaLayout.indexOf('>', plantillaLayout.indexOf('<q-drawer')))
    assert.doesNotMatch(drawer, /aria-label=/)
    assert.match(plantillaLayout, /<nav aria-label="Navegación principal">\s*<q-list padding>/)
    assert.match(plantillaLayout, /<\/q-list>\s*<\/nav>/)
  })

  it('cada opción marca la página actual con aria-current', () => {
    const opciones = [...plantillaLayout.matchAll(/:to="\{ name: '([\w-]+)' \}"/g)]
    assert.ok(opciones.length >= 7, 'opciones del menú')
    for (const [, nombre] of opciones) {
      assert.ok(
        plantillaLayout.includes(`:aria-current="paginaActual('${nombre}')"`),
        `${nombre}: marca la página actual`,
      )
    }
    assert.match(layout, /const paginaActual = \(nombre\) => \(route\.name === nombre \? 'page' : undefined\)/)
  })

  it('hay un enlace «Saltar al contenido» que lleva al contenido de la página', () => {
    const boton = plantillaLayout.slice(plantillaLayout.lastIndexOf('<q-btn', plantillaLayout.indexOf('saltar-contenido')))
    assert.match(boton.slice(0, boton.indexOf('/>')), /label="Saltar al contenido"/)
    assert.match(boton.slice(0, boton.indexOf('/>')), /@click="saltarAlContenido"/)
    assert.match(plantillaLayout, /<q-page-container id="contenido-principal" tabindex="-1"/)
    assert.ok(
      plantillaLayout.indexOf('saltar-contenido') < plantillaLayout.indexOf('<q-drawer'),
      'es lo primero que recibe el foco',
    )
    assert.match(layout, /\.saltar-contenido:not\(:focus\)\s*\{[^}]*clip/, 'oculto hasta recibir el foco')
  })
})
