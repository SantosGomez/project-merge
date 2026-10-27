// Pruebas del servicio de autenticación (RF-01 a RF-10, RF-42, RF-43, RF-45 a RF-47).
// Sin red y sin navegador: se inyectan un almacén falso y una api falsa.

import test from 'node:test'
import assert from 'node:assert/strict'

import { CLAVES_SESION } from '../src/services/api.js'
import { crearAuthService, isTokenExpirado } from '../src/services/authService.js'

// --- ayudas ----------------------------------------------------------------

// Almacén falso en memoria: sustituye a sessionStorage.
const crearAlmacenFalso = (inicial = {}) => {
  const datos = new Map(Object.entries(inicial))
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => {
      datos.set(clave, String(valor))
    },
    removeItem: (clave) => {
      datos.delete(clave)
    },
  }
}

// Api falsa: registra las llamadas y responde o falla según lo indicado.
const crearApiFalsa = ({ datos, error } = {}) => {
  const llamadas = []
  return {
    llamadas,
    async post(url, cuerpo) {
      llamadas.push({ url, cuerpo })
      if (error) {
        throw error
      }
      return { data: datos }
    },
    async patch(url, cuerpo) {
      llamadas.push({ metodo: 'PATCH', url, cuerpo })
      if (error) {
        throw error
      }
      return { data: datos }
    },
  }
}

// Token con forma de JWT (cabecera.carga.firma) con la carga indicada.
const tokenCon = (carga) => {
  const cabecera = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString('base64url')
  return `${cabecera}.${cuerpo}.firma-falsa`
}

const AHORA = new Date('2026-10-22T10:00:00.000Z')
const AHORA_EN_SEGUNDOS = Math.floor(AHORA.getTime() / 1000)

const DATOS_SESION = {
  token: 'token-falso',
  rol: 'administrador',
  id: 5,
  nombre: 'Admin Seed',
}

// --- login (RF-01 a RF-04, RF-08, RF-42) -----------------------------------

test('login entra con el correo y guarda también el nombre de la cuenta', async () => {
  const datos = { ...DATOS_SESION, nombre: 'CPC. Admin Seed', correo: 'admin_seed@prueba.local' }
  const api = crearApiFalsa({ datos })
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api, almacen })

  const sesion = await servicio.login('admin_seed@prueba.local', 'clave-falsa')

  assert.deepEqual(api.llamadas, [
    { url: '/auth/login', cuerpo: { correo: 'admin_seed@prueba.local', password: 'clave-falsa' } },
  ])
  assert.equal(sesion.nombre, 'CPC. Admin Seed')
  assert.equal(almacen.getItem(CLAVES_SESION.nombre), 'CPC. Admin Seed')
  assert.equal(servicio.getNombre(), 'CPC. Admin Seed')
})

test('login hace POST /auth/login y guarda token, rol, id y nombre en el almacén, sin usuario (5b)', async () => {
  const api = crearApiFalsa({ datos: DATOS_SESION })
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api, almacen })

  const sesion = await servicio.login('admin_seed', 'clave-falsa')

  assert.deepEqual(api.llamadas, [
    { url: '/auth/login', cuerpo: { correo: 'admin_seed', password: 'clave-falsa' } },
  ])
  assert.deepEqual(
    sesion,
    { ...DATOS_SESION, debeCambiarContrasena: false },
    'login devuelve los datos de la sesión',
  )
  assert.equal(almacen.getItem(CLAVES_SESION.token), 'token-falso')
  assert.equal(almacen.getItem(CLAVES_SESION.rol), 'administrador')
  assert.equal(almacen.getItem(CLAVES_SESION.id), '5')
  assert.equal(almacen.getItem(CLAVES_SESION.nombre), 'Admin Seed')
  assert.ok(!('usuario' in CLAVES_SESION), 'la sesión ya no tiene clave de usuario')
  assert.equal(almacen.getItem('delgrow_usuario'), null, 'no se guarda el usuario')
})

test('login guarda la marca de contraseña asignada cuando el backend la manda', async () => {
  const api = crearApiFalsa({ datos: { ...DATOS_SESION, debe_cambiar_contrasena: true } })
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api, almacen })

  const sesion = await servicio.login('nuevo@delgrow.mx', 'AsignadaAdmin1')

  assert.equal(sesion.debeCambiarContrasena, true)
  assert.equal(servicio.getCambioPendiente(), true, 'la marca sobrevive a recargar la página')
})

