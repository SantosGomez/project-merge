const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { query } = require('../src/config/db');

/*
 * GET /contadores/casos-importantes: casos importantes de todos los contadores y los escalados
 * de sus auxiliares, para el calendario del administrador. Solo lectura y solo administrador.
 */

let servidor;
let admin;
let contadorA;
let contadorB;
let auxiliarDeA;
let auxiliarSuelto;
let tokenAdmin;
let tokenContador;

async function crearCaso(contadorId, { cliente, importante, estado = 'Pendiente', vencimiento = '2099-12-31' }) {
  await query(
    `INSERT INTO casos (contador_id, cliente, estado, prioridad, importante, fecha_inicio, fecha_vencimiento, creado_en, actualizado_en)
     VALUES (?, ?, ?, 'Media', ?, '2099-01-02', ?, NOW(), NOW())`,
    [contadorId, cliente, estado, importante, vencimiento]
  );
}

const clientesPropios = (casos) =>
  casos
    .map((c) => c.cliente)
    .filter((cliente) => cliente.startsWith('zz_test_cal'))
    .sort();

describe('GET /contadores/casos-importantes', () => {
  before(async () => {
    await prepararBaseDeDatos();
    admin = await crearUsuarioDePrueba('administrador');
    contadorA = await crearUsuarioDePrueba('contador');
    contadorB = await crearUsuarioDePrueba('contador');
    auxiliarDeA = await crearUsuarioDePrueba('auxiliar');
    auxiliarSuelto = await crearUsuarioDePrueba('auxiliar');
    await asignarAuxiliar(contadorA.id, auxiliarDeA.id);
    await crearCaso(contadorA.id, { cliente: 'zz_test_cal A importante', importante: 1 });
    await crearCaso(contadorA.id, { cliente: 'zz_test_cal A normal', importante: 0 });
    await crearCaso(contadorB.id, { cliente: 'zz_test_cal B finalizado', importante: 1, estado: 'Finalizado' });
    await crearCaso(auxiliarDeA.id, { cliente: 'zz_test_cal aux escalado', importante: 1 });
    await crearCaso(auxiliarDeA.id, { cliente: 'zz_test_cal aux normal', importante: 0 });
    await crearCaso(auxiliarSuelto.id, { cliente: 'zz_test_cal aux suelto', importante: 1 });
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenContador = await iniciarSesion(servidor.puerto, contadorA.correo, contadorA.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el administrador recibe los casos importantes de todos los contadores y los escalados de sus auxiliares', async () => {
    const respuesta = await peticion(servidor.puerto, 'GET', '/contadores/casos-importantes', null, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.deepStrictEqual(clientesPropios(respuesta.body.casos), [
      'zz_test_cal A importante',
      'zz_test_cal B finalizado',
      'zz_test_cal aux escalado',
    ]);
  });

  test('cada caso trae su dueño y, si es auxiliar, el contador que apoya', async () => {
    const { body } = await peticion(servidor.puerto, 'GET', '/contadores/casos-importantes', null, tokenAdmin);
    const propio = body.casos.find((c) => c.cliente === 'zz_test_cal A importante');
    assert.strictEqual(propio.nombre_contador, contadorA.nombre);
    assert.strictEqual(propio.contador_que_apoya, null);
    assert.strictEqual(propio.contador_que_apoya_id, null);

    const escalado = body.casos.find((c) => c.cliente === 'zz_test_cal aux escalado');
    assert.strictEqual(escalado.nombre_contador, auxiliarDeA.nombre);
    assert.strictEqual(escalado.contador_que_apoya, contadorA.nombre);
    assert.strictEqual(Number(escalado.contador_que_apoya_id), contadorA.id);
  });

  test('las fechas DATE salen como AAAA-MM-DD y importante como booleano', async () => {
    const { body } = await peticion(servidor.puerto, 'GET', '/contadores/casos-importantes', null, tokenAdmin);
    const caso = body.casos.find((c) => c.cliente === 'zz_test_cal A importante');
    assert.strictEqual(caso.fecha_vencimiento, '2099-12-31');
    assert.strictEqual(caso.fecha_inicio, '2099-01-02');
    assert.strictEqual(caso.importante, true);
    assert.match(caso.creado_en, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('sin token da 401 y otros roles dan 403', async () => {
    const sinToken = await peticion(servidor.puerto, 'GET', '/contadores/casos-importantes');
    assert.strictEqual(sinToken.statusCode, 401);
    const comoContador = await peticion(servidor.puerto, 'GET', '/contadores/casos-importantes', null, tokenContador);
    assert.strictEqual(comoContador.statusCode, 403);
  });
});
