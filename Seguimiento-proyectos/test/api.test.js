// Pruebas de la instancia de axios y de la normalización de errores
// (RF-02, RF-04, RF-05, RF-07, RF-34, RF-36, RF-42).
// Sin red: se inyecta un adaptador falso y un almacén falso en lugar de sessionStorage.

import test from 'node:test'
import assert from 'node:assert/strict'
import { AxiosError } from 'axios'

import { CLAVES_SESION, TIEMPO_LIMITE_MS, URL_BASE_API, crearApi } from '../src/services/api.js'

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

// Respuesta HTTP simulada que devuelve un adaptador de axios.
const respuestaHttp = (config, { estado = 200, datos = {} } = {}) => ({
  data: datos,
  status: estado,
  statusText: String(estado),
  headers: {},
  config,
})

// Fallo HTTP: rechaza igual que un adaptador real de axios, con `response`.
const falloHttp = (config, estado, datos) =>
  Promise.reject(
    new AxiosError(
      `Request failed with status code ${estado}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      null,
      respuestaHttp(config, { estado, datos }),
    ),
  )

// Adaptador de axios que responde sin red con el comportamiento indicado.
// Los adaptadores de axios devuelven siempre una promesa.
const crearAdaptador = (comportamiento) => (config) =>
  Promise.resolve().then(() => comportamiento(config))

// Lee una cabecera aunque axios la entregue como AxiosHeaders o como objeto plano.
const leerCabecera = (config, nombre) => {
  const cabeceras = config.headers ?? {}
  return typeof cabeceras.get === 'function' ? cabeceras.get(nombre) : cabeceras[nombre]
}

// Cuerpo de error real del backend (tres partes ya unidas).
const MENSAJE_BACKEND = 'Sesión caducada sobre token de acceso: Inicie sesión nuevamente'

// --- instancia -------------------------------------------------------------

test('la instancia usa la URL del backend y el límite de 15 s del plan', () => {
  const { api } = crearApi({ almacen: crearAlmacenFalso() })

  assert.equal(URL_BASE_API, 'http://localhost:3000')
  assert.equal(TIEMPO_LIMITE_MS, 15000)
  assert.equal(api.defaults.baseURL, 'http://localhost:3000')
  assert.equal(api.defaults.timeout, 15000)
})

// --- cabecera Authorization (RF-42) ---------------------------------------

test('el interceptor de petición añade Authorization: Bearer con el token del almacén', async () => {
  const almacen = crearAlmacenFalso({ [CLAVES_SESION.token]: 'token-falso' })
  const peticiones = []
  const { api } = crearApi({
    almacen,
    adaptador: crearAdaptador((config) => {
      peticiones.push(config)
      return respuestaHttp(config)
    }),
  })

  await api.get('/contadores')

  assert.equal(peticiones.length, 1)
  assert.equal(leerCabecera(peticiones[0], 'Authorization'), 'Bearer token-falso')
})

test('el interceptor de petición no añade Authorization si no hay token', async () => {
  const peticiones = []
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => {
      peticiones.push(config)
      return respuestaHttp(config)
    }),
  })

  await api.get('/contadores')

  assert.equal(leerCabecera(peticiones[0], 'Authorization'), undefined)
})

// --- normalización de errores ---------------------------------------------

test('un 401 de una ruta protegida se normaliza como sin_sesion con el mensaje del backend', async () => {
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 401, { mensaje: MENSAJE_BACKEND })),
  })

  await assert.rejects(api.get('/contadores'), (error) => {
    assert.equal(error.estado, 'sin_sesion')
    assert.equal(error.mensaje, MENSAJE_BACKEND, 'se muestra el mensaje del backend tal cual')
    assert.equal(error.codigoHttp, 401)
    assert.deepEqual(error.datos, { mensaje: MENSAJE_BACKEND })
    return true
  })
})

test('un 401 de POST /auth/login se normaliza como credenciales_invalidas y no avisa de sesión expirada', async () => {
  const mensaje =
    'Credenciales no válidas sobre usuario o contraseña: Verifique sus datos e intente nuevamente'
  let avisos = 0
  const servicio = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 401, { mensaje })),
  })
  servicio.registrarOnSesionExpirada(() => {
    avisos += 1
  })

  await assert.rejects(
    servicio.api.post('/auth/login', { usuario: 'x', password: 'y' }),
    (error) => {
      assert.equal(error.estado, 'credenciales_invalidas')
      assert.equal(error.mensaje, mensaje)
      assert.equal(error.codigoHttp, 401)
      return true
    },
  )
  assert.equal(avisos, 0, 'las credenciales no válidas no son una sesión caducada (RF-04)')
})

test('un 401 de una ruta protegida avisa a onSesionExpirada con el error normalizado', async () => {
  let aviso = null
  const servicio = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 401, { mensaje: MENSAJE_BACKEND })),
  })
  servicio.registrarOnSesionExpirada((error) => {
    aviso = error
  })

  await assert.rejects(servicio.api.get('/casos/mis-casos'))

  assert.ok(aviso, 'debe avisarse de la sesión expirada')
  assert.equal(aviso.estado, 'sin_sesion')
  assert.equal(aviso.mensaje, MENSAJE_BACKEND)
})

test('un 401 de POST /auth/logout no dispara onSesionExpirada (el cierre lo decide quien llama)', async () => {
  let avisos = 0
  const servicio = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 401, { mensaje: MENSAJE_BACKEND })),
  })
  servicio.registrarOnSesionExpirada(() => {
    avisos += 1
  })

  await assert.rejects(servicio.api.post('/auth/logout'))
  assert.equal(avisos, 0)
})

test('un 403 se normaliza como sin_permiso sin borrar ni tocar la sesión', async () => {
  const mensaje = 'Rol insuficiente sobre usuario autenticado: Se requiere rol de administrador'
  let avisos = 0
  const servicio = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 403, { mensaje })),
  })
  servicio.registrarOnSesionExpirada(() => {
    avisos += 1
  })

  await assert.rejects(servicio.api.get('/contadores'), (error) => {
    assert.equal(error.estado, 'sin_permiso')
    assert.equal(error.mensaje, mensaje)
    assert.equal(error.codigoHttp, 403)
    return true
  })
  assert.equal(avisos, 0, 'un 403 no es una sesión caducada')
})

test('un 404 se normaliza como no_encontrado con el mensaje del backend', async () => {
  const mensaje = 'No se encontró el contador sobre contador solicitado: Verifique el identificador'
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 404, { mensaje })),
  })

  await assert.rejects(api.get('/contadores/99/casos'), (error) => {
    assert.equal(error.estado, 'no_encontrado')
    assert.equal(error.mensaje, mensaje)
    assert.equal(error.codigoHttp, 404)
    return true
  })
})

test('un 429 se normaliza como demasiados_intentos con el mensaje del backend', async () => {
  const mensaje = 'Demasiados intentos fallidos sobre inicio de sesión: Espere 15 minutos antes de volver a intentarlo'
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 429, { mensaje })),
  })

  await assert.rejects(api.post('/auth/login', {}), (error) => {
    assert.equal(error.estado, 'demasiados_intentos')
    assert.equal(error.mensaje, mensaje)
    assert.equal(error.codigoHttp, 429)
    return true
  })
})

test('un 500 se normaliza como servidor con el mensaje del backend', async () => {
  const mensaje = 'Error interno del servidor sobre la petición: intente nuevamente'
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 500, { mensaje })),
  })

  await assert.rejects(api.get('/contadores'), (error) => {
    assert.equal(error.estado, 'servidor')
    assert.equal(error.mensaje, mensaje)
    assert.equal(error.codigoHttp, 500)
    return true
  })
})

test('un 503 se normaliza igual que un 500 (servidor), como exige la spec 004', async () => {
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) =>
      falloHttp(config, 503, { mensaje: 'Servicio no disponible' }),
    ),
  })

  await assert.rejects(api.get('/contadores'), (error) => {
    assert.equal(error.estado, 'servidor')
    assert.equal(error.codigoHttp, 503)
    return true
  })
})

test('una respuesta de error sin mensaje del backend se convierte en error de tres partes', async () => {
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => falloHttp(config, 500, {})),
  })

  await assert.rejects(api.get('/contadores'), (error) => {
    assert.equal(error.estado, 'servidor')
    assert.ok(error.mensaje.includes('Qué ocurrió:'), 'falta la parte de qué ocurrió (RNF-01)')
    assert.ok(error.mensaje.includes('Sobre:'), 'falta la parte de sobre qué (RNF-01)')
    assert.ok(error.mensaje.includes('Qué hacer:'), 'falta la parte de qué hacer (RNF-01)')
    assert.ok(error.mensaje.includes('GET /contadores'), 'el mensaje indica sobre qué petición')
    return true
  })
})

test('un error de red se normaliza como red con mensaje de tres partes', async () => {
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) =>
      Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config)),
    ),
  })

  await assert.rejects(api.get('/casos/mis-casos'), (error) => {
    assert.equal(error.estado, 'red')
    assert.equal(error.codigoHttp, null)
    assert.equal(error.datos, null)
    assert.ok(error.mensaje.includes('No se pudo conectar con el servidor'))
    assert.ok(error.mensaje.includes('Qué ocurrió:'))
    assert.ok(error.mensaje.includes('Sobre:'))
    assert.ok(error.mensaje.includes('Qué hacer:'))
    return true
  })
})

test('un tiempo agotado (ECONNABORTED) se normaliza como red con mensaje de tres partes', async () => {
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) =>
      Promise.reject(new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED', config)),
    ),
  })

  await assert.rejects(api.get('/contadores'), (error) => {
    assert.equal(error.estado, 'red')
    assert.ok(
      error.mensaje.includes('no respondió a tiempo'),
      'el texto distingue el tiempo agotado',
    )
    assert.ok(error.mensaje.includes('Qué hacer:'))
    return true
  })
})

// --- gancho de actividad (RF-07) ------------------------------------------

test('cada petición avisa a onActividad para reiniciar el temporizador de inactividad', async () => {
  let avisos = 0
  const servicio = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => respuestaHttp(config)),
  })
  servicio.registrarOnActividad(() => {
    avisos += 1
  })

  await servicio.api.get('/contadores')
  await servicio.api.get('/casos/mis-casos')

  assert.equal(avisos, 2, 'cada petición válida reinicia la inactividad (RF-07)')
})

test('los ganchos son opcionales: sin registrar no se lanza al hacer peticiones', async () => {
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => respuestaHttp(config)),
  })

  const respuesta = await api.get('/contadores')

  assert.deepEqual(respuesta.data, {})
})

// --- respuesta correcta ----------------------------------------------------

test('una respuesta correcta se entrega tal cual a quien llama', async () => {
  const datos = { contadores: [{ id: 1, nombre: 'ana' }] }
  const { api } = crearApi({
    almacen: crearAlmacenFalso(),
    adaptador: crearAdaptador((config) => respuestaHttp(config, { datos })),
  })

  const respuesta = await api.get('/contadores')

  assert.equal(respuesta.status, 200)
  assert.deepEqual(respuesta.data, datos)
})

// --- almacén de sesión: sessionStorage o localStorage según «Mantener sesión» ----

test('crearAlmacenSesion guarda en el temporal salvo que la sesión esté marcada como persistente', async () => {
  const { crearAlmacenSesion } = await import('../src/services/api.js')
  const temporal = crearAlmacenFalso()
  const persistente = crearAlmacenFalso()
  const almacen = crearAlmacenSesion(temporal, persistente)

  almacen.setItem(CLAVES_SESION.token, 'normal')
  assert.equal(temporal.getItem(CLAVES_SESION.token), 'normal')
  assert.equal(persistente.getItem(CLAVES_SESION.token), null)

  // La marca siempre vive en el persistente y desde ahí todo se guarda allá
  almacen.removeItem(CLAVES_SESION.token)
  almacen.setItem(CLAVES_SESION.persistente, '1')
  almacen.setItem(CLAVES_SESION.token, 'recordada')
  assert.equal(persistente.getItem(CLAVES_SESION.persistente), '1')
  assert.equal(persistente.getItem(CLAVES_SESION.token), 'recordada')
  assert.equal(temporal.getItem(CLAVES_SESION.token), null)
  assert.equal(almacen.getItem(CLAVES_SESION.token), 'recordada', 'se lee de donde esté')

  // Borrar quita la clave de los dos
  temporal.setItem(CLAVES_SESION.token, 'vieja')
  almacen.removeItem(CLAVES_SESION.token)
  assert.equal(temporal.getItem(CLAVES_SESION.token), null)
  assert.equal(persistente.getItem(CLAVES_SESION.token), null)
})
