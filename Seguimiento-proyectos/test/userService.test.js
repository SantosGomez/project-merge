// Pruebas del servicio de usuarios: alta de cuentas (historia 9a).
// Sin red: se inyecta una api falsa que registra las llamadas y devuelve
// respuestas con la forma real del backend.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearUserService } from '../src/services/userService.js'

// Api falsa: registra cada POST y responde con el manejador recibido.
const crearApiFalsa = (responder) => {
  const llamadas = []
  return {
    llamadas,
    post: async (url, cuerpo) => {
      llamadas.push({ url, cuerpo })
      return responder(url, cuerpo)
    },
  }
}

test('crearUsuario envía el alta a POST /usuarios con usuario y contraseña sin espacios extremos', async () => {
  const api = crearApiFalsa(() => ({
    status: 201,
    data: { mensaje: 'Usuario dado de alta correctamente' },
  }))
  const servicio = crearUserService({ api })

  const mensaje = await servicio.crearUsuario('  nuevo_contador  ', ' clave segura ', 'contador')

  assert.equal(mensaje, 'Usuario dado de alta correctamente')
  assert.deepEqual(api.llamadas, [
    {
      url: '/usuarios',
      // El login recorta usuario y contraseña; si el alta no lo hiciera, la cuenta no podría entrar.
      cuerpo: { usuario: 'nuevo_contador', password: 'clave segura', rol: 'contador' },
    },
  ])
})

test('crearUsuario deja pasar el error del backend tal cual (p. ej. usuario repetido)', async () => {
  const errorBackend = {
    estado: 'datos_invalidos',
    mensaje: 'El usuario ya existe sobre usuario: Elija otro nombre de usuario',
    codigoHttp: 400,
    datos: null,
  }
  const api = crearApiFalsa(() => {
    throw errorBackend
  })
  const servicio = crearUserService({ api })

  await assert.rejects(servicio.crearUsuario('Admin_Seed', '12345678', 'contador'), (error) => {
    assert.equal(error, errorBackend)
    return true
  })
})
