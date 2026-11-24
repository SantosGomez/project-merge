// Pruebas de la clasificación de fallos y la tabla de permisos
// (tarea T4 de la especificación 002, módulo `Backend/src/logica/errores.js`).
//
// Sin un solo import del proyecto: este módulo no habla con la base ni con el
// servidor, solo mira el `code` de un error. Por eso `node --test` lo carga sin
// base de datos, que es lo que RNF-5 pide.
//
// Los códigos que salen aquí son los que se Midieron contra MariaDB de verdad,
// no los de memoria:
//   ER_NO_SUCH_TABLE  1146 / 42S02   tabla inexistente
//   ER_BAD_DB_ERROR   1049 / 42000   base inexistente
//   ER_DUP_ENTRY      1062 / 23000   folio repetido
//   ECONNREFUSED      del cliente de red al no haber quien escuche

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { clasificarFallo, mensajeDeFallo, hayAcceso } from './errores.mjs'

// Los códigos tal cual los reporta el motor.
const CONEXION = [
  ['ECONNREFUSED', 'nadie escucha en el puerto'],
  ['ECONNRESET', 'la conexión se cortó'],
  ['ETIMEDOUT', 'no respondió a tiempo'],
  ['ENOTFOUND', 'no se pudo resolver el nombre'],
  ['EHOSTUNREACH', 'no se puede llegar al servidor']
]

const ESQUEMA = [
  ['ER_NO_SUCH_TABLE', 'falta una tabla'],
  ['ER_BAD_DB_ERROR', 'falta la base']
]

describe('clasificarFallo con fallos de conexión', () => {
  for (const [codigo, situacion] of CONEXION) {
    test(`${codigo} (${situacion}) es SIN_CONEXION`, () => {
      assert.equal(clasificarFallo({ code: codigo }), 'SIN_CONEXION')
    })
  }
})

describe('clasificarFallo con el esquema sin aplicar', () => {
  for (const [codigo, situacion] of ESQUEMA) {
    test(`${codigo} (${situacion}) es ESQUEMA_NO_APLICADO`, () => {
      assert.equal(clasificarFallo({ code: codigo }), 'ESQUEMA_NO_APLICADO')
    })
  }

  test('un esquema sin aplicar NO se confunde con una conexión caída', () => {
    // Son fallos distintos con remedios distintos: uno se arregla levantando el
    // servidor, el otro ejecutando el script del esquema. Si los dos dieran el
    // mismo motivo, el usuario recibiría un consejo que no le sirve.
    assert.notEqual(
      clasificarFallo({ code: 'ER_NO_SUCH_TABLE' }),
      clasificarFallo({ code: 'ECONNREFUSED' })
    )
  })
})

describe('clasificarFallo con el folio repetido', () => {
  test('ER_DUP_ENTRY es FOLIO_REPETIDO', () => {
    assert.equal(clasificarFallo({ code: 'ER_DUP_ENTRY' }), 'FOLIO_REPETIDO')
  })

  test('⚠️ el folio repetido tiene su propio motivo y no es "no encontrado"', () => {
    // "No encontrado" es lo que se le dice a un usuario cuando se busca algo y
    // no está. Un folio repetido es un conflicto de escritura interna, que §4.2
    // del plan reintenta antes de responder. Si compartieran motivo, o el
    // usuario vería "no encontré lo que buscabas" al guardar, o la reentrega se
    // tragaría un error de verdad.
    const motivo = clasificarFallo({ code: 'ER_DUP_ENTRY' })
    assert.equal(motivo, 'FOLIO_REPETIDO')
    assert.ok(
      !/NO_ENCONTRADO|NO_ENCONTRADO/i.test(motivo),
      `el motivo del folio repetido no debe parecer un "no encontrado": ${motivo}`
    )
  })
})

describe('clasificarFallo con lo que no sabe', () => {
  test('un código desconocido es OTRO', () => {
    assert.equal(clasificarFallo({ code: 'ER_ALGO_QUE_NO_CONOCEMOS' }), 'OTRO')
  })

  test('un error sin código es OTRO', () => {
    assert.equal(clasificarFallo({ message: 'algo salió mal' }), 'OTRO')
  })

  test('un error con código en minúsculas no se inventa un motivo', () => {
    // Los códigos del motor vienen en mayúsculas. Si alguien los pasa en
    // minúsculas, lo honesto es no saber, no adivinar.
    assert.equal(clasificarFallo({ code: 'er_no_such_table' }), 'OTRO')
  })

  test('no lanza con un error nulo, indefinido, o sin forma de objeto', () => {
    // Esta función se llama dentro del `catch` del servidor. Si también falla
    // aquí, el usuario vería un error de error en vez de su mensaje.
    for (const entrada of [null, undefined, 0, '', 'texto', []]) {
      assert.equal(clasificarFallo(entrada), 'OTRO', `falló con ${JSON.stringify(entrada)}`)
    }
  })

  test('no escribe nada en la consola, ni siquiera con una entrada rara', () => {
    const original = console.error
    const originalSalida = process.stdout.write
    let hablo = false
    console.error = () => {
      hablo = true
    }
    process.stdout.write = () => {
      hablo = true
      return true
    }
    try {
      clasificarFallo(null)
      assert.equal(hablo, false, 'el módulo escribió en la consola')
    } finally {
      console.error = original
      process.stdout.write = originalSalida
    }
  })
})

