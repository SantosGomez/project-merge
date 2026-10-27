// Pruebas del store de sesión (RF-01 a RF-10, RF-42 a RF-47).
// Sin navegador y sin red: se inyectan authService, servicios, reloj y temporizador falsos.

import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { CLAVES_SESION } from '../src/services/api.js'
import { isTokenExpirado } from '../src/services/authService.js'
import {
  INTERVALO_INACTIVIDAD_MS,
  LIMITE_INACTIVIDAD_MINUTOS,
  RUTA_CAMBIO_CONTRASENA,
  TEXTO_AVISO_CIERRE,
  TEXTO_AVISO_REVOCACION,
  crearSessionStore,
} from '../src/stores/session.js'

// --- ayudas ----------------------------------------------------------------

const AHORA = new Date('2026-10-22T10:00:00.000Z')
const EXP_FUTURO = Math.floor(AHORA.getTime() / 1000) + 3600
const EXP_VENCIDO = Math.floor(AHORA.getTime() / 1000) - 1

// Token con forma de JWT (cabecera.carga.firma) con la carga indicada.
const tokenCon = (carga) => {
  const cabecera = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString('base64url')
  return `${cabecera}.${cuerpo}.firma-falsa`
}

const tokenVigente = () => tokenCon({ exp: EXP_FUTURO })

// Almacén falso en memoria: sustituye a sessionStorage.
const crearAlmacenFalso = (inicial = {}) => {
  const datos = new Map(
    Object.entries(inicial).map(([clave, valor]) => [clave, valor === null ? null : String(valor)]),
  )
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

const escribir = (almacen, clave, valor) => {
  if (valor === null || valor === undefined) {
    almacen.removeItem(clave)
  } else {
    almacen.setItem(clave, String(valor))
  }
}

const almacenConSesion = (sesion) => ({
  [CLAVES_SESION.token]: sesion.token,
  [CLAVES_SESION.rol]: sesion.rol,
  [CLAVES_SESION.nombre]: sesion.nombre,
  [CLAVES_SESION.id]: sesion.id,
})

// Reloj falso: `ahora()` devuelve la hora simulada y `avanzarMinutos` la mueve.
const crearRelojFalso = (inicio = AHORA) => {
  let actual = new Date(inicio.getTime())
  return {
    ahora: () => new Date(actual.getTime()),
    avanzarMinutos: (minutos) => {
      actual = new Date(actual.getTime() + minutos * 60 * 1000)
    },
    avanzarMilisegundos: (ms) => {
      actual = new Date(actual.getTime() + ms)
    },
  }
}

// Temporizador falso: registra la función programada y permite dispararla a mano.
const crearProgramadorFalso = () => {
  let programada = null
  return {
    setInterval: (funcion, ms) => {
      programada = { funcion, ms }
      return 1
    },
    clearInterval: () => {
      programada = null
    },
    disparar: () => {
      if (programada) {
        programada.funcion()
      }
    },
    get activo() {
      return programada !== null
    },
    get intervaloMs() {
      return programada ? programada.ms : null
    },
  }
}

// AuthService falso con almacén propio; registra login/logout y sus tokens.
const crearAuthFalsa = ({
  inicial = {},
  sesionLogin,
  errorLogin,
  resultadoLogout,
  errorCambio,
} = {}) => {
  const almacen = crearAlmacenFalso(inicial)
  const llamadas = []

  const servicio = {
    almacen,
    llamadas,
    getToken: () => almacen.getItem(CLAVES_SESION.token),
    getRol: () => almacen.getItem(CLAVES_SESION.rol),
    getNombre: () => almacen.getItem(CLAVES_SESION.nombre),
    getId: () => almacen.getItem(CLAVES_SESION.id),
    getCambioPendiente: () => almacen.getItem(CLAVES_SESION.cambioPendiente) === '1',
    setToken: (token) => escribir(almacen, CLAVES_SESION.token, token),
    setSesion: (sesion) => {
      escribir(almacen, CLAVES_SESION.token, sesion.token)
      escribir(almacen, CLAVES_SESION.rol, sesion.rol)
      escribir(almacen, CLAVES_SESION.nombre, sesion.nombre)
      escribir(almacen, CLAVES_SESION.id, sesion.id)
      escribir(almacen, CLAVES_SESION.cambioPendiente, sesion.debeCambiarContrasena ? '1' : null)
    },
    async cambiarContrasena(password) {
      llamadas.push({ accion: 'cambiarContrasena', password })
      if (errorCambio) {
        throw errorCambio
      }
      almacen.removeItem(CLAVES_SESION.cambioPendiente)
    },
    limpiarSesion: () => {
      for (const clave of Object.values(CLAVES_SESION)) {
        almacen.removeItem(clave)
      }
    },
    isTokenExpirado: (token, ahora) => isTokenExpirado(token, ahora),
    async login(correo, password) {
      llamadas.push({ accion: 'login', correo, password })
      if (errorLogin) {
        throw errorLogin
      }
      const sesion = sesionLogin ?? {
        token: tokenVigente(),
        rol: 'administrador',
        id: 5,
        nombre: correo,
      }
      servicio.setSesion(sesion)
      return sesion
    },
    async logout() {
      llamadas.push({ accion: 'logout', token: servicio.getToken() })
      return resultadoLogout ?? { ok: true, mensaje: 'Sesión cerrada correctamente' }
    },
  }

  return servicio
}

// Servicios falsos de contadores y casos: registran la lectura protegida.
const crearContadoresFalsos = ({ error, contadores } = {}) => {
  const llamadas = []
  return {
    llamadas,
    async listCounters() {
      llamadas.push({ accion: 'listCounters' })
      if (error) {
        throw error
      }
      return contadores ?? [{ id: 3, nombre: 'ana' }]
    },
    async getConteosPorEstado() {
      return { pendiente: 0, en_proceso: 0, finalizado: 0 }
    },
    async getCasosPorContador() {
      return []
    },
  }
}

const crearCasosFalsos = ({ error, casos } = {}) => {
  const llamadas = []
  return {
    llamadas,
    async getMisCasos() {
      llamadas.push({ accion: 'getMisCasos' })
      if (error) {
        throw error
      }
      return casos ?? [{ id: 9, cliente: 'Cliente', estado: 'pendiente', prioridad: 'alta' }]
    },
    async crearCaso() {
      return {}
    },
    async actualizarCaso() {
      return {}
    },
  }
}

const ERROR_SIN_SESION = {
  estado: 'sin_sesion',
  mensaje:
    'Qué ocurrió: la sesión ya no es válida. Sobre: la lectura protegida. Qué hacer: inicie sesión.',
  codigoHttp: 401,
  datos: null,
}

const ERROR_RED = {
  estado: 'red',
  mensaje:
    'Qué ocurrió: no hay conexión. Sobre: la lectura protegida. Qué hacer: verifique su conexión.',
  codigoHttp: null,
  datos: null,
}

const ERROR_SERVIDOR = {
  estado: 'servidor',
  mensaje: 'Qué ocurrió: el servidor falló. Sobre: la lectura protegida. Qué hacer: reintente.',
  codigoHttp: 500,
  datos: null,
}

// Monta el store con todas las dependencias falsas y devuelve también los dobles.
const montarSesion = (opciones = {}) => {
  const auth = opciones.auth ?? crearAuthFalsa()
  const contadores = opciones.contadores ?? crearContadoresFalsos()
  const casos = opciones.casos ?? crearCasosFalsos()
  const reloj = opciones.reloj ?? crearRelojFalso()
  const programador = opciones.programador ?? crearProgramadorFalso()
  const ganchos = { actividad: null, expirada: null }

  const useStore = crearSessionStore({
    authService: auth,
    counterService: contadores,
    caseService: casos,
    registrarOnActividad: (funcion) => {
      ganchos.actividad = funcion
    },
    registrarOnSesionExpirada: (funcion) => {
      ganchos.expirada = funcion
    },
    ahora: reloj.ahora,
    setInterval: programador.setInterval,
    clearInterval: programador.clearInterval,
  })

  return { store: useStore(), auth, contadores, casos, reloj, programador, ganchos }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// --- arranque y lectura protegida (4.3, RF-42, RF-44) ---------------------

test('arranque sin token: no hay sesión y no se llama al backend', async () => {
  const { store, contadores, casos } = montarSesion()

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'sin_sesion')
  assert.equal(store.autenticado, false)
  assert.equal(store.token, null)
  assert.equal(contadores.llamadas.length, 0)
  assert.equal(casos.llamadas.length, 0)
})

test('arranque con token vencido: caduca sin llamar al backend ni conservar el token', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenCon({ exp: EXP_VENCIDO }),
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, contadores, reloj, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'caducada')
  assert.equal(store.sesionCaducada, true)
  assert.equal(store.token, null)
  assert.equal(auth.getToken(), null, 'el token se elimina del almacén')
  assert.equal(contadores.llamadas.length, 0)
  assert.equal(programador.activo, false)
  assert.ok(reloj.ahora() instanceof Date)
})

