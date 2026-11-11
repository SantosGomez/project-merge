const assert = require('node:assert');
const { describe, test, before, after, beforeEach } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración de las rutas de auxiliares:
 * listar, asignar, quitar, contadores que me tienen como auxiliar y disponibles.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let dueno;
let auxiliarUno;
let auxiliarDos;
let otroContador;
let tokenDueno;
let tokenAuxiliarUno;
let tokenOtro;

const idsDePrueba = () => [dueno.id, auxiliarUno.id, auxiliarDos.id, otroContador.id];

async function limpiarRelaciones() {
  const marcas = idsDePrueba().map(() => '?').join(', ');
  await query(
    `DELETE FROM contador_auxiliar WHERE contador_id IN (${marcas}) OR auxiliar_id IN (${marcas})`,
    [...idsDePrueba(), ...idsDePrueba()]
  );
}

async function get(ruta, token) {
  return peticion(servidor.puerto, 'GET', ruta, undefined, token);
}

async function contarAvisos(usuarioId) {
  const [fila] = await query('SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ?', [usuarioId]);
  return Number(fila.n);
}

async function ultimoAvisoDe(usuarioId) {
  const filas = await query(
    'SELECT mensaje FROM notificaciones WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC LIMIT 1',
    [usuarioId]
  );
  return filas.length > 0 ? filas[0].mensaje : null;
}

async function post(ruta, token) {
  return peticion(servidor.puerto, 'POST', ruta, {}, token);
}

async function del(ruta, token) {
  return peticion(servidor.puerto, 'DELETE', ruta, undefined, token);
}

