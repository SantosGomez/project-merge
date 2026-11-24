// Pruebas del módulo de color del semáforo (semaforoVista.js).
// Se ejecutan con `node --test` desde `Frontend/`, sin dependencias: el módulo
// es JavaScript puro y no importa Vue ni Quasar.
//
// Las cadenas de estado van aquí literales a propósito: el archivo bajo
// prueba no puede contener nombres de colores (lo verifica un `git grep -i`),
// pero las pruebas sí deben fijar el contrato exacto con el servidor.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { claseDeSemaforo } from './semaforoVista.js'

// Los cuatro estados que devuelve el servidor (Backend/src/logica/semaforo.js).
const ROJO = 'ROJO'
const AMBAR = 'ÁMBAR'
const VERDE = 'VERDE'
const NEUTRO = 'NEUTRO'

/** Clases del estado neutro: también son el respaldo de cualquier valor desconocido. */
const CLASES_NEUTRO = { fondo: 'bg-secondary-white-alternative', texto: 'text-grey-8' }

test('ROJO: fondo intenso con texto blanco', () => {
  assert.deepEqual(claseDeSemaforo(ROJO), { fondo: 'bg-negative', texto: 'text-white' })
})

test('ÁMBAR: fondo claro con texto oscuro', () => {
  assert.deepEqual(claseDeSemaforo(AMBAR), { fondo: 'bg-warning', texto: 'text-primary' })
})

test('VERDE: fondo claro con texto oscuro', () => {
  assert.deepEqual(claseDeSemaforo(VERDE), { fondo: 'bg-positive', texto: 'text-primary' })
})

test('NEUTRO: gris de chips con texto gris oscuro', () => {
  assert.deepEqual(claseDeSemaforo(NEUTRO), CLASES_NEUTRO)
})

test('un estado desconocido cae al neutro', () => {
  assert.deepEqual(claseDeSemaforo('INCOMPLETO'), CLASES_NEUTRO)
  assert.deepEqual(claseDeSemaforo('bajo'), CLASES_NEUTRO)
  // 'constructor' es una trampa del prototipo: con un objeto plano devolvería
  // una función. Con el mapa del módulo cae al neutro como cualquier otro.
  assert.deepEqual(claseDeSemaforo('constructor'), CLASES_NEUTRO)
})

test('undefined, null y la cadena vacía caen al neutro', () => {
  assert.deepEqual(claseDeSemaforo(undefined), CLASES_NEUTRO)
  assert.deepEqual(claseDeSemaforo(null), CLASES_NEUTRO)
  assert.deepEqual(claseDeSemaforo(''), CLASES_NEUTRO)
})

test('las minúsculas no reconocen el estado y caen al neutro', () => {
  assert.deepEqual(claseDeSemaforo('rojo'), CLASES_NEUTRO)
})

test('el objeto devuelto tiene exactamente dos claves: fondo y texto', () => {
  for (const estado of [ROJO, AMBAR, VERDE, NEUTRO, 'INCOMPLETO', undefined]) {
    assert.deepEqual(Object.keys(claseDeSemaforo(estado)).sort(), ['fondo', 'texto'])
  }
})

test('las clases devueltas son clases Quasar válidas y no nombran un color', () => {
  const CLASES_VALIDAS = new Set([
    'bg-negative',
    'bg-warning',
    'bg-positive',
    'bg-secondary-white-alternative',
    'text-white',
    'text-primary',
    'text-grey-8',
  ])
  for (const estado of [ROJO, AMBAR, VERDE, NEUTRO, 'INCOMPLETO', undefined, null]) {
    const { fondo, texto } = claseDeSemaforo(estado)
    assert.ok(CLASES_VALIDAS.has(fondo), `fondo inesperado: ${fondo}`)
    assert.ok(CLASES_VALIDAS.has(texto), `texto inesperado: ${texto}`)
  }
})
