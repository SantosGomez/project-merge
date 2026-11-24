import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { subirEnOrden, textoArchivosPendientes } from './subidaArchivos.js'

const A = { nombre: 'a.pdf' }
const B = { nombre: 'b.xml' }
const C = { nombre: 'acuse-DCA-2026-0001.pdf' }

describe('subirEnOrden', () => {
  test('si todo sube, no queda nada pendiente', async () => {
    const pendientes = await subirEnOrden([A, B], async () => {})
    assert.deepEqual(pendientes, [])
  })

  test('devuelve los que fallaron, con el motivo, y sigue con los demás', async () => {
    const intentados = []
    const pendientes = await subirEnOrden([A, B, C], async (e) => {
      intentados.push(e.nombre)
      if (e === B) throw new Error('No se pudo conectar con el servidor.')
    })
    assert.deepEqual(intentados, ['a.pdf', 'b.xml', 'acuse-DCA-2026-0001.pdf'])
    assert.equal(pendientes.length, 1)
    assert.equal(pendientes[0].nombre, 'b.xml')
    assert.equal(pendientes[0].motivo, 'No se pudo conectar con el servidor.')
  })

  test('sube de uno en uno, no todos a la vez', async () => {
    let enCurso = 0
    let maximo = 0
    await subirEnOrden([A, B, C], async () => {
      enCurso++
      maximo = Math.max(maximo, enCurso)
      await new Promise((r) => setTimeout(r, 5))
      enCurso--
    })
    assert.equal(maximo, 1)
  })

  test('reintentar con los pendientes deja solo los que vuelven a fallar', async () => {
    const primera = await subirEnOrden([A, B], async () => {
      throw new Error('falla')
    })
    const segunda = await subirEnOrden(primera, async (e) => {
      if (e.nombre === 'b.xml') throw new Error('otra vez')
    })
    assert.deepEqual(
      segunda.map((p) => [p.nombre, p.motivo]),
      [['b.xml', 'otra vez']],
    )
  })

  test('el elemento pendiente conserva lo necesario para reintentarlo', async () => {
    const archivo = { nombre: 'a.pdf', contenido: 'bytes' }
    const [pendiente] = await subirEnOrden([archivo], async () => {
      throw new Error('falla')
    })
    assert.equal(pendiente.contenido, 'bytes')
  })
})

describe('textoArchivosPendientes', () => {
  test('un archivo', () => {
    assert.equal(
      textoArchivosPendientes([{ nombre: 'a.pdf' }]),
      'No se pudo guardar 1 archivo en la carpeta del cliente: a.pdf.',
    )
  })

  test('varios archivos', () => {
    assert.equal(
      textoArchivosPendientes([{ nombre: 'a.pdf' }, { nombre: 'b.xml' }]),
      'No se pudieron guardar 2 archivos en la carpeta del cliente: a.pdf, b.xml.',
    )
  })
})
