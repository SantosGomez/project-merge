// Pruebas de la formación del folio (tarea T7 de la especificación 002,
// módulo `Backend/src/logica/folio.js`).
//
// Sin un solo import: este módulo no habla con la base de datos ni con el
// servidor. Por eso `node --test` lo carga sin nada más.
//
// Lo que se comprueba aquí es la FORMA del folio y, sobre todo, que el ancho no
// se pierda. El año y el consecutivo llegan ya resueltos por parámetro: el año lo
// da `anioDe` de `fechas.js` y el consecutivo lo da la transacción que bloquea la
// fila de `contador_folio` (§4.2 del plan). Aquí no hay fechas ni base de datos,
// solo texto.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { formarFolio } from './folio.mjs'

/** La parte del consecutivo: lo que va detrás del segundo guion. */
const consecutivoDe = (folio) => folio.split('-')[2]

describe('formarFolio', () => {
  test('el consecutivo 1 da DCA-2026-0001', () => {
    assert.equal(formarFolio(2026, 1), 'DCA-2026-0001')
  })

  test('el consecutivo 9999 da DCA-2026-9999', () => {
    assert.equal(formarFolio(2026, 9999), 'DCA-2026-9999')
  })

  test('⚠️ de 999 a 1000 el número NO pierde el ancho', () => {
    // Este es el motivo de rellenar con ceros a la izquierda: el folio se ordena
    // y se compara como texto en las pantallas y en los reportes, y un `1000` sin
    // el cero de delante se leería antes que `999`, que es su anterior.
    assert.equal(formarFolio(2026, 999), 'DCA-2026-0999')
    assert.equal(formarFolio(2026, 1000), 'DCA-2026-1000')
    assert.equal(consecutivoDe(formarFolio(2026, 1000)).length, 4)
  })

  test('el consecutivo siempre ocupa cuatro dígitos', () => {
    // Del 1 al 9999 no puede haber ni un número más corto ni uno más largo.
    for (const consecutivo of [1, 9, 10, 99, 100, 999, 1000, 9999]) {
      const parte = consecutivoDe(formarFolio(2026, consecutivo))
      assert.equal(
        parte.length,
        4,
        `el consecutivo ${consecutivo} salió como "${parte}" y no ocupa cuatro dígitos`
      )
    }
  })

  test('⚠️ el cambio de año cambia el año y devuelve el consecutivo a uno', () => {
    // El consecutivo es POR AÑO (RF-5.3): el 1 de enero el contador vuelve a 1 y
    // el folio del año nuevo no puede chocar con el del anterior.
    assert.equal(formarFolio(2025, 412), 'DCA-2025-0412')
    assert.equal(formarFolio(2026, 1), 'DCA-2026-0001')
  })

  test('el folio tiene tres partes separadas por guion: DCA, año y consecutivo', () => {
    assert.match(formarFolio(2026, 7), /^DCA-\d{4}-\d{4}$/)
  })
})

describe('la regla que sostiene el módulo', () => {
  // Para poder distinguir el código de lo que se escribe alrededor, primero se
  // quitan los comentarios. Sin esto, el guardián dispararía contra el mismo
  // comentario que explica la regla, y documentarla sería un error.
  const codigoSinComentarios = (fuente) =>
    fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  test('⚠️ ninguna función llama a `new Date()` sin argumentos', async () => {
    // El año entra por parámetro (se lo da `anioDe` de `fechas.js`). Si alguien
    // escribiera `new Date()` para tener "hoy", las pruebas seguirían pasando con
    // el año real y el primer folio de enero saldría con el año equivocado.
    const fuente = codigoSinComentarios(
      await readFile(new URL('./folio.mjs', import.meta.url), 'utf8')
    )
    const sinArgumentos = fuente.match(/new Date\(\s*\)/g)
    assert.equal(
      sinArgumentos,
      null,
      `se encontró ${sinArgumentos?.length ?? 0} llamada(s) a new Date() sin argumentos`
    )
  })

  test('el módulo no importa nada', async () => {
    // El §2 del plan pide que ninguna función pura se importe de un lado al
    // otro. `anioDe` vive en `fechas.js` y no se arrastra aquí: llega ya hecho.
    const fuente = codigoSinComentarios(
      await readFile(new URL('./folio.mjs', import.meta.url), 'utf8')
    )
    assert.ok(
      !/^\s*import\s/m.test(fuente),
      'el módulo no debe importar nada: sin imports, node --test lo carga solo'
    )
  })
})