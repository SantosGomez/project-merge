// Pruebas de la validación del documento y de los adjuntos
// (tarea T6 de la especificación 002, módulo `Backend/src/logica/validacion.js`).
//
// Sin un solo import: este módulo no habla con la base de datos ni con el
// servidor. Por eso `node --test` lo carga sin nada más.
//
// Lo que más importa aquí es que la validación **diga qué falta y por qué**, en
// español. Un "datos inválidos" obliga a abrir el código para saber qué
// arreglar; un "el periodo no tiene el formato AAAA-MM" se resuelve solo.
// RF-5.10 pide "explica qué falta" y RNF-1 que el mensaje diga qué hacer.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validarDocumento, validarAdjuntos, LIMITE_ADJUNTO_BYTES } from './validacion.mjs'

// Un documento válido y completo. Cada prueba parte de aquí y quita UNA cosa.
const COMPLETO = {
  clienteId: 1,
  empresaId: 2,
  tipoDocId: 3,
  departamentoId: 4,
  asunto: 'Comprobante de pago de octubre',
  prioridad: 'MEDIA',
  periodo: '2026-10',
  viaEntrega: 'CORREO',
  firmaCliente: 'datos-de-la-firma-del-cliente',
  firmaRecep: 'datos-de-la-firma-del-recepcionista',
  // El contador asignado es obligatorio desde la rebanada 44.
  contadorId: 7,
  // Opcionales: si no están, el documento sigue siendo válido.
  observaciones: 'sin incidencias',
  notificarCorreo: true
}

/** Copia del documento válido con un campo a `undefined`. */
const sinCampo = (nombre) => {
  const datos = { ...COMPLETO }
  delete datos[nombre]
  return datos
}

/** Copia del documento válido con un campo puesto a otro valor. */
const conCampo = (nombre, valor) => ({ ...COMPLETO, [nombre]: valor })

/** Los nombres de los campos que la lista de problemas menciona. */
const camposDe = (problemas) => problemas.map((problema) => problema.campo)

/** El primer problema de un campo dado, o `undefined`. */
const problemaDe = (problemas, campo) => problemas.find((p) => p.campo === campo)

/** Un adjunto para las pruebas. */
const adjunto = (nombreOriginal, tamanoBytes) => ({ nombreOriginal, tamanoBytes })

describe('validarDocumento con un documento completo', () => {
  test('no devuelve ningún problema', () => {
    assert.deepEqual(validarDocumento(COMPLETO), [])
  })

  test('devuelve una lista, no un verdadero o un falso', () => {
    // El plan lo pide así: quien llama tiene que poder decir CUÁLES faltan, no
    // solo que algo falla. Un booleano obliga a volver a validar para saber qué.
    const resultado = validarDocumento(COMPLETO)
    assert.ok(Array.isArray(resultado))
  })

  test('no lanza ni con datos que no son un objeto', () => {
    for (const entrada of [null, undefined, 0, '', 'texto', []]) {
      assert.ok(Array.isArray(validarDocumento(entrada)))
    }
  })

  test('no altera el objeto que le pasaron', () => {
    const datos = { ...COMPLETO }
    validarDocumento(datos)
    assert.deepEqual(datos, COMPLETO, 'la validación no debe tocar los datos')
  })
})

describe('cada campo obligatorio, quitado uno por uno', () => {
  // Los diez de RF-5.2: cliente, empresa, tipo, departamento, asunto, prioridad,
  // periodo, vía de entrega y las dos firmas.
  const OBLIGATORIOS = [
    ['clienteId', 'cliente'],
    ['empresaId', 'empresa receptora'],
    ['tipoDocId', 'tipo de documento'],
    ['departamentoId', 'departamento'],
    ['asunto', 'asunto'],
    ['prioridad', 'prioridad'],
    ['periodo', 'periodo'],
    ['viaEntrega', 'vía de entrega'],
    ['firmaCliente', 'firma del cliente'],
    ['firmaRecep', 'firma del recepcionista']
  ]

  for (const [campo, etiqueta] of OBLIGATORIOS) {
    test(`sin ${campo}, la lista lo nombra`, () => {
      const problemas = validarDocumento(sinCampo(campo))
      const encontrado = problemaDe(problemas, campo)
      assert.ok(encontrado, `la lista no nombró ${campo}: ${JSON.stringify(problemas)}`)
      assert.equal(encontrado.problema, 'FALTA')
      assert.equal(encontrado.etiqueta, etiqueta, 'debe decir cómo se llama en la pantalla')
    })
  }

  test('si faltan varios, aparecen TODOS y no solo el primero', () => {
    const problemas = validarDocumento(sinCampo('asunto'))
    // quitar uno más a mano
    const datos = { ...sinCampo('asunto') }
    delete datos.periodo
    delete datos.firmaRecep
    const todos = validarDocumento(datos)
    assert.ok(camposDe(todos).includes('asunto'))
    assert.ok(camposDe(todos).includes('periodo'))
    assert.ok(camposDe(todos).includes('firmaRecep'))
    assert.equal(todos.length, 3, `faltaron más de los tres: ${JSON.stringify(problemas)}`)
  })

  test('un campo vacío o con puros espacios cuenta como que falta', () => {
    // En un formulario es fácil dejar el espacio en blanco y creer que se puso.
    for (const vacio of ['', '   ', null, undefined, '\t']) {
      const problemas = validarDocumento(conCampo('asunto', vacio))
      const encontrado = problemaDe(problemas, 'asunto')
      assert.ok(encontrado, `"${vacio}" debería contar como que falta`)
      assert.equal(encontrado.problema, 'FALTA')
    }
  })
})

