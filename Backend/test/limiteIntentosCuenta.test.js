const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { crearLimitadorCuenta } = require('../src/middlewares/limiteCuentaMiddleware');
const { crearApp } = require('../src/app');
const { pool } = require('../src/config/db');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');

/**
 * Bloqueo por cuenta (S2): 5 intentos fallidos por correo en 15 minutos → 429,
 * exista o no la cuenta. No requiere cuentas reales.
 */

describe('limitador por cuenta (unidad)', () => {
  test('bloquea al quinto fallo y libera al pasar la ventana', () => {
    let ahora = 1000;
    const limitador = crearLimitadorCuenta({ max: 5, ventanaMs: 900000, ahora: () => ahora });
    for (let i = 0; i < 4; i++) limitador.registrarFallo('A@x.mx');
    assert.strictEqual(limitador.bloqueado('a@x.mx'), false);
    limitador.registrarFallo(' a@X.mx ');
    assert.strictEqual(limitador.bloqueado('a@x.mx'), true, 'mayúsculas y espacios cuentan como el mismo correo');
    assert.strictEqual(limitador.bloqueado('otra@x.mx'), false);
    ahora += 900001;
    assert.strictEqual(limitador.bloqueado('a@x.mx'), false);
  });

  test('un inicio de sesión correcto reinicia el contador', () => {
    const limitador = crearLimitadorCuenta({ max: 5, ventanaMs: 900000 });
    for (let i = 0; i < 4; i++) limitador.registrarFallo('b@x.mx');
    limitador.limpiar('b@x.mx');
    limitador.registrarFallo('b@x.mx');
    assert.strictEqual(limitador.bloqueado('b@x.mx'), false);
  });

  test('ignora valores que no son texto', () => {
    const limitador = crearLimitadorCuenta({ max: 1, ventanaMs: 1000 });
    limitador.registrarFallo(undefined);
    limitador.registrarFallo({ a: 1 });
    assert.strictEqual(limitador.bloqueado(undefined), false);
  });
});

describe('POST /auth/login con bloqueo por cuenta', () => {
  let servidor;
  before(async () => {
    servidor = await iniciarServidor(crearApp());
  });
  after(async () => {
    await servidor.cerrar();
    await pool.end();
  });

  test('al sexto intento sobre un correo inexistente responde 429 en tres partes', async () => {
    const cuerpo = { correo: 'zz_test_no_existe@prueba.local', password: 'ClaveIncorrecta123' };
    for (let i = 0; i < 5; i++) {
      const r = await peticion(servidor.puerto, 'POST', '/auth/login', cuerpo);
      assert.strictEqual(r.statusCode, 401, `intento ${i + 1}`);
    }
    const bloqueado = await peticion(servidor.puerto, 'POST', '/auth/login', cuerpo);
    assert.strictEqual(bloqueado.statusCode, 429);
    assert.match(bloqueado.body.mensaje, /^Demasiados intentos fallidos sobre .+: .+/);
    assert.ok(!/existe|encontr/i.test(bloqueado.body.mensaje), 'no revela si el correo existe');
  });
});
