// Pruebas de las validaciones puras del frontend (RF-03, RF-21, RF-22, RF-23).
// Las tres funciones son síncronas, no tocan el navegador y no mutan sus argumentos.

import test from 'node:test'
import assert from 'node:assert/strict'

import { MAX_CLIENT_LENGTH } from '../src/utils/constants.js'
import {
  validarAltaUsuario,
  validarCliente,
  validarCredenciales,
  validarPrioridad,
} from '../src/utils/validators.js'

// --- validarCredenciales ---------------------------------------------------

test('validarCredenciales acepta usuario y contraseña completos e ignora los espacios extremos', () => {
  assert.deepEqual(validarCredenciales('admin', 'admin123'), { valido: true, faltantes: [] })
  assert.deepEqual(
    validarCredenciales('  admin  ', '\t admin123 \n'),
    { valido: true, faltantes: [] },
    'los espacios al inicio y al final no cuentan (Definiciones: Credenciales)',
  )
})

test('validarCredenciales señala los dos campos cuando ambos faltan', () => {
  assert.deepEqual(validarCredenciales('', ''), {
    valido: false,
    faltantes: ['username', 'password'],
  })
})

test('validarCredenciales señala solo el campo que falta', () => {
  assert.deepEqual(
    validarCredenciales('admin', ''),
    { valido: false, faltantes: ['password'] },
    'falta únicamente la contraseña (RF-03)',
  )
  assert.deepEqual(
    validarCredenciales('   ', 'admin123'),
    { valido: false, faltantes: ['username'] },
    'falta únicamente el usuario (RF-03)',
  )
})

test('validarCredenciales trata un valor con solo espacios como campo faltante', () => {
  assert.deepEqual(validarCredenciales(' \t ', '\n  '), {
    valido: false,
    faltantes: ['username', 'password'],
  })
})

test('validarCredenciales trata un valor que no es texto como campo faltante', () => {
  assert.deepEqual(validarCredenciales(null, undefined), {
    valido: false,
    faltantes: ['username', 'password'],
  })
})

test('validarCredenciales no compara mayúsculas y minúsculas: solo comprueba que haya datos', () => {
  assert.deepEqual(
    validarCredenciales('ADMIN', 'Admin123'),
    { valido: true, faltantes: [] },
    'la comparación que distingue mayúsculas la hace el backend, no esta validación (RF-04)',
  )
  assert.deepEqual(
    validarCredenciales('admin', 'ADMIN123'),
    { valido: true, faltantes: [] },
    'una contraseña con otras mayúsculas sigue siendo un dato presente (RF-04)',
  )
})

// --- validarCliente -------------------------------------------------------

test('validarCliente acepta un cliente válido e ignora los espacios al inicio y al final', () => {
  assert.deepEqual(validarCliente('Panadería La Espiga'), { valido: true, error: null })
  assert.deepEqual(
    validarCliente('   Distribuidora Ñandú  '),
    { valido: true, error: null },
    'los espacios extremos se ignoran (Definiciones: Cliente)',
  )
})

test('validarCliente exige el cliente cuando llega vacío, nulo o solo con espacios', () => {
  for (const cliente of ['', '   ', '\t \n', null, undefined]) {
    assert.deepEqual(
      validarCliente(cliente),
      { valido: false, error: 'cliente_requerido' },
      `el cliente ${JSON.stringify(cliente)} debe rechazarse por obligatorio (RF-21)`,
    )
  }
})

test('validarCliente acepta 80 caracteres y rechaza 81, con acentos y espacios interiores', () => {
  const conAcentos = `${'á'.repeat(40)}${'ñ'.repeat(40)}`
  const conEspacioInterior = `${'a'.repeat(39)} ${'b'.repeat(40)}`
  const deMas = 'a'.repeat(MAX_CLIENT_LENGTH + 1)

  assert.equal(conAcentos.length, MAX_CLIENT_LENGTH, 'el caso de 80 caracteres está bien armado')
  assert.equal(
    conEspacioInterior.length,
    MAX_CLIENT_LENGTH,
    'el espacio interior cuenta para la longitud',
  )

  assert.deepEqual(
    validarCliente(conAcentos),
    { valido: true, error: null },
    '80 caracteres se aceptan (Definiciones: Cliente)',
  )
  assert.deepEqual(
    validarCliente(conEspacioInterior),
    { valido: true, error: null },
    'los espacios interiores cuentan y 80 caracteres siguen siendo válidos (RF-23)',
  )
  assert.deepEqual(
    validarCliente(deMas),
    { valido: false, error: 'cliente_demasiado_largo' },
    '81 caracteres no se aceptan (RF-23)',
  )
})

