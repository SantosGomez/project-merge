// Revisión de UI, rebanada 3 («Mis casos»): textos claros (grupo A), un fallo al guardar no
// tumba la lista y el formulario no pierde lo escrito (grupo B), colores de la paleta y
// accesibilidad de la lista (grupo C).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { paginar } from '../src/utils/filtrosCasos.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))
const reglaDe = (fuente, selector) =>
  fuente.match(new RegExp(String.raw`(?:^|\n)${selector}\s*\{([^}]*)\}`))?.[1]

const pagina = leer('../src/pages/MyCasesPage.vue')
const casoItem = leer('../src/components/CasoItem.vue')
const formulario = leer('../src/components/CaseFormDialog.vue')
const filtros = leer('../src/components/FiltrosCasos.vue')
const casesStore = leer('../src/stores/cases.js')
const variables = leer('../src/css/quasar.variables.scss')

describe('Grupo A: textos de «Mis casos»', () => {
  it('el tooltip de «Vence» dice quién pone la fecha (contador y administrador)', () => {
    assert.doesNotMatch(casoItem, /calculada en días hábiles/)
    assert.ok(casoItem.includes('Fecha límite para terminar el caso. La pones tú y puedes cambiarla con «Editar».'))
    assert.ok(casoItem.includes('Fecha límite que puso el contador al registrar el caso.'))
  })

  it('la cabecera y el vacío hablan de casos registrados y asignados', () => {
    const plantilla = plantillaDe(pagina)
    assert.ok(
      plantilla.includes(
        'Aquí están los casos que registraste y los que te asignó el administrador. Cambia el estado desde la lista; para el resto de los datos usa «Editar».',
      ),
    )
    assert.match(plantilla, /title="Todavía no tienes casos"/)
    assert.ok(
      plantilla.includes(
        'message="Registra el primero con «Registrar caso». Los casos que te asigne el administrador también aparecerán aquí."',
      ),
    )
    assert.doesNotMatch(pagina, /Usa el control|tus casos asignados/)
  })

  it('al finalizar un caso el aviso dice dónde encontrarlo', () => {
    assert.ok(pagina.includes('marcado como Finalizado. Lo encuentras en el filtro «Finalizado».'))
    assert.ok(pagina.includes('Estado cambiado a «'))
  })

  it('«sin resultados» distingue los filtros iniciales y ofrece «Limpiar filtros»', () => {
    const plantilla = plantillaDe(pagina)
    assert.ok(plantilla.includes('No tienes casos abiertos. Los terminados están en el filtro «Finalizado».'))
    const bloque = plantilla.slice(plantilla.indexOf('class="sin-resultados"'), plantilla.indexOf('<q-list'))
    assert.match(bloque, /<q-btn[\s\S]*?label="Limpiar filtros"[\s\S]*?@click="limpiarFiltros"/)
  })

  it('los mensajes del formulario y del store van en tú', () => {
    assert.doesNotMatch(formulario, /\bUse\b|Se debe elegir/)
    assert.ok(formulario.includes("'Elige una prioridad.'"))
    assert.doesNotMatch(casesStore, /de sus casos/)
    assert.match(casesStore, /'la carga de tus casos'/)
  })

  it('un error al guardar no dice que falló la carga de datos', () => {
    assert.match(casesStore, /No se pudo guardar en el servidor/)
    for (const sobreQue of ['el registro del caso', 'la asignación del caso', 'el cambio del caso']) {
      assert.match(casesStore, new RegExp(String.raw`normalizarErrorDeGuardado\(error, '${sobreQue}'\)`))
    }
  })

  it('contadores de caracteres coherentes y ayudas que sí informan', () => {
    const plantilla = plantillaDe(formulario)
    const cliente = plantilla.slice(plantilla.indexOf('v-model="client"'), plantilla.indexOf('</q-input>', plantilla.indexOf('v-model="client"')))
    assert.match(cliente, /maxlength="80"/)
    for (const campo of ['fechaInicio', 'fechaVencimiento']) {
      const inicio = plantilla.indexOf(`v-model="${campo}"`)
      const bloque = plantilla.slice(inicio, plantilla.indexOf('<template #append>', inicio))
      assert.doesNotMatch(bloque, /\bcounter\b/, `${campo} sin contador «0/10»`)
    }
    assert.ok(plantilla.includes('Indica qué tan urgente es el caso. No cambia la fecha de vencimiento.'))
    assert.ok(plantilla.includes('Todavía no has cambiado ningún dato.'))
  })

  it('la paginación usa singular con un solo caso', () => {
    assert.equal(paginar([{ id: 1 }], 1, 25).texto, 'Mostrando 1–1 de 1 caso')
    assert.equal(paginar([{ id: 1 }, { id: 2 }], 1, 25).texto, 'Mostrando 1–2 de 2 casos')
  })
})

