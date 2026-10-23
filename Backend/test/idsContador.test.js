const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const { parseCounterId } = require('../src/utils/validationUtils');

/**
 * Pruebas de los identificadores que no corresponden a un contador.
 * RF-35, RF-14, RF-16, criterio 29.
 *
 * Dos bloques: los casos puros de `parseCounterId` (función pura que valida el
 * identificador antes de consultar la base de datos) y las peticiones HTTP reales
 * a `GET /contadores/:id/conteos` y `GET /contadores/:id/casos` con token de
 * administrador.
 *
 * Levanta la aplicación real en un puerto libre y hace peticiones HTTP reales.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea su propio administrador, su
 * propio contador y su propio usuario de sistema con prefijo `zz_test_`; el id
 * inexistente se calcula en vez de fijarlo y el `after` borra solo lo que este
 * proceso registró y cierra el pool.
 */

let servidor;
let administrador;
let contador;
let usuarioSistema;
let tokenAdmin;

/**
 * Inicia sesión con un usuario de la prueba y devuelve su token de acceso.
 * @param {{usuario: string, password: string}} cuenta - Cuenta de la prueba.
 * @returns {Promise<string>} Token de acceso.
 */
async function iniciarSesionDe(cuenta) {
  return iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
}

/**
 * Calcula un id de usuario que no existe: el máximo actual más un margen amplio.
 * Evita depender de un número fijo (aislamiento, plan 9.3).
 * @returns {Promise<number>} Id de usuario inexistente.
 */
async function idDeUsuarioInexistente() {
  const filas = await query('SELECT COALESCE(MAX(id), 0) + 1000 AS id FROM usuarios');
  return Number(filas[0].id);
}

// ---------- RF-35: `parseCounterId` acepta solo un entero positivo ----------
async function testParseCounterIdAceptaEnteroPositivo() {
  assert.strictEqual(
    typeof parseCounterId,
    'function',
    'parseCounterId debe existir en validationUtils para validar el identificador (RF-35)'
  );
  assert.strictEqual(parseCounterId('12'), 12, 'debe devolver el número de un identificador válido');
  assert.strictEqual(parseCounterId('7'), 7, 'debe devolver el número de un identificador válido');
}

// ---------- RF-35: `parseCounterId` rechaza lo que no es un entero positivo ----------
async function testParseCounterIdRechazaValoresNoNumericos() {
  assert.strictEqual(
    typeof parseCounterId,
    'function',
    'parseCounterId debe existir en validationUtils para validar el identificador (RF-35)'
  );

  const rechazados = ['abc', '2abc', '', '-1', '1.5'];
  for (const valor of rechazados) {
    assert.strictEqual(
      parseCounterId(valor),
      null,
      `parseCounterId debe rechazar ${JSON.stringify(valor)} y devolver null`
    );
  }
}

// ---------- RF-35, RF-16, criterio 29: el id de un administrador no es un contador ----------
async function testIdDeAdministradorNoEsContador() {
  const conteos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${administrador.id}/conteos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(conteos.statusCode, 404, 'el id de un administrador debe responder 404 en conteos');
  assert.ok(
    conteos.body.mensaje.includes('No se encontró el contador'),
    'el mensaje debe indicar que no se encontró el contador'
  );
  assert.strictEqual(conteos.body.pendiente, undefined, 'no debe devolver conteos de un administrador');

  const casos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${administrador.id}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(casos.statusCode, 404, 'el id de un administrador debe responder 404 en casos');
  assert.ok(
    casos.body.mensaje.includes('No se encontró el contador'),
    'el mensaje debe indicar que no se encontró el contador'
  );
  assert.strictEqual(casos.body.casos, undefined, 'no debe devolver casos de un administrador');
}

// ---------- RF-35, RF-16, criterio 29: el id de un usuario de sistema no es un contador ----------
async function testIdDeUsuarioDeSistemaNoEsContador() {
  const conteos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${usuarioSistema.id}/conteos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(conteos.statusCode, 404, 'el id de un usuario de sistema debe responder 404 en conteos');
  assert.ok(
    conteos.body.mensaje.includes('No se encontró el contador'),
    'el mensaje debe indicar que no se encontró el contador'
  );
  assert.strictEqual(conteos.body.pendiente, undefined, 'no debe devolver conteos de un usuario de sistema');

  const casos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${usuarioSistema.id}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(casos.statusCode, 404, 'el id de un usuario de sistema debe responder 404 en casos');
  assert.ok(
    casos.body.mensaje.includes('No se encontró el contador'),
    'el mensaje debe indicar que no se encontró el contador'
  );
  assert.strictEqual(casos.body.casos, undefined, 'no debe devolver casos de un usuario de sistema');
}

