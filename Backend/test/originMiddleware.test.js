const assert = require('node:assert');
const { describe, test } = require('node:test');
const { createOriginGuard } = require('../src/middlewares/originMiddleware');

/**
 * Pruebas del guard de orígenes con `req`/`res` simulados (RF-34, RF-23, criterios 24 y 28).
 *
 * Requieren que exista `src/middlewares/originMiddleware.js` (tarea T22).
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T21.
 *
 * No usan Express ni la base de datos: solo simulan la petición y la respuesta.
 */

const PERMITIDOS = ['http://localhost:9000', 'http://127.0.0.1:9000'];

function crearRes() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(datos) {
      this.body = datos;
      return this;
    },
  };
}

function crearNext() {
  let llamado = false;
  const next = function () {
    llamado = true;
  };
  next.llamado = () => llamado;
  return next;
}

// RF-34: una petición que no declara origen (scripts, pruebas) continúa
async function testSinOrigenLlamaANext() {
  const guard = createOriginGuard(PERMITIDOS);
  const req = { headers: {} };
  const res = crearRes();
  const next = crearNext();

  await guard(req, res, next);

  assert.strictEqual(next.llamado(), true, 'una petición sin origen debe llamar a next');
  assert.strictEqual(res.statusCode, 200, 'una petición sin origen no debe recibir error');
  assert.strictEqual(res.body, null, 'una petición sin origen no debe recibir un mensaje de error');
}

// RF-34: un origen local de desarrollo permitido continúa
async function testOrigenPermitidoLlamaANext() {
  const guard = createOriginGuard(PERMITIDOS);
  const req = { headers: { origin: 'http://localhost:9000' } };
  const res = crearRes();
  const next = crearNext();

  await guard(req, res, next);

  assert.strictEqual(next.llamado(), true, 'un origen permitido debe llamar a next');
  assert.strictEqual(res.statusCode, 200, 'un origen permitido no debe recibir error');
}

// RF-34, RF-23: un origen no permitido recibe 403 con las tres partes y no continúa
async function testOrigenNoPermitidoResponde403() {
  const guard = createOriginGuard(PERMITIDOS);
  const req = { headers: { origin: 'http://otro-sitio.example' } };
  const res = crearRes();
  const next = crearNext();

  await guard(req, res, next);

  assert.strictEqual(res.statusCode, 403, 'un origen no permitido debe recibir 403');
  assert.strictEqual(next.llamado(), false, 'un origen no permitido no debe llamar a next');
  assert.ok(res.body && typeof res.body.mensaje === 'string', 'debe responder un mensaje en español');

  const mensaje = res.body.mensaje;
  assert.ok(mensaje.includes('Origen no permitido'), 'falta la parte de qué ocurrió');
  assert.ok(mensaje.includes('origen de la petición'), 'falta la parte de sobre qué');
  assert.ok(
    mensaje.includes('Use la aplicación web de desarrollo autorizada'),
    'falta la parte de qué hacer'
  );
}

describe('originMiddleware', () => {
  test('testSinOrigenLlamaANext', testSinOrigenLlamaANext);
  test('testOrigenPermitidoLlamaANext', testOrigenPermitidoLlamaANext);
  test('testOrigenNoPermitidoResponde403', testOrigenNoPermitidoResponde403);
});