describe('Grupo B: comportamiento de «Mis casos»', () => {
  it('un fallo al guardar un cambio no sustituye la lista por el error', () => {
    const script = scriptDe(pagina)
    assert.doesNotMatch(script, /errorCambio/)
    assert.match(script, /error: cases\.error,/)
  })

  it('el aviso de fallo nombra al cliente y ofrece «Reintentar» con el mismo cambio', () => {
    const script = scriptDe(pagina)
    assert.ok(script.includes('No se guardó el cambio del caso de ${cliente}.'))
    assert.match(script, /actions: \[[\s\S]*?label: 'Reintentar'[\s\S]*?handler: \(\) => guardarCambio\(caseId, cambios\)/)
  })

  it('solo se deshabilita la fila que se está guardando', () => {
    assert.match(plantillaDe(pagina), /:deshabilitado="guardandoId === item\.id"/)
  })

  it('«hoy» se recalcula al volver a la ventana', () => {
    const script = scriptDe(pagina)
    assert.match(script, /const hoy = ref\(hoyLocal\(\)\)/)
    assert.match(script, /addEventListener\('visibilitychange'/)
    assert.match(script, /removeEventListener\('visibilitychange'/)
  })

  it('el diálogo no se cierra con Esc ni con clic fuera si hay datos escritos: pregunta antes', () => {
    const plantilla = plantillaDe(formulario)
    assert.match(plantilla, /:persistent="cases\.guardando \|\| hayDatosSinGuardar"/)
    assert.match(plantilla, /@shake="pedirDescartar"/)
    assert.match(plantilla, /¿Descartar los cambios\?/)
    assert.match(plantilla, /label="Seguir editando"/)
    assert.match(plantilla, /label="Descartar"/)
    assert.match(scriptDe(formulario), /const hayDatosSinGuardar = computed/)
  })

  it('valida todos los campos a la vez y lleva el foco al primero con error', () => {
    const script = scriptDe(formulario)
    assert.match(script, /const erroresCampo = ref\(\{\}\)/)
    assert.doesNotMatch(script, /formError/)
    assert.match(script, /enfocarPrimerError\(\)/)
    assert.match(script, /scrollIntoView/)
  })
})

describe('Grupo C: paleta y accesibilidad de la lista', () => {
  it('sin hexadecimales sueltos en la página, la fila y los filtros', () => {
    for (const [nombre, fuente] of [['MyCasesPage', pagina], ['CasoItem', casoItem], ['FiltrosCasos', filtros]]) {
      assert.doesNotMatch(estilosDe(fuente), /#[0-9a-fA-F]{3,6}\b/, `${nombre}: colores de la paleta`)
    }
    assert.match(variables, /importante-fondo-suave: #fffaf0/)
  })

  it('sin grises ni ámbar de Quasar: estrella, chips e interruptores con colores de la paleta', () => {
    for (const fuente of [pagina, casoItem, filtros, formulario]) {
      assert.doesNotMatch(plantillaDe(fuente), /'?(grey|amber)-\d'?|color="negative"/)
    }
    assert.match(casoItem, /caso\.important \? 'dg-importante' : 'dg-texto-tenue'/)
  })

  it('«Importante» y «En proceso desde» ya no son paradas de Tab; «Vence» sí', () => {
    const plantilla = plantillaDe(casoItem)
    const importante = plantilla.slice(plantilla.indexOf('class="caso-item__importante"') - 40, plantilla.indexOf('</span>', plantilla.indexOf('class="caso-item__importante"')))
    assert.doesNotMatch(importante, /tabindex/)
    const enProceso = plantilla.slice(plantilla.indexOf('caso.inProgressSince && !soloLectura') - 20, plantilla.indexOf('</span>', plantilla.indexOf('caso.inProgressSince && !soloLectura')))
    assert.doesNotMatch(enProceso, /tabindex/)
    assert.match(plantilla, /class="caso-item__vence"[\s\S]{0,120}tabindex="0"/)
  })

  it('las filas son hijas directas de la lista (se ven los separadores y Ctrl+F las encuentra)', () => {
    assert.doesNotMatch(pagina, /q-intersection/)
    // TransitionGroup sin `tag` no agrega envoltorio: las filas siguen siendo hijas directas.
    assert.match(
      plantillaDe(pagina),
      /<q-list[^>]*separator[^>]*>\s*(?:<!--[\s\S]*?-->\s*)?<TransitionGroup\s+name="caso-salida"\s+:css="animarSalida"\s+:move-class="animarSalida \? 'caso-salida-move' : 'caso-sin-movimiento'"\s*>\s*<CasoItem\s+v-for="item in filas"/,
    )
  })

  it('los chips de estado tienen un área táctil de 44 px', () => {
    const regla = reglaDe(estilosDe(filtros), String.raw`\.filtros-casos__chip::after`) ?? ''
    assert.match(regla, /inset:\s*-6px 0/)
  })

  it('el asterisco de obligatorio no se lee en voz alta', () => {
    assert.doesNotMatch(formulario, /aria-label="obligatorio"/)
    assert.match(formulario, /<span aria-hidden="true" class="required-mark">\*<\/span>/)
  })

  it('cada fila del contador avisa «Vencido» o «Vence pronto» con una etiqueta', () => {
    const plantilla = plantillaDe(casoItem)
    assert.match(plantilla, /v-if="vencido"[^>]*class="caso-item__alerta caso-item__alerta--vencido"/)
    assert.match(plantilla, /v-else-if="proximo"[^>]*class="caso-item__alerta caso-item__alerta--pronto"/)
    assert.match(scriptDe(casoItem), /const proximo = computed\(\(\) => Boolean\(props\.caso\.proximo\) && !props\.soloLectura\)/)
    assert.match(scriptDe(pagina), /proximo: esCasoProximoAVencer\(caso, hoy\.value\)/)
  })
})

const appScss = leer('../src/css/app.scss')

describe('Grupo D: movimiento (rápido, con salida más corta que la entrada)', () => {
  it('la fila que pasa a Finalizado sale en 150 ms; al filtrar no se anima nada', () => {
    const script = scriptDe(pagina)
    assert.match(script, /const animarSalida = ref\(false\)/)
    assert.match(script, /if \(cambios\.estado === 'finalizado'\) animarSalida\.value = true/)
    const estilos = estilosDe(pagina)
    assert.match(reglaDe(estilos, String.raw`\.caso-salida-leave-active`) ?? '', /transition:\s*opacity 150ms/)
    assert.match(reglaDe(estilos, String.raw`\.caso-salida-leave-active`) ?? '', /position:\s*absolute/)
    assert.match(estilos, /\.caso-salida-move\s*\{[^}]*transition:\s*transform 150ms/)
    assert.match(estilos, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.caso-salida-move/)
  })

  it('los botones responden al presionar con una escala sutil', () => {
    assert.match(appScss, /\.boton-presionable\s*\{[^}]*transition:\s*transform 120ms/)
    assert.match(appScss, /\.boton-presionable:active:not\(\.disabled\)\s*\{[^}]*transform:\s*scale\(0\.97\)/)
    assert.match(plantillaDe(pagina), /class="my-cases-page__register-btn control-touch boton-presionable"/)
    assert.match(plantillaDe(casoItem), /label="Editar"[\s\S]*?class="control-touch boton-presionable"/)
    assert.match(estilosDe(casoItem), /\.caso-item__estrella-boton:active:not\(\.disabled\)\s*\{[^}]*scale\(0\.9\)/)
    for (const etiqueta of ['Seguir editando', 'Descartar']) {
      assert.match(plantillaDe(formulario), new RegExp(String.raw`label="${etiqueta}"[^>]*class="control-touch boton-presionable"`))
    }
  })

  it('los menús de los selectores duran 180 ms', () => {
    for (const [nombre, fuente] of [['CasoItem', casoItem], ['MyCasesPage', pagina], ['CaseFormDialog', formulario]]) {
      const selects = plantillaDe(fuente).split('<q-select').slice(1).map((s) => s.slice(0, s.indexOf('>')))
      assert.ok(selects.length > 0, `${nombre} tiene selectores`)
      for (const s of selects) assert.match(s, /:transition-duration="180"/, `${nombre}: menú en 180 ms`)
    }
  })

  it('el diálogo entra en 220 ms desde 0.95 y sale en 150 ms', () => {
    assert.match(plantillaDe(formulario), /transition-show="dialogo-entra"\s+transition-hide="dialogo-sale"\s+:transition-duration="220"/)
    assert.match(appScss, /\.q-transition--dialogo-entra-enter-active\s*\{[^}]*220ms/)
    assert.match(appScss, /\.q-transition--dialogo-entra-enter-from\s*\{[^}]*scale\(0\.95\)/)
    assert.match(appScss, /\.q-transition--dialogo-sale-leave-active\s*\{[^}]*150ms/)
  })

  it('el calendario nace de su icono (jump-down en 180 ms), sin cubrir el campo', () => {
    const proxies = plantillaDe(formulario).split('<q-popup-proxy').slice(1).map((s) => s.slice(0, s.indexOf('>')))
    assert.equal(proxies.length, 2)
    for (const p of proxies) {
      assert.doesNotMatch(p, /\bcover\b|"scale"/)
      assert.match(p, /transition-show="jump-down"/)
      assert.match(p, /:transition-duration="180"/)
    }
  })

  it('campos y opciones con curva de salida rápida; el hover de las opciones solo con ratón y desde la paleta', () => {
    assert.match(appScss, /\$curva-salida:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/)
    assert.doesNotMatch(appScss, /0\.2s ease|0\.25s ease|0\.15s ease|#f1f5f9/)
    assert.match(appScss, /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.item-opcion-custom:hover\s*\{\s*background:\s*var\(--dg-fondo-hover\)/)
  })
})
