// Pruebas del store de sesión (RF-01 a RF-10, RF-42 a RF-47).
// Sin navegador y sin red: se inyectan authService, servicios, reloj y temporizador falsos.

import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { CLAVES_SESION } from '../src/services/api.js'
import {
  INTERVALO_INACTIVIDAD_MS,
  LIMITE_INACTIVIDAD_MINUTOS,
  LIMITE_INACTIVIDAD_PERSISTENTE_MINUTOS,
  RUTA_CAMBIO_CONTRASENA,
  TEXTO_AVISO_CIERRE,
  TEXTO_AVISO_REVOCACION,
  crearSessionStore,
} from '../src/stores/session.js'

// --- ayudas ----------------------------------------------------------------

const AHORA = new Date('2026-10-22T10:00:00.000Z')

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

// AuthService falso con almacén propio; registra login/logout y las lecturas del perfil.
const crearAuthFalsa = ({
  inicial = {},
  sesionLogin,
  errorLogin,
  resultadoLogout,
  errorCambio,
  errorPerfil,
  idPerfil,
} = {}) => {
  const almacen = crearAlmacenFalso(inicial)
  const llamadas = []

  const servicio = {
    almacen,
    llamadas,
    getRol: () => almacen.getItem(CLAVES_SESION.rol),
    getNombre: () => almacen.getItem(CLAVES_SESION.nombre),
    getId: () => almacen.getItem(CLAVES_SESION.id),
    getCambioPendiente: () => almacen.getItem(CLAVES_SESION.cambioPendiente) === '1',
    getPersistente: () => almacen.getItem(CLAVES_SESION.persistente) === '1',
    getActividades: () => almacen.getItem(CLAVES_SESION.actividades) === '1',
    setActividades: (habilitado) => escribir(almacen, CLAVES_SESION.actividades, habilitado ? '1' : null),
    setSesion: (sesion) => {
      escribir(almacen, CLAVES_SESION.rol, sesion.rol)
      escribir(almacen, CLAVES_SESION.nombre, sesion.nombre)
      escribir(almacen, CLAVES_SESION.id, sesion.id)
      escribir(almacen, CLAVES_SESION.cambioPendiente, sesion.debeCambiarContrasena ? '1' : null)
      escribir(almacen, CLAVES_SESION.persistente, sesion.persistente ? '1' : null)
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
    // GET /auth/perfil: con la cookie vigente devuelve la cuenta de la sesión (id guardado por defecto)
    async obtenerPerfil() {
      llamadas.push({ accion: 'obtenerPerfil' })
      if (errorPerfil) {
        throw errorPerfil
      }
      return { id: idPerfil ?? Number(almacen.getItem(CLAVES_SESION.id)) }
    },
    async login(correo, password, mantenerSesion = false) {
      llamadas.push({ accion: 'login', correo, password, mantenerSesion })
      if (errorLogin) {
        throw errorLogin
      }
      const sesion = sesionLogin ?? {
        rol: 'administrador',
        id: 5,
        nombre: correo,
        persistente: mantenerSesion,
      }
      servicio.setSesion(sesion)
      return sesion
    },
    async logout() {
      llamadas.push({ accion: 'logout' })
      return resultadoLogout ?? { ok: true, mensaje: 'Sesión cerrada correctamente' }
    },
  }

  return servicio
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
  const reloj = opciones.reloj ?? crearRelojFalso()
  const programador = opciones.programador ?? crearProgramadorFalso()
  const ganchos = { actividad: null, expirada: null }

  const useStore = crearSessionStore({
    authService: auth,
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

  return { store: useStore(), auth, reloj, programador, ganchos }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// --- arranque y lectura protegida (4.3, RF-42, RF-44) ---------------------

test('arranque sin perfil guardado: no hay sesión y no se llama al backend', async () => {
  const { store, auth } = montarSesion()

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'sin_sesion')
  assert.equal(store.autenticado, false)
  assert.equal(auth.llamadas.length, 0)
})

test('arranque con sesión vigente de administrador: valida con GET /auth/perfil y abre P-2', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, reloj, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.deepEqual(resultado.pantallaPrincipal, '/admin/dashboard')
  assert.deepEqual(auth.llamadas, [{ accion: 'obtenerPerfil' }])
  assert.equal(store.autenticado, true)
  assert.equal(store.rol, 'administrador')
  assert.equal(store.nombre, 'admin_seed')
  assert.equal(store.id, '5')
  assert.ok(!('token' in store.$state), 'el store no guarda ningún token')
  assert.equal(store.sesionCaducada, false)
  assert.equal(store.ultimaActividad, reloj.ahora().getTime())
  assert.equal(programador.activo, true)
  assert.equal(programador.intervaloMs, INTERVALO_INACTIVIDAD_MS)
})

test('arranque con sesión vigente de contador: valida con GET /auth/perfil y abre P-5', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(resultado.pantallaPrincipal, '/contador/casos')
  assert.deepEqual(auth.llamadas, [{ accion: 'obtenerPerfil' }])
  assert.equal(store.rol, 'contador')
})

test('arranque con 401 del backend: caduca y limpia la sesión (RF-43)', async () => {
  const auth = crearAuthFalsa({
    errorPerfil: ERROR_SIN_SESION,
    inicial: almacenConSesion({
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'caducada')
  assert.equal(resultado.error, ERROR_SIN_SESION)
  assert.equal(store.sesionCaducada, true)
  assert.equal(store.autenticado, false)
  assert.equal(auth.getRol(), null, 'el perfil se elimina del almacén')
  assert.equal(programador.activo, false)
})

test('arranque con error de red: error recuperable y la sesión sigue viva (4.3)', async () => {
  const auth = crearAuthFalsa({
    errorPerfil: ERROR_RED,
    inicial: almacenConSesion({
      rol: 'administrador',
      id: 5,
      nombre: 'admin_seed',
    }),
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'error')
  assert.equal(resultado.error, ERROR_RED)
  assert.equal(resultado.reintentar, true)
  assert.equal(store.sesionCaducada, false)
  assert.equal(store.autenticado, true, 'el perfil NO se borra con un error de red')
  assert.notEqual(auth.getRol(), null)
  assert.equal(programador.activo, false)
})

test('arranque con error del servidor: error recuperable y sin borrar la sesión', async () => {
  const auth = crearAuthFalsa({
    errorPerfil: ERROR_SERVIDOR,
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'error')
  assert.equal(store.autenticado, true)
  assert.equal(store.sesionCaducada, false)
})

test('arranque del usuario de sistema: valida con el perfil y abre el directorio de usuarios (9a)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      rol: 'usuarios_de_sistema',
      id: 8,
      nombre: 'sistema',
    }),
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(resultado.pantallaPrincipal, '/admin/directorio')
  // No tiene lectura propia: el perfil acepta cualquier sesión y solo comprueba la cookie.
  assert.deepEqual(auth.llamadas, [{ accion: 'obtenerPerfil' }])
  assert.equal(store.esUsuarioSistema, true)
  assert.equal(programador.activo, true)
})

test('arranque con la cookie de otra cuenta (otra pestaña inició sesión): caduca sin mostrar datos ajenos', async () => {
  const auth = crearAuthFalsa({
    idPerfil: 99,
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'caducada')
  assert.equal(store.sesionCaducada, true)
  assert.equal(store.autenticado, false)
  assert.equal(auth.getRol(), null)
  assert.equal(programador.activo, false)
})

test('arranque con un perfil sin pantalla: acceso denegado y sin lectura protegida', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
      rol: 'invitado',
      id: 8,
      nombre: 'invitado',
    }),
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'acceso_denegado')
  assert.equal(resultado.rol, 'invitado')
  assert.equal(auth.llamadas.length, 0)
  assert.equal(store.tienePantalla, false)
  assert.equal(store.pantallaPrincipal, null)
  assert.equal(programador.activo, false)
})