describe('rutas de auxiliares del contador', () => {
  before(async () => {
    await prepararBaseDeDatos();
    dueno = await crearUsuarioDePrueba('contador');
    auxiliarUno = await crearUsuarioDePrueba('auxiliar');
    auxiliarDos = await crearUsuarioDePrueba('auxiliar');
    otroContador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
    tokenDueno = await iniciarSesion(servidor.puerto, dueno.correo, dueno.password);
    tokenAuxiliarUno = await iniciarSesion(servidor.puerto, auxiliarUno.correo, auxiliarUno.password);
    tokenOtro = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
  });

  after(async () => {
    await limpiarRelaciones();
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  beforeEach(async () => {
    await limpiarRelaciones();
  });

  test('el dueño lista a sus auxiliares', async () => {
    const asignar = await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);
    assert.strictEqual(asignar.statusCode, 201, 'el dueño puede asignar un auxiliar');

    const respuesta = await get(`/contadores/${dueno.id}/auxiliares`, tokenDueno);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.ok(Array.isArray(respuesta.body.auxiliares), 'devuelve la lista de auxiliares');
    assert.strictEqual(respuesta.body.auxiliares.length, 1);
    assert.strictEqual(respuesta.body.auxiliares[0].id, auxiliarUno.id);
    assert.strictEqual(respuesta.body.auxiliares[0].nombre, auxiliarUno.nombre);
  });

  test('otro contador no puede listar ni asignar auxiliares ajenos', async () => {
    const listar = await get(`/contadores/${dueno.id}/auxiliares`, tokenOtro);
    assert.strictEqual(listar.statusCode, 403, 'listar los auxiliares de otro devuelve 403');

    const asignar = await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenOtro);
    assert.strictEqual(asignar.statusCode, 403, 'asignar en la cuenta de otro devuelve 403');

    const quitar = await del(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenOtro);
    assert.strictEqual(quitar.statusCode, 403, 'quitar en la cuenta de otro devuelve 403');
  });

  test('asignar dos veces el mismo auxiliar responde 409 y no duplica', async () => {
    const primera = await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);
    assert.strictEqual(primera.statusCode, 201);

    const segunda = await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);
    assert.strictEqual(segunda.statusCode, 409, 'el auxiliar repetido se rechaza');
    assert.match(segunda.body.mensaje, /ya está asignado/i);

    const lista = await get(`/contadores/${dueno.id}/auxiliares`, tokenDueno);
    assert.strictEqual(lista.body.auxiliares.length, 1, 'no se duplica la relación');
  });

  test('no se puede asignar uno mismo como auxiliar', async () => {
    const respuesta = await post(`/contadores/${dueno.id}/auxiliares/${dueno.id}`, tokenDueno);
    assert.strictEqual(respuesta.statusCode, 400, 'la auto-asignación se rechaza');
    assert.match(respuesta.body.mensaje, /asignarte a ti mismo/i);
  });

  test('no se puede asignar a alguien que no tiene rol auxiliar', async () => {
    const administrador = await crearUsuarioDePrueba('administrador');
    const tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);

    // El administrador ni siquiera puede usar la ruta (solo contadores).
    const comoAdmin = await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenAdmin);
    assert.strictEqual(comoAdmin.statusCode, 403, 'un administrador no gestiona auxiliares');

    // Y una cuenta sin rol auxiliar (aquí, un administrador) se rechaza con 400.
    const respuesta = await post(`/contadores/${dueno.id}/auxiliares/${administrador.id}`, tokenDueno);
    assert.strictEqual(respuesta.statusCode, 400, 'una cuenta sin rol auxiliar no puede ser auxiliar');
  });

  test('quitar un auxiliar lo saca de la lista', async () => {
    await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);

    const quitar = await del(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);
    assert.strictEqual(quitar.statusCode, 200, 'el dueño puede quitar a su auxiliar');

    const lista = await get(`/contadores/${dueno.id}/auxiliares`, tokenDueno);
    assert.strictEqual(lista.body.auxiliares.length, 0);
  });

  test('el auxiliar ve para qué contadores trabaja y solo los suyos', async () => {
    await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);
    await post(`/contadores/${otroContador.id}/auxiliares/${auxiliarUno.id}`, tokenOtro);

    const respuesta = await get(
      `/contadores/${auxiliarUno.id}/contadores-que-me-tienen-como-auxiliar`,
      tokenAuxiliarUno
    );
    assert.strictEqual(respuesta.statusCode, 200);
    assert.ok(Array.isArray(respuesta.body.contadores));
    const ids = respuesta.body.contadores.map((c) => c.id).sort((a, b) => a - b);
    assert.deepStrictEqual(ids, [dueno.id, otroContador.id].sort((a, b) => a - b));

    const ajeno = await get(
      `/contadores/${dueno.id}/contadores-que-me-tienen-como-auxiliar`,
      tokenAuxiliarUno
    );
    assert.strictEqual(ajeno.statusCode, 403, 'no puede consultar los equipos de otro');
  });

  test('los disponibles excluyen al propio contador y a los ya asignados', async () => {
    await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);

    const respuesta = await get(`/contadores/${dueno.id}/auxiliares-disponibles`, tokenDueno);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.ok(Array.isArray(respuesta.body.contadores));

    const ids = respuesta.body.contadores.map((c) => c.id);
    assert.ok(!ids.includes(dueno.id), 'no se incluye a uno mismo');
    assert.ok(!ids.includes(auxiliarUno.id), 'no se incluye a un auxiliar ya asignado');
    assert.ok(ids.includes(auxiliarDos.id), 'incluye a los contadores libres');
  });

  test('al quitar un auxiliar se le avisa solo a él, no al contador', async () => {
    await post(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);

    const avisosAuxiliarAntes = await contarAvisos(auxiliarUno.id);
    const avisosDuenoAntes = await contarAvisos(dueno.id);

    const quitar = await del(`/contadores/${dueno.id}/auxiliares/${auxiliarUno.id}`, tokenDueno);
    assert.strictEqual(quitar.statusCode, 200, 'el dueño puede quitar a su auxiliar');

    assert.strictEqual(await contarAvisos(auxiliarUno.id), avisosAuxiliarAntes + 1, 'el auxiliar recibe el aviso de baja');
    assert.strictEqual(await contarAvisos(dueno.id), avisosDuenoAntes, 'el contador no recibe aviso');

    assert.strictEqual(
      await ultimoAvisoDe(auxiliarUno.id),
      `Ya no apoyas a ${dueno.nombre} con sus casos.`,
      'texto del aviso al auxiliar'
    );
  });

  test('quitar a un auxiliar que no está vinculado no crea avisos', async () => {
    const avisosAuxiliarAntes = await contarAvisos(auxiliarDos.id);
    const avisosDuenoAntes = await contarAvisos(dueno.id);

    const quitar = await del(`/contadores/${dueno.id}/auxiliares/${auxiliarDos.id}`, tokenDueno);
    assert.strictEqual(quitar.statusCode, 200, 'quitar sin vínculo no da error');

    assert.strictEqual(await contarAvisos(auxiliarDos.id), avisosAuxiliarAntes, 'sin aviso al auxiliar');
    assert.strictEqual(await contarAvisos(dueno.id), avisosDuenoAntes, 'sin aviso al contador');
  });
});
