// Revisión de UI, rebanada 7 («Ficha y bitácora de auditoría»): textos (A), guardar sin
// mentir ni perder lo escrito (B), accesibilidad y paleta (C), movimiento (D) y el botón
// «Mensajes» en la tabla de escritorio.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { nombreCorto } from '../src/utils/listaAuditorias.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))
const estilosDe = (fuente) => fuente.slice(fuente.indexOf('<style'))

const ficha = leer('../src/pages/AuditoriaFichaPage.vue')
const bitacora = leer('../src/components/BitacoraAuditoria.vue')
const chat = leer('../src/components/ChatAuditoria.vue')
const tabla = leer('../src/components/AuditoriasTabla.vue')
const lista = leer('../src/pages/AuditoriasPage.vue')

describe('A: textos', () => {
  it('la ficha nombra el estado y el semáforo igual que la lista', () => {
    const plantilla = plantillaDe(ficha)
    assert.match(plantilla, /\{\{ etiquetaEstado\(auditoria\.estado\) \}\}/)
    assert.match(plantilla, /\{\{ etiquetaSemaforo\(auditoria\.semaforo\) \}\}/)
    assert.doesNotMatch(plantilla, /Estatus|estatus/)
  })

  it('la bitácora muestra «En revisión» y «En proceso» sin cambiar lo que se guarda', () => {
    assert.match(bitacora, /Revision: 'En revisión'/)
    assert.match(plantillaDe(bitacora), /etiquetaEstadoEvento\(ev\.estado\)/)
  })

  it('plazos con el mismo texto que el resto de la app, sin plural roto', () => {
    assert.doesNotMatch(ficha, /le quedan \$\{diasAutoridad\} días/)
    assert.match(plantillaDe(ficha), /textoDiasPlazo\(diasAutoridad\)/)
    assert.match(plantillaDe(ficha), /auditoria\.estado !== 'Completado'/)
    assert.doesNotMatch(bitacora, /const textoDias =/)
    assert.match(plantillaDe(bitacora), /textoDiasPlazo\(ev\.plazo\.dias\)/)
    assert.doesNotMatch(plantillaDe(ficha), /· vence\s/)
  })

  it('la tabla de la bitácora usa los nombres del formulario y el nombre corto de la fase', () => {
    const plantilla = plantillaDe(bitacora)
    assert.match(plantilla, /<th class="text-left">Fecha de entrega<\/th>/)
    assert.match(plantilla, /<th class="text-left">Observaciones<\/th>/)
    assert.doesNotMatch(plantilla, />Comentarios</)
    assert.match(plantilla, /\{\{ ev\.fase\.id \}\} · \{\{ nombreCorto\(ev\.fase\.nombre\) \}\}/)
    assert.equal(nombreCorto('Fase 3 · Observaciones'), 'Observaciones')
  })

  it('ayuda corta que no se imprime y avisos sin confusión', () => {
    assert.match(estilosDe(bitacora), /@media print[\s\S]*\.bitacora__ayuda/)
    assert.match(ficha, /El evento se guardó, pero el semáforo y el próximo plazo no se actualizaron\./)
    assert.match(bitacora, /label: 'Borrar evento'/)
  })
})