test('sin marca no se guarda la clave de cambio pendiente', async () => {
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api: crearApiFalsa({ datos: DATOS_SESION }), almacen })

  await servicio.login('admin_seed', 'clave-falsa')

  assert.equal(servicio.getCambioPendiente(), false)
  assert.equal(almacen.getItem(CLAVES_SESION.cambioPendiente), null)
})

test('cambiarContrasena hace PATCH /auth/contrasena y quita la marca guardada', async () => {
  const api = crearApiFalsa({ datos: { mensaje: 'Contraseña actualizada correctamente' } })
  const almacen = crearAlmacenFalso({ [CLAVES_SESION.cambioPendiente]: '1' })
  const servicio = crearAuthService({ api, almacen })

  await servicio.cambiarContrasena('MiClavePropia2')

  assert.deepEqual(api.llamadas, [
    { metodo: 'PATCH', url: '/auth/contrasena', cuerpo: { password: 'MiClavePropia2' } },
  ])
  assert.equal(servicio.getCambioPendiente(), false)
})

test('cambiarContrasena propaga el error y conserva la marca', async () => {
  const error = { estado: 'solicitud_invalida', mensaje: 'Contraseña inválida', codigoHttp: 400 }
  const almacen = crearAlmacenFalso({ [CLAVES_SESION.cambioPendiente]: '1' })
  const servicio = crearAuthService({ api: crearApiFalsa({ error }), almacen })

  await assert.rejects(() => servicio.cambiarContrasena('Corta1'), error)
  assert.equal(servicio.getCambioPendiente(), true)
})

test('las claves de sesión llevan el prefijo delgrow_ para no mezclarse con otros datos', () => {
  for (const clave of Object.values(CLAVES_SESION)) {
    assert.match(clave, /^delgrow_/, `la clave "${clave}" debe estar prefijada`)
  }
})

test('login propaga el error del backend y no guarda nada si las credenciales no son válidas', async () => {
  const error = {
    estado: 'credenciales_invalidas',
    mensaje: 'Credenciales no válidas sobre usuario o contraseña: Verifique sus datos',
    codigoHttp: 401,
    datos: null,
  }
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api: crearApiFalsa({ error }), almacen })

  await assert.rejects(servicio.login('admin_seed', 'mala'), (recibido) => {
    assert.equal(recibido, error, 'se propaga el error normalizado de api.js')
    return true
  })
  assert.equal(almacen.getItem(CLAVES_SESION.token), null, 'no se guarda un token inválido')
})

test('login rechaza con tres partes si el backend no devuelve token', async () => {
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api: crearApiFalsa({ datos: { rol: 'contador' } }), almacen })

  await assert.rejects(servicio.login('ana', 'clave'), (error) => {
    assert.equal(error.estado, 'respuesta_inesperada')
    assert.ok(error.mensaje.includes('Qué ocurrió:'))
    assert.ok(error.mensaje.includes('Qué hacer:'))
    return true
  })
  assert.equal(almacen.getItem(CLAVES_SESION.token), null)
})

// --- lectura y escritura de la sesión -------------------------------------

test('getToken, getRol, getNombre y getId leen del almacén y devuelven null si no hay sesión', () => {
  const almacen = crearAlmacenFalso({
    [CLAVES_SESION.token]: 'token-falso',
    [CLAVES_SESION.rol]: 'contador',
    [CLAVES_SESION.id]: '7',
    [CLAVES_SESION.nombre]: 'Ana',
  })
  const servicio = crearAuthService({ api: crearApiFalsa(), almacen })

  assert.equal(servicio.getToken(), 'token-falso')
  assert.equal(servicio.getRol(), 'contador')
  assert.equal(servicio.getId(), '7')
  assert.equal(servicio.getNombre(), 'Ana')

  const vacio = crearAuthService({ api: crearApiFalsa(), almacen: crearAlmacenFalso() })
  assert.equal(vacio.getToken(), null)
  assert.equal(vacio.getRol(), null)
  assert.equal(vacio.getId(), null)
  assert.equal(vacio.getNombre(), null)
})

test('setSesion escribe token, rol, id y nombre de una vez', () => {
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api: crearApiFalsa(), almacen })

  servicio.setSesion(DATOS_SESION)

  assert.equal(almacen.getItem(CLAVES_SESION.token), 'token-falso')
  assert.equal(almacen.getItem(CLAVES_SESION.rol), 'administrador')
  assert.equal(almacen.getItem(CLAVES_SESION.id), '5')
  assert.equal(almacen.getItem(CLAVES_SESION.nombre), 'Admin Seed')
})