test('arranque con token vigente de administrador: valida con GET /contadores y abre P-2', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenVigente(),
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const contadores = crearContadoresFalsos()
  const { store, reloj, programador } = montarSesion({ auth, contadores })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.deepEqual(resultado.pantallaPrincipal, '/admin/dashboard')
  assert.equal(contadores.llamadas.length, 1)
  assert.equal(contadores.llamadas[0].accion, 'listCounters')
  assert.equal(store.autenticado, true)
  assert.equal(store.rol, 'administrador')
  assert.equal(store.nombre, 'admin_seed')
  assert.equal(store.id, '5')
  assert.equal(store.exp, EXP_FUTURO)
  assert.equal(store.sesionCaducada, false)
  assert.equal(store.ultimaActividad, reloj.ahora().getTime())
  assert.equal(programador.activo, true)
  assert.equal(programador.intervaloMs, INTERVALO_INACTIVIDAD_MS)
})

test('arranque con token vigente de contador: valida con GET /casos/mis-casos y abre P-5', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const casos = crearCasosFalsos()
  const { store } = montarSesion({ auth, casos })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(resultado.pantallaPrincipal, '/contador/casos')
  assert.equal(casos.llamadas.length, 1)
  assert.equal(casos.llamadas[0].accion, 'getMisCasos')
  assert.equal(store.rol, 'contador')
})

test('arranque con 401 del backend: caduca y limpia la sesión (RF-43)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenVigente(),
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, programador } = montarSesion({
    auth,
    contadores: crearContadoresFalsos({ error: ERROR_SIN_SESION }),
  })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'caducada')
  assert.equal(resultado.error, ERROR_SIN_SESION)
  assert.equal(store.sesionCaducada, true)
  assert.equal(store.token, null)
  assert.equal(auth.getToken(), null)
  assert.equal(programador.activo, false)
})

test('arranque con error de red: error recuperable y la sesión sigue viva (4.3)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenVigente(),
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, programador } = montarSesion({
    auth,
    contadores: crearContadoresFalsos({ error: ERROR_RED }),
  })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'error')
  assert.equal(resultado.error, ERROR_RED)
  assert.equal(resultado.reintentar, true)
  assert.equal(store.sesionCaducada, false)
  assert.equal(store.token, tokenVigente(), 'el token NO se borra con un error de red')
  assert.notEqual(auth.getToken(), null)
  assert.equal(programador.activo, false)
})

test('arranque con error del servidor: error recuperable y sin borrar el token', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const { store } = montarSesion({
    auth,
    casos: crearCasosFalsos({ error: ERROR_SERVIDOR }),
  })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'error')
  assert.equal(store.token, tokenVigente())
  assert.equal(store.sesionCaducada, false)
})

test('arranque del usuario de sistema: valida con «mis casos» y abre el directorio de usuarios (9a)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenVigente(),
      rol: 'usuarios_de_sistema',
      id: 8,
      nombre: 'sistema',
    }),
  })
  const contadores = crearContadoresFalsos()
  const casos = crearCasosFalsos({ casos: [] })
  const { store, programador } = montarSesion({ auth, contadores, casos })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(resultado.pantallaPrincipal, '/admin/directorio')
  // No tiene lectura propia: «mis casos» acepta cualquier sesión y solo comprueba el token.
  assert.equal(casos.llamadas.length, 1)
  assert.equal(contadores.llamadas.length, 0)
  assert.equal(store.esUsuarioSistema, true)
  assert.equal(programador.activo, true)
})

