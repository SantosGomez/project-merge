// Pruebas de las etiquetas de estado y prioridad (RF-13, RF-28, RNF-06).
// Cada etiqueta devuelve texto, color y tooltip: el color nunca es el único portador del significado.

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatearEstado,
  formatearIniciales,
  formatearPrioridad,
  formatearRol,
} from '../src/utils/formateadores.js'

// Comprobación común: toda etiqueta trae las tres claves con valores útiles.
const comprobarEtiqueta = (etiqueta, contexto) => {
  assert.equal(typeof etiqueta.texto, 'string', `${contexto}: el texto debe ser una cadena`)
  assert.ok(etiqueta.texto.length > 0, `${contexto}: el texto siempre está presente (RNF-06)`)
  assert.equal(typeof etiqueta.color, 'string', `${contexto}: el color debe ser una cadena`)
  assert.ok(etiqueta.color.length > 0, `${contexto}: el color debe acompañar al texto (RNF-06)`)
  assert.equal(typeof etiqueta.tooltip, 'string', `${contexto}: el tooltip debe ser una cadena`)
  assert.ok(etiqueta.tooltip.length > 0, `${contexto}: el tooltip debe dar contexto (RNF-03)`)
}

test('formatearIniciales devuelve las dos primeras letras del usuario en mayúsculas', () => {
  assert.equal(formatearIniciales('contador_seed'), 'CO')
  assert.equal(formatearIniciales('UsuarioTest'), 'US')

  for (const usuario of [null, '', '   ']) {
    assert.equal(formatearIniciales(usuario), '')
  }
})

test('formatearRol devuelve el nombre legible del rol', () => {
  assert.equal(formatearRol('administrador'), 'Administrador')
  assert.equal(formatearRol('contador'), 'Contador')
  assert.equal(formatearRol(null), '')
  assert.equal(formatearRol('usuarios_de_sistema'), '')
})

test('formatearEstado devuelve el texto en español de cada estado', () => {
  const esperados = {
    Pendiente: 'Pendiente',
    'En proceso': 'En proceso',
    Finalizado: 'Finalizado',
  }

  for (const [estado, texto] of Object.entries(esperados)) {
    const etiqueta = formatearEstado(estado)

    comprobarEtiqueta(etiqueta, `estado ${estado}`)
    assert.equal(etiqueta.texto, texto, `el estado ${estado} se muestra con su texto (RF-13)`)
  }
})

test('formatearEstado da un texto distinto a cada estado', () => {
  const textos = ['Pendiente', 'En proceso', 'Finalizado'].map(
    (estado) => formatearEstado(estado).texto,
  )

  assert.equal(new Set(textos).size, 3, 'los tres estados se distinguen por su texto (RNF-06)')
})

test('formatearPrioridad devuelve Alta en rojo, Media en ámbar y Baja en verde', () => {
  const esperados = {
    Alta: 'red',
    Media: 'amber',
    Baja: 'green',
  }

  for (const [prioridad, color] of Object.entries(esperados)) {
    const etiqueta = formatearPrioridad(prioridad)

    comprobarEtiqueta(etiqueta, `prioridad ${prioridad}`)
    assert.equal(etiqueta.texto, prioridad, `la prioridad ${prioridad} se muestra con su texto`)
    assert.equal(etiqueta.color, color, `la prioridad ${prioridad} usa su color (RNF-06)`)
  }
})

test('formatearPrioridad distingue las tres prioridades por color y por tooltip', () => {
  const etiquetas = ['Alta', 'Media', 'Baja'].map(formatearPrioridad)

  assert.equal(
    new Set(etiquetas.map((etiqueta) => etiqueta.color)).size,
    3,
    'cada prioridad tiene un color propio (RNF-06)',
  )
  assert.equal(
    new Set(etiquetas.map((etiqueta) => etiqueta.tooltip)).size,
    3,
    'cada prioridad explica su significado en el tooltip (RNF-03)',
  )
  assert.equal(
    new Set(etiquetas.map((etiqueta) => etiqueta.texto)).size,
    3,
    'cada prioridad tiene un texto propio (RNF-06)',
  )
})
