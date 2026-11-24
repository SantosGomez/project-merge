// Pruebas de la regla del semáforo (tarea T8 de la especificación 002,
// módulo `Backend/src/logica/semaforo.js`).
//
// Esta es LA REGLA DE NEGOCIO MÁS IMPORTANTE DEL PROYECTO: de ella sale el color
// de cada fila del directorio. Las pruebas están escritas en el mismo ORDEN en
// que la regla se evalúa, porque aquí el orden es el comportamiento: si alguien
// mueve el rojo después del verde, un documento cancelado acompañado de otros
// completados saldría verde y nadie se enteraría.
//
// Lo que se fija en cada prueba es de dónde sale el día: NINGUNA función pide la
// hora al reloj. Si el módulo usara `new Date()` por su cuenta, estas pruebas
// seguirían dando el mismo resultado mientras la fecha real coincidiera con la de
// aquí, y se romperían solas un día de octubre. Al final está la prueba que lo
// comprueba leyendo el archivo.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { semaforoDe } from './semaforo.mjs'

/** El día con el que se prueba. Miércoles 14 de octubre de 2026. */
const HOY = '2026-10-14T09:30:00'

/** Una fecha límite del día ANTERIOR: ya pasó, el documento está vencido. */
const VENCIDA = '2026-10-13T18:00:00'

/** Una fecha límite del día de hoy más tarde: todavía no llega. */
const DE_HOY = '2026-10-14T23:00:00'

/** Una fecha límite de la semana que viene. */
const FUTURA = '2026-10-20T18:00:00'

/** Un documento del periodo. El estado es lo único que el semáforo mira. */
const documento = (estado, fechaLimite = null) => ({ estado, fechaLimite })

describe('cada uno de los cuatro estados', () => {
  test('un documento cancelado da ROJO', () => {
    assert.equal(semaforoDe([documento('CANCELADO')], HOY), 'ROJO')
  })

  test('⚠️ un documento recibido, en proceso o pendiente con el cliente da ÁMBAR', () => {
    // Los tres son el mismo paso de la regla: el documento está vivo y el cliente
    // todavía tiene algo pendiente. Se prueban los tres por separado porque la
    // regla los nombra uno a uno.
    for (const estado of ['RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE']) {
      assert.equal(semaforoDe([documento(estado)], HOY), 'ÁMBAR', `con un ${estado}`)
    }
  })

  test('varios documentos activos juntos siguen dando ÁMBAR', () => {
    const documentos = [
      documento('RECEPCIONADO'),
      documento('EN_PROCESO'),
      documento('PENDIENTE_CLIENTE')
    ]
    assert.equal(semaforoDe(documentos, HOY), 'ÁMBAR')
  })

  test('un documento completado da VERDE', () => {
    assert.equal(semaforoDe([documento('COMPLETADO')], HOY), 'VERDE')
  })

  test('⚠️ varios completados juntos dan VERDE', () => {
    // El verde es el de "tiene al menos uno y todos están completados" (RF-8.2).
    const documentos = [documento('COMPLETADO'), documento('COMPLETADO')]
    assert.equal(semaforoDe(documentos, HOY), 'VERDE')
  })

  test('sin documentos da NEUTRO', () => {
    assert.equal(semaforoDe([], HOY), 'NEUTRO')
  })
})

describe('el rojo va primero: sale en cuanto se cumple', () => {
  test('⚠️ cancelados Y completados a la vez da ROJO, no VERDE', () => {
    // Esta es la prueba que existe para que nadie invierta el orden. Con el rojo
    // después del verde, estos documentos saldrían en verde y el cliente
    // aparecería al día teniendo un trámite cancelado.
    const documentos = [documento('COMPLETADO'), documento('CANCELADO')]
    assert.equal(semaforoDe(documentos, HOY), 'ROJO')
  })

  test('un cancelado manda aunque el resto sea una lista larga de completados', () => {
    const documentos = [
      documento('COMPLETADO'),
      documento('COMPLETADO'),
      documento('COMPLETADO'),
      documento('CANCELADO')
    ]
    assert.equal(semaforoDe(documentos, HOY), 'ROJO')
  })

  test('un cancelado manda aunque no tenga fecha límite', () => {
    // La fecha límite es otra de las dos puertas del rojo: si solo contara el
    // vencimiento, un cancelado sin fecha se colaría al verde.
    assert.equal(semaforoDe([documento('CANCELADO', null)], HOY), 'ROJO')
  })
})