test('validarCliente no cuenta los espacios extremos para el límite de 80 caracteres', () => {
  const justos = `   ${'a'.repeat(MAX_CLIENT_LENGTH)}   `
  const deMas = `  ${'a'.repeat(MAX_CLIENT_LENGTH + 1)} `

  assert.deepEqual(
    validarCliente(justos),
    { valido: true, error: null },
    'los espacios extremos no cuentan para el límite (Definiciones: Cliente)',
  )
  assert.deepEqual(
    validarCliente(deMas),
    { valido: false, error: 'cliente_demasiado_largo' },
    'el límite se mide sobre el texto sin espacios extremos (RF-23)',
  )
})

// --- validarPrioridad -----------------------------------------------------

test('validarPrioridad acepta las tres prioridades permitidas', () => {
  for (const prioridad of ['Alta', 'Media', 'Baja']) {
    assert.deepEqual(
      validarPrioridad(prioridad),
      { valido: true, error: null },
      `la prioridad ${prioridad} es válida (Definiciones: Prioridad)`,
    )
  }
})

test('validarPrioridad exige la prioridad cuando llega vacía, nula o solo con espacios', () => {
  for (const prioridad of ['', '   ', null, undefined]) {
    assert.deepEqual(
      validarPrioridad(prioridad),
      { valido: false, error: 'prioridad_requerida' },
      `la prioridad ${JSON.stringify(prioridad)} debe rechazarse por obligatoria (RF-22)`,
    )
  }
})

test('validarPrioridad rechaza valores fuera de la lista y las minúsculas', () => {
  for (const prioridad of ['Urgente', 'Altaa', 'alta', 'media', 'baja', 'ALTA']) {
    assert.deepEqual(
      validarPrioridad(prioridad),
      { valido: false, error: 'prioridad_invalida' },
      `la prioridad ${JSON.stringify(prioridad)} no es una de Alta, Media o Baja (RF-22)`,
    )
  }
})

// --- validarAltaUsuario (historia 9a) -------------------------------------

test('validarAltaUsuario exige usuario y contraseña', () => {
  const sinUsuario = validarAltaUsuario('', 'clave1234', 'contador')
  assert.equal(sinUsuario.valido, false)
  assert.equal(sinUsuario.errores.usuario, 'usuario_requerido')
  assert.equal(sinUsuario.errores.password, null)

  const sinPassword = validarAltaUsuario('nuevo', '', 'contador')
  assert.equal(sinPassword.valido, false)
  assert.equal(sinPassword.errores.usuario, null)
  assert.equal(sinPassword.errores.password, 'password_requerida')

  const soloEspacios = validarAltaUsuario('   ', '   ', 'contador')
  assert.equal(soloEspacios.valido, false)
  assert.equal(soloEspacios.errores.usuario, 'usuario_requerido')
  assert.equal(soloEspacios.errores.password, 'password_requerida')
})

test('validarAltaUsuario exige una contraseña de al menos 8 caracteres', () => {
  const corta = validarAltaUsuario('nuevo', '1234567', 'contador')
  assert.equal(corta.valido, false)
  assert.equal(corta.errores.password, 'password_corta')

  const justa = validarAltaUsuario('nuevo', '12345678', 'contador')
  assert.equal(justa.errores.password, null)
  assert.equal(justa.valido, true, 'con 8 caracteres la contraseña es válida')

  // El login recorta la contraseña: los espacios extremos no cuentan para el mínimo.
  const conEspacio = validarAltaUsuario('nuevo', ' 1234567 ', 'contador')
  assert.equal(conEspacio.errores.password, 'password_corta', 'quedan 7 caracteres al recortar')
})

test('validarAltaUsuario admite hasta 100 caracteres de usuario', () => {
  const justo = validarAltaUsuario(`${'a'.repeat(100)}`, '12345678', 'contador')
  assert.equal(justo.errores.usuario, null)
  assert.equal(justo.valido, true, '100 caracteres se aceptan')

  const deMas = validarAltaUsuario('a'.repeat(101), '12345678', 'contador')
  assert.equal(deMas.errores.usuario, 'usuario_demasiado_largo')
  assert.equal(deMas.valido, false, '101 caracteres no se aceptan')

  const conEspacios = validarAltaUsuario(`   ${'a'.repeat(100)}   `, '12345678', 'contador')
  assert.equal(conEspacios.errores.usuario, null, 'los espacios extremos no cuentan')
})

test('validarAltaUsuario exige elegir uno de los tres roles', () => {
  for (const rol of ['administrador', 'contador', 'usuarios_de_sistema']) {
    const conRol = validarAltaUsuario('nuevo', '12345678', rol)
    assert.equal(conRol.errores.rol, null, `«${rol}» es un rol válido`)
    assert.equal(conRol.valido, true)
  }

  for (const rol of [null, undefined, '', 'Administrador', 'invitado']) {
    const sinRol = validarAltaUsuario('nuevo', '12345678', rol)
    assert.equal(sinRol.errores.rol, 'rol_requerido', `«${rol}» no es un rol válido`)
    assert.equal(sinRol.valido, false)
  }
})

