import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  opcionesDeClientes,
  filtrarOpcionesClientes,
  textoRfc,
  paginarClientes,
  CLIENTES_POR_PAGINA,
} from './clientesVista.js'

const CLIENTES = [
  { id: 7, clave: '0031', razonSocial: "COMEDORES INDUSTRIALES MONT'S SA DE CV", rfc: null },
  { id: 3, clave: '0001', razonSocial: 'ACME TRANSLOGISTICS SA DE CV', rfc: null },
  { id: 1, clave: null, razonSocial: 'Cliente Test', rfc: 'TEST123456789' },
  { id: 9, clave: '0099', razonSocial: 'Consultores Pérez', rfc: 'CNO120415AB3' },
]

describe('opcionesDeClientes', () => {
  test('el valor es el id y la etiqueta lleva la clave delante', () => {
    const opciones = opcionesDeClientes(CLIENTES)
    const acme = opciones.find((o) => o.value === 3)
    assert.equal(acme.label, '0001 · ACME TRANSLOGISTICS SA DE CV')
  })

  test('cada opción lleva la clave y la razón social por separado, para las tarjetas', () => {
    const acme = opcionesDeClientes(CLIENTES).find((o) => o.value === 3)
    assert.equal(acme.clave, '0001')
    assert.equal(acme.razonSocial, 'ACME TRANSLOGISTICS SA DE CV')
  })

  test('un cliente sin clave se muestra solo con su razón social', () => {
    const opciones = opcionesDeClientes(CLIENTES)
    assert.equal(opciones.find((o) => o.value === 1).label, 'Cliente Test')
  })

  test('se ordenan por clave, y los que no tienen clave van al final', () => {
    const valores = opcionesDeClientes(CLIENTES).map((o) => o.value)
    assert.deepEqual(valores, [3, 7, 9, 1])
  })
})

describe('filtrarOpcionesClientes', () => {
  const opciones = opcionesDeClientes(CLIENTES)

  test('sin término devuelve todas', () => {
    assert.equal(filtrarOpcionesClientes(opciones, '').length, 4)
    assert.equal(filtrarOpcionesClientes(opciones, '   ').length, 4)
  })

  test('busca por clave', () => {
    assert.deepEqual(
      filtrarOpcionesClientes(opciones, '0031').map((o) => o.value),
      [7],
    )
  })

  test('busca por razón social sin importar mayúsculas ni acentos', () => {
    assert.deepEqual(
      filtrarOpcionesClientes(opciones, 'perez').map((o) => o.value),
      [9],
    )
    assert.deepEqual(
      filtrarOpcionesClientes(opciones, 'acme').map((o) => o.value),
      [3],
    )
  })

  test('busca por RFC sin guiones', () => {
    assert.deepEqual(
      filtrarOpcionesClientes(opciones, 'cno-120415').map((o) => o.value),
      [9],
    )
  })
})

describe('textoRfc', () => {
  test('sin RFC dice que falta, en vez de pintar "null"', () => {
    assert.equal(textoRfc(null), 'Sin registrar')
    assert.equal(textoRfc(''), 'Sin registrar')
    assert.equal(textoRfc('TEST123456789'), 'TEST123456789')
  })
})

describe('paginarClientes', () => {
  const muchos = Array.from({ length: 45 }, (_, i) => ({ value: i + 1 }))

  test('la cuadrícula muestra 20 por página (4 × 5)', () => {
    assert.equal(CLIENTES_POR_PAGINA, 20)
  })

  test('parte la lista en páginas de 20 y cuenta las páginas', () => {
    const primera = paginarClientes(muchos, 1)
    assert.equal(primera.elementos.length, 20)
    assert.equal(primera.elementos[0].value, 1)
    assert.equal(primera.totalPaginas, 3)
    const ultima = paginarClientes(muchos, 3)
    assert.deepEqual(
      ultima.elementos.map((o) => o.value),
      [41, 42, 43, 44, 45],
    )
  })

  test('una página fuera de rango se lleva a la última que existe', () => {
    // Pasa al buscar: estabas en la página 7 y el filtro deja una sola página.
    const r = paginarClientes(muchos.slice(0, 5), 7)
    assert.equal(r.pagina, 1)
    assert.equal(r.elementos.length, 5)
  })

  test('sin clientes hay una página vacía, no cero páginas', () => {
    const r = paginarClientes([], 1)
    assert.equal(r.totalPaginas, 1)
    assert.equal(r.pagina, 1)
    assert.deepEqual(r.elementos, [])
  })

  test('una página menor que 1 o inválida se lleva a la 1', () => {
    assert.equal(paginarClientes(muchos, 0).pagina, 1)
    assert.equal(paginarClientes(muchos, undefined).pagina, 1)
  })
})

describe('normalización de la búsqueda', () => {
  // La normalización es la misma del servidor: en la app unida el frontend se construye sin el
  // Backend (Docker), así que usa la copia de `logica/normalizar.js` (igual a la del Backend).
  const FUENTE = readFileSync(fileURLToPath(new URL('./clientesVista.js', import.meta.url)), 'utf8')

  test('no tiene su propia copia: la importa de la lógica compartida del módulo', () => {
    assert.doesNotMatch(FUENTE, /\.normalize\(/)
    assert.match(FUENTE, /from '\.\.\/logica\/normalizar\.js'/)
  })

  test('la copia del frontend es idéntica a la del Backend', () => {
    const copia = readFileSync(
      fileURLToPath(new URL('../logica/normalizar.js', import.meta.url)),
      'utf8',
    )
    const servidor = readFileSync(
      fileURLToPath(
        new URL(
          '../../../../../Backend/src/modulos/documentos/logica/normalizar.mjs',
          import.meta.url,
        ),
      ),
      'utf8',
    )
    assert.strictEqual(copia.replace(/\r\n/g, '\n'), servidor.replace(/\r\n/g, '\n'))
  })
})