test('arranque con un perfil sin pantalla: acceso denegado y sin lectura protegida', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenVigente(),
      rol: 'invitado',
      id: 8,
      nombre: 'invitado',
    }),
  })
  const contadores = crearContadoresFalsos()
  const casos = crearCasosFalsos()
  const { store, programador } = montarSesion({ auth, contadores, casos })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'acceso_denegado')
  assert.equal(resultado.rol, 'invitado')
  assert.equal(contadores.llamadas.length, 0)
  assert.equal(casos.llamadas.length, 0)
  assert.equal(store.tienePantalla, false)
  assert.equal(store.pantallaPrincipal, null)
  assert.equal(programador.activo, false)
})

// --- inicio de sesión (RF-01 a RF-10) -------------------------------------

test('iniciarSesion guarda el nombre de la cuenta para mostrarlo en el menú', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { token: tokenVigente(), rol: 'contador', id: 7, nombre: 'Ana Karen Ramírez' },
  })
  const { store } = montarSesion({ auth })

  await store.iniciarSesion('ana@delgrow.mx', 'clave')

  assert.equal(store.nombre, 'Ana Karen Ramírez')
  assert.equal(store.nombreVisible, 'Ana Karen Ramírez')
})

test('la sesión ya no expone el usuario: el nombre visible es solo el nombre (5b)', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { token: tokenVigente(), rol: 'contador', id: 7, nombre: 'Ana Karen Ramírez' },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('ana@delgrow.mx', 'clave')

  assert.ok(!('usuario' in store.$state), 'el estado no tiene usuario')
  assert.ok(!('usuario' in resultado), 'iniciarSesion no devuelve usuario')
  assert.equal(store.nombreVisible, 'Ana Karen Ramírez')

  // Una sesión guardada antes del cambio, sin nombre, no tiene nada que mostrar.
  auth.almacen.removeItem(CLAVES_SESION.nombre)
  store.aplicarSesionGuardada()
  assert.equal(store.nombreVisible, null)
})

test('iniciarSesion sin sesión previa: guarda la sesión, arranca el temporizador y devuelve la pantalla', async () => {
  const auth = crearAuthFalsa()
  const { store, reloj, programador } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('admin_seed', 'clave')

  assert.equal(resultado.ok, true)
  assert.equal(resultado.rol, 'administrador')
  assert.equal(resultado.pantallaPrincipal, '/admin/dashboard')
  assert.equal(resultado.accesoDenegado, false)
  assert.equal(store.autenticado, true)
  assert.equal(store.token, tokenVigente())
  assert.equal(store.rol, 'administrador')
  assert.equal(store.nombre, 'admin_seed')
  assert.equal(store.exp, EXP_FUTURO)
  assert.equal(store.ultimaActividad, reloj.ahora().getTime())
  assert.equal(programador.activo, true)
  assert.equal(auth.llamadas.filter((llamada) => llamada.accion === 'logout').length, 0)
})

test('iniciarSesion con sesión previa: revoca la anterior de forma best-effort (RF-10)', async () => {
  const tokenAnterior = tokenCon({ exp: EXP_FUTURO, jti: 'anterior' })
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenAnterior, rol: 'contador', id: 3, nombre: 'ana' }),
    sesionLogin: { token: tokenVigente(), rol: 'administrador', id: 5, nombre: 'admin_seed' },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('admin_seed', 'clave')

  assert.equal(resultado.ok, true)
  assert.deepEqual(
    auth.llamadas.map((llamada) => llamada.accion),
    ['login', 'logout'],
    'primero inicia sesión y después revoca la anterior',
  )
  assert.equal(auth.llamadas[1].token, tokenAnterior, 'logout usa el token anterior, no el nuevo')
  assert.equal(store.token, tokenVigente(), 'el store queda con la sesión nueva')
  assert.equal(store.rol, 'administrador')
})