// --- inicio de sesión (RF-01 a RF-10) -------------------------------------

test('iniciarSesion guarda el nombre de la cuenta para mostrarlo en el menú', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { rol: 'contador', id: 7, nombre: 'Ana Karen Ramírez' },
  })
  const { store } = montarSesion({ auth })

  await store.iniciarSesion('ana@delgrow.mx', 'clave')

  assert.equal(store.nombre, 'Ana Karen Ramírez')
  assert.equal(store.nombreVisible, 'Ana Karen Ramírez')
})

test('la sesión ya no expone el usuario: el nombre visible es solo el nombre (5b)', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { rol: 'contador', id: 7, nombre: 'Ana Karen Ramírez' },
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
  assert.equal(store.rol, 'administrador')
  assert.equal(store.nombre, 'admin_seed')
  assert.equal(store.ultimaActividad, reloj.ahora().getTime())
  assert.equal(programador.activo, true)
  assert.equal(auth.llamadas.filter((llamada) => llamada.accion === 'logout').length, 0)
})

test('iniciarSesion con sesión previa: no llama a logout, el backend revoca la cookie anterior (RF-10, S8)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
    sesionLogin: { rol: 'administrador', id: 5, nombre: 'admin_seed' },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.iniciarSesion('admin_seed', 'clave')

  assert.equal(resultado.ok, true)
  assert.deepEqual(
    auth.llamadas.map((llamada) => llamada.accion),
    ['login'],
    'el frontend ya no tiene el token anterior: la revocación la hace el backend con la cookie',
  )
  assert.equal(store.rol, 'administrador', 'el store queda con la sesión nueva')
})

