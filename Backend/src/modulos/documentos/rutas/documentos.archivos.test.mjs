import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { rutaSubirArchivo, rutaDescargarArchivo } from './documentos.mjs'

test('rutaSubirArchivo guarda el archivo y devuelve 200', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'dca-'))
  const pool = {
    query: async (sql) => {
      if (sql.includes('FROM documentos d')) {
        return [[{ folio: 'DCA-2026-0001', periodo: '2026-10', clave: '0042', razonSocial: 'ACME TRANSLOGISTICS SA DE CV' }]]
      }
      if (sql.startsWith('UPDATE documento_archivos')) {
        return [{ affectedRows: 0 }]
      }
      if (sql.startsWith('INSERT INTO documento_archivos')) {
        return [{ insertId: 7 }]
      }
      return [[]]
    },
  }

  const res = await rutaSubirArchivo(pool, base, 1, 'x.pdf', 'application/pdf', Buffer.from('hola'), 1)

  assert.equal(res.status, 200)
  assert.equal(res.body.id, 7)
  assert.equal(res.body.tamanoBytes, 4)

  // Cliente / año / mes del periodo / folio, como las carpetas de clientes.
  const rel = path.join('0042 ACME TRANSLOGISTICS SA DE CV', '2026', '10 OCTUBRE', 'DCA-2026-0001', 'x.pdf')
  assert.equal(res.body.rutaStorage, rel)
  const leido = await fs.readFile(path.join(base, rel), 'utf8')
  assert.equal(leido, 'hola')
})

test('rutaSubirArchivo usa la carpeta del cliente que ya existe y no pisa un archivo igual', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'dca-'))
  await fs.mkdir(path.join(base, '0042 ACME NOMBRE ANTERIOR'))
  const guardadas = []
  const pool = {
    query: async (sql, params) => {
      if (sql.includes('FROM documentos d')) {
        return [[{ folio: 'F1', periodo: '2026-11', clave: '0042', razonSocial: 'ACME TRANSLOGISTICS SA DE CV' }]]
      }
      if (sql.startsWith('UPDATE documento_archivos')) return [{ affectedRows: 0 }]
      if (sql.startsWith('INSERT INTO documento_archivos')) {
        guardadas.push(params[1])
        return [{ insertId: guardadas.length }]
      }
      return [[]]
    },
  }

  await rutaSubirArchivo(pool, base, 1, 'x.pdf', 'application/pdf', Buffer.from('uno'), 1)
  await rutaSubirArchivo(pool, base, 1, 'x.pdf', 'application/pdf', Buffer.from('dos'), 1)

  const carpeta = path.join('0042 ACME NOMBRE ANTERIOR', '2026', '11 NOVIEMBRE', 'F1')
  assert.deepEqual(guardadas, [path.join(carpeta, 'x.pdf'), path.join(carpeta, 'x (2).pdf')])
  assert.equal(await fs.readFile(path.join(base, carpeta, 'x.pdf'), 'utf8'), 'uno')
  assert.equal(await fs.readFile(path.join(base, carpeta, 'x (2).pdf'), 'utf8'), 'dos')
})

test('rutaSubirArchivo devuelve 404 si el documento no existe', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'dca-'))
  const pool = { query: async () => [[]] }
  const res = await rutaSubirArchivo(pool, base, 999, 'x.pdf', 'application/pdf', Buffer.from('hola'), 1)
  assert.equal(res.status, 404)
})

// Descarga: el Cliente solo baja lo suyo. Defecto real (2026-11-04): con
// `clienteId` nulo (usuario Cliente sin cliente vinculado, p. ej. porque el
// cliente se borró y `usuarios.cliente_id` quedó en NULL) se saltaba la
// comprobación y podía descargar los archivos de cualquier documento.
describe('rutaDescargarArchivo: permisos', () => {
  /** Carpeta con un archivo real, para que un permiso mal hecho sí descargue. */
  const prepararArchivo = async () => {
    const base = await fs.mkdtemp(path.join(os.tmpdir(), 'dca-'))
    await fs.writeFile(path.join(base, 'ajeno.pdf'), 'contenido ajeno')
    return base
  }

  /** Pool cuyo documento pertenece al cliente 99; anota si se llegó a pedir el archivo. */
  const poolDe = (consultas) => ({
    query: async (sql) => {
      consultas.push(sql)
      if (sql.includes('FROM documentos d')) return [[{ id: 5, clienteId: 99 }]]
      return [[{ nombre: 'ajeno.pdf', mimeType: 'application/pdf', ruta: 'ajeno.pdf' }]]
    },
  })

  test('un Cliente sin cliente vinculado no descarga nada', async () => {
    const base = await prepararArchivo()
    const consultas = []
    const res = await rutaDescargarArchivo(poolDe(consultas), base, 5, 1, 7, 'Cliente', null)
    assert.equal(res.status, 403)
    assert.equal(res.archivo, undefined, 'no debe entregar el archivo')
    assert.ok(
      !consultas.some((sql) => sql.includes('FROM documento_archivos')),
      'ni siquiera debe buscar el archivo',
    )
  })

  test('un Cliente no descarga el documento de otro cliente', async () => {
    const base = await prepararArchivo()
    const res = await rutaDescargarArchivo(poolDe([]), base, 5, 1, 7, 'Cliente', 3)
    assert.equal(res.status, 403)
    assert.equal(res.archivo, undefined)
  })

  test('un Cliente sí descarga lo suyo', async () => {
    const base = await prepararArchivo()
    const res = await rutaDescargarArchivo(poolDe([]), base, 5, 1, 7, 'Cliente', 99)
    assert.equal(res.status, 200)
    assert.equal(res.archivo.buffer.toString(), 'contenido ajeno')
  })

  test('el Contador descarga sin cliente vinculado', async () => {
    const base = await prepararArchivo()
    const res = await rutaDescargarArchivo(poolDe([]), base, 5, 1, 7, 'Contador', null)
    assert.equal(res.status, 200)
  })
})

test('el servidor toma el nombre del archivo solo de la URL, nunca de una cabecera', async () => {
  // Una cabecera no admite «–» ni otros caracteres fuera de Latin-1: el
  // navegador rechazaba la petición antes de enviarla.
  // Unión, fase 3: la ruta vive en el router de Express de status-conta.
  const fuente = await fs.readFile(new URL('../../../routes/documentoRoutes.js', import.meta.url), 'utf8')
  assert.doesNotMatch(fuente, /x-nombre-original/i)
  assert.match(fuente, /const nombreOriginal = req\.query\.nombreOriginal/)
})
