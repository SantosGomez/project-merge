// Revisión de UI, rebanada 5 («Dashboard admin»): textos (A), un fallo del detalle no tumba la
// pantalla y la prioridad se puede reintentar (B), paleta y accesibilidad (C), movimiento (D).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))

const pagina = leer('../src/pages/AdminDashboardPage.vue')
const detalle = leer('../src/components/DetalleContador.vue')
const fila = leer('../src/components/CounterCountsRow.vue')
const casoItem = leer('../src/components/CasoItem.vue')
const store = leer('../src/stores/counters.js')
const filasVista = leer('../src/utils/filasVista.js')

describe('Grupo A: textos', () => {
  it('saluda «Hola» al administrador, sin llamarlo «Contador»', () => {
    assert.match(plantillaDe(pagina), /Hola<template v-if="session\.nombreVisible">, \{\{ session\.nombreVisible \}\}<\/template>/)
    assert.doesNotMatch(pagina, /Buen día|bienvenido|Contador \{\{/)
  })

  it('las ayudas hablan de casos importantes y usan «Haz clic»', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /Revisa cuántos casos importantes tiene cada contador en cada estado/)
    assert.match(plantilla.replace(/\s+/g, ' '), /Haz clic en el nombre para ver todos sus casos o en un número para ver solo ese estado\./)
    for (const fuente of [pagina, fila, filasVista, detalle]) assert.doesNotMatch(fuente, /\bToca\b|Tócalo|la ✕/)
  })

  it('plural de contadores, título del detalle con el nombre y KPI «Alta sin finalizar»', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /contadores\.length === 1 \? 'contador' : 'contadores'/)
    assert.match(plantilla, /Casos importantes<template v-if="contadorSeleccionado"> de \{\{ contadorSeleccionado\.nombre \}\}<\/template>/)
    assert.match(pagina, /alta_abiertos: 'Alta sin finalizar'/)
  })

  it('al asignar un caso no importante, el aviso dice por qué no aparece', () => {
    assert.match(pagina, /No aparece en el dashboard porque no está marcado como importante\./)
  })

  it('el detalle no repite el aviso y habla del contador por su nombre', () => {
    const plantilla = plantillaDe(detalle)
    assert.doesNotMatch(plantilla, /Selecciona un contador de la lista para ver el cliente/)
    assert.match(plantilla, /se le avisará a \{\{ contador\.nombre \}\}/)
    assert.match(plantilla, /`\$\{contador\.nombre\} no tiene casos marcados como importantes\.`/)
  })

  it('el nombre accesible de cada conteo es corto', () => {
    assert.match(plantillaDe(fila), /:aria-label="`\$\{STATUS_LABELS\[status\]\}: \$\{counts\[status\] \?\? 0\} casos importantes\. Filtra el detalle\.`"/)
  })
})

describe('Grupo B: comportamiento', () => {
  it('un fallo del detalle se queda en el detalle, con «Reintentar», sin perder la selección', () => {
    assert.match(store, /errorDetalle: null/)
    assert.match(store, /this\.errorDetalle = normalizarError\(error, 'el detalle del contador'\)/)
    assert.match(store, /estadoDetalle: \(state\) =>\s*screenState\(\{\s*loading: state\.cargandoDetalle,\s*error: state\.errorDetalle,/)
    assert.match(plantillaDe(detalle), /<ErrorState[\s\S]*?v-else-if="estado === SCREEN_STATES\.error"[\s\S]*?@retry="emit\('reintentar'\)"/)
    assert.match(plantillaDe(pagina), /@reintentar="reintentarDetalle"/)
  })

  it('si falla el cambio de prioridad, el aviso ofrece «Reintentar»', () => {
    assert.match(pagina, /label: 'Reintentar'[\s\S]*?handler: \(\) => guardarPrioridad\(caso, prioridad, nombreContador\)/)
  })

  it('al volver a la pestaña se recargan el resumen y los conteos en silencio', () => {
    assert.match(pagina, /addEventListener\('visibilitychange', alVolver\)/)
    assert.match(pagina, /removeEventListener\('visibilitychange', alVolver\)/)
    assert.match(pagina, /const alVolver = \(\) => \{[\s\S]*?cargarResumen\(\{ silencioso: true \}\)[\s\S]*?contadoresStore\.refrescarEnSilencio\(\)/)
  })
})

describe('Grupo C: paleta y accesibilidad', () => {
  it('sin hexadecimales sueltos en la página', () => {
    assert.doesNotMatch(estilosDe(pagina), /#[0-9a-fA-F]{3,6}\b/)
  })

  it('«Ver directorio» es secundario (outline)', () => {
    const boton = pagina.slice(pagina.indexOf('class="dashboard-page__directory-btn'), pagina.indexOf('label="Ver directorio"'))
    assert.match(boton, /\boutline\b/)
    assert.doesNotMatch(boton, /unelevated/)
  })

  it('la fila del admin no repite la prioridad ni tiene paradas de Tab inútiles ni sangría en celular', () => {
    const plantilla = plantillaDe(casoItem)
    assert.match(plantilla, /<PriorityTag v-if="!puedeCambiarPrioridad" :priority="caso\.priority" \/>/)
    assert.doesNotMatch(plantilla, /class="caso-item__estado-fijo" tabindex/)
    assert.match(plantilla, /'caso-item--solo-lectura': soloLectura/)
    assert.match(estilosDe(casoItem), /\.caso-item--solo-lectura \.caso-item__acciones\s*\{\s*padding-left:\s*0/)
  })

  it('la fila del contador: hover solo con ratón y solo sobre lo que se pulsa; etiqueta de 0.75rem', () => {
    const estilos = estilosDe(fila)
    assert.doesNotMatch(estilos, /\n\.counter-row:hover/)
    assert.match(estilos, /@media \(hover: hover\) and \(pointer: fine\)\s*\{[\s\S]*?\.counter-row:not\(\.counter-row--selected\):has\(\.counter-row__select:hover\)/)
    assert.match(estilos, /\.counter-row__count-label\s*\{[^}]*font-size:\s*0\.75rem/)
  })
})

describe('Grupo D: movimiento', () => {
  it('botones y conteos responden al presionar; la selección cambia en 150 ms', () => {
    const plantilla = plantillaDe(fila)
    assert.match(plantilla, /class="counter-row__select boton-presionable"/)
    assert.match(plantilla, /class="counter-row__count boton-presionable"/)
    assert.match(estilosDe(fila), /transition:\s*background-color 150ms/)
    for (const clase of ['dashboard-page__directory-btn', 'dashboard-page__asignar-btn']) {
      assert.match(plantillaDe(pagina), new RegExp(`class="${clase} control-touch boton-presionable"`))
    }
  })

  it('pestañas con fundido de 150 ms y diálogos con la entrada y salida de la app', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /<q-tab-panels[^>]*transition-prev="fade"[^>]*transition-next="fade"[^>]*:transition-duration="150"/)
    assert.match(plantilla, /position="bottom"[\s\S]*?:transition-duration="220"/)
    assert.match(pagina, /transitionShow: 'dialogo-entra',\s*transitionHide: 'dialogo-sale',/)
  })
})