test('setToken, setRol, setNombre y setId escriben cada dato por separado', () => {
  const almacen = crearAlmacenFalso()
  const servicio = crearAuthService({ api: crearApiFalsa(), almacen })

  servicio.setToken('otro-token')
  servicio.setRol('contador')
  servicio.setNombre('Ana')
  servicio.setId(9)

  assert.equal(servicio.getToken(), 'otro-token')
  assert.equal(servicio.getRol(), 'contador')
  assert.equal(servicio.getNombre(), 'Ana')
  assert.equal(servicio.getId(), '9')
})

test('limpiarSesion elimina todas las claves de la sesión y no toca otros datos', () => {
  const almacen = crearAlmacenFalso({
    [CLAVES_SESION.token]: 'token-falso',
    otra_clave: 'se queda',
  })
  const servicio = crearAuthService({ api: crearApiFalsa(), almacen })
  servicio.setSesion(DATOS_SESION)

  servicio.limpiarSesion()

  for (const clave of Object.values(CLAVES_SESION)) {
    assert.equal(almacen.getItem(clave), null, `la clave "${clave}" debe quedar vacía`)
  }
  assert.equal(almacen.getItem('otra_clave'), 'se queda')
})

// --- caducidad del token por su campo exp (RF-42, RF-43) -------------------

test('isTokenExpirado devuelve false si el token tiene exp en el futuro', () => {
  assert.equal(isTokenExpirado(tokenCon({ exp: AHORA_EN_SEGUNDOS + 60 }), AHORA), false)
})

test('isTokenExpirado devuelve true si el token ya venció', () => {
  assert.equal(isTokenExpirado(tokenCon({ exp: AHORA_EN_SEGUNDOS - 1 }), AHORA), true)
})

test('isTokenExpirado devuelve true justo en el límite de exp', () => {
  assert.equal(isTokenExpirado(tokenCon({ exp: AHORA_EN_SEGUNDOS }), AHORA), true)
})

test('isTokenExpirado trata como expirado un token mal formado, sin exp o que no es texto', () => {
  const invalidos = [
    null,
    undefined,
    '',
    'no-es-un-token',
    'a.b',
    'a.b.c.d',
    '%%%.%%%.%%%',
    tokenCon({ usuario: 'sin-exp' }),
    tokenCon({ exp: '1700000000' }),
    tokenCon({ exp: null }),
  ]

  for (const token of invalidos) {
    assert.equal(
      isTokenExpirado(token, AHORA),
      true,
      `el token ${JSON.stringify(token)} debe tratarse como expirado por seguridad`,
    )
  }
})

// --- logout (RF-10, RF-45 a RF-47) ---------------------------------------

test('logout hace POST /auth/logout y devuelve un resultado de éxito', async () => {
  const api = crearApiFalsa({ datos: { mensaje: 'Sesión cerrada correctamente' } })
  const almacen = crearAlmacenFalso({ [CLAVES_SESION.token]: 'token-falso' })
  const servicio = crearAuthService({ api, almacen })

  const resultado = await servicio.logout()

  assert.deepEqual(api.llamadas, [{ url: '/auth/logout', cuerpo: undefined }])
  assert.deepEqual(resultado, { ok: true, mensaje: 'Sesión cerrada correctamente' })
})

test('logout no limpia la sesión por sí solo: el cierre local lo decide quien llama (4.8)', async () => {
  const almacen = crearAlmacenFalso({ [CLAVES_SESION.token]: 'token-falso' })
  const servicio = crearAuthService({ api: crearApiFalsa({ datos: {} }), almacen })

  await servicio.logout()

  assert.equal(almacen.getItem(CLAVES_SESION.token), 'token-falso')
})

test('logout devuelve un fallo sin lanzar cuando el backend no responde (RF-47)', async () => {
  const error = {
    estado: 'red',
    mensaje: 'Qué ocurrió: no hay conexión.',
    codigoHttp: null,
    datos: null,
  }
  const almacen = crearAlmacenFalso({ [CLAVES_SESION.token]: 'token-falso' })
  const servicio = crearAuthService({ api: crearApiFalsa({ error }), almacen })

  const resultado = await servicio.logout()

  assert.equal(resultado.ok, false)
  assert.equal(resultado.error, error, 'el fallo se devuelve para que la pantalla decida el aviso')
  assert.equal(almacen.getItem(CLAVES_SESION.token), 'token-falso', 'logout no limpia la sesión')
})