test('iniciarSesion con credenciales inválidas conserva la sesión previa y no revoca nada', async () => {
  const error = {
    estado: 'credenciales_invalidas',
    mensaje: 'Credenciales no válidas sobre usuario o contraseña: verifique sus datos',
    codigoHttp: 401,
    datos: null,
  }
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
    errorLogin: error,
  })
  const { store } = montarSesion({ auth })
  store.aplicarSesionGuardada()

  const resultado = await store.iniciarSesion('otra', 'mala')

  assert.equal(resultado.ok, false)
  assert.equal(resultado.error, error)
  assert.equal(auth.llamadas.filter((llamada) => llamada.accion === 'logout').length, 0)
  assert.equal(store.autenticado, true, 'no se pierde la sesión activa (Constitución, principio 3)')
  assert.equal(store.rol, 'contador')
})

test('iniciarSesion del usuario de sistema lleva al directorio de usuarios y arranca el temporizador (9a)', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { rol: 'usuarios_de_sistema', id: 8, nombre: 'sistema' },
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
    sesionLogin: { rol: 'invitado', id: 8, nombre: 'invitado' },
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

test('cerrarSesionVoluntaria con logout correcto: aviso de sesión cerrada y perfil eliminado', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({
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
  assert.equal(store.autenticado, false)
  assert.equal(store.autenticado, false)
  assert.equal(store.sesionCaducada, false)
  assert.equal(auth.getRol(), null)
  assert.equal(programador.activo, false)
})

test('cerrarSesionVoluntaria con logout fallido: cierre local igual y aviso de tres partes (RF-47)', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
    resultadoLogout: { ok: false, error: ERROR_RED },
  })
  const { store, programador } = montarSesion({ auth })

  const resultado = await store.cerrarSesionVoluntaria()

  assert.equal(resultado.ok, false)
  assert.equal(store.autenticado, false, 'el cierre local se hace igual')
  assert.equal(auth.getRol(), null)
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
    inicial: almacenConSesion({ rol: 'usuarios_de_sistema', id: 7, nombre: 'sis' }),
  })
  const { store, programador } = montarSesion({ auth })
  store.iniciarTemporizador()

  store.cerrarSesionPorContrasenaNueva()

  // El backend ya revocó el token al restablecer: llamar a logout solo daría 401.
  assert.deepEqual(auth.llamadas, [], 'no llama a logout')
  assert.equal(store.autenticado, false)
  assert.equal(store.autenticado, false)
  assert.equal(auth.getRol(), null)
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
  assert.equal(store.autenticado, false)
  assert.equal(auth.getRol(), null)
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
  assert.equal(store.autenticado, false)
  assert.equal(programador.activo, false)
})

