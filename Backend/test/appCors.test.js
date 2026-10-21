const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { crearApp } = require('../src/app');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');

/**
 * Pruebas de CORS sobre la app real (RF-34, criterios 24 y 28).
 *
 * Requieren que `crearApp({ origenesPermitidos })` aplique el guard de orígenes
 * y las cabeceras CORS (tarea T24). Mientras `app.js` siga usando `cors()` sin
 * opciones, las pruebas de rechazo fallan (en rojo), que es el estado esperado
 * de la tarea T23.
 *
 * No dependen de la base de datos: las peticiones protegidas se rechazan por
 * falta de token antes de consultarla. No crean usuarios ni casos.
 */

const PERMITIDOS = ['http://localhost:9000', 'http://127.0.0.1:9000'];
const RUTA_PROTEGIDA = '/contadores';

let servidor;

before(async () => {
  servidor = await iniciarServidor(crearApp({ origenesPermitidos: PERMITIDOS }));
});

after(async () => {
  await servidor.cerrar();
});

/**
 * Busca la cabecera CORS del origen permitido en una respuesta.
 * @param {Object} cabeceras - cabeceras de la respuesta HTTP.
 * @returns {string|undefined} valor de `Access-Control-Allow-Origin`.
 */
function origenPermitidoDeRespuesta(cabeceras) {
  return cabeceras['access-control-allow-origin'];
}

// RF-34: un origen local permitido recibe la cabecera CORS con su propio origen
async function testOrigenPermitidoRecibeSuOrigen() {
  const origen = 'http://localhost:9000';
  const respuesta = await peticion(servidor.puerto, 'GET', RUTA_PROTEGIDA, null, null, {
    Origin: origen,
  });

  assert.strictEqual(
    origenPermitidoDeRespuesta(respuesta.headers),
    origen,
    'un origen permitido debe recibir su propio origen en Access-Control-Allow-Origin'
  );
}

// RF-34: un origen de otro sitio se rechaza y no puede leer la respuesta
async function testOrigenDeOtroSitioEsRechazado() {
  const respuesta = await peticion(servidor.puerto, 'GET', RUTA_PROTEGIDA, null, null, {
    Origin: 'http://otro-sitio.example',
  });

  assert.strictEqual(respuesta.statusCode, 403, 'un origen de otro sitio debe recibir 403');
  assert.strictEqual(
    origenPermitidoDeRespuesta(respuesta.headers),
    undefined,
    'un origen no permitido no debe recibir la cabecera Access-Control-Allow-Origin'
  );
}

// RF-34: un puerto local que no está en la lista también se rechaza
async function testPuertoLocalNoListadoEsRechazado() {
  const respuesta = await peticion(servidor.puerto, 'GET', RUTA_PROTEGIDA, null, null, {
    Origin: 'http://localhost:9001',
  });

  assert.strictEqual(respuesta.statusCode, 403, 'un puerto local no listado debe recibir 403');
  assert.strictEqual(
    origenPermitidoDeRespuesta(respuesta.headers),
    undefined,
    'un puerto local no listado no debe recibir la cabecera Access-Control-Allow-Origin'
  );
}

// RF-34, RF-04: sin origen la petición llega al control de acceso y exige token
async function testSinOrigenLlegaAlControlDeAcceso() {
  const respuesta = await peticion(servidor.puerto, 'GET', RUTA_PROTEGIDA);

  assert.strictEqual(
    respuesta.statusCode,
    401,
    'una petición sin origen a un endpoint protegido y sin token debe recibir 401'
  );
}

// RF-34: el preflight de un origen permitido responde con las cabeceras CORS
async function testPreflightOrigenPermitidoDevuelveCabeceras() {
  const origen = 'http://127.0.0.1:9000';
  const respuesta = await peticion(servidor.puerto, 'OPTIONS', RUTA_PROTEGIDA, null, null, {
    Origin: origen,
    'Access-Control-Request-Method': 'GET',
  });

  assert.strictEqual(respuesta.statusCode, 204, 'el preflight de un origen permitido debe responder 204');
  assert.strictEqual(
    origenPermitidoDeRespuesta(respuesta.headers),
    origen,
    'el preflight de un origen permitido debe devolver su propio origen'
  );
  assert.ok(
    typeof respuesta.headers['access-control-allow-methods'] === 'string',
    'el preflight debe indicar los métodos permitidos'
  );
}

// RF-34: el preflight de un origen no permitido se rechaza sin cabeceras CORS
async function testPreflightOrigenNoPermitidoEsRechazado() {
  const respuesta = await peticion(servidor.puerto, 'OPTIONS', RUTA_PROTEGIDA, null, null, {
    Origin: 'http://otro-sitio.example',
    'Access-Control-Request-Method': 'GET',
  });

  assert.strictEqual(respuesta.statusCode, 403, 'el preflight de un origen no permitido debe responder 403');
  assert.strictEqual(
    origenPermitidoDeRespuesta(respuesta.headers),
    undefined,
    'el preflight de un origen no permitido no debe recibir cabeceras CORS'
  );
}

describe('appCors', () => {
  test('testOrigenPermitidoRecibeSuOrigen', testOrigenPermitidoRecibeSuOrigen);
  test('testOrigenDeOtroSitioEsRechazado', testOrigenDeOtroSitioEsRechazado);
  test('testPuertoLocalNoListadoEsRechazado', testPuertoLocalNoListadoEsRechazado);
  test('testSinOrigenLlegaAlControlDeAcceso', testSinOrigenLlegaAlControlDeAcceso);
  test('testPreflightOrigenPermitidoDevuelveCabeceras', testPreflightOrigenPermitidoDevuelveCabeceras);
  test('testPreflightOrigenNoPermitidoEsRechazado', testPreflightOrigenNoPermitidoEsRechazado);
});
