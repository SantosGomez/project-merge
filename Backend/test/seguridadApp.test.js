const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { crearApp } = require('../src/app');
const { obtenerSecretoJwt } = require('../src/config/jwt');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');

/**
 * Pruebas de endurecimiento de la app (rebanada 5): cabeceras de seguridad,
 * sin `x-powered-by`, límite de intentos fallidos de inicio de sesión y
 * secreto JWT sin valor por defecto conocido.
 *
 * No dependen de la base de datos: el login se rechaza por cuerpo inválido
 * (400) antes de consultarla, y esas respuestas cuentan como intentos fallidos.
 */

const LOGIN_INVALIDO = { correo: '', contrasena: '' };

/**
 * Hace `veces` intentos de login inválidos y devuelve la última respuesta.
 * @param {number} puerto - Puerto del servidor.
 * @param {number} veces - Cantidad de intentos.
 * @returns {Promise<{statusCode: number, body: any}>} Última respuesta.
 */
async function intentarLoginInvalido(puerto, veces) {
  let respuesta;
  for (let i = 0; i < veces; i += 1) {
    respuesta = await peticion(puerto, 'POST', '/auth/login', LOGIN_INVALIDO);
  }
  return respuesta;
}

describe('cabeceras de seguridad', () => {
  let servidor;

  before(async () => {
    servidor = await iniciarServidor(crearApp({ limitarLogin: false }));
  });

  after(async () => {
    await servidor.cerrar();
  });

  test('no expone x-powered-by', async () => {
    const respuesta = await peticion(servidor.puerto, 'GET', '/no-existe');
    assert.strictEqual(respuesta.headers['x-powered-by'], undefined, 'no debe anunciar Express');
  });

  test('envía las cabeceras de helmet', async () => {
    const respuesta = await peticion(servidor.puerto, 'GET', '/no-existe');
    assert.strictEqual(respuesta.headers['x-content-type-options'], 'nosniff', 'debe impedir el sniffing de tipos');
    assert.ok(respuesta.headers['content-security-policy'], 'debe enviar Content-Security-Policy');
  });
});

describe('límite de intentos de inicio de sesión', () => {
  test('con limitarLogin, el intento 11 fallido en la ventana responde 429 en español', async () => {
    const servidor = await iniciarServidor(crearApp());
    try {
      const decimo = await intentarLoginInvalido(servidor.puerto, 10);
      assert.strictEqual(decimo.statusCode, 400, 'los primeros 10 intentos llegan al controlador');

      const onceavo = await intentarLoginInvalido(servidor.puerto, 1);
      assert.strictEqual(onceavo.statusCode, 429, 'el intento 11 debe bloquearse');
      assert.match(onceavo.body.mensaje, /minutos/, 'debe explicar el bloqueo y cuánto esperar');
    } finally {
      await servidor.cerrar();
    }
  });

  test('con limitarLogin: false no se bloquea', async () => {
    const servidor = await iniciarServidor(crearApp({ limitarLogin: false }));
    try {
      const respuesta = await intentarLoginInvalido(servidor.puerto, 12);
      assert.strictEqual(respuesta.statusCode, 400, 'sin límite el intento 12 sigue llegando al controlador');
    } finally {
      await servidor.cerrar();
    }
  });
});

describe('secreto JWT', () => {
  test('usa JWT_SECRET cuando está definido', () => {
    assert.strictEqual(obtenerSecretoJwt({ JWT_SECRET: 'secreto-propio' }), 'secreto-propio');
  });

  test('en producción sin JWT_SECRET falla al arrancar', () => {
    assert.throws(() => obtenerSecretoJwt({ NODE_ENV: 'production' }), /JWT_SECRET/);
  });

  test('en desarrollo sin JWT_SECRET usa un secreto aleatorio, nunca uno fijo', () => {
    const primero = obtenerSecretoJwt({});
    const segundo = obtenerSecretoJwt({});
    assert.ok(primero.length >= 32, 'el secreto aleatorio debe ser largo');
    assert.notStrictEqual(primero, segundo, 'cada arranque debe generar un secreto distinto');
    assert.notStrictEqual(primero, 'delgrow_secret_cambiar_en_produccion', 'no debe usar el secreto fijo de antes');
  });
});
