import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { exampleAccounts } from '../src/services/exampleData.js'
import {
  PANTALLA_PRINCIPAL_POR_ROL,
  decidirAcceso,
  normalizeCredential,
  resolveProfile,
  validateLoginForm,
} from '../src/utils/accessRules.js'
import { PROFILES, RUTA_PRINCIPAL_POR_ROL } from '../src/utils/constants.js'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

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

// --- Decisión del guard de navegación (T5: RF-05, RF-06, RF-10) -------------

const RUTA_LOGIN = { requiereSesion: false, perfil: null }
const RUTA_ADMIN_DASHBOARD = { requiereSesion: true, perfil: 'administrador' }
// El directorio lo comparten administrador y usuario de sistema (directorio, rebanada 2).
const RUTA_ADMIN_DIRECTORIO = {
  requiereSesion: true,
  perfil: ['administrador', 'usuarios_de_sistema'],
}
const RUTA_CONTADOR_REGISTRO = { requiereSesion: true, perfil: 'contador' }
const RUTA_CONTADOR_CASOS = { requiereSesion: true, perfil: 'contador' }

test('decidirAcceso exige iniciar sesión en una pantalla interna sin sesión (RF-05)', () => {
  const sesion = { autenticado: false, rol: null }

  for (const ruta of [
    RUTA_ADMIN_DASHBOARD,
    RUTA_ADMIN_DIRECTORIO,
    RUTA_CONTADOR_REGISTRO,
    RUTA_CONTADOR_CASOS,
  ]) {
    assert.deepEqual(decidirAcceso({ ruta, sesion }), { accion: 'ir_login', aviso: 'sesion' })
  }
})

test('decidirAcceso permite P-1 con sesión activa sin cerrarla (RF-10)', () => {
  for (const rol of ['administrador', 'contador', 'usuarios_de_sistema']) {
    assert.deepEqual(decidirAcceso({ ruta: RUTA_LOGIN, sesion: { autenticado: true, rol } }), {
      accion: 'permitir',
    })
  }

  assert.deepEqual(
    decidirAcceso({ ruta: RUTA_LOGIN, sesion: { autenticado: false, rol: null } }),
    { accion: 'permitir' },
  )
})

test('decidirAcceso deja entrar al perfil correcto en sus cuatro pantallas (RF-06)', () => {
  const admin = { autenticado: true, rol: 'administrador' }
  const contador = { autenticado: true, rol: 'contador' }

  assert.deepEqual(decidirAcceso({ ruta: RUTA_ADMIN_DASHBOARD, sesion: admin }), {
    accion: 'permitir',
  })
  assert.deepEqual(decidirAcceso({ ruta: RUTA_ADMIN_DIRECTORIO, sesion: admin }), {
    accion: 'permitir',
  })
  assert.deepEqual(decidirAcceso({ ruta: RUTA_CONTADOR_REGISTRO, sesion: contador }), {
    accion: 'permitir',
  })
  assert.deepEqual(decidirAcceso({ ruta: RUTA_CONTADOR_CASOS, sesion: contador }), {
    accion: 'permitir',
  })
})

test('decidirAcceso deniega al contador las pantallas de administrador (RF-06)', () => {
  const sesion = { autenticado: true, rol: 'contador' }

  for (const ruta of [RUTA_ADMIN_DASHBOARD, RUTA_ADMIN_DIRECTORIO]) {
    assert.deepEqual(decidirAcceso({ ruta, sesion }), {
      accion: 'denegar',
      motivo: 'perfil',
      destino: 'contador-casos',
    })
  }
})

test('decidirAcceso deniega al administrador las pantallas de contador (RF-06)', () => {
  const sesion = { autenticado: true, rol: 'administrador' }

  for (const ruta of [RUTA_CONTADOR_REGISTRO, RUTA_CONTADOR_CASOS]) {
    assert.deepEqual(decidirAcceso({ ruta, sesion }), {
      accion: 'denegar',
      motivo: 'perfil',
      destino: 'admin-dashboard',
    })
  }
})

test('la pantalla principal del usuario de sistema es Ajustes (rebanada 52b)', () => {
  assert.equal(PANTALLA_PRINCIPAL_POR_ROL.usuarios_de_sistema, 'ajustes')
})

test('cada nombre de ruta principal existe en el router', () => {
  const router = read('../src/router/index.js')

  for (const [rol, nombre] of Object.entries(PANTALLA_PRINCIPAL_POR_ROL)) {
    assert.match(router, new RegExp(`name: '${nombre}'`), `la ruta ${nombre} de ${rol} no existe`)
  }
})

test('la tabla de rutas principales tiene una entrada por perfil con pantalla', () => {
  assert.deepEqual(Object.keys(PANTALLA_PRINCIPAL_POR_ROL).sort(), Object.values(PROFILES).sort())

  for (const [rol, ruta] of Object.entries(RUTA_PRINCIPAL_POR_ROL)) {
    const nombre = ruta.split('/').filter(Boolean).join('-')
    assert.equal(PANTALLA_PRINCIPAL_POR_ROL[rol], nombre, `el nombre de ${rol} no deriva de su ruta`)
  }
})

test('el store de sesión usa la misma tabla de rutas principales', () => {
  const store = read('../src/stores/session.js')
  assert.match(store, /export const PANTALLA_PRINCIPAL = RUTA_PRINCIPAL_POR_ROL/)
})

test('decidirAcceso deja entrar al usuario de sistema al directorio de usuarios (directorio, rebanada 2)', () => {
  const sistema = { autenticado: true, rol: 'usuarios_de_sistema' }
  assert.deepEqual(decidirAcceso({ ruta: RUTA_ADMIN_DIRECTORIO, sesion: sistema }), {
    accion: 'permitir',
  })
})

test('decidirAcceso deniega al usuario de sistema el dashboard y las pantallas de contador', () => {
  const sistema = { autenticado: true, rol: 'usuarios_de_sistema' }

  for (const ruta of [RUTA_ADMIN_DASHBOARD, RUTA_CONTADOR_REGISTRO, RUTA_CONTADOR_CASOS]) {
    assert.deepEqual(decidirAcceso({ ruta, sesion: sistema }), {
      accion: 'denegar',
      motivo: 'perfil',
      destino: 'ajustes',
    })
  }
})

test('decidirAcceso deniega un perfil sin pantalla asignada y ofrece volver a P-1', () => {
  const sesion = { autenticado: true, rol: 'invitado' }

  for (const ruta of [
    RUTA_ADMIN_DASHBOARD,
    RUTA_ADMIN_DIRECTORIO,
    RUTA_CONTADOR_REGISTRO,
    RUTA_CONTADOR_CASOS,
  ]) {
    assert.deepEqual(decidirAcceso({ ruta, sesion }), {
      accion: 'denegar',
      motivo: 'sin_pantalla',
      destino: null,
    })
  }
})
