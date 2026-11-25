/**
 * Oráculos de `pages/IndexPage.vue` para la rebanada 50: textos y tono de Recepción.
 * Son pruebas de fuente (un `.vue` no se puede importar en `node --test`).
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FUENTE = readFileSync(fileURLToPath(new URL('./IndexPage.vue', import.meta.url)), 'utf8')
const PLANTILLA = FUENTE.replace(/<!--[\s\S]*?-->/g, '')
const CODIGO = PLANTILLA.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const SOLO_PLANTILLA = PLANTILLA.slice(0, PLANTILLA.indexOf('</template>\n\n<script'))

const PLANA = PLANTILLA.replace(/\s+/g, ' ')
const contiene = (texto) => assert.ok(PLANA.includes(texto), `falta «${texto}»`)

describe('rebanada 50 · encabezado y secciones', () => {
  test('título, subtítulo y línea discreta del folio', () => {
    contiene('Recepción de documentos')
    contiene('Registra lo que entrega el cliente y genera su acuse firmado.')
    contiene('El folio se asigna al registrar.')
    assert.doesNotMatch(SOLO_PLANTILLA, /<q-chip/, 'el chip del folio ya no existe')
  })

  test('secciones sin mayúsculas tipo inglés', () => {
    contiene('1. Cliente y empresa que recibe')
    contiene('2. Clasificación y periodo')
    contiene('3. Prioridad y entrega')
    contiene('4. Archivos, observaciones y firmas')
  })
})

describe('rebanada 50 · etiquetas y validaciones', () => {
  test('etiquetas de los campos', () => {
    contiene('label="Empresa del grupo que recibe *"')
    contiene('label="Asunto del documento *"')
    contiene('label="Tipo de documento *"')
    contiene('label="Vía de entrega *"')
    contiene('label="Fecha límite de atención"')
    contiene('hint="Se calcula con la prioridad"')
    contiene('label="Elige o arrastra los archivos"')
    contiene('PDF, XML, ZIP o JPG. Máximo 25 MB por archivo.')
  })

  test('validaciones en tú', () => {
    for (const t of [
      'Elige la empresa que recibe',
      'Escribe el asunto',
      'Elige el departamento',
      'Elige el tipo de documento',
      'Escribe el periodo',
      'El periodo va como AAAA-MM, por ejemplo 2026-11',
    ]) {
      contiene(t)
    }
  })

  test('no quedan jerga ni «usted»', () => {
    for (const t of ['Seleccione', 'SLA', 'ingesta', 'Dibuje']) {
      assert.equal(SOLO_PLANTILLA.includes(t), false, `no debe quedar «${t}» en la plantilla`)
    }
  })
})

describe('rebanada 50 · firmas, botones y avisos', () => {
  test('firmas', () => {
    contiene('Firma de quien entrega (cliente) *')
    contiene('Firma de quien recibe (DCA) *')
    contiene('Dibuja la firma con el dedo o el ratón')
    contiene('Borrar la firma del cliente')
    contiene('Borrar la firma de quien recibe')
    assert.equal(PLANTILLA.match(/label="Borrar firma"/g)?.length, 2)
  })

  test('botones con no-caps', () => {
    contiene('label="Registrar y generar acuse"')
    contiene('Registrar la entrega y generar el acuse de recepción')
    for (const etiqueta of ['Limpiar', 'Registrar y generar acuse', 'Borrar firma', 'Cerrar']) {
      const botones = PLANTILLA.match(new RegExp(`<q-btn[^>]*label="${etiqueta}"[^>]*>`, 'g')) ?? []
      assert.ok(botones.length > 0, `falta el botón ${etiqueta}`)
      for (const b of botones) assert.match(b, /no-caps/, `${etiqueta} sin no-caps`)
    }
    const reintentar = PLANTILLA.match(/<q-btn[^>]*label="Reintentar"[^>]*>/g) ?? []
    assert.equal(reintentar.length, 2)
    for (const b of reintentar) assert.match(b, /no-caps/)
  })

  test('avisos', () => {
    contiene('Faltan firmas: el cliente y quien recibe deben firmar antes de registrar.')
    assert.match(CODIGO, /El archivo \S+ pasa de 25 MB y no se adjuntó\./)
  })
})

describe('rebanada 50 · prioridades y acuse', () => {
  test('opciones con etiqueta y valor guardado en mayúsculas', () => {
    for (const [v, l] of [
      ['BAJA', 'Baja'],
      ['MEDIA', 'Media'],
      ['ALTA', 'Alta'],
      ['URGENTE', 'Urgente'],
    ]) {
      assert.ok(CODIGO.includes(`{ value: '${v}', label: '${l}' }`), `falta la opción ${v}`)
    }
    const campo = PLANTILLA.slice(PLANTILLA.indexOf('v-model="form.prioridad"'))
    const bloque = campo.slice(0, campo.indexOf('>'))
    assert.match(bloque, /emit-value/)
    assert.match(bloque, /map-options/)
  })

  test('el acuse muestra la etiqueta de la prioridad', () => {
    assert.match(PLANTILLA, /etiquetaDePrioridad\(acuseData\.prioridad\)/)
    assert.match(CODIGO, /acuseData\.prioridad = form\.prioridad/)
  })

  test('textos del acuse en pantalla', () => {
    for (const t of [
      'Acuse de recepción',
      '>Folio<',
      '>Fecha y hora<',
      '>Vía de entrega<',
      '>Fecha límite de atención<',
      'Firmas de conformidad',
      '>Entregó<',
      '>Recibió<',
      'Este acuse confirma que el Grupo DCA recibió la documentación para su revisión contable.',
    ]) {
      contiene(t)
    }
  })
})