describe('mensajeDeFallo', () => {
  const MOTIVOS = ['SIN_CONEXION', 'ESQUEMA_NO_APLICADO', 'FOLIO_REPETIDO', 'OTRO']

  for (const motivo of MOTIVOS) {
    test(`${motivo} tiene un mensaje`, () => {
      const mensaje = mensajeDeFallo(motivo)
      assert.equal(typeof mensaje, 'string')
      assert.ok(mensaje.length > 0, 'el mensaje no puede estar vacío')
      assert.match(mensaje, /[a-záéíóúñ]/i, 'tiene que ser texto, no signos')
    })
  }

  test('cada motivo tiene un mensaje DISTINTO del de los otros', () => {
    const mensajes = MOTIVOS.map((motivo) => mensajeDeFallo(motivo))
    assert.equal(new Set(mensajes).size, MOTIVOS.length, 'hay dos motivos con el mismo texto')
  })

  test('⚠️ el de conexión caída dice cómo se arregla', () => {
    // RNF-1: los mensajes dicen qué pasó Y qué hacer. "No se pudo conectar" sin
    // más deja al usuario sin camino.
    assert.match(mensajeDeFallo('SIN_CONEXION'), /conect/i)
  })

  test('⚠️ el del esquema dice que hay que ejecutar el script', () => {
    assert.match(mensajeDeFallo('ESQUEMA_NO_APLICADO'), /esquema/i)
  })

  test('⚠️ el del folio NO le echa la culpa al usuario', () => {
    // El folio lo pone el sistema. Decirle a alguien que "ya existe" lo manda a
    // buscar un documento que él no creó.
    const mensaje = mensajeDeFallo('FOLIO_REPETIDO')
    assert.ok(
      !/ya existe|duplicad/i.test(mensaje),
      `el mensaje le echa la culpa al usuario: ${mensaje}`
    )
  })

  test('un motivo desconocido devuelve texto, no undefined', () => {
    const mensaje = mensajeDeFallo('MOTIVO_QUE_NO_EXISTE')
    assert.equal(typeof mensaje, 'string')
    assert.ok(mensaje.length > 0)
  })

  test('sin motivo devuelve texto, no undefined', () => {
    assert.equal(typeof mensajeDeFallo(), 'string')
    assert.equal(typeof mensajeDeFallo(null), 'string')
  })

  test('ningún mensaje incluye undefined ni null en su texto', () => {
    for (const motivo of MOTIVOS) {
      const mensaje = mensajeDeFallo(motivo)
      assert.ok(!/undefined|null/.test(mensaje), `el mensaje de ${motivo} dice "${mensaje}"`)
    }
  })

  test('⚠️ ningún mensaje filtra el código interno de MySQL', () => {
    // El código técnico va al registro del servidor, no a la pantalla: se puede
    // ver en otra red y no le dice nada a quien recepciona.
    for (const motivo of MOTIVOS) {
      assert.ok(
        !/ER_[A-Z_]+|ECONN|\b10\d{2}\b/.test(mensajeDeFallo(motivo)),
        `el mensaje de ${motivo} filtra un código técnico`
      )
    }
  })
})