test('caducarSesion directa limpia la sesión y activa la bandera de caducidad', () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'contador', id: 3, nombre: 'ana' }),
  })
  const { store } = montarSesion({ auth })

  store.caducarSesion()

  assert.equal(store.sesionCaducada, true)
  assert.equal(store.autenticado, false)
  assert.equal(store.rol, null)
  assert.equal(auth.getRol(), null)
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
  assert.equal(store.autenticado, false)
})

// --- contraseña propia tras el primer inicio de sesión ---------------------

test('iniciarSesion con contraseña asignada lleva a crear la contraseña propia', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: {
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
      ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'Ana' }),
      [CLAVES_SESION.cambioPendiente]: '1',
    },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(resultado.pantallaPrincipal, RUTA_CAMBIO_CONTRASENA)
  assert.equal(auth.llamadas.length, 0, 'la API la bloquearía con 403')
  assert.equal(store.debeCambiarContrasena, true)
})

test('crearContrasenaPropia guarda la nueva, quita la marca y devuelve la pantalla del perfil', async () => {
  const auth = crearAuthFalsa({
    inicial: {
      ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'Ana' }),
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
      ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'Ana' }),
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
      ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'Ana' }),
      [CLAVES_SESION.cambioPendiente]: '1',
    },
  })
  const { store } = montarSesion({ auth })
  store.aplicarSesionGuardada()

  store.caducarSesion()

  assert.equal(store.debeCambiarContrasena, false)
  assert.equal(auth.almacen.getItem(CLAVES_SESION.cambioPendiente), null)
})

// --- «Mantener sesión iniciada» --------------------------------------------

test('iniciarSesion pasa la casilla al servicio y recuerda que la sesión es persistente', async () => {
  const auth = crearAuthFalsa()
  const { store } = montarSesion({ auth })

  await store.iniciarSesion('admin_seed', 'clave', true)

  assert.equal(auth.llamadas[0].mantenerSesion, true)
  assert.equal(store.persistente, true)
})

test('una sesión persistente no caduca a los 30 minutos sino tras 7 días sin actividad', async () => {
  const auth = crearAuthFalsa()
  const { store, reloj } = montarSesion({ auth })

  await store.iniciarSesion('admin_seed', 'clave', true)
  reloj.avanzarMinutos(LIMITE_INACTIVIDAD_MINUTOS + 1)
  assert.equal(store.comprobarInactividad(reloj.ahora()), false, 'sigue abierta tras 31 minutos')

  reloj.avanzarMinutos(LIMITE_INACTIVIDAD_PERSISTENTE_MINUTOS)
  assert.equal(store.comprobarInactividad(reloj.ahora()), true, 'caduca pasados 7 días')
  assert.equal(store.persistente, false)
})

test('sin la casilla la sesión no es persistente y caduca a los 30 minutos como antes', async () => {
  const auth = crearAuthFalsa()
  const { store, reloj } = montarSesion({ auth })

  await store.iniciarSesion('admin_seed', 'clave')
  assert.equal(auth.llamadas[0].mantenerSesion, false)
  assert.equal(store.persistente, false)

  reloj.avanzarMinutos(LIMITE_INACTIVIDAD_MINUTOS + 1)
  assert.equal(store.comprobarInactividad(reloj.ahora()), true)
})

test('al reabrir la app una sesión persistente guardada se restaura como persistente', async () => {
  const auth = crearAuthFalsa({
    inicial: {
      ...almacenConSesion({ rol: 'administrador', id: 5, nombre: 'admin_seed' }),
      [CLAVES_SESION.persistente]: '1',
    },
  })
  const { store } = montarSesion({ auth })

  const resultado = await store.restaurarSesion()

  assert.equal(resultado.estado, 'valida')
  assert.equal(store.persistente, true)
})

// --- «Mis actividades» solo para las cuentas habilitadas ------------------------

test('«Mis actividades»: sin la marca guardada la cuenta no tiene el módulo', () => {
  const auth = crearAuthFalsa({ inicial: almacenConSesion({ rol: 'contador', id: 7, nombre: 'c' }) })
  const { store } = montarSesion({ auth })

  assert.equal(store.actividadesHabilitadas, false)
})

