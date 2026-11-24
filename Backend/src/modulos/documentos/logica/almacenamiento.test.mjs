import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  sanitizarNombreArchivo,
  carpetaDeMes,
  nombreCarpetaCliente,
  buscarCarpetaCliente,
  segmentosCarpeta,
  rutaRelativaArchivo,
  escribirArchivo,
} from './almacenamiento.mjs'

const carpetaTemporal = () => fs.mkdtemp(path.join(os.tmpdir(), 'dca-'))

describe('sanitizarNombreArchivo', () => {
  test('deja un nombre limpio igual, con acentos y guion largo', () => {
    assert.equal(sanitizarNombreArchivo('Factura–octubre año.pdf'), 'Factura–octubre año.pdf')
  })
  test('sustituye separadores de ruta', () => {
    assert.equal(sanitizarNombreArchivo('a/b\\c.pdf'), 'a_b_c.pdf')
  })
  test('no devuelve vacío', () => {
    assert.equal(sanitizarNombreArchivo(''), 'archivo')
    assert.equal(sanitizarNombreArchivo(null), 'archivo')
  })
  test('⚠️ «..» y «.» no pueden apuntar a la carpeta de arriba', () => {
    assert.equal(sanitizarNombreArchivo('..'), 'archivo')
    assert.equal(sanitizarNombreArchivo('.'), 'archivo')
  })
  test('quita puntos y espacios al final, que Windows descarta en silencio', () => {
    assert.equal(sanitizarNombreArchivo('factura.pdf. '), 'factura.pdf')
  })
})

describe('carpetaDeMes', () => {
  test('el periodo AAAA-MM da la carpeta del mes como en las carpetas de clientes', () => {
    assert.equal(carpetaDeMes('2026-01'), '01 ENERO')
    assert.equal(carpetaDeMes('2026-09'), '09 SEPTIEMBRE')
    assert.equal(carpetaDeMes('2026-11'), '11 NOVIEMBRE')
  })
  test('un periodo inválido no inventa una carpeta', () => {
    assert.throws(() => carpetaDeMes('2026-13'))
    assert.throws(() => carpetaDeMes('noviembre'))
  })
})

describe('nombreCarpetaCliente', () => {
  test('clave y razón social, como las carpetas existentes', () => {
    assert.equal(
      nombreCarpetaCliente('0001', 'ACME TRANSLOGISTICS SA DE CV'),
      '0001 ACME TRANSLOGISTICS SA DE CV',
    )
  })
  test('sin clave va a sin-clave', () => {
    assert.equal(nombreCarpetaCliente(null, 'Cliente Test'), 'sin-clave')
  })
  test('una razón social con caracteres prohibidos o punto final no rompe la ruta', () => {
    assert.equal(nombreCarpetaCliente('0007', 'ALL PARTS S. DE R.L. DE C.V.'), '0007 ALL PARTS S. DE R.L. DE C.V')
    assert.equal(nombreCarpetaCliente('0099', 'A/B: C'), '0099 A_B_ C')
  })
})

describe('buscarCarpetaCliente', () => {
  test('usa la carpeta que ya existe con esa clave, aunque el nombre sea otro', async () => {
    const base = await carpetaTemporal()
    await fs.mkdir(path.join(base, '0001 ACME NOMBRE ANTERIOR SA'))
    await fs.mkdir(path.join(base, '00010 OTRO CLIENTE'))
    assert.equal(
      await buscarCarpetaCliente(base, '0001', 'ACME TRANSLOGISTICS SA DE CV'),
      '0001 ACME NOMBRE ANTERIOR SA',
    )
  })
  test('no confunde la clave 0001 con la 00010', async () => {
    const base = await carpetaTemporal()
    await fs.mkdir(path.join(base, '00010 OTRO CLIENTE'))
    assert.equal(
      await buscarCarpetaCliente(base, '0001', 'ACME TRANSLOGISTICS SA DE CV'),
      '0001 ACME TRANSLOGISTICS SA DE CV',
    )
  })
  test('si la carpeta base aún no existe, propone el nombre nuevo', async () => {
    const base = path.join(await carpetaTemporal(), 'no-existe')
    assert.equal(await buscarCarpetaCliente(base, '0002', 'BETA SC'), '0002 BETA SC')
  })
  test('sin clave va a sin-clave', async () => {
    const base = await carpetaTemporal()
    assert.equal(await buscarCarpetaCliente(base, null, 'Cliente Test'), 'sin-clave')
  })
})

describe('segmentosCarpeta y rutaRelativaArchivo', () => {
  test('cliente / año / mes / folio', () => {
    assert.deepEqual(
      segmentosCarpeta({ carpetaCliente: '0001 ACME SA', periodo: '2026-11', folio: 'DCA-2026-10016' }),
      ['0001 ACME SA', '2026', '11 NOVIEMBRE', 'DCA-2026-10016'],
    )
  })
  test('la ruta del archivo termina en el nombre saneado', () => {
    assert.equal(
      rutaRelativaArchivo({
        carpetaCliente: '0001 ACME SA',
        periodo: '2026-11',
        folio: 'F',
        nombreOriginal: 'a/b.pdf',
      }),
      path.join('0001 ACME SA', '2026', '11 NOVIEMBRE', 'F', 'a_b.pdf'),
    )
  })
})

describe('escribirArchivo', () => {
  test('crea carpetas, escribe y devuelve la ruta relativa usada', async () => {
    const base = await carpetaTemporal()
    const rel = path.join('0042 X', '2026', '11 NOVIEMBRE', 'F', 'x.txt')
    const { rutaRelativa } = await escribirArchivo(base, rel, Buffer.from('hola'))
    assert.equal(rutaRelativa, rel)
    assert.equal(await fs.readFile(path.join(base, rel), 'utf8'), 'hola')
  })

  test('⚠️ un archivo con el mismo nombre no pisa al anterior: se guarda como «(2)»', async () => {
    const base = await carpetaTemporal()
    const rel = path.join('0042 X', 'F', 'factura.pdf')
    await escribirArchivo(base, rel, Buffer.from('primero'))
    const segundo = await escribirArchivo(base, rel, Buffer.from('segundo'))
    const tercero = await escribirArchivo(base, rel, Buffer.from('tercero'))

    assert.equal(segundo.rutaRelativa, path.join('0042 X', 'F', 'factura (2).pdf'))
    assert.equal(tercero.rutaRelativa, path.join('0042 X', 'F', 'factura (3).pdf'))
    assert.equal(await fs.readFile(path.join(base, rel), 'utf8'), 'primero')
    assert.equal(await fs.readFile(path.join(base, segundo.rutaRelativa), 'utf8'), 'segundo')
  })
})
