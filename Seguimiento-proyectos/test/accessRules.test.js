import test from 'node:test'
import assert from 'node:assert/strict'

import { exampleAccounts } from '../src/services/exampleData.js'
import { normalizeCredential, resolveProfile, validateLoginForm } from '../src/utils/accessRules.js'

// Cuentas de apoyo para comprobar la regla defensiva de RF-4 sin tocar la semilla.
const accountsWithUnknownProfile = [
  { username: 'auditor', password: 'auditor123', profile: 'auditor' },
]

test('normalizeCredential quita los espacios al inicio y al final', () => {
  assert.equal(normalizeCredential('  admin  '), 'admin')
  assert.equal(normalizeCredential('\t contador123 \n'), 'contador123')
  assert.equal(
    normalizeCredential('  clave con espacios interiores  '),
    'clave con espacios interiores',
    'los espacios interiores se conservan (Definiciones: Credenciales)',
  )
})

test('normalizeCredential devuelve cadena vacía cuando el valor no es texto o está vacío', () => {
  for (const value of ['', '   ', '\t\n', null, undefined, 123]) {
    assert.equal(
      normalizeCredential(value),
      '',
      `el valor ${JSON.stringify(value)} cuenta como vacío`,
    )
  }
})

test('validateLoginForm no señala campos cuando ambos están completos', () => {
  assert.deepEqual(validateLoginForm('admin', 'admin123'), { valid: true, missing: [] })
  assert.deepEqual(
    validateLoginForm('  admin  ', '  admin123  '),
    { valid: true, missing: [] },
    'los espacios extremos se ignoran (Definiciones: Credenciales)',
  )
})

test('validateLoginForm señala cada campo faltante por separado', () => {
  assert.deepEqual(validateLoginForm('', ''), {
    valid: false,
    missing: ['username', 'password'],
  })
  assert.deepEqual(validateLoginForm('admin', ''), { valid: false, missing: ['password'] })
  assert.deepEqual(validateLoginForm('', 'admin123'), { valid: false, missing: ['username'] })
})

test('validateLoginForm trata un valor con solo espacios como campo faltante', () => {
  assert.deepEqual(validateLoginForm('   ', 'admin123'), {
    valid: false,
    missing: ['username'],
  })
  assert.deepEqual(validateLoginForm('admin', ' \t\n '), {
    valid: false,
    missing: ['password'],
  })
  assert.deepEqual(validateLoginForm('  ', '  '), {
    valid: false,
    missing: ['username', 'password'],
  })
})

test('validateLoginForm devuelve un objeto nuevo en cada llamada', () => {
  const first = validateLoginForm('', '')
  const second = validateLoginForm('', '')

  assert.notEqual(first, second)
  assert.notEqual(first.missing, second.missing)
})

test('resolveProfile resuelve el perfil de cada cuenta de ejemplo', () => {
  assert.equal(resolveProfile('admin', 'admin123', exampleAccounts), 'administrador')
  assert.equal(resolveProfile('contador', 'contador123', exampleAccounts), 'contador')
})

test('resolveProfile ignora los espacios al inicio y al final de las credenciales', () => {
  assert.equal(resolveProfile('  admin ', ' admin123  ', exampleAccounts), 'administrador')
  assert.equal(resolveProfile('\tcontador\n', 'contador123 ', exampleAccounts), 'contador')
})

test('resolveProfile distingue mayúsculas y minúsculas', () => {
  const invalidCombinations = [
    ['Admin', 'admin123'],
    ['admin', 'Admin123'],
    ['ADMIN', 'ADMIN123'],
    ['Contador', 'contador123'],
    ['contador', 'Contador123'],
    ['CONTADOR', 'CONTADOR123'],
  ]

  for (const [username, password] of invalidCombinations) {
    assert.equal(
      resolveProfile(username, password, exampleAccounts),
      null,
      `${username}/${password} no debe ser válido (RF-4)`,
    )
  }
})

test('resolveProfile devuelve null con credenciales que no corresponden a ninguna cuenta', () => {
  const invalids = [
    ['admin', 'otra123'],
    ['otra', 'admin123'],
    ['admin', ''],
    ['', 'admin123'],
    ['', ''],
    ['  ', '  '],
    ['admin123', 'admin'],
    ['contador', 'admin123'],
  ]

  for (const [username, password] of invalids) {
    assert.equal(
      resolveProfile(username, password, exampleAccounts),
      null,
      `${JSON.stringify(username)}/${JSON.stringify(password)} no debe dar perfil (RF-4)`,
    )
  }
})

test('resolveProfile trata como inválido cualquier perfil distinto de administrador o contador', () => {
  assert.equal(resolveProfile('auditor', 'auditor123', accountsWithUnknownProfile), null)
})

test('resolveProfile devuelve null si la lista de cuentas no es utilizable', () => {
  for (const accounts of [undefined, null, []]) {
    assert.equal(resolveProfile('admin', 'admin123', accounts), null)
  }
})

test('resolveProfile no modifica la lista de cuentas', () => {
  const before = JSON.parse(JSON.stringify(exampleAccounts))

  resolveProfile('  admin  ', '  admin123  ', exampleAccounts)
  resolveProfile('Admin', 'admin123', exampleAccounts)

  assert.deepEqual(exampleAccounts, before)
})
