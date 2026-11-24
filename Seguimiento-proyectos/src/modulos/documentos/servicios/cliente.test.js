// Pruebas de `mensajeParaUsuario` (cliente.js): qué texto se le enseña a la
// persona cuando una petición falla.
// Se ejecutan con `node --test` desde `Frontend/`, sin dependencias.
//
// El defecto que ata: las vistas leían `err.mensaje`, que no existe (el texto
// vive en `err.message`), así que siempre salía el respaldo genérico; y aun con
// `err.message`, el cliente pone por delante su traducción por código, de modo
// que un 400 con explicación del servidor («No puedes desactivar tu propia
// cuenta…») se leía como «Faltan datos obligatorios…».

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ErrorHTTP, ErrorRed, mensajeParaUsuario } from './cliente.js'

const RESPALDO = 'No se pudo completar la acción'

test('si el servidor explicó el motivo, se enseña su explicación', () => {
  const err = new ErrorHTTP(
    'Faltan datos obligatorios o el formato no es válido.',
    400,
    'VALIDACION',
    { error: 'VALIDACION', mensaje: 'No puedes desactivar tu propia cuenta.' },
  )

  assert.equal(mensajeParaUsuario(err, RESPALDO), 'No puedes desactivar tu propia cuenta.')
})

test('sin explicación del servidor se enseña el texto traducido del error', () => {
  const sinServidor = new ErrorRed('No se pudo conectar con el servidor.')
  const sinMensaje = new ErrorHTTP(
    'Error del servidor. Inténtalo de nuevo más tarde.',
    502,
    'INTERNO',
    {},
  )

  assert.equal(mensajeParaUsuario(sinServidor, RESPALDO), 'No se pudo conectar con el servidor.')
  assert.equal(
    mensajeParaUsuario(sinMensaje, RESPALDO),
    'Error del servidor. Inténtalo de nuevo más tarde.',
  )
})

test('si el error no trae ningún texto, se enseña el respaldo', () => {
  for (const err of [null, undefined, {}, new Error('')]) {
    assert.equal(mensajeParaUsuario(err, RESPALDO), RESPALDO)
  }
})

// Subida en crudo. Defecto real (2026-11-04): el nombre viajaba también en la
// cabecera `X-Nombre-Original`, y una cabecera solo admite caracteres hasta
// U+00FF: «Factura–octubre.pdf» (guion largo de Word) hacía que `fetch`
// lanzara antes de enviar y el archivo nunca llegaba.
test('la subida no manda el nombre en una cabecera, solo en la URL', async () => {
  const { subirArchivo } = await import('./api.js')
  const original = globalThis.fetch
  let peticion = null
  globalThis.fetch = async (url, opciones) => {
    peticion = { url, opciones }
    // Valida las cabeceras como lo hace el navegador.
    new Headers(opciones.headers)
    return new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const archivo = new File(['hola'], 'Factura–octubre.pdf', { type: 'application/pdf' })
    await subirArchivo(5, archivo)
  } finally {
    globalThis.fetch = original
  }
  const cabeceras = Object.keys(peticion.opciones.headers).map((c) => c.toLowerCase())
  assert.ok(!cabeceras.includes('x-nombre-original'), 'el nombre no debe ir en una cabecera')
  const nombre = new URL(peticion.url, 'http://x').searchParams.get('nombreOriginal')
  assert.equal(nombre, 'Factura–octubre.pdf')
})