test('iniciarSesion con sesión previa: un fallo de logout no bloquea el cambio de cuenta (RF-10)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenCon({ exp: EXP_FUTURO, jti: 'anterior' }),
      rol: 'contador',
      id: 3,
      nombre: 'ana',
    }),
    sesionLogin: { token: tokenVigente(), rol: 'administrador', id: 5, nombre: 'admin_seed' },
    resultadoLogout: { ok: false, error: ERROR_RED },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('admin_seed', 'clave')

  assert.equal(resultado.ok, true)
  assert.equal(store.rol, 'administrador')
  assert.equal(store.token, tokenVigente())
})

test('iniciarSesion con credenciales inválidas conserva la sesión previa y no revoca nada', async () => {
  const tokenAnterior = tokenCon({ exp: EXP_FUTURO, jti: 'anterior' })
  const error = {
    estado: 'credenciales_invalidas',
    mensaje: 'Credenciales no válidas sobre usuario o contraseña: verifique sus datos',
    codigoHttp: 401,
    datos: null,
  }
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenAnterior, rol: 'contador', id: 3, nombre: 'ana' }),
    errorLogin: error,
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('otra', 'mala')

  assert.equal(resultado.ok, false)
  assert.equal(resultado.error, error)
  assert.equal(auth.llamadas.filter((llamada) => llamada.accion === 'logout').length, 0)
  assert.equal(
    store.token,
    tokenAnterior,
    'no se pierde la sesión activa (Constitución, principio 3)',
  )
  assert.equal(store.rol, 'contador')
})

test('iniciarSesion del usuario de sistema lleva al directorio de usuarios y arranca el temporizador (9a)', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { token: tokenVigente(), rol: 'usuarios_de_sistema', id: 8, nombre: 'sistema' },
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('sistema', 'clave')

  assert.equal(resultado.ok, true)
  assert.equal(resultado.accesoDenegado, false)
  assert.equal(resultado.pantallaPrincipal, '/admin/directorio')
  assert.equal(store.esUsuarioSistema, true)
  assert.equal(store.esAdministrador, false)
  assert.equal(store.esContador, false)
  assert.equal(programador.activo, true)
})

test('iniciarSesion con un perfil sin pantalla devuelve acceso denegado y no arranca el temporizador', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { token: tokenVigente(), rol: 'invitado', id: 8, nombre: 'invitado' },
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('invitado', 'clave')

  assert.equal(resultado.ok, true)
  assert.equal(resultado.accesoDenegado, true)
  assert.equal(resultado.pantallaPrincipal, null)
  assert.equal(store.tienePantalla, false)
  assert.equal(programador.activo, false)
})

// --- cierre voluntario (RF-45 a RF-47) -----------------------------------

test('cerrarSesionVoluntaria con logout correcto: aviso de sesión cerrada y token eliminado', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      token: tokenVigente(),
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.cerrarSesionVoluntaria()

  assert.equal(resultado.ok, true)
  assert.equal(store.avisoSesion.texto, TEXTO_AVISO_CIERRE)
  assert.equal(store.avisoSesion.texto, 'Sesión cerrada.')
  assert.equal(store.avisoSesion.tipo, 'cierre')
  assert.equal(store.token, null)
  assert.equal(store.autenticado, false)
  assert.equal(store.sesionCaducada, false)
  assert.equal(auth.getToken(), null)
  assert.equal(programador.activo, false)
})

test('cerrarSesionVoluntaria con logout fallido: cierre local igual y aviso de tres partes (RF-47)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 3, nombre: 'ana' }),
    resultadoLogout: { ok: false, error: ERROR_RED },
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.cerrarSesionVoluntaria()

  assert.equal(resultado.ok, false)
  assert.equal(store.token, null, 'el cierre local se hace igual')
  assert.equal(auth.getToken(), null)
  assert.equal(programador.activo, false)
  assert.equal(store.avisoSesion.texto, TEXTO_AVISO_REVOCACION)
  assert.notEqual(store.avisoSesion.texto, TEXTO_AVISO_CIERRE)
  assert.equal(store.avisoSesion.tipo, 'revocacion')
  assert.ok(store.avisoSesion.texto.includes('Qué ocurrió:'), 'falta qué ocurrió (RNF-01)')
  assert.ok(store.avisoSesion.texto.includes('Sobre:'), 'falta sobre qué (RNF-01)')
  assert.ok(store.avisoSesion.texto.includes('Qué hacer:'), 'falta qué hacer (RNF-01)')
})