describe('los campos opcionales no bloquean', () => {
  for (const opcional of ['observaciones', 'notificarCorreo', 'adjuntos']) {
    test(`sin ${opcional} el documento sigue siendo válido`, () => {
      assert.deepEqual(validarDocumento(sinCampo(opcional)), [])
    })
  }
})

describe('el contador asignado es obligatorio', () => {
  test('sin contador, o con contador vacío, falta el contador asignado', () => {
    for (const datos of [sinCampo('contadorId'), conCampo('contadorId', null), conCampo('contadorId', '')]) {
      const problema = problemaDe(validarDocumento(datos), 'contadorId')
      assert.ok(problema, 'tiene que reportar el contador')
      assert.equal(problema.problema, 'FALTA')
      assert.equal(problema.etiqueta, 'contador asignado')
    }
  })

  test('con contador puesto no reporta nada', () => {
    assert.deepEqual(validarDocumento(conCampo('contadorId', 7)), [])
  })
})

describe('el formato del periodo', () => {
  test('⚠️ un periodo con texto se rechaza por FORMATO, no por FALTA', () => {
    // La diferencia importa: "falta el periodo" hace que el usuario lo escriba,
    // y "el periodo no tiene el formato" le dice qué está mal. Con el texto
    // equivocado, escribir cualquier cosa otra vez tampoco lo arregla.
    const problemas = validarDocumento(conCampo('periodo', 'octubre'))
    const encontrado = problemaDe(problemas, 'periodo')
    assert.ok(encontrado, 'el periodo con texto tiene que rechazarse')
    assert.equal(encontrado.problema, 'FORMATO')
  })

  test('⚠️ el mensaje del formato dice cuál es el esperado', () => {
    const problema = problemaDe(validarDocumento(conCampo('periodo', '2026-1')), 'periodo')
    assert.ok(problema, '2026-1 no tiene la forma AAAA-MM')
    assert.match(problema.detalle, /AAAA-MM/, 'el detalle dice la forma esperada')
  })

  test('acepta los periodos bien formados, en cualquier mes', () => {
    for (const periodo of ['2026-10', '2026-01', '2026-12', '2025-02', '2024-02']) {
      assert.deepEqual(validarDocumento(conCampo('periodo', periodo)), [], `rechazó ${periodo}`)
    }
  })

  test('rechaza las formas que casi están bien', () => {
    for (const periodo of ['2026-1', '26-10', '2026-13', '2026/10', '202610', '2026-10-01']) {
      const problemas = validarDocumento(conCampo('periodo', periodo))
      const encontrado = problemaDe(problemas, 'periodo')
      assert.ok(encontrado, `debió rechazar "${periodo}"`)
      assert.equal(encontrado.problema, 'FORMATO')
    }
  })
})

describe('la vía de entrega', () => {
  test('acepta los cuatro valores del esquema', () => {
    for (const via of ['PRESENCIAL', 'CORREO', 'DIGITAL', 'OTRO']) {
      assert.deepEqual(validarDocumento(conCampo('viaEntrega', via)), [], `rechazó ${via}`)
    }
  })

  test('⚠️ una vía inventada se rechaza por FORMATO', () => {
    // El mismo motivo que en el esquema: un ENUM con un valor que no existe se
    // convertiría en cadena vacía en una base sin modo estricto, en silencio.
    const problemas = validarDocumento(conCampo('viaEntrega', 'TELEPATIA'))
    const encontrado = problemaDe(problemas, 'viaEntrega')
    assert.ok(encontrado, 'una vía que no existe tiene que rechazarse')
    assert.equal(encontrado.problema, 'FORMATO')
  })

  test('una vía en minúsculas se rechaza: el ENUM guarda mayúsculas', () => {
    const problemas = validarDocumento(conCampo('viaEntrega', 'correo'))
    assert.ok(problemaDe(problemas, 'viaEntrega'))
  })

  test('el mensaje nombra los cuatro valores que sí valen', () => {
    const problema = problemaDe(validarDocumento(conCampo('viaEntrega', 'TELEPATIA')), 'viaEntrega')
    for (const via of ['PRESENCIAL', 'CORREO', 'DIGITAL', 'OTRO']) {
      assert.ok(problema.detalle.includes(via), `el detalle no menciona ${via}`)
    }
  })
})

