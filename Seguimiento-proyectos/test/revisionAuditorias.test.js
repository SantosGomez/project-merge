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
    assert.match(dialogo, /Estado y asignación/)
    assert.match(dialogo, new RegExp(String.raw`Notas \(opcional\)`))
  })
})

describe('Grupo B: comportamiento y estados de carga', () => {
  it('mientras carga muestra un esqueleto con la forma de la lista y se anuncia con role="status"', () => {
    const carga = pagina.slice(
      pagina.indexOf('v-if="cargando"'),
      pagina.indexOf('v-else-if="errorCarga"')
    )
    assert.match(carga, /role="status"/)
    assert.match(carga, /<q-skeleton v-for="n in 3"/)
    assert.match(carga, /Cargando auditorías…/)
  })

  // La lista ya viene filtrada por semáforo: resaltar las filas «del filtro» las marcaba todas.
  it('la tabla no resalta filas por el filtro ni pone aria-pressed en un chip que no se pulsa', () => {
    assert.doesNotMatch(tabla, /filtroSemaforo|filtro-activo|aria-pressed/)
    assert.doesNotMatch(pagina, /:filtro-semaforo=/)
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

// Una regla scoped no alcanza los menús y calendarios de Quasar (se montan en el body); si hace
// falta, el movimiento reducido de los menús va en app.scss, que es global.
describe('Grupo D: movimiento', () => {
  it('el formulario no trae una regla de movimiento reducido scoped que no surte efecto', () => {
    assert.doesNotMatch(estilosDe(dialogo), /prefers-reduced-motion/)
  })
})

// --- Evaluación completa de la rebanada 6 (A, B, C sin el botón «Mensajes» en la tabla, D) ---
const semaforoUtil = leer('../src/utils/semaforoAuditoria.js')
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))

describe('Rebanada 6, A: textos', () => {
  it('cada campo obligatorio tiene su mensaje en tú (sin «es obligatorio» armado ni usted)', () => {
    assert.doesNotMatch(dialogo, /es obligatorio\.`|Seleccione/)
    for (const mensaje of [
      'Escribe el nombre del cliente.',
      'Escribe el no. de expediente u orden.',
      'Escribe la dependencia que audita.',
      'Elige o escribe el tipo de auditoría.',
      'Escribe la fecha de inicio del periodo revisado.',
      'Escribe el final del periodo revisado.',
      'Escribe la fecha de inicio.',
      'Escribe la fecha de vencimiento.',
      'Elige al menos un contador.',
    ]) assert.ok(dialogo.includes(mensaje), mensaje)
  })

  it('un error al guardar dice que los datos siguen en el formulario', () => {
    assert.match(dialogo, /tus datos siguen en el formulario/)
  })

  it('la tarjeta no se contradice: «Próximo: qué · fecha (días)»', () => {
    assert.doesNotMatch(plantillaDe(item), /· vence\s/)
  })

  it('«Estado» en todo el formulario, «Aplazado por acta» y «En proceso» iguales en filtro y chips', () => {
    assert.doesNotMatch(plantillaDe(dialogo), /Estatus|estatus/)
    assert.doesNotMatch(dialogo, /El estatus/)
    assert.match(pagina, /etiqueta: 'Aplazado por acta'/)
    for (const fuente of [tabla, item]) assert.match(plantillaDe(fuente), /etiquetaEstado\(/)
  })

  it('el resumen usa la misma ayuda del semáforo que los tooltips', () => {
    assert.match(plantillaDe(pagina), /AYUDA_SEMAFORO\[tarjeta\.valor\]/)
    assert.match(semaforoUtil, /Concluida: 'Auditorías con estado Completado\.'/)
  })

  it('vacío sin mezclar registradas/asignadas y aviso si una auditoría registrada queda oculta por filtros', () => {
    assert.match(plantillaDe(pagina), /title="Todavía no hay auditorías"/)
    assert.match(pagina, /No aparece porque hay filtros activos\./)
    assert.match(pagina, /Cambios de la auditoría guardados\./)
  })
})

describe('Rebanada 6, B: comportamiento del formulario y de la lista', () => {
  it('no pierde lo escrito: pregunta antes de descartar', () => {
    const plantilla = plantillaDe(dialogo)
    assert.match(plantilla, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(plantilla, /@shake="pedirDescartar"/)
    assert.match(plantilla, /¿Descartar los cambios\?/)
  })

  it('valida todo a la vez y lleva el foco al primer error', () => {
    const script = scriptDe(dialogo)
    assert.match(script, /const erroresCampo = ref\(\{\}\)/)
    assert.doesNotMatch(script, /formError/)
    assert.match(script, /enfocarPrimerError\(\)/)
  })

  it('valida formato y orden de las fechas escritas a mano, con la ayuda visible', () => {
    assert.match(dialogo, /Escribe la fecha como DD-MM-AAAA\./)
    assert.match(dialogo, /La fecha de vencimiento no puede ser anterior a la fecha de inicio\./)
    assert.match(dialogo, /fechaADominioBackend/)
    assert.match(plantillaDe(dialogo), /:hint="campo\.ayuda"/)
  })

  it('al volver a la ventana la lista se refresca sin esqueleto', () => {
    assert.match(pagina, /addEventListener\('visibilitychange', alVolver\)/)
    assert.match(pagina, /removeEventListener\('visibilitychange', alVolver\)/)
  })
})

describe('Rebanada 6, C: accesibilidad y paleta', () => {
  it('cada etiqueta está asociada a su campo y el asterisco no se lee', () => {
    const plantilla = plantillaDe(dialogo)
    assert.doesNotMatch(plantilla, /<label class="form-label">/)
    for (const id of ['aud-cliente', 'aud-expediente', 'aud-dependencia', 'aud-tipo']) {
      assert.match(plantilla, new RegExp(`<label for="${id}"`))
      assert.match(plantilla, new RegExp(`<q-(input|select)\\s[^>]*for="${id}"`))
    }
    assert.doesNotMatch(plantilla, /<span class="required-mark">/)
    assert.match(plantilla, /:aria-label="`Abrir calendario: \$\{campo\.etiqueta\}`"/)
  })

  it('sin grises de Quasar y con etiquetas y chips cómodos en celular', () => {
    assert.doesNotMatch(plantillaDe(pagina), /grey-\d/)
    assert.doesNotMatch(estilosDe(pagina), /0\.68rem/)
    assert.match(estilosDe(pagina), /\.auditorias-page__chip::after\s*\{[^}]*inset:\s*-6px 0/)
  })
})

describe('Rebanada 6, D: movimiento', () => {
  it('el formulario entra y sale como los demás diálogos y sus calendarios nacen del icono', () => {
    const plantilla = plantillaDe(dialogo)
    assert.match(plantilla, /transition-show="dialogo-entra"\s+transition-hide="dialogo-sale"/)
    assert.doesNotMatch(plantilla, /transition-show="scale"|\bcover\b/)
    assert.match(plantilla, /<q-popup-proxy[^>]*transition-show="jump-down"/)
  })

  it('los botones responden al presionar', () => {
    assert.match(plantillaDe(pagina), /class="auditorias-page__register-btn control-touch gt-xs boton-presionable"/)
    assert.match(plantillaDe(pagina), /class="resumen-semaforo boton-presionable"/)
    assert.match(plantillaDe(item), /boton-presionable/)
    assert.match(plantillaDe(dialogo), /label="Cancelar"[^>]*boton-presionable/)
  })
})
