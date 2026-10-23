// Pruebas de la preferencia «menú fijado» (historia #8): se guarda por equipo
// en localStorage y, si no hay preferencia o el almacenamiento falla, arranca compacto.

import test from 'node:test'
import assert from 'node:assert/strict'

import { guardarMenuFijado, leerMenuFijado } from '../src/utils/preferenciaMenu.js'

// Almacén falso equivalente a localStorage, para no depender del navegador.
const crearAlmacen = (inicial = {}) => {
  const datos = new Map(Object.entries(inicial))
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => {
      datos.set(clave, String(valor))
    },
  }
}

test('sin preferencia guardada el menú arranca compacto', () => {
  assert.equal(leerMenuFijado(crearAlmacen()), false)
  // Node no expone localStorage: equivale a un equipo sin almacenamiento.
  assert.equal(leerMenuFijado(), false)
})

test('la preferencia guardada se lee al arrancar', () => {
  assert.equal(leerMenuFijado(crearAlmacen({ delgrow_menu_fijado: 'true' })), true)
  assert.equal(leerMenuFijado(crearAlmacen({ delgrow_menu_fijado: 'false' })), false)
})

test('una preferencia desconocida se trata como compacto', () => {
  for (const valor of ['1', 'sí', '', 'TRUE']) {
    assert.equal(
      leerMenuFijado(crearAlmacen({ delgrow_menu_fijado: valor })),
      false,
      `«${valor}» no debe fijar el menú`,
    )
  }
})

test('si el almacenamiento falla al leer, arranca compacto sin lanzar', () => {
  const bloqueado = {
    getItem: () => {
      throw new Error('almacenamiento bloqueado')
    },
  }

  assert.doesNotThrow(() => leerMenuFijado(bloqueado))
  assert.equal(leerMenuFijado(bloqueado), false)

  // Modo privado: hasta el acceso a localStorage puede lanzar.
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('almacenamiento bloqueado')
    },
  })

  try {
    assert.equal(leerMenuFijado(), false, 'sin acceso al almacén, arranca compacto')
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'localStorage', descriptor)
    } else {
      delete globalThis.localStorage
    }
  }
})

test('al fijar o soltar se guarda la preferencia', () => {
  const almacen = crearAlmacen()

  guardarMenuFijado(true, almacen)
  assert.equal(leerMenuFijado(almacen), true, 'al fijar queda guardado')

  guardarMenuFijado(false, almacen)
  assert.equal(leerMenuFijado(almacen), false, 'al soltar queda guardado')

  guardarMenuFijado(true, almacen)
  assert.equal(almacen.getItem('delgrow_menu_fijado'), 'true', 'se guarda como texto')
})

test('si el almacenamiento falla al guardar, no lanza', () => {
  const bloqueado = {
    setItem: () => {
      throw new Error('almacenamiento bloqueado')
    },
  }

  assert.doesNotThrow(() => guardarMenuFijado(true, bloqueado))
})
