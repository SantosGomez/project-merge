// Pruebas del servicio de usuarios: alta de cuentas (historia 9a, con nombre y correo).
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