test('cerrarSesionPorContrasenaNueva cierra en este equipo sin llamar a logout y avisa de la contraseña nueva (9b)', () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenVigente(), rol: 'usuarios_de_sistema', id: 7, nombre: 'sis' }),
  })
  const { store, programador } = montarSesion({ auth })
  store.iniciarTemporizador()

  store.cerrarSesionPorContrasenaNueva()

  // El backend ya revocó el token al restablecer: llamar a logout solo daría 401.
  assert.deepEqual(auth.llamadas, [], 'no llama a logout')
  assert.equal(store.token, null)
  assert.equal(store.autenticado, false)
  assert.equal(auth.getToken(), null)
  assert.equal(programador.activo, false)
  assert.equal(store.sesionCaducada, false, 'no es una sesión caducada')
  assert.deepEqual(store.avisoSesion, {
    texto: 'Contraseña restablecida correctamente. Inicia sesión con la contraseña nueva.',
    tipo: 'cierre',
  })
})

test('fijarAvisoSesion y limpiarAvisoSesion controlan el aviso persistente', () => {
  const { store } = montarSesion()

  store.fijarAvisoSesion('Texto de prueba', 'cierre')
  assert.deepEqual(store.avisoSesion, { texto: 'Texto de prueba', tipo: 'cierre' })

  store.limpiarAvisoSesion()
  assert.equal(store.avisoSesion, null)
})

// --- inactividad de 30 minutos (RF-07, RF-43) ----------------------------

test('la inactividad no caduca exactamente a los 30 minutos y sí al minuto siguiente', async () => {
  const auth = crearAuthFalsa()
  const { store, reloj, programador } = montarSesion({ auth })

  await store.iniciarSesion('admin_seed', 'clave')
  reloj.avanzarMinutos(LIMITE_INACTIVIDAD_MINUTOS)

  assert.equal(store.comprobarInactividad(reloj.ahora()), false)
  assert.equal(store.autenticado, true)
  assert.equal(programador.activo, true)

  reloj.avanzarMinutos(1)

  assert.equal(store.comprobarInactividad(reloj.ahora()), true)
  assert.equal(store.autenticado, false)
  assert.equal(store.sesionCaducada, true)
  assert.equal(store.token, null)
  assert.equal(auth.getToken(), null)
  assert.equal(programador.activo, false)
})

test('marcarActividad reinicia el plazo de inactividad', async () => {
  const auth = crearAuthFalsa()
  const { store, reloj } = montarSesion({ auth })

  await store.iniciarSesion('admin_seed', 'clave')
  reloj.avanzarMinutos(20)
  store.marcarActividad(reloj.ahora())
  reloj.avanzarMinutos(30)

  assert.equal(
    store.comprobarInactividad(reloj.ahora()),
    false,
    '30 minutos desde la última actividad no caducan',
  )
  assert.equal(store.autenticado, true)

  reloj.avanzarMinutos(1)

  assert.equal(store.comprobarInactividad(reloj.ahora()), true)
})

test('el temporizador comprueba la inactividad y caduca la sesión al dispararse', async () => {
  const auth = crearAuthFalsa()
  const { store, reloj, programador } = montarSesion({ auth })

  await store.iniciarSesion('admin_seed', 'clave')
  reloj.avanzarMinutos(LIMITE_INACTIVIDAD_MINUTOS + 1)

  programador.disparar()

  assert.equal(store.sesionCaducada, true)
  assert.equal(store.token, null)
  assert.equal(programador.activo, false)
})

test('caducarSesion directa limpia la sesión y activa la bandera de caducidad', () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const { store } = montarSesion({ auth })

  store.caducarSesion()

  assert.equal(store.sesionCaducada, true)
  assert.equal(store.token, null)
  assert.equal(store.rol, null)
  assert.equal(auth.getToken(), null)
})

// --- ganchos de api.js (RF-07, RF-42, RF-43) ------------------------------