describe('una fecha límite que ya pasó', () => {
  test('⚠️ un documento sin completar y vencido da ROJO', () => {
    const documentos = [documento('EN_PROCESO', VENCIDA)]
    assert.equal(semaforoDe(documentos, HOY), 'ROJO')
  })

  test('⚠️ un documento COMPLETADO con la fecha vencida NO da rojo', () => {
    // RF-8.2 dice "cuya fecha límite ya pasó y que no está completado": las dos
    // cosas. Un documento completado ya se entregó, y pedirlo hoy no lo pone en
    // rojo aunque su plazo terminara.
    const documentos = [documento('COMPLETADO', VENCIDA)]
    assert.equal(semaforoDe(documentos, HOY), 'VERDE')
  })

  test('un documento vencido entre varios completados da ROJO', () => {
    const documentos = [documento('COMPLETADO'), documento('RECEPCIONADO', VENCIDA)]
    assert.equal(semaforoDe(documentos, HOY), 'ROJO')
  })

  test('una fecha límite de HOY no vence: da ÁMBAR, no ROJO', () => {
    // El plazo vence al día siguiente, no a las 24:00 del día de la fecha.
    const documentos = [documento('EN_PROCESO', DE_HOY)]
    assert.equal(semaforoDe(documentos, HOY), 'ÁMBAR')
  })

  test('⚠️ la hora dentro del día no cuenta: hoy a la 1:00 sigue sin vencer', () => {
    // Si `hoy` no se bajara a medianoche, una fecha límite de hoy a la 01:00 se
    // leería como ya pasada a las 23:00 y el cliente se pondría en rojo el mismo
    // día del plazo. Es la trampa de comparar momentos en vez de días.
    const documentos = [documento('EN_PROCESO', '2026-10-14T01:00:00')]
    assert.equal(semaforoDe(documentos, '2026-10-14T23:50:00'), 'ÁMBAR')
  })

  test('una fecha límite futura da ÁMBAR, no ROJO', () => {
    const documentos = [documento('RECEPCIONADO', FUTURA)]
    assert.equal(semaforoDe(documentos, HOY), 'ÁMBAR')
  })

  test('⚠️ un documento sin fecha límite no se pone en rojo', () => {
    // La fecha límite es obligatoria en el formulario, pero la regla dice "no es
    // nulo": un documento sin ella no puede contarse como vencido.
    const documentos = [documento('RECEPCIONADO', null)]
    assert.equal(semaforoDe(documentos, HOY), 'ÁMBAR')
  })

  test('un completado sin fecha límite da VERDE', () => {
    const documentos = [documento('COMPLETADO', null)]
    assert.equal(semaforoDe(documentos, HOY), 'VERDE')
  })
})

describe('una lista vacía NO es verde', () => {
  test('⚠️ sin documentos el resultado es NEUTRO y no VERDE', () => {
    // RF-8.2 pone el neutro antes del verde justamente para esto: un cliente sin
    // documentos en el periodo no está "al día", no tiene nada que mostrar.
    const resultado = semaforoDe([], HOY)
    assert.equal(resultado, 'NEUTRO')
    assert.notEqual(resultado, 'VERDE', 'la lista vacía no puede salir en verde')
  })
})