describe('validarAdjuntos', () => {
  test('el límite son 25 MiB', () => {
    assert.equal(LIMITE_ADJUNTO_BYTES, 26214400)
  })

  test('sin adjuntos, no hay ninguno rechazado', () => {
    assert.deepEqual(validarAdjuntos([]), [])
    assert.deepEqual(validarAdjuntos(), [])
  })

  test('un adjunto de 24 MiB se acepta', () => {
    assert.deepEqual(validarAdjuntos([adjunto('chico.pdf', 24 * 1024 * 1024)]), [])
  })

  test('⚠️ un adjunto de 26 MiB se separa del resto', () => {
    const rechazados = validarAdjuntos([adjunto('grande.pdf', 26 * 1024 * 1024)])
    assert.equal(rechazados.length, 1)
    assert.equal(rechazados[0].nombreOriginal, 'grande.pdf')
  })

  test('⚠️ el que se pasa NO bloquea a los que sí caben', () => {
    // RF-9.4: se rechaza ESE adjunto y el resto del registro continúa. Por eso
    // la función devuelve una lista de rechazados y no un sí o un no.
    const rechazados = validarAdjuntos([
      adjunto('chico.pdf', 1024),
      adjunto('grande.pdf', 30 * 1024 * 1024),
      adjunto('mediano.pdf', 5 * 1024 * 1024)
    ])
    assert.equal(rechazados.length, 1)
    assert.equal(rechazados[0].nombreOriginal, 'grande.pdf')
  })

  test('⚠️ justo en el límite se acepta; un byte más se rechaza', () => {
    // "Supera el límite" es lo que dice RF-9.4. Justo en el límite no lo supera.
    assert.deepEqual(validarAdjuntos([adjunto('justo.pdf', LIMITE_ADJUNTO_BYTES)]), [])
    assert.equal(
      validarAdjuntos([adjunto('un-byte.pdf', LIMITE_ADJUNTO_BYTES + 1)]).length,
      1
    )
  })

  test('si se pasan varios, aparecen todos', () => {
    const rechazados = validarAdjuntos([
      adjunto('a.pdf', 40 * 1024 * 1024),
      adjunto('b.pdf', 1024),
      adjunto('c.pdf', 26 * 1024 * 1024)
    ])
    assert.equal(rechazados.length, 2)
    assert.deepEqual(
      rechazados.map((r) => r.nombreOriginal).sort(),
      ['a.pdf', 'c.pdf']
    )
  })

  test('el rechazado trae tamaño y límite, para que la pantalla los muestre', () => {
    const [rechazado] = validarAdjuntos([adjunto('grande.pdf', 30 * 1024 * 1024)])
    assert.equal(rechazado.tamanoBytes, 30 * 1024 * 1024)
    assert.equal(rechazado.limiteBytes, LIMITE_ADJUNTO_BYTES)
  })

  test('un adjunto sin nombre o sin tamaño no rompe nada', () => {
    const rechazados = validarAdjuntos([{}, { nombreOriginal: 'x.pdf' }])
    assert.ok(Array.isArray(rechazados))
  })

  test('un tamaño que no es número no se marca como rechazado', () => {
    // Sin dato no se puede afirmar que se pasa del límite. Se deja pasar y lo
    // que se sepa se lo preguntará la base, no esta función adivinando.
    assert.deepEqual(validarAdjuntos([adjunto('raro.pdf', 'mucho')]), [])
  })

  test('un tamaño en texto SÍ se rechaza si se puede leer', () => {
    const rechazados = validarAdjuntos([{ nombreOriginal: 'x.pdf', tamanoBytes: '30000000' }])
    assert.equal(rechazados.length, 1)
  })

  test('no altera la lista de adjuntos que le pasaron', () => {
    const adjuntos = [adjunto('chico.pdf', 1024), adjunto('grande.pdf', 30 * 1024 * 1024)]
    validarAdjuntos(adjuntos)
    assert.equal(adjuntos.length, 2)
    assert.equal(adjuntos[1].tamanoBytes, 30 * 1024 * 1024)
  })
})

describe('validar un documento que además trae adjuntos', () => {
  test('⚠️ un adjunto grande no invalida el documento, solo se separa', () => {
    const datos = { ...COMPLETO, adjuntos: [adjunto('grande.pdf', 30 * 1024 * 1024)] }
    assert.deepEqual(validarDocumento(datos), [], 'el documento es válido')
    assert.equal(validarAdjuntos(datos.adjuntos).length, 1, 'pero el adjunto se separa')
  })

  test('un documento sin periodo Y con adjunto grande avisa de las dos cosas', () => {
    const datos = sinCampo('periodo')
    datos.adjuntos = [adjunto('grande.pdf', 30 * 1024 * 1024)]
    const problemas = validarDocumento(datos)
    assert.ok(problemaDe(problemas, 'periodo'))
    assert.equal(validarAdjuntos(datos.adjuntos).length, 1)
  })
})
