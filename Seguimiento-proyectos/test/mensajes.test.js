// Pruebas de los mensajes de error con tres partes (RF-36, RNF-01).
// Formato del plan (sección 3): "Qué ocurrió: X. Sobre: Y. Qué hacer: Z."

import test from 'node:test'
import assert from 'node:assert/strict'

import { QUE_HACER, construirError, separarMensajeError } from '../src/utils/mensajes.js'

test('construirError une las tres partes en el orden y con el formato del plan', () => {
  assert.deepEqual(
    construirError(
      'No se pudo conectar con el servidor',
      'la carga de contadores',
      'Verifique su conexión e intente de nuevo',
    ),
    {
      mensaje:
        'Qué ocurrió: No se pudo conectar con el servidor. Sobre: la carga de contadores. Qué hacer: Verifique su conexión e intente de nuevo.',
    },
  )
})

test('construirError nombra las tres partes de RNF-01', () => {
  const casos = [
    [
      'No se pudo guardar el caso',
      'el registro del caso',
      'Reintente en unos segundos',
      ['No se pudo guardar el caso', 'el registro del caso', 'Reintente en unos segundos'],
    ],
    [
      'La sesión se cerró en este equipo',
      'el cierre de sesión',
      'Inicie sesión de nuevo cuando desee usar la aplicación',
      [
        'La sesión se cerró en este equipo',
        'el cierre de sesión',
        'Inicie sesión de nuevo cuando desee usar la aplicación',
      ],
    ],
  ]

  for (const [queOcurrio, sobreQue, queHacer, partes] of casos) {
    const { mensaje } = construirError(queOcurrio, sobreQue, queHacer)

    assert.equal(typeof mensaje, 'string', 'el mensaje debe ser una cadena')
    assert.ok(mensaje.includes('Qué ocurrió:'), 'falta la parte de qué ocurrió (RNF-01)')
    assert.ok(mensaje.includes('Sobre:'), 'falta la parte de sobre qué (RNF-01)')
    assert.ok(mensaje.includes('Qué hacer:'), 'falta la parte de qué hacer (RNF-01)')

    for (const parte of partes) {
      assert.ok(mensaje.includes(parte), `el mensaje debe contener "${parte}" (RNF-01)`)
    }
  }
})

test('construirError conserva acentos y caracteres especiales en español', () => {
  assert.deepEqual(
    construirError(
      'La operación no se completó',
      'la búsqueda del contador Ñandú',
      'Revise el nombre e inténtelo otra vez',
    ),
    {
      mensaje:
        'Qué ocurrió: La operación no se completó. Sobre: la búsqueda del contador Ñandú. Qué hacer: Revise el nombre e inténtelo otra vez.',
    },
  )
})

test('construirError devuelve un mensaje que no dice solo "Error"', () => {
  const { mensaje } = construirError(
    'No se pudo cargar la lista',
    'los contadores',
    'Reintente la carga',
  )

  assert.notEqual(mensaje.trim(), 'Error', 'no se admiten mensajes de una sola palabra (RNF-01)')
  assert.ok(mensaje.length > 0, 'el mensaje no puede quedar vacío (RNF-01)')
})

// Revisión de UI, rebanada 2: ErrorState muestra las tres partes por separado.
test('separarMensajeError divide un mensaje de tres partes; si no tiene ese formato devuelve null', () => {
  assert.deepEqual(
    separarMensajeError(
      'Qué ocurrió: No se pudo conectar con el servidor. Sobre: tus casos. Qué hacer: Revisa tu conexión a internet y vuelve a intentarlo.',
    ),
    {
      queOcurrio: 'No se pudo conectar con el servidor',
      sobreQue: 'tus casos',
      queHacer: 'Revisa tu conexión a internet y vuelve a intentarlo',
    },
  )
  assert.equal(separarMensajeError('Demasiados intentos fallidos sobre inicio de sesión: Espere'), null)
  assert.equal(separarMensajeError(undefined), null)
})

test('los «qué hacer» compartidos van en trato de tú', () => {
  for (const texto of Object.values(QUE_HACER)) {
    assert.doesNotMatch(texto, /Reintente|Verifique|avise|intente /, texto)
  }
})