describe('B: comportamiento', () => {
  it('un fallo al releer no se presenta como fallo del guardado', () => {
    const script = scriptDe(bitacora)
    assert.match(script, /Se guardó, pero no se pudo actualizar la bitácora\./)
    assert.match(script, /const releerTrasCambio = async/)
    for (const funcion of ['guardar', 'registrarEntrega']) {
      const cuerpo = script.slice(script.indexOf(`const ${funcion} = `), script.indexOf('\n}\n', script.indexOf(`const ${funcion} = `)))
      const intento = cuerpo.slice(cuerpo.indexOf('try {'), cuerpo.indexOf('} catch'))
      assert.doesNotMatch(intento, /releer/, `${funcion}: releer va fuera del try del guardado`)
    }
  })

  it('pregunta antes de descartar lo escrito en el evento', () => {
    const script = scriptDe(bitacora)
    assert.match(script, /const hayDatosSinGuardar = computed/)
    assert.match(script, /¿Descartar los cambios\?/)
    assert.match(plantillaDe(bitacora), /label="Cancelar"[\s\S]*?@click="cancelar"/)
  })

  it('valida todos los campos a la vez, con fechas en formato y orden, y foco al primero', () => {
    const script = scriptDe(bitacora)
    assert.match(script, /const erroresCampo = ref\(\{\}\)/)
    assert.match(script, /'Escribe el evento\.'/)
    assert.match(script, /'Escribe la fecha como DD-MM-AAAA\.'/)
    assert.match(script, /La fecha límite no puede ser anterior a la fecha del evento\./)
    assert.match(script, /enfocarPrimerError\(\)/)
  })

  it('«Registrar entrega» pide confirmación', () => {
    assert.match(scriptDe(bitacora), /title: '¿Registrar la entrega\?'/)
    assert.match(plantillaDe(bitacora), /@click="confirmarEntrega\(ev\)"/)
  })

  it('al editar un evento, la vista y el foco van al formulario', () => {
    assert.match(scriptDe(bitacora), /scrollIntoView\(\{ block: 'nearest' \}\)/)
  })

  it('la ficha se actualiza en vivo y al volver a la ventana, sin aviso de error', () => {
    const script = scriptDe(ficha)
    assert.match(script, /eventos\.escuchar\('auditoria-actualizada'/)
    assert.match(script, /addEventListener\('visibilitychange', alVolver\)/)
    assert.match(script, /bitacora\.value\?\.refrescar\(\)/)
    assert.match(scriptDe(bitacora), /defineExpose\(\{ refrescar/)
  })

  it('el chat no vuelve a mostrar el cargador al reabrirse y Enter envía solo con teclado físico', () => {
    const script = scriptDe(chat)
    assert.match(script, /cargar\(\{ silencioso: mensajes\.value\.length > 0 \}\)/)
    assert.match(script, /\$q\.platform\.is\.mobile/)
  })
})

describe('C: accesibilidad y paleta', () => {
  it('el formulario de eventos asocia cada etiqueta con su campo; asterisco oculto', () => {
    const plantilla = plantillaDe(bitacora)
    assert.doesNotMatch(plantilla, /<label class="form-label">/)
    for (const id of ['ev-evento', 'ev-fase', 'ev-estado', 'ev-folio', 'ev-descripcion', 'ev-observaciones']) {
      assert.match(plantilla, new RegExp(`<label for="${id}"`))
      assert.match(plantilla, new RegExp(`<q-(input|select)\\s[^>]*for="${id}"`))
    }
    assert.doesNotMatch(plantilla, /<span (v-if="campo\.requerido" )?class="required-mark">/)
    assert.match(plantilla, /:aria-label="`Abrir calendario: \$\{campo\.etiqueta\}`"/)
  })

  it('el rojo queda para plazos vencidos o críticos', () => {
    assert.match(scriptDe(bitacora), /const esUrgente = /)
    assert.match(plantillaDe(bitacora), /'bitacora__fila--urgente': esUrgente\(ev\)/)
    assert.doesNotMatch(plantillaDe(bitacora), /ev\.plazo\.pendiente \? 'dg-error'/)
    assert.match(estilosDe(bitacora), /print-color-adjust:\s*exact/)
  })

  it('en celular «Mensajes» no se repite y el botón flotante no tapa la bitácora', () => {
    assert.match(plantillaDe(ficha), /label="Mensajes"[\s\S]*?class="control-touch gt-xs boton-presionable"/)
    assert.match(estilosDe(ficha), /@media \(max-width: 599px\)[\s\S]*padding-bottom:\s*88px/)
  })

  it('sin grises de Quasar en la bitácora y el chat', () => {
    for (const fuente of [bitacora, chat]) assert.doesNotMatch(plantillaDe(fuente), /grey-\d/)
  })

  it('la tabla de escritorio tiene «Mensajes» y abre el chat sin abrir la ficha', () => {
    assert.match(tabla, /defineEmits\(\['ver-detalle', 'editar', 'abrir-chat'\]\)/)
    assert.match(plantillaDe(tabla), /icon="forum"[\s\S]*?@click\.stop="emit\('abrir-chat', props\.row\)"/)
    assert.match(plantillaDe(lista), /<AuditoriasTabla[\s\S]*?@abrir-chat="\(fila\) => \(chatAbierto = fila\)"/)
  })
})

describe('D: movimiento', () => {
  it('selectores y calendarios en 180 ms, sin «cover»', () => {
    const plantilla = plantillaDe(bitacora)
    assert.equal((plantilla.match(/:transition-duration="180"/g) ?? []).length, 4)
    assert.doesNotMatch(plantilla, /\bcover\b/)
  })

  it('el formulario de evento aparece con un fundido y los botones responden al presionar', () => {
    assert.match(plantillaDe(bitacora), /<transition name="bitacora-form">/)
    assert.match(estilosDe(bitacora), /\.bitacora-form-enter-active/)
    assert.match(plantillaDe(bitacora), /label="Agregar evento"[\s\S]*?boton-presionable/)
    assert.match(plantillaDe(chat), /class="chat-auditoria__enviar control-touch boton-presionable"/)
    assert.doesNotMatch(estilosDe(chat), /\.chat-auditoria__enviar:active/)
  })

  it('los diálogos de la bitácora usan la entrada y salida de la app', () => {
    assert.match(scriptDe(bitacora), /transitionShow: 'dialogo-entra'/)
  })
})
