// Revisión de UI, rebanada 4 («Mi resumen»): textos (A), fecha y deshacer (B),
// accesibilidad y colores (C) y movimiento (D).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { COLOR_ESTADO, tarjetasResumen } from '../src/utils/filasVista.js'
import { etiquetaSemaforo } from '../src/utils/semaforoAuditoria.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))

const pagina = leer('../src/pages/ContadorDashboardPage.vue')
const agenda = leer('../src/components/AgendaCasos.vue')
const resumen = leer('../src/components/ResumenEquipo.vue')
const dona = leer('../src/components/DonaEstados.vue')
const tablero = leer('../src/components/TableroAuditorias.vue')
const alertas = leer('../src/components/AlertasAuditoria.vue')
const filasVista = leer('../src/utils/filasVista.js')

describe('Grupo A: textos', () => {
  it('la agenda se llama «Tus próximos vencimientos» y ofrece ver todos si hay más', () => {
    const plantilla = plantillaDe(agenda)
    assert.match(plantilla, /<h2 id="agenda-casos-titulo" class="agenda-casos__titulo">Tus próximos vencimientos<\/h2>/)
    assert.match(plantilla, /v-if="totalAbiertos > casos\.length"[\s\S]*?:label="`Ver los \$\{totalAbiertos\} casos abiertos`"/)
    assert.match(plantilla, /query: \{ filtro: 'abiertos' \}/)
    assert.match(plantilla, /No tienes casos abiertos\. Los que registres en «Mis casos» aparecerán aquí/)
    assert.match(plantillaDe(pagina), /:total-abiertos="resumen\.abiertos"/)
  })

  it('«Haz clic» en vez de «Toca», y la ayuda habla de la leyenda', () => {
    for (const fuente of [pagina, agenda, dona, alertas, filasVista]) assert.doesNotMatch(fuente, /\bToca\b/)
    assert.match(pagina, /Haz clic en una tarjeta o en un estado de la leyenda/)
  })

  it('saludo «Hola», aviso de auditorías preciso y «Expediente» completo', () => {
    assert.match(plantillaDe(pagina), /Hola<template v-if="session\.nombreVisible">/)
    assert.doesNotMatch(pagina, /Buen día/)
    assert.match(alertas, /auditoría vencida o crítica/)
    assert.match(alertas, /auditorías vencidas o críticas/)
    assert.doesNotMatch(alertas, /Exp\. |requieren atención/)
  })

  it('el semáforo se lee «En atención» en el tablero', () => {
    assert.equal(etiquetaSemaforo('Atención'), 'En atención')
    assert.equal(etiquetaSemaforo('Crítico'), 'Crítico')
    assert.doesNotMatch(plantillaDe(tablero), /\{\{ (barra|auditoria)\.semaforo \}\}/)
  })

  it('la tarjeta de prioridad Alta se lee «Alta sin finalizar»', () => {
    assert.equal(tarjetasResumen({}).find((t) => t.clave === 'alta_abiertos').titulo, 'Alta sin finalizar')
  })
})