test('«Mis actividades»: con la marca guardada la cuenta tiene el módulo', () => {
  const auth = crearAuthFalsa({
    inicial: { ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'c' }), [CLAVES_SESION.actividades]: '1' },
  })
  const { store } = montarSesion({ auth })

  assert.equal(store.actividadesHabilitadas, true)
})

test('«Mis actividades»: al restaurar la sesión el perfil del backend manda sobre la marca guardada', async () => {
  const auth = crearAuthFalsa({
    inicial: { ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'c' }), [CLAVES_SESION.actividades]: '1' },
  })
  auth.obtenerPerfil = async () => ({ id: 7, actividades_habilitadas: false })
  const { store } = montarSesion({ auth })

  await store.restaurarSesion()

  assert.equal(store.actividadesHabilitadas, false)
  assert.equal(auth.getActividades(), false, 'la marca guardada también se corrige')
})

test('«Mis actividades»: si el perfil la habilita, el store y la marca guardada la reflejan', async () => {
  const auth = crearAuthFalsa({ inicial: almacenConSesion({ rol: 'contador', id: 7, nombre: 'c' }) })
  auth.obtenerPerfil = async () => ({ id: 7, actividades_habilitadas: true })
  const { store } = montarSesion({ auth })

  await store.restaurarSesion()

  assert.equal(store.actividadesHabilitadas, true)
  assert.equal(auth.getActividades(), true)
})

test('«Mis actividades»: al caducar la sesión el estado vuelve a «no habilitado»', () => {
  const auth = crearAuthFalsa({
    inicial: { ...almacenConSesion({ rol: 'contador', id: 7, nombre: 'c' }), [CLAVES_SESION.actividades]: '1' },
  })
  const { store } = montarSesion({ auth })

  store.caducarSesion()

  assert.equal(store.actividadesHabilitadas, false)
})

// --- administradores que atiende la recepcionista (rebanada 28) -----------------

const ATENDIDOS = [{ id: 11, nombre: 'Ana Administradora' }]

test('administradores atendidos: sin sesión nueva no hay ninguno', () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'recepcionista', id: 7, nombre: 'r' }),
  })
  const { store } = montarSesion({ auth })

  assert.deepEqual(store.administradoresAtendidos, [])
})

test('administradores atendidos: el login los guarda en el store', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { rol: 'recepcionista', id: 7, nombre: 'r', administradoresAtendidos: ATENDIDOS },
  })
  const { store } = montarSesion({ auth })

  await store.iniciarSesion('rosa@delgrow.mx', 'clave')

  assert.deepEqual(store.administradoresAtendidos, ATENDIDOS)
})

test('administradores atendidos: al restaurar la sesión el perfil del backend los fija', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'recepcionista', id: 7, nombre: 'r' }),
  })
  auth.obtenerPerfil = async () => ({ id: 7, administradores_atendidos: ATENDIDOS })
  const { store } = montarSesion({ auth })

  await store.restaurarSesion()

  assert.deepEqual(store.administradoresAtendidos, ATENDIDOS)
})

test('administradores atendidos: un perfil sin la llave los deja vacíos', async () => {
  const auth = crearAuthFalsa({
    inicial: almacenConSesion({ rol: 'contador', id: 7, nombre: 'c' }),
  })
  const { store } = montarSesion({ auth })

  await store.restaurarSesion()

  assert.deepEqual(store.administradoresAtendidos, [])
})

test('administradores atendidos: al cerrar o caducar la sesión se limpian', async () => {
  const auth = crearAuthFalsa({
    sesionLogin: { rol: 'recepcionista', id: 7, nombre: 'r', administradoresAtendidos: ATENDIDOS },
  })
  const { store } = montarSesion({ auth })
  await store.iniciarSesion('rosa@delgrow.mx', 'clave')

  await store.cerrarSesionVoluntaria()
  assert.deepEqual(store.administradoresAtendidos, [])

  await store.iniciarSesion('rosa@delgrow.mx', 'clave')
  store.caducarSesion()
  assert.deepEqual(store.administradoresAtendidos, [])
})