describe('hayAcceso con la tabla de permisos', () => {
  // Las reglas exactas de RF-3.1, RF-3.2 y RF-3.5:
  //   registrar_recepcion -> Recepcionista y Administrador
  //   ver_directorio     -> Contador y Administrador

  test('registrar una recepción: la puede el Recepcionista y el Administrador', () => {
    assert.equal(hayAcceso('Recepcionista', 'registrar_recepcion'), true)
    assert.equal(hayAcceso('Administrador', 'registrar_recepcion'), true)
  })

  test('registrar una recepción: no la puede el Contador ni el Cliente', () => {
    assert.equal(hayAcceso('Contador', 'registrar_recepcion'), false)
    assert.equal(hayAcceso('Cliente', 'registrar_recepcion'), false)
  })

  test('ver el directorio: lo puede el Contador y el Administrador', () => {
    assert.equal(hayAcceso('Contador', 'ver_directorio'), true)
    assert.equal(hayAcceso('Administrador', 'ver_directorio'), true)
  })

  test('ver el directorio: no lo puede el Recepcionista ni el Cliente', () => {
    assert.equal(hayAcceso('Recepcionista', 'ver_directorio'), false)
    assert.equal(hayAcceso('Cliente', 'ver_directorio'), false)
  })

  test('cambiar el estado de un documento: lo puede el Contador y el Administrador', () => {
    assert.equal(hayAcceso('Contador', 'cambiar_estado'), true)
    assert.equal(hayAcceso('Administrador', 'cambiar_estado'), true)
  })

  test('cambiar el estado de un documento: no lo puede el Recepcionista ni el Cliente', () => {
    assert.equal(hayAcceso('Recepcionista', 'cambiar_estado'), false)
    assert.equal(hayAcceso('Cliente', 'cambiar_estado'), false)
  })

  test('ver el directorio de usuarios: solo el Administrador', () => {
    assert.equal(hayAcceso('Administrador', 'ver_usuarios'), true)
    for (const rol of ['Contador', 'Recepcionista', 'Cliente']) {
      assert.equal(hayAcceso(rol, 'ver_usuarios'), false, rol)
    }
  })

  test('activar o desactivar usuarios: solo el Administrador', () => {
    assert.equal(hayAcceso('Administrador', 'administrar_usuarios'), true)
    for (const rol of ['Contador', 'Recepcionista', 'Cliente']) {
      assert.equal(hayAcceso(rol, 'administrar_usuarios'), false, rol)
    }
  })

  test('un rol desconocido no tiene acceso a nada', () => {
    assert.equal(hayAcceso('Director', 'registrar_recepcion'), false)
    assert.equal(hayAcceso('Director', 'ver_directorio'), false)
  })

  test('⚠️ un rol en minúsculas NO tiene acceso', () => {
    // roles.nombre es texto libre con restricción de único, así que pueden
    // existir "Recepcionista" y "recepcionista". Comparar exacto falla hacia el
    // lado seguro: se le pide al administrador que lo arregle, en vez de
    // devolverle un permiso que no pidió.
    assert.equal(hayAcceso('recepcionista', 'registrar_recepcion'), false)
    assert.equal(hayAcceso('administrador', 'ver_directorio'), false)
  })

  test('un rol con espacios sobrantes tampoco', () => {
    assert.equal(hayAcceso(' Recepcionista', 'registrar_recepcion'), false)
    assert.equal(hayAcceso('Recepcionista ', 'registrar_recepcion'), false)
  })

  test('un rol vacío, nulo o indefinido no tiene acceso a nada', () => {
    for (const rol of ['', '   ', null, undefined]) {
      assert.equal(hayAcceso(rol, 'registrar_recepcion'), false, `falló con "${rol}"`)
      assert.equal(hayAcceso(rol, 'ver_directorio'), false, `falló con "${rol}"`)
    }
  })

  test('una acción desconocida no está permitida para nadie', () => {
    for (const rol of ['Administrador', 'Recepcionista', 'Contador', 'Cliente']) {
      assert.equal(hayAcceso(rol, 'borrar_todo'), false, `el ${rol} pudo borrar_todo`)
    }
  })

  test('sin acción no hay acceso', () => {
    assert.equal(hayAcceso('Administrador'), false)
    assert.equal(hayAcceso('Administrador', ''), false)
    assert.equal(hayAcceso('Administrador', null), false)
  })

  test('⚠️ el Administrador puede las dos, y no es por ser el primero de la lista', () => {
    // La tentación es devolver true al primer caso que coincida. Se comprueba
    // que las dos acciones del Administrador pasan y las de los demás no.
    const acciones = ['registrar_recepcion', 'ver_directorio']
    for (const accion of acciones) {
      assert.equal(hayAcceso('Administrador', accion), true)
    }
    assert.equal(hayAcceso('Recepcionista', acciones[1]), false)
    assert.equal(hayAcceso('Contador', acciones[0]), false)
  })

  test('la tabla no se puede ampliar desde fuera', () => {
    // `PERMISOS` es una constante del módulo. Si fuera un objeto que llega como
    // argumento, cualquiera podría pasarle un rol con todos los permisos.
    assert.equal(hayAcceso('Superusuario', 'registrar_recepcion'), false)
    assert.equal(hayAcceso('Superusuario', 'ver_directorio'), false)
  })
})

describe('permisos de los roles Practicante y Sistemas (2026-11-04)', () => {
  const ACCIONES = [
    'registrar_recepcion',
    'ver_directorio',
    'cambiar_estado',
    'ver_usuarios',
    'administrar_usuarios',
    'ver_seguimiento',
  ]

  test('Sistemas puede lo mismo que Administrador', () => {
    for (const accion of ACCIONES) {
      assert.equal(hayAcceso('Sistemas', accion), hayAcceso('Administrador', accion), accion)
      assert.equal(hayAcceso('Sistemas', accion), true, accion)
    }
  })

  test('Practicante solo consulta: Dashboard/Clientes y Seguimiento', () => {
    assert.equal(hayAcceso('Practicante', 'ver_directorio'), true)
    assert.equal(hayAcceso('Practicante', 'ver_seguimiento'), true)
  })

  test('Practicante no cambia estados, no recepciona y no gestiona usuarios', () => {
    for (const accion of ['cambiar_estado', 'registrar_recepcion', 'ver_usuarios', 'administrar_usuarios']) {
      assert.equal(hayAcceso('Practicante', accion), false, accion)
    }
  })
})
