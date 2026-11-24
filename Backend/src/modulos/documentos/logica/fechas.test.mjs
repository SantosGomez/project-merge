// Pruebas de las fechas del servidor (tarea T5 de la especificación 002,
// módulo `Backend/src/logica/fechas.js`).
//
// Esta tarea existe por una trampa que el proyecto ya pagó dos veces. Medido en
// esta máquina, con desfase de 5 horas (America/Matamoros):
//
//   new Date('2026-01-01')        -> 2025-12-31   retrocede día Y año
//   new Date('2026-10-01')        -> 2026-09-30   retrocede mes
//   new Date('2026-10-08')        -> 2026-10-07   retrocede día
//
// Un valor de SOLO DÍA lo interpreta el motor como UTC. Anclarlo a mediodía local
// es lo que hace imposible ese retroceso. Por eso hay aquí una prueba que
// comprueba la diferencia, y no solo que el resultado sea el bueno.
//
// El calendario de referencia se verificó contra el motor antes de escribir esto:
//   2026-10-09 viernes, 10 sábado, 11 domingo, 12 lunes, 13 martes,
//   14 miércoles, 15 jueves, 16 viernes, y 2026-01-01 jueves.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { aFechaLocal, aMedianoche, anioDe, esDiaHabil } from './fechas.mjs'

