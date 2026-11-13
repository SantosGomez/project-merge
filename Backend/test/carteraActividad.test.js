const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const { seedDatabase } = require('../src/utils/seed');

/**
 * Pruebas de integración de la cartera por tipo (rebanada 11): `GET/PUT /tipos-actividad/:id/clientes`
 * y `total_clientes` en `GET /tipos-actividad`. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo usa y borra cuentas `zz_test_` (sus filas se borran en cascada).
 */

let servidor;
let contador;
let otroContador;
let auxiliar;
let administrador;
let sistema;
let tokenContador;
let tokenOtroContador;
let tokenAuxiliar;
let contadorSecuencia = 0;

async function nuevoCliente(token) {
  contadorSecuencia += 1;
  const respuesta = await peticion(servidor.puerto, 'POST', '/clientes', { nombre: `Cliente cartera ${contadorSecuencia}` }, token);
  assert.strictEqual(respuesta.statusCode, 201);
  return respuesta.body.cliente;
}

async function nuevoTipo(token) {
  contadorSecuencia += 1;
  const respuesta = await peticion(servidor.puerto, 'POST', '/tipos-actividad', { nombre: `Tipo cartera ${contadorSecuencia}` }, token);
  assert.strictEqual(respuesta.statusCode, 201);
  return respuesta.body.tipo;
}

const asignar = (token, tipoId, cuerpo) =>
  peticion(servidor.puerto, 'PUT', `/tipos-actividad/${tipoId}/clientes`, cuerpo, token);
const leerCartera = (token, tipoId) =>
  peticion(servidor.puerto, 'GET', `/tipos-actividad/${tipoId}/clientes`, null, token);

async function totalDe(token, tipoId) {
  const lista = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, token);
  return lista.body.tipos.find((t) => t.id === tipoId).total_clientes;
}

async function testSeedCreaLaTablaDeFormaIdempotente() {
  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });
  const columnas = await query('SHOW COLUMNS FROM cartera_actividad');
  assert.deepStrictEqual(
    columnas.map((c) => c.Field),
    ['usuario_id', 'cliente_id', 'tipo_id', 'creado_en']
  );
  const llaves = await query("SHOW KEYS FROM cartera_actividad WHERE Key_name = 'PRIMARY'");
  assert.deepStrictEqual(
    llaves.map((k) => k.Column_name),
    ['cliente_id', 'tipo_id']
  );
}

async function testAgregarYQuitarGuardanSoloLaDiferencia() {
  const tipo = await nuevoTipo(tokenContador);
  const a = await nuevoCliente(tokenContador);
  const b = await nuevoCliente(tokenContador);
  const c = await nuevoCliente(tokenContador);

  const vacio = await leerCartera(tokenContador, tipo.id);
  assert.strictEqual(vacio.statusCode, 200);
  assert.deepStrictEqual(vacio.body, { cliente_ids: [] });

  const alta = await asignar(tokenContador, tipo.id, { agregar: [a.id, b.id] });
  assert.strictEqual(alta.statusCode, 200);
  assert.deepStrictEqual(alta.body.cliente_ids.sort(), [a.id, b.id].sort());

  const cambio = await asignar(tokenContador, tipo.id, { agregar: [c.id], quitar: [a.id] });
  assert.strictEqual(cambio.statusCode, 200);
  assert.deepStrictEqual(cambio.body.cliente_ids.sort(), [b.id, c.id].sort());
  const leida = await leerCartera(tokenContador, tipo.id);
  assert.deepStrictEqual(leida.body.cliente_ids.sort(), [b.id, c.id].sort());
  assert.strictEqual(await totalDe(tokenContador, tipo.id), 2);

  const repetido = await asignar(tokenContador, tipo.id, { agregar: [b.id], quitar: [a.id] });
  assert.strictEqual(repetido.statusCode, 200, 'agregar lo que ya está y quitar lo que no está no falla');
  assert.deepStrictEqual(repetido.body.cliente_ids.sort(), [b.id, c.id].sort());

  const sinCambios = await asignar(tokenContador, tipo.id, {});
  assert.strictEqual(sinCambios.statusCode, 200);
  assert.strictEqual(sinCambios.body.cliente_ids.length, 2);
}

async function testTotalClientesCuentaSoloClientesActivosYSeVeEnTodasLasRespuestas() {
  const tipo = await nuevoTipo(tokenContador);
  assert.strictEqual(tipo.total_clientes, 0, 'un tipo nuevo no tiene clientes');
  const a = await nuevoCliente(tokenContador);
  const b = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo.id, { agregar: [a.id, b.id] });
  assert.strictEqual(await totalDe(tokenContador, tipo.id), 2);

  await peticion(servidor.puerto, 'PATCH', `/clientes/${b.id}`, { activo: false }, tokenContador);
  assert.strictEqual(await totalDe(tokenContador, tipo.id), 1, 'un cliente desactivado no cuenta');

  const editado = await peticion(
    servidor.puerto, 'PATCH', `/tipos-actividad/${tipo.id}`, { cobrable: true }, tokenContador
  );
  assert.strictEqual(editado.body.tipo.total_clientes, 1, 'el PATCH también devuelve el total');
}

