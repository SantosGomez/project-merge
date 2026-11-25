import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('.', import.meta.url))
const PAGINA = fs.readFileSync(`${RAIZ}IndexPage.vue`, 'utf8')
const API = fs.readFileSync(`${RAIZ}../servicios/api.js`, 'utf8')

const PLANTILLA = PAGINA.replace(/<!--[\s\S]*?-->/g, '')
const CODIGO = PAGINA.replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Cuerpo del manejador de confirmación del autollenado. */
function cuerpoDelManejador() {
  const inicio = CODIGO.indexOf('const onAutollenadoConfirmar')
  assert.notEqual(inicio, -1, 'no se encontró `const onAutollenadoConfirmar`')
  const resto = CODIGO.slice(inicio + 5)
  const fin = resto.search(/\nconst [a-zA-Z_$]/)
  return fin === -1 ? CODIGO.slice(inicio) : CODIGO.slice(inicio, inicio + 5 + fin)
}

describe('Recepción — autollenado con cliente frecuente', () => {
  test('la API expone obtenerClientesFrecuentes', () => {
    assert.match(API, /export async function obtenerClientesFrecuentes\(/)
    assert.match(API, /get\(`\$\{BASE_DOC\}\/clientes\/frecuentes`\)/)
  })

  test('la vista importa el modal y la lógica del autollenado', () => {
    assert.match(
      CODIGO,
      /import AutollenadoDialogo from '@\/modulos\/documentos\/components\/AutollenadoDialogo\.vue'/,
    )
    assert.match(CODIGO, /from '@\/modulos\/documentos\/composables\/autollenado\.js'/)
    assert.match(CODIGO, /aplicarPlantilla/)
    assert.match(CODIGO, /TIPOS_RECEPCION/)
    assert.match(CODIGO, /obtenerClientesFrecuentes/)
  })

  test('el botón de autollenar tiene tooltip y se apaga sin clientes frecuentes', () => {
    const inicio = PLANTILLA.indexOf('label="Autollenar"')
    assert.notEqual(inicio, -1, 'falta el botón Autollenar')
    const bloque = PLANTILLA.slice(inicio, PLANTILLA.indexOf('</q-btn>', inicio))
    assert.match(bloque, /<q-tooltip[\s>]/)
    assert.match(bloque, /:disable="!clientesFrecuentes\.length( \|\| formularioBloqueado)?"/)
  })

  test('el botón de autollenar va arriba, en la sección 1, y no al pie del formulario', () => {
    const seccion1 = PLANTILLA.indexOf('1. Cliente y empresa que recibe')
    const boton = PLANTILLA.indexOf('label="Autollenar"')
    const cliente = PLANTILLA.indexOf('label="Cliente *"')
    const registrar = PLANTILLA.indexOf('label="Registrar y generar acuse"')
    assert.notEqual(seccion1, -1, 'falta el título de la sección 1')
    assert.ok(
      boton > seccion1 && boton < cliente,
      'Autollenar debe ir entre el título y el campo Cliente',
    )
    assert.equal(
      PLANTILLA.indexOf('label="Autollenar"', boton + 1),
      -1,
      'solo debe haber un botón Autollenar',
    )
    assert.ok(boton < registrar)
  })

  test('el modal recibe los clientes frecuentes y los tipos, y avisa al confirmar', () => {
    const inicio = PLANTILLA.indexOf('<AutollenadoDialogo')
    assert.notEqual(inicio, -1, 'IndexPage no usa AutollenadoDialogo')
    const etiqueta = PLANTILLA.slice(inicio, PLANTILLA.indexOf('/>', inicio))
    assert.match(etiqueta, /v-model="mostrarAutollenado"/)
    assert.match(etiqueta, /:clientes="opcionesClientesFrecuentes"/)
    assert.match(etiqueta, /:tipos="tiposRecepcion"/)
    assert.match(etiqueta, /@confirmar="onAutollenadoConfirmar"/)
  })

  test('confirmar aplica la plantilla, fija el cliente y revalida el campo', () => {
    const cuerpo = cuerpoDelManejador()
    assert.match(cuerpo, /aplicarPlantilla\(tipoRecepcion, form\)/)
    assert.match(cuerpo, /form\.cliente = clienteId/)
    assert.match(cuerpo, /campoCliente\.value\?\.validate\(\)/)
    assert.match(cuerpo, /mostrarAutollenado\.value = false/)
  })

  test('el autollenado no toca el periodo ni los archivos', () => {
    const cuerpo = cuerpoDelManejador()
    assert.doesNotMatch(cuerpo, /form\.periodo\s*=/)
    assert.doesNotMatch(cuerpo, /form\.archivos\s*=/)
    assert.doesNotMatch(cuerpo, /form\.firma(Cliente|Recepcion)/)
  })

  test('los clientes frecuentes se cargan al montar, sin bloquear el formulario si fallan', () => {
    assert.match(CODIGO, /clientesFrecuentes\.value = respuestaFrecuentes\?\.clientes \?\? \[\]/)
    const inicio = CODIGO.indexOf('await obtenerClientesFrecuentes()')
    assert.notEqual(inicio, -1, 'onMounted no carga los clientes frecuentes')
    const bloque = CODIGO.slice(inicio, CODIGO.indexOf('calcularSla()', inicio))
    assert.match(bloque, /catch/)
  })
})
