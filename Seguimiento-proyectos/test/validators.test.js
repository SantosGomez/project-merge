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

// --- validarAltaUsuario (historia 9a, con nombre y correo) ----------------

const ALTA = { nombre: 'Ana Karen Ramírez', correo: 'kramirez@delgrow.mx', password: '12345678', rol: 'contador' }
const validarAlta = (cambios = {}) => {
  const datos = { ...ALTA, ...cambios }
  return validarAltaUsuario(datos.nombre, datos.correo, datos.password, datos.rol)
}

test('validarAltaUsuario acepta nombre, correo, contraseña de 8 y un rol válido', () => {
  const resultado = validarAlta()
  assert.equal(resultado.valido, true)
  assert.deepEqual(resultado.errores, { nombre: null, correo: null, password: null, rol: null })
})

test('validarAltaUsuario exige nombre y correo, sin contar espacios', () => {
  assert.equal(validarAlta({ nombre: '   ' }).errores.nombre, 'nombre_requerido')
  assert.equal(validarAlta({ correo: '' }).errores.correo, 'correo_requerido')
  assert.equal(validarAlta({ correo: '   ' }).valido, false)
})

test('validarAltaUsuario pide un correo con forma de correo', () => {
  for (const correo of ['kramirez', 'kramirez@delgrow', 'k ramirez@delgrow.mx', '@delgrow.mx']) {
    assert.equal(validarAlta({ correo }).errores.correo, 'correo_invalido', `«${correo}» no es un correo`)
  }
  assert.equal(validarAlta({ correo: '  KRamirez@DelGrow.MX  ' }).errores.correo, null, 'mayúsculas y espacios no importan')
})

test('validarAltaUsuario admite hasta 150 caracteres en nombre y correo', () => {
  const correoDe = (largo) => 'a'.repeat(largo - '@delgrow.mx'.length) + '@delgrow.mx'
  assert.equal(validarAlta({ nombre: 'N'.repeat(150) }).errores.nombre, null)
  assert.equal(validarAlta({ nombre: 'N'.repeat(151) }).errores.nombre, 'nombre_demasiado_largo')
  assert.equal(validarAlta({ correo: correoDe(150) }).errores.correo, null)
  assert.equal(validarAlta({ correo: correoDe(151) }).errores.correo, 'correo_demasiado_largo')
})

test('validarAltaUsuario exige una contraseña de al menos 8 caracteres sin contar espacios', () => {
  assert.equal(validarAlta({ password: '' }).errores.password, 'password_requerida')
  assert.equal(validarAlta({ password: '1234567' }).errores.password, 'password_corta')
  // El login recorta la contraseña: los espacios extremos no cuentan para el mínimo.
  assert.equal(validarAlta({ password: ' 1234567 ' }).errores.password, 'password_corta')
})

test('validarAltaUsuario exige elegir uno de los tres roles', () => {
  for (const rol of ['administrador', 'contador', 'usuarios_de_sistema']) {
    assert.equal(validarAlta({ rol }).errores.rol, null, `«${rol}» es un rol válido`)
  }
  for (const rol of [null, undefined, '', 'Administrador', 'invitado']) {
    assert.equal(validarAlta({ rol }).errores.rol, 'rol_requerido', `«${rol}» no es un rol válido`)
  }
})