async function testNoSePuedeUsarUnTipoOUnClienteAjeno() {
  const tipoAjeno = await nuevoTipo(tokenOtroContador);
  const clienteAjeno = await nuevoCliente(tokenOtroContador);
  const tipo = await nuevoTipo(tokenContador);
  const propio = await nuevoCliente(tokenContador);

  assert.strictEqual((await leerCartera(tokenContador, tipoAjeno.id)).statusCode, 404);
  assert.strictEqual((await asignar(tokenContador, tipoAjeno.id, { agregar: [propio.id] })).statusCode, 404);
  assert.strictEqual((await leerCartera(tokenContador, 99999999)).statusCode, 404);

  const conAjeno = await asignar(tokenContador, tipo.id, { agregar: [propio.id, clienteAjeno.id] });
  assert.strictEqual(conAjeno.statusCode, 404);
  assert.match(conAjeno.body.mensaje, / sobre .+: /);
  const quitarAjeno = await asignar(tokenContador, tipo.id, { quitar: [clienteAjeno.id] });
  assert.strictEqual(quitarAjeno.statusCode, 404);
  const leida = await leerCartera(tokenContador, tipo.id);
  assert.deepStrictEqual(leida.body.cliente_ids, [], 'si algo falla no se guarda nada (transacción)');
  const delOtro = await leerCartera(tokenOtroContador, tipoAjeno.id);
  assert.deepStrictEqual(delOtro.body.cliente_ids, []);
}

async function testNoSeAsignaUnClienteOUnTipoDesactivado() {
  const tipo = await nuevoTipo(tokenContador);
  const activo = await nuevoCliente(tokenContador);
  const inactivo = await nuevoCliente(tokenContador);
  await peticion(servidor.puerto, 'PATCH', `/clientes/${inactivo.id}`, { activo: false }, tokenContador);

  const conInactivo = await asignar(tokenContador, tipo.id, { agregar: [activo.id, inactivo.id] });
  assert.strictEqual(conInactivo.statusCode, 400);
  assert.match(conInactivo.body.mensaje, / sobre .+: /);
  assert.deepStrictEqual((await leerCartera(tokenContador, tipo.id)).body.cliente_ids, []);

  await asignar(tokenContador, tipo.id, { agregar: [activo.id] });
  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${tipo.id}`, { activo: false }, tokenContador);
  const otro = await nuevoCliente(tokenContador);
  const tipoInactivo = await asignar(tokenContador, tipo.id, { agregar: [otro.id] });
  assert.strictEqual(tipoInactivo.statusCode, 400);
  const quitar = await asignar(tokenContador, tipo.id, { quitar: [activo.id] });
  assert.strictEqual(quitar.statusCode, 200, 'sí se puede quitar clientes de un tipo desactivado');
  assert.deepStrictEqual(quitar.body.cliente_ids, []);
}

async function testRechazaCuerposInvalidosConTresPartes() {
  const tipo = await nuevoTipo(tokenContador);
  const cliente = await nuevoCliente(tokenContador);
  const casos = [
    [{ agregar: 'x' }, 'agregar que no es lista'],
    [{ quitar: { id: 1 } }, 'quitar que no es lista'],
    [{ agregar: [0] }, 'id cero'],
    [{ agregar: ['abc'] }, 'id que no es número'],
    [{ agregar: [cliente.id], quitar: [cliente.id] }, 'el mismo cliente en agregar y quitar'],
  ];
  for (const [cuerpo, descripcion] of casos) {
    const respuesta = await asignar(tokenContador, tipo.id, cuerpo);
    assert.strictEqual(respuesta.statusCode, 400, descripcion);
    assert.match(respuesta.body.mensaje, / sobre .+: /, `${descripcion}: mensaje en tres partes`);
  }
  assert.strictEqual((await leerCartera(tokenContador, 'abc')).statusCode, 400);
  assert.strictEqual((await asignar(tokenContador, 'abc', {})).statusCode, 400);
}

async function testElAuxiliarTambienTieneSuCartera() {
  const tipo = await nuevoTipo(tokenAuxiliar);
  const cliente = await nuevoCliente(tokenAuxiliar);
  const respuesta = await asignar(tokenAuxiliar, tipo.id, { agregar: [cliente.id] });
  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(respuesta.body.cliente_ids, [cliente.id]);
  assert.strictEqual(await totalDe(tokenAuxiliar, tipo.id), 1);
}

async function testSoloContadorYAuxiliar() {
  for (const cuenta of [administrador, sistema]) {
    const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    assert.strictEqual((await leerCartera(token, 1)).statusCode, 403);
    assert.strictEqual((await asignar(token, 1, { agregar: [1] })).statusCode, 403);
  }
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/tipos-actividad/1/clientes')).statusCode, 401);
  assert.strictEqual((await peticion(servidor.puerto, 'PUT', '/tipos-actividad/1/clientes', {})).statusCode, 401);
}

describe('cartera por tipo de actividad', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    administrador = await crearUsuarioDePrueba('administrador');
    sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    servidor = await iniciarServidor();
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenOtroContador = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el seed crea cartera_actividad y se puede repetir', testSeedCreaLaTablaDeFormaIdempotente);
  test('agregar y quitar guardan solo la diferencia', testAgregarYQuitarGuardanSoloLaDiferencia);
  test('total_clientes cuenta solo clientes activos y sale en alta y edición', testTotalClientesCuentaSoloClientesActivosYSeVeEnTodasLasRespuestas);
  test('un tipo o cliente de otro usuario da 404 y no se guarda nada', testNoSePuedeUsarUnTipoOUnClienteAjeno);
  test('no se asigna un cliente ni un tipo desactivado (400)', testNoSeAsignaUnClienteOUnTipoDesactivado);
  test('rechaza cuerpos inválidos con mensaje en tres partes', testRechazaCuerposInvalidosConTresPartes);
  test('el auxiliar también arma su cartera', testElAuxiliarTambienTieneSuCartera);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