// ---------- RF-16: un id inexistente responde 404 en los dos endpoints ----------
async function testIdInexistenteResponde404() {
  const idInexistente = await idDeUsuarioInexistente();

  const conteos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${idInexistente}/conteos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(conteos.statusCode, 404, 'un id inexistente debe responder 404 en conteos');
  assert.ok(
    conteos.body.mensaje.includes('No se encontró el contador'),
    'el mensaje debe indicar que no se encontró el contador'
  );
  assert.strictEqual(conteos.body.pendiente, undefined, 'no debe devolver conteos de un id inexistente');

  const casos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${idInexistente}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(casos.statusCode, 404, 'un id inexistente debe responder 404 en casos');
  assert.ok(
    casos.body.mensaje.includes('No se encontró el contador'),
    'el mensaje debe indicar que no se encontró el contador'
  );
  assert.strictEqual(casos.body.casos, undefined, 'no debe devolver casos de un id inexistente');
}

// ---------- RF-35: un id no numérico o negativo responde 404 en los dos endpoints ----------
async function testIdNoNumericoYNegativoResponde404() {
  const ids = ['abc', '2abc', '-1'];

  for (const id of ids) {
    const conteos = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${id}/conteos`,
      null,
      tokenAdmin
    );
    assert.strictEqual(conteos.statusCode, 404, `el id ${id} debe responder 404 en conteos`);
    assert.ok(
      conteos.body.mensaje.includes('No se encontró el contador'),
      `el id ${id} debe avisar que no se encontró el contador`
    );
    assert.strictEqual(conteos.body.pendiente, undefined, `el id ${id} no debe devolver conteos`);

    const casos = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${id}/casos`,
      null,
      tokenAdmin
    );
    assert.strictEqual(casos.statusCode, 404, `el id ${id} debe responder 404 en casos`);
    assert.ok(
      casos.body.mensaje.includes('No se encontró el contador'),
      `el id ${id} debe avisar que no se encontró el contador`
    );
    assert.strictEqual(casos.body.casos, undefined, `el id ${id} no debe devolver casos`);
  }
}

// ---------- RF-13, RF-14: el id de un contador real sigue devolviendo 200 ----------
async function testIdDeContadorRealDevuelveConteosYCasos() {
  const conteos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contador.id}/conteos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(conteos.statusCode, 200, 'el id de un contador real debe responder 200 en conteos');
  assert.strictEqual(conteos.body.pendiente, 1, 'debe contar el caso propio pendiente');
  assert.strictEqual(conteos.body.en_proceso, 0, 'debe devolver cero cuando no hay casos En proceso (RF-13)');
  assert.strictEqual(conteos.body.finalizado, 0, 'debe devolver cero cuando no hay casos Finalizado (RF-13)');

  const casos = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contador.id}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(casos.statusCode, 200, 'el id de un contador real debe responder 200 en casos');
  assert.ok(Array.isArray(casos.body.casos), 'debe devolver un array de casos');
  assert.strictEqual(casos.body.casos.length, 1, 'debe devolver exactamente el caso propio del contador');
  assert.strictEqual(casos.body.casos[0].contador_id, contador.id, 'el caso debe pertenecer al contador consultado');
  assert.strictEqual(casos.body.casos[0].cliente, 'Cliente de ids', 'debe devolver el detalle del caso propio');
}

describe('identificadores de contador', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    usuarioSistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesionDe(administrador);

    // Un caso propio del contador para que sus conteos y sus casos no estén vacíos.
    await crearCasoDePrueba(contador.id, { cliente: 'Cliente de ids', estado: 'Pendiente' });
  });

  after(async () => {
    if (servidor) {
      await servidor.cerrar();
    }
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('parseCounterId devuelve el número cuando el identificador es un entero positivo', testParseCounterIdAceptaEnteroPositivo);
  test('parseCounterId rechaza con null los identificadores que no son un entero positivo', testParseCounterIdRechazaValoresNoNumericos);
  test('el id de un administrador no se trata como un contador', testIdDeAdministradorNoEsContador);
  test('el id de un usuario de sistema no se trata como un contador', testIdDeUsuarioDeSistemaNoEsContador);
  test('un id inexistente responde 404 en conteos y en casos', testIdInexistenteResponde404);
  test('un id no numérico o negativo responde 404 en conteos y en casos', testIdNoNumericoYNegativoResponde404);
  test('el id de un contador real devuelve sus conteos y sus casos', testIdDeContadorRealDevuelveConteosYCasos);
});