describe('un estado desconocido NO es verde', () => {
  test('⚠️ un estado que no está en los cinco da ÁMBAR y no VERDE', () => {
    // El paso 0, el guardián: un dato raro no se perdona. Sin él, un estado
    // desconocido no contaría ni como completado ni como activo, y el cliente
    // caería en el verde por la puerta de atrás.
    const resultado = semaforoDe([documento('LO_QUE_SEA')], HOY)
    assert.equal(resultado, 'ÁMBAR')
    assert.notEqual(resultado, 'VERDE', 'un estado desconocido no puede salir en verde')
  })

  test('el guardián salta aunque el resto de la lista esté completada', () => {
    const documentos = [documento('COMPLETADO'), documento('')]
    assert.equal(semaforoDe(documentos, HOY), 'ÁMBAR')
  })

  test('un estado en minúsculas es un estado desconocido', () => {
    // La comparación es exacta a propósito: es lo mismo que hace `hayAcceso` con
    // el rol. Un dato con distinta forma tiene que verse, no colarse de verde.
    assert.equal(semaforoDe([documento('completado')], HOY), 'ÁMBAR')
  })
})

describe('el guardián va antes que el rojo', () => {
  test('un estado desconocido con la fecha vencida da ÁMBAR y no ROJO', () => {
    // Si el rojo se evaluara antes, saldría en rojo, que es una alerta; el
    // guardián existe para que lo raro se vea como "pendiente de revisar", no
    // como "urgente".
    const documentos = [documento('LO_QUE_SEA', VENCIDA)]
    assert.equal(semaforoDe(documentos, HOY), 'ÁMBAR')
  })
})

describe('el texto que sale es el que pinta la vista', () => {
  test('⚠️ el valor que sale es ÁMBAR CON acento', () => {
    // Si alguien lo escribe sin tilde, la comparación de la vista contra
    // 'ÁMBAR' no encuentra nada y la celda se queda sin color sin avisar.
    assert.equal(semaforoDe([documento('RECEPCIONADO')], HOY), 'ÁMBAR')
    assert.equal('ÁMBAR'.length, 5, 'cinco letras: A con acento cuenta como una')
  })
})

describe('la regla que sostiene el módulo', () => {
  // Para poder distinguir el código de lo que se escribe alrededor, primero se
  // quitan los comentarios. Sin esto, el guardián dispararía contra el mismo
  // comentario que explica la regla, y documentarla sería un error.
  const codigoSinComentarios = (fuente) =>
    fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

  test('⚠️ ninguna función llama a `new Date()` sin argumentos', async () => {
    // Se comprueba leyendo el archivo, no confiando en la memoria. El día lo
    // recibe quien llama: si el módulo sacara "hoy" del reloj, estas pruebas
    // seguirían dando lo mismo mientras la fecha real coincidiera con la de
    // aquí, y un cliente se pondría en verde porque el día cambió.
    const fuente = codigoSinComentarios(
      await readFile(new URL('./semaforo.mjs', import.meta.url), 'utf8')
    )
    const sinArgumentos = fuente.match(/new Date\(\s*\)/g)
    assert.equal(
      sinArgumentos,
      null,
      `se encontró ${sinArgumentos?.length ?? 0} llamada(s) a new Date() sin argumentos`
    )
  })

  test('el módulo solo importa de `fechas.js`', async () => {
    // El §2 del plan pide que ninguna función pura se importe de un lado al
    // otro; la excepción es `fechas.js`, que es del mismo lado (línea 43 del
    // plan). Ni la base, ni el servidor, ni una dependencia: nada de eso se
    // importa aquí, y por eso `node --test` lo carga sin nada más.
    const fuente = codigoSinComentarios(
      await readFile(new URL('./semaforo.mjs', import.meta.url), 'utf8')
    )
    const importaciones = fuente.match(/^\s*import\s.*$/gm) ?? []
    for (const linea of importaciones) {
      assert.match(
        linea,
        /from\s+'\.\/fechas\.mjs'/,
        `esta importación no es del módulo de fechas: ${linea.trim()}`
      )
    }
  })
})