test('conectarServicios enlaza actividad y sesión expirada sin tocar api.js', async () => {
  const { store, reloj, ganchos } = montarSesion()

  store.conectarServicios()

  assert.equal(typeof ganchos.actividad, 'function')
  assert.equal(typeof ganchos.expirada, 'function')

  await store.iniciarSesion('admin_seed', 'clave')
  reloj.avanzarMinutos(5)
  ganchos.actividad()

  assert.equal(store.ultimaActividad, reloj.ahora().getTime())

  ganchos.expirada()

  assert.equal(store.sesionCaducada, true)
  assert.equal(store.token, null)
})

// --- contraseña propia tras el primer inicio de sesión ---------------------

test('iniciarSesion con contraseña asignada lleva a crear la contraseña propia', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: {
      token: tokenVigente(),
      rol: 'contador',
      id: 7,
      nombre: 'Ana',
      debeCambiarContrasena: true,
    },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('ana@delgrow.mx', 'AsignadaAdmin1')

  assert.equal(resultado.ok, true)
  assert.equal(resultado.pantallaPrincipal, RUTA_CAMBIO_CONTRASENA)
  assert.equal(store.debeCambiarContrasena, true)
})

test('iniciarSesion sin marca conserva la pantalla principal del perfil', async () => {
  const { store } = montarSesion()

  const resultado = await store.iniciarSesion('admin_seed', 'clave')

  assert.equal(resultado.pantallaPrincipal, '/admin/dashboard')
  assert.equal(store.debeCambiarContrasena, false)
})

test('al recargar con la marca guardada no se hace la lectura protegida y se va a crear la contraseña', async () => {
  const auth = crearAuthFalsa({
    inicial: {
      ...almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 7, nombre: 'Ana' }),
      [CLAVES_SESION.cambioPendiente]: '1',
    },
  })
  const { store, casos } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(resultado.pantallaPrincipal, RUTA_CAMBIO_CONTRASENA)
  assert.equal(casos.llamadas.length, 0, 'la API la bloquearía con 403')
  assert.equal(store.debeCambiarContrasena, true)
})

test('crearContrasenaPropia guarda la nueva, quita la marca y devuelve la pantalla del perfil', async () => {
  const auth = crearAuthFalsa({
    inicial: {
      ...almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 7, nombre: 'Ana' }),
      [CLAVES_SESION.cambioPendiente]: '1',
    },
  })
  const { store } = montarSesion({ auth })
  store.aplicarSesionGuardada()

  const resultado = await store.crearContrasenaPropia('MiClavePropia2')

  assert.deepEqual(resultado, { ok: true, pantallaPrincipal: '/contador/casos' })
  assert.deepEqual(auth.llamadas.at(-1), { accion: 'cambiarContrasena', password: 'MiClavePropia2' })
  assert.equal(store.debeCambiarContrasena, false)
})

test('crearContrasenaPropia con error lo devuelve y conserva la marca', async () => {
  const error = { estado: 'solicitud_invalida', mensaje: 'Contraseña inválida', codigoHttp: 400 }
  const auth = crearAuthFalsa({
    inicial: {
      ...almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 7, nombre: 'Ana' }),
      [CLAVES_SESION.cambioPendiente]: '1',
    },
    errorCambio: error,
  })
  const { store } = montarSesion({ auth })
  store.aplicarSesionGuardada()

  const resultado = await store.crearContrasenaPropia('Corta1')

  assert.deepEqual(resultado, { ok: false, error })
  assert.equal(store.debeCambiarContrasena, true)
})

test('limpiar la sesión también quita la marca de cambio pendiente', () => {
  const auth = crearAuthFalsa({
    inicial: {
      ...almacenConSesion({ token: tokenVigente(), rol: 'contador', id: 7, nombre: 'Ana' }),
      [CLAVES_SESION.cambioPendiente]: '1',
    },
  })
  const { store } = montarSesion({ auth })
  store.aplicarSesionGuardada()

  store.caducarSesion()

  assert.equal(store.debeCambiarContrasena, false)
  assert.equal(auth.almacen.getItem(CLAVES_SESION.cambioPendiente), null)
})
