// Pruebas de la cartera de clientes de «Mi perfil»: se deriva de los casos propios.

import test from 'node:test'
import assert from 'node:assert/strict'

import { carteraDeClientes } from '../src/utils/carteraClientes.js'

const caso = (cliente, estado, extra = {}) => ({
  contador_id: 7,
  cliente,
  estado,
  importante: 0,
  creado_en: '2026-11-01 10:00:00',
  ...extra,
})

test('agrupa los casos propios por cliente sin distinguir mayúsculas, acentos ni espacios de sobra', () => {
  const casos = [
    caso('Ácme ', 'pendiente'),
    caso('acme', 'finalizado'),
    caso('  ACME', 'en_proceso'),
    caso('Beta  Sur', 'pendiente'),
    caso('beta sur', 'pendiente'),
    caso('Acme', 'pendiente', { contador_id: 8 }),
    caso('Otro', 'pendiente', { contador_id: 8 }),
  ]

  const cartera = carteraDeClientes(casos, 7)

  assert.deepEqual(cartera.map((c) => [c.clave, c.total]), [['acme', 3], ['beta sur', 2]])
})

test('compara el contador como número', () => {
  const cartera = carteraDeClientes([caso('Acme', 'pendiente', { contador_id: '7' })], 7)

  assert.equal(cartera.length, 1)
})

test('el nombre es la forma escrita en el caso más reciente', () => {
  const casos = [
    caso('acme', 'pendiente', { creado_en: '2026-11-01 10:00:00' }),
    caso('Ácme', 'pendiente', { creado_en: '2026-11-05 09:00:00' }),
    caso('ACME', 'pendiente', { creado_en: '2026-11-03 10:00:00' }),
  ]

  assert.equal(carteraDeClientes(casos, 7)[0].nombre, 'Ácme')
})

test('cuenta abiertos (Pendiente y En proceso), finalizados y total', () => {
  const casos = [
    caso('Acme', 'pendiente'),
    caso('Acme', 'en_proceso'),
    caso('Acme', 'en_proceso'),
    caso('Acme', 'finalizado'),
  ]

  assert.deepEqual(carteraDeClientes(casos, 7)[0], {
    clave: 'acme',
    nombre: 'Acme',
    abiertos: 3,
    finalizados: 1,
    total: 4,
    importante: false,
  })
})

test('importante es true solo si hay un caso abierto marcado como importante', () => {
  const casos = [
    caso('Acme', 'pendiente', { importante: 1 }),
    caso('Beta', 'finalizado', { importante: 1 }),
    caso('Beta', 'pendiente', { importante: 0 }),
    caso('Gama', 'en_proceso', { importante: true }),
  ]

  const porClave = Object.fromEntries(carteraDeClientes(casos, 7).map((c) => [c.clave, c.importante]))

  assert.deepEqual(porClave, { acme: true, beta: false, gama: true })
})

test('ordena: más abiertos primero, empate por nombre en español y sin abiertos al final', () => {
  const casos = [
    caso('Zeta', 'pendiente'),
    caso('Ñandú', 'pendiente'),
    caso('Álamo', 'pendiente'),
    caso('Álamo', 'en_proceso'),
    caso('Omega', 'finalizado'),
    caso('Beta', 'finalizado'),
    caso('Beta', 'finalizado'),
  ]

  assert.deepEqual(
    carteraDeClientes(casos, 7).map((c) => c.nombre),
    ['Álamo', 'Ñandú', 'Zeta', 'Beta', 'Omega'],
  )
})
