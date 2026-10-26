// Pruebas del servicio de usuarios: alta de cuentas (historia 9a, con nombre y correo).
// Sin red: se inyecta una api falsa que registra las llamadas y devuelve
// respuestas con la forma real del backend.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearUserService } from '../src/services/userService.js'

// Api falsa: registra cada POST, PATCH y GET (estos con su método) y responde con el manejador recibido.
const crearApiFalsa = (responder) => {
  const llamadas = []
  return {
    llamadas,
    post: async (url, cuerpo) => {
      llamadas.push({ url, cuerpo })
      return responder(url, cuerpo)
    },
    patch: async (url, cuerpo) => {
      llamadas.push({ metodo: 'patch', url, cuerpo })
      return responder(url, cuerpo)
    },
    get: async (url) => {
      llamadas.push({ metodo: 'get', url })
      return responder(url)
    },
  }
}

test('crearUsuario envía nombre y correo a POST /usuarios, recortados y con el correo en minúsculas', async () => {
  const api = crearApiFalsa(() => ({
    status: 201,
    data: { mensaje: 'Usuario dado de alta correctamente' },
  }))
  const servicio = crearUserService({ api })

  const mensaje = await servicio.crearUsuario({
    nombre: '  Ana Karen Ramírez  ',
    correo: '  KRamirez@DelGrow.MX  ',
    password: ' clave segura ',
    rol: 'contador',
  })

  assert.equal(mensaje, 'Usuario dado de alta correctamente')
  assert.deepEqual(api.llamadas, [
    {
      url: '/usuarios',
      // El login recorta correo y contraseña; si el alta no lo hiciera, la cuenta no podría entrar.
      cuerpo: {
        nombre: 'Ana Karen Ramírez',
        correo: 'kramirez@delgrow.mx',
        password: 'clave segura',
        rol: 'contador',
      },
    },
  ])
})

test('restablecerContrasena envía correo y contraseña nueva a PATCH /usuarios/restablecer-contrasena y devuelve mensaje y cuentaPropia (historia 9b)', async () => {
  const api = crearApiFalsa(() => ({
    status: 200,
    data: { mensaje: 'Contraseña restablecida correctamente', cuentaPropia: true },
  }))
  const servicio = crearUserService({ api })

  const resultado = await servicio.restablecerContrasena({
    correo: '  KRamirez@DelGrow.MX  ',
    password: ' clave nueva ',
  })

  // `cuentaPropia` indica que la sesión actual ya quedó revocada en el backend.
  assert.deepEqual(resultado, { mensaje: 'Contraseña restablecida correctamente', cuentaPropia: true })
  assert.deepEqual(api.llamadas, [
    {
      metodo: 'patch',
      url: '/usuarios/restablecer-contrasena',
      // Igual que el login: correo recortado y en minúsculas, contraseña recortada.
      cuerpo: { correo: 'kramirez@delgrow.mx', password: 'clave nueva' },
    },
  ])
})

test('restablecerContrasena deja pasar el error del backend tal cual (p. ej. correo inexistente)', async () => {
  const errorBackend = {
    estado: 'no_encontrado',
    mensaje: 'No se encontró una cuenta con ese correo sobre correo: Verifique que el correo esté bien escrito',
    codigoHttp: 404,
    datos: null,
  }
  const api = crearApiFalsa(() => {
    throw errorBackend
  })
  const servicio = crearUserService({ api })

  await assert.rejects(
    servicio.restablecerContrasena({ correo: 'nadie@delgrow.mx', password: 'ClaveNueva2026' }),
    (error) => {
      assert.equal(error, errorBackend)
      return true
    },
  )
})

test('crearUsuario deja pasar el error del backend tal cual (p. ej. correo repetido)', async () => {
  const errorBackend = {
    estado: 'datos_invalidos',
    mensaje: 'El correo ya existe sobre correo: Use otro correo o restablezca la contraseña de esa cuenta',
    codigoHttp: 400,
    datos: null,
  }
  const api = crearApiFalsa(() => {
    throw errorBackend
  })
  const servicio = crearUserService({ api })

  await assert.rejects(
    servicio.crearUsuario({ nombre: 'Otra', correo: 'admin_seed@prueba.local', password: '12345678', rol: 'contador' }),
    (error) => {
      assert.equal(error, errorBackend)
      return true
    },
  )
})

test('listarUsuarios hace GET /usuarios y devuelve la lista de cuentas (directorio, rebanada 1)', async () => {
  const usuarios = [
    { id: 1, nombre: 'Ana Karen Ramírez', correo: 'kramirez@delgrow.mx', rol: 'contador', ultimo_acceso_en: null },
    { id: 2, nombre: 'Admin', correo: 'admin@delgrow.mx', rol: 'administrador', ultimo_acceso_en: '2026-10-26 09:00:00' },
  ]
  const api = crearApiFalsa(() => ({ status: 200, data: { usuarios } }))
  const servicio = crearUserService({ api })

  assert.deepEqual(await servicio.listarUsuarios(), usuarios)
  assert.deepEqual(api.llamadas, [{ metodo: 'get', url: '/usuarios' }])
})

test('listarUsuarios deja pasar el error del backend y rechaza con tres partes una respuesta sin lista', async () => {
  const errorBackend = { estado: 'sin_permiso', mensaje: 'Rol insuficiente sobre usuario autenticado: …', codigoHttp: 403, datos: null }
  const conError = crearUserService({
    api: crearApiFalsa(() => {
      throw errorBackend
    }),
  })
  await assert.rejects(conError.listarUsuarios(), (error) => {
    assert.equal(error, errorBackend)
    return true
  })

  const sinLista = crearUserService({ api: crearApiFalsa(() => ({ status: 200, data: {} })) })
  await assert.rejects(sinLista.listarUsuarios(), (error) => {
    assert.equal(error.estado, 'respuesta_inesperada')
    assert.ok(error.mensaje.includes('Qué ocurrió:') && error.mensaje.includes('Qué hacer:'))
    return true
  })
})