/** Cómo se ve una fecha, para que el fallo se lea en el mensaje. */
const comoTexto = (fecha) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`

describe('aFechaLocal con un valor de solo día', () => {
  test('devuelve el MISMO día que dice el texto', () => {
    assert.equal(comoTexto(aFechaLocal('2026-10-08')), '2026-10-08')
  })

  test('⚠️ el primero de enero NO retrocede de año', () => {
    // Este es el caso que más daño hace: sin anclar, el 1 de enero de 2026 se
    // convierte en 31 de diciembre de 2025, y el folio del año queda mal.
    const fecha = aFechaLocal('2026-01-01')
    assert.equal(fecha.getDate(), 1)
    assert.equal(fecha.getFullYear(), 2026)
  })

  test('⚠️ el primero de mes NO retrocede de mes', () => {
    const fecha = aFechaLocal('2026-10-01')
    assert.equal(fecha.getMonth(), 9)
    assert.equal(fecha.getDate(), 1)
  })

  test('la diferencia se ve al compararlo con el parseo sin anclar', () => {
    // Si alguien quita el anclaje a mediodía, esta prueba se rompe y dice por qué.
    const anclada = aFechaLocal('2026-01-01')
    const sinAnclar = new Date('2026-01-01')
    assert.notEqual(
      comoTexto(sinAnclar),
      comoTexto(anclada),
      'si las dos dan lo mismo, el anclaje dejó de hacer algo'
    )
    assert.equal(comoTexto(sinAnclar), '2025-12-31')
    assert.equal(comoTexto(anclada), '2026-01-01')
  })
})

describe('aFechaLocal con un valor que ya trae hora', () => {
  test('un texto con hora y sin desfase se lee en hora local', () => {
    const fecha = aFechaLocal('2026-10-08T10:15:00')
    assert.equal(fecha.getFullYear(), 2026)
    assert.equal(fecha.getMonth(), 9)
    assert.equal(fecha.getDate(), 8)
    assert.equal(fecha.getHours(), 10)
    assert.equal(fecha.getMinutes(), 15)
  })

  test('⚠️ una fecha con hora de la mañana NO se mueve al día anterior', () => {
    // Con hora, el motor la lee como hora local, así que una hora temprana se
    // queda en su día. Sin el anclaje a mediodía esto también se rompería.
    const fecha = aFechaLocal('2026-10-08T00:30:00')
    assert.equal(comoTexto(fecha), '2026-10-08')
    assert.equal(fecha.getHours(), 0)
  })

  test('un texto con la Z se respeta tal cual, no se reinterpreta', () => {
    // Si llega con `Z` significa UTC de verdad, y doblarlo a hora local sería
    // inventarse una hora. Aquí solo se comprueba que no lanza y que es una fecha.
    const fecha = aFechaLocal('2026-10-08T10:15:00Z')
    assert.ok(!Number.isNaN(fecha.getTime()), 'debe ser una fecha válida')
  })
})

describe('aFechaLocal con un Date', () => {
  test('lo devuelve tal cual, sin copiar ni alterar', () => {
    const original = new Date(2026, 9, 8, 10, 15)
    assert.equal(aFechaLocal(original), original)
  })
})

describe('aFechaLocal con algo que no es una fecha', () => {
  test('devuelve una fecha inválida en vez de inventar una fecha', () => {
    // No lanza ni devuelve hoy. Devuelve "inválida", y es la señal de que quien
    // llama tiene que revisarlo: una fecha inválida comparada con otra da falso
    // en todos lados, y en el semáforo eso dejaría a un cliente en verde.
    for (const entrada of ['no-es-fecha', '', 'ayer', {}]) {
      const fecha = aFechaLocal(entrada)
      assert.ok(
        Number.isNaN(fecha.getTime()),
        `"${entrada}" debería dar fecha inválida y dio ${comoTexto(fecha)}`
      )
    }
  })
})

describe('aMedianoche', () => {
  test('deja la hora, los minutos, los segundos y los milisegundos en cero', () => {
    const medianoche = aMedianoche('2026-10-08T10:15:30.500')
    assert.equal(medianoche.getHours(), 0)
    assert.equal(medianoche.getMinutes(), 0)
    assert.equal(medianoche.getSeconds(), 0)
    assert.equal(medianoche.getMilliseconds(), 0)
  })

  test('⚠️ no cambia el día, solo la hora', () => {
    assert.equal(comoTexto(aMedianoche('2026-10-08T23:59:59')), '2026-10-08')
  })

  test('⚠️ dos momentos del mismo día dan la MISMA medianoche', () => {
    // Esto es para lo que existe: comparar "ya pasó" sin que la hora dentro del
    // día haga que dos horas distintas se lean como días distintos.
    const temprano = aMedianoche('2026-10-08T01:00:00')
    const tarde = aMedianoche('2026-10-08T23:00:00')
    assert.equal(tiempoDe(temprano), tiempoDe(tarde))
  })

  test('⚠️ el 31 de diciembre a medianoche NO se va al año siguiente', () => {
    const medianoche = aMedianoche('2026-12-31T22:00:00')
    assert.equal(medianoche.getFullYear(), 2026)
    assert.equal(medianoche.getMonth(), 11)
    assert.equal(medianoche.getDate(), 31)
  })

  test('acepta un valor de solo día', () => {
    assert.equal(comoTexto(aMedianoche('2026-10-08')), '2026-10-08')
  })

  test('no altera el Date que le pasaron', () => {
    const original = new Date(2026, 9, 8, 10, 15)
    aMedianoche(original)
    assert.equal(original.getHours(), 10, 'el Date de entrada no debe tocarse')
    assert.equal(original.getDate(), 8)
  })

  test('devuelve un Date nuevo, no el mismo objeto', () => {
    const original = new Date(2026, 9, 8, 10, 15)
    assert.notEqual(aMedianoche(original), original)
  })
})

describe('anioDe', () => {
  test('⚠️ el primero de enero devuelve el año que dice, no el anterior', () => {
    // El consecutivo del folio es por año. Si el 1 de enero devolviera 2025, el
    // folio del primer documento del año saldría con el año equivocado.
    assert.equal(anioDe('2026-01-01'), 2026)
    assert.equal(anioDe('2025-12-31'), 2025)
  })

  test('devuelve un número, no un texto', () => {
    assert.equal(typeof anioDe('2026-10-08'), 'number')
  })

  test('acepta un Date', () => {
    assert.equal(anioDe(new Date(2027, 5, 15)), 2027)
  })
})

describe('esDiaHabil', () => {
  // Semana verificada contra el motor: 9 viernes, 10 sábado, 11 domingo,
  // 12 lunes, 13 martes, 14 miércoles, 15 jueves, 16 viernes.
  const SEMANA = [
    ['2026-10-09', true, 'viernes'],
    ['2026-10-10', false, 'sábado'],
    ['2026-10-11', false, 'domingo'],
    ['2026-10-12', true, 'lunes'],
    ['2026-10-13', true, 'martes'],
    ['2026-10-14', true, 'miércoles'],
    ['2026-10-15', true, 'jueves'],
    ['2026-10-16', true, 'viernes']
  ]

  for (const [fecha, esperado, dia] of SEMANA) {
    test(`${fecha} es ${dia} y ${esperado ? 'cuenta' : 'no cuenta'}`, () => {
      assert.equal(esDiaHabil(fecha), esperado)
    })
  }

  test('⚠️ da lo mismo con hora que sin hora', () => {
    // El sábado sigue siendo sábado a las 23:00 y a las 00:30.
    assert.equal(esDiaHabil('2026-10-10T00:30:00'), false)
    assert.equal(esDiaHabil('2026-10-10T23:30:00'), false)
  })

  test('⚠️ da lo mismo con un Date que con un texto', () => {
    assert.equal(esDiaHabil(new Date(2026, 9, 11)), esDiaHabil('2026-10-11'))
    assert.equal(esDiaHabil(new Date(2026, 9, 10)), false)
  })

  test('acepta la salida de aMedianoche, que es como lo usará el semáforo', () => {
    assert.equal(esDiaHabil(aMedianoche('2026-10-10T15:00:00')), false)
    assert.equal(esDiaHabil(aMedianoche('2026-10-14T15:00:00')), true)
  })
})

describe('la regla que sostiene todo el módulo', () => {
  // Para poder distinguir el código de lo que se escribe alrededor, primero se
  // quitan los comentarios. Sin esto, el guardián dispararía contra el mismo
  // comentario que explica la regla, y documentarla sería un error.
  const codigoSinComentarios = (fuente) =>
    fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  test('⚠️ ninguna función llama a `new Date()` sin argumentos', async () => {
    // Se comprueba leyendo el archivo, no confiando en la memoria. Si alguien
    // escribe `new Date()` para tener "hoy", las pruebas seguirían pasando con
    // la fecha real y nadie se enteraría hasta que fallen en otro sitio.
    const fuente = codigoSinComentarios(
      await readFile(new URL('./fechas.mjs', import.meta.url), 'utf8')
    )
    const sinArgumentos = fuente.match(/new Date\(\s*\)/g)
    assert.equal(
      sinArgumentos,
      null,
      `se encontró ${sinArgumentos?.length ?? 0} llamada(s) a new Date() sin argumentos`
    )
  })

  test('el módulo no importa nada', async () => {
    const fuente = codigoSinComentarios(
      await readFile(new URL('./fechas.mjs', import.meta.url), 'utf8')
    )
    assert.ok(
      !/^\s*import\s/m.test(fuente),
      'el módulo no debe importar nada: sin imports, node --test lo carga solo'
    )
  })
})

/** Milisegundos desde el origen, para comparar dos momentos del mismo día. */
const tiempoDe = (fecha) => fecha.getTime()