describe('Grupo B: comportamiento', () => {
  it('«hoy» se recalcula al volver a la ventana y se usa en el resumen y la agenda', () => {
    assert.match(pagina, /const hoy = ref\(hoyLocal\(\)\)/)
    assert.match(pagina, /resumenMisCasos\(cases\.casos, hoy\.value\)/)
    assert.match(pagina, /agendaCasos\(cases\.casos, hoy\.value\)/)
    assert.match(pagina, /:hoy="hoy"/)
    assert.match(pagina, /addEventListener\('visibilitychange'/)
    assert.match(pagina, /removeEventListener\('visibilitychange'/)
  })

  it('el aviso nombra al caso y «Finalizar» se puede deshacer', () => {
    assert.ok(pagina.includes('`Caso de ${cliente} ahora está ${STATUS_LABELS[estado]}.`'))
    assert.match(pagina, /label: 'Deshacer'[\s\S]*?cambiarEstado\(casoId, 'en_proceso'\)/)
  })

  it('al volver a la pestaña Auditorías solo se refresca en silencio', () => {
    assert.match(tablero, /onActivated\(\(\) => \(fases\.value\.length > 0 \? refrescarEnSilencio\(\) : cargar\(\)\)\)/)
  })

  it('mientras cargan los casos, la agenda reserva su lugar con un esqueleto', () => {
    assert.match(plantillaDe(pagina), /<q-skeleton v-if="cases\.cargando"/)
  })
})

describe('Grupo C: visual y accesibilidad', () => {
  it('rojo solo para Vencidos: «Próximos a vencer» y «Sin movimiento» usan aviso ámbar', () => {
    const tarjetas = tarjetasResumen({ proximosAVencer: 2, sinMovimiento: 1 }, { propios: true })
    for (const clave of ['proximosAVencer', 'sinMovimiento']) {
      const t = tarjetas.find((x) => x.clave === clave)
      assert.equal(t.alerta, false)
      assert.equal(t.aviso, true)
    }
    assert.match(resumen, /'resumen-tarjeta--aviso': tarjeta\.aviso/)
    assert.match(estilosDe(resumen), /\.resumen-tarjeta--aviso\s*\{[^}]*var\(--dg-importante\)/)
  })

  it('la leyenda de la dona mide 44 px cuando se puede pulsar', () => {
    assert.match(estilosDe(dona), /\.dona-estados__item\.q-item--clickable\s*\{[^}]*min-height:\s*44px/)
  })

  it('tarjetas: lista intacta, botón por dentro y «presionado» solo donde filtran (admin)', () => {
    const plantilla = plantillaDe(resumen)
    assert.match(plantilla, /<q-card[^>]*tag="li"/)
    assert.match(plantilla, /<q-card-section[\s\S]*?:tabindex="seleccionable \? 0 : undefined"[\s\S]*?:role="seleccionable \? 'button' : undefined"/)
    assert.match(plantilla, /:aria-pressed="seleccionable && !propios \? String\(activa === tarjeta\.clave\) : undefined"/)
    assert.match(plantillaDe(dona), /:aria-pressed="seleccionable && !propios \?/)
  })

  it('tabla «Avance»: fases con nombre para el lector, filas con nombre y Espacio; Tipo y Dependencia ocultos en celular', () => {
    const plantilla = plantillaDe(tablero)
    assert.match(plantilla, /<span class="sr-only">\{\{ textoMarca\(marca, i\) \}\}<\/span>/)
    assert.match(plantilla, /class="avance__fila"[\s\S]*?:aria-label="`Abrir la ficha de \$\{auditoria\.cliente\}`"[\s\S]*?@keydown\.space\.prevent="verFicha\(auditoria\.id\)"/)
    assert.match(plantilla, /role="link"\s+:aria-label="`Abrir la ficha de \$\{auditoria\.cliente\}`"\s+class="kanban__tarjeta"/)
    assert.match(plantilla, /<th class="text-left gt-xs">Tipo<\/th>/)
    assert.match(plantilla, /<th class="text-left gt-xs">Dependencia<\/th>/)
    assert.match(leer('../src/css/app.scss'), /\.sr-only\s*\{/)
  })

  it('colores de la dona desde la paleta y etiqueta central legible', () => {
    assert.deepEqual(Object.values(COLOR_ESTADO), [
      'var(--dg-estado-pendiente)',
      'var(--dg-estado-en-proceso)',
      'var(--dg-estado-finalizado)',
    ])
    assert.match(plantillaDe(dona), /:style="\{ stroke: segmento\.color \}"/)
    assert.match(estilosDe(dona), /\.dona-estados__total-etiqueta\s*\{[^}]*font-size:\s*5\.5px/)
  })

  it('la agenda sin tooltip doble en la fila y con el botón abajo en celular', () => {
    const plantilla = plantillaDe(agenda)
    assert.doesNotMatch(plantilla, /Abre el formulario para editar este caso/)
    assert.match(estilosDe(agenda), /@media \(max-width: 599px\)[\s\S]*\.agenda-casos__accion-seccion/)
  })
})

describe('Grupo D: movimiento', () => {
  it('las pestañas cambian con un fundido de 150 ms', () => {
    for (const fuente of [pagina, tablero]) {
      assert.match(plantillaDe(fuente), /<q-tab-panels[^>]*transition-prev="fade"[^>]*transition-next="fade"[^>]*:transition-duration="150"/)
    }
  })

  it('Empezar/Finalizar, tarjetas y leyenda responden al presionar', () => {
    assert.match(plantillaDe(agenda), /class="agenda-casos__accion control-touch boton-presionable"/)
    assert.match(resumen, /'boton-presionable': seleccionable/)
    assert.match(plantillaDe(dona), /:class="\{ 'boton-presionable': seleccionable \}"/)
  })

  it('la fila de la agenda sale en 150 ms y las demás se reacomodan', () => {
    assert.match(plantillaDe(agenda), /<TransitionGroup name="agenda-salida">/)
    assert.match(estilosDe(agenda), /\.agenda-salida-leave-active\s*\{[^}]*150ms/)
    assert.match(estilosDe(agenda), /\.agenda-salida-move\s*\{/)
  })

  it('la dona cambia con transición y el hover solo con ratón', () => {
    assert.match(estilosDe(dona), /transition:\s*stroke-dasharray 300ms/)
    assert.match(estilosDe(resumen), /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.resumen-tarjeta--clicable:hover/)
    assert.match(estilosDe(tablero), /@media \(hover: hover\) and \(pointer: fine\)\s*\{[^@]*\.kanban__tarjeta:hover[^@]*\.avance__fila:hover/)
  })
})
