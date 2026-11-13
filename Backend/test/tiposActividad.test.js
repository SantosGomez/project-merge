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
 * Pruebas de integración de /tipos-actividad (rebanada 10): cada contador o auxiliar
 * define sus propios tipos de actividad. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo usa y borra cuentas `zz_test_` (sus tipos se borran en cascada).
 */

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

let servidor;
let contador;
let otroContador;
let auxiliar;
let administrador;
let sistema;
let tokenContador;
let tokenOtroContador;
let tokenAuxiliar;

async function crear(token, cuerpo) {
  return peticion(servidor.puerto, 'POST', '/tipos-actividad', cuerpo, token);
}

async function testSeedCreaLaTablaDeFormaIdempotente() {
  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });
  const columnas = await query('SHOW COLUMNS FROM tipos_actividad');
  assert.deepStrictEqual(
    columnas.map((c) => c.Field),
    ['id', 'usuario_id', 'nombre', 'cobrable', 'activo', 'creado_en']
  );
}

async function testAltaDevuelve201ConCobrableApagadoPorDefecto() {
  const respuesta = await crear(tokenContador, { nombre: '  Revisión de facturas  ' });
  assert.strictEqual(respuesta.statusCode, 201);
  const { tipo } = respuesta.body;
  assert.deepStrictEqual(Object.keys(tipo).sort(), ['activo', 'cobrable', 'creado_en', 'id', 'nombre', 'total_clientes']);
  assert.strictEqual(tipo.total_clientes, 0);
  assert.strictEqual(tipo.nombre, 'Revisión de facturas');
  assert.strictEqual(tipo.cobrable, false);
  assert.strictEqual(tipo.activo, true);
  assert.match(tipo.creado_en, FORMATO_FECHA);

  const cobrable = await crear(tokenContador, { nombre: 'Declaración mensual', cobrable: true });
  assert.strictEqual(cobrable.statusCode, 201);
  assert.strictEqual(cobrable.body.tipo.cobrable, true);
}

async function testRechazaDatosInvalidosConTresPartes() {
  const casos = [
    [{}, 'falta el nombre'],
    [{ nombre: '  ' }, 'nombre vacío'],
    [{ nombre: 5 }, 'nombre que no es texto'],
    [{ nombre: 'x'.repeat(121) }, 'nombre de más de 120'],
    [{ nombre: 'Cobrable raro', cobrable: 'si' }, 'cobrable que no es booleano'],
  ];
  for (const [cuerpo, descripcion] of casos) {
    const respuesta = await crear(tokenContador, cuerpo);
    assert.strictEqual(respuesta.statusCode, 400, descripcion);
    assert.match(respuesta.body.mensaje, / sobre .+: /, `${descripcion}: mensaje en tres partes`);
  }
  assert.strictEqual((await crear(tokenContador, { nombre: 'x'.repeat(120) })).statusCode, 201);
}

async function testNombreRepetidoDa409SinDistinguirMayusculasNiAcentos() {
  assert.strictEqual((await crear(tokenContador, { nombre: 'Conciliación' })).statusCode, 201);
  for (const repetido of ['conciliación', 'CONCILIACION', ' Conciliacion ']) {
    const respuesta = await crear(tokenContador, { nombre: repetido });
    assert.strictEqual(respuesta.statusCode, 409, repetido);
    assert.match(respuesta.body.mensaje, /ya existe/i);
  }
  assert.strictEqual((await crear(tokenOtroContador, { nombre: 'Conciliación' })).statusCode, 201);
}

async function testListaSoloLoPropioConActivosPrimero() {
  await crear(tokenAuxiliar, { nombre: 'Zeta tipo' });
  const b = await crear(tokenAuxiliar, { nombre: 'Alfa tipo' });
  await crear(tokenAuxiliar, { nombre: 'Beta tipo', cobrable: true });
  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${b.body.tipo.id}`, { activo: false }, tokenAuxiliar);

  const respuesta = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, tokenAuxiliar);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(
    respuesta.body.tipos.map((x) => x.nombre),
    ['Beta tipo', 'Zeta tipo', 'Alfa tipo']
  );
  assert.deepStrictEqual(
    respuesta.body.tipos.map((x) => x.cobrable),
    [true, false, false]
  );
}

async function testEditarNombreCobrableYActivo() {
  const alta = await crear(tokenContador, { nombre: 'Editable tipo' });
  const id = alta.body.tipo.id;

  const cambio = await peticion(
    servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, { nombre: ' Editado tipo ', cobrable: true }, tokenContador
  );
  assert.strictEqual(cambio.statusCode, 200);
  assert.strictEqual(cambio.body.tipo.nombre, 'Editado tipo');
  assert.strictEqual(cambio.body.tipo.cobrable, true);

  const baja = await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, { activo: false }, tokenContador);
  assert.strictEqual(baja.body.tipo.activo, false);
  assert.strictEqual(baja.body.tipo.cobrable, true, 'lo que no se envía no cambia');
  const alza = await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, { activo: true }, tokenContador);
  assert.strictEqual(alza.body.tipo.activo, true);

  const mismo = await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, { nombre: 'EDITADO TIPO' }, tokenContador);
  assert.strictEqual(mismo.statusCode, 200, 'cambiar solo mayúsculas del propio nombre no es repetido');
}

async function testEditarConNombreRepetidoDa409YDatosInvalidosDa400() {
  const a = await crear(tokenContador, { nombre: 'Uno tipo repetido' });
  await crear(tokenContador, { nombre: 'Dos tipo repetido' });
  const id = a.body.tipo.id;

  const repetido = await peticion(
    servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, { nombre: 'dos TIPO repetido' }, tokenContador
  );
  assert.strictEqual(repetido.statusCode, 409);

  for (const cuerpo of [{}, { nombre: '' }, { cobrable: 1 }, { activo: 'si' }]) {
    const respuesta = await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, cuerpo, tokenContador);
    assert.strictEqual(respuesta.statusCode, 400, JSON.stringify(cuerpo));
  }
  const invalido = await peticion(servidor.puerto, 'PATCH', '/tipos-actividad/abc', { nombre: 'X' }, tokenContador);
  assert.strictEqual(invalido.statusCode, 400);
}

async function testNoSePuedeTocarElTipoDeOtro() {
  const ajeno = await crear(tokenOtroContador, { nombre: 'Solo del otro tipo' });
  const id = ajeno.body.tipo.id;
  const respuesta = await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, { nombre: 'Robado' }, tokenContador);
  assert.strictEqual(respuesta.statusCode, 404);
  const inexistente = await peticion(servidor.puerto, 'PATCH', '/tipos-actividad/99999999', { nombre: 'X' }, tokenContador);
  assert.strictEqual(inexistente.statusCode, 404);
  const lista = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, tokenContador);
  assert.ok(!lista.body.tipos.some((t) => t.id === id));
  const intacto = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, tokenOtroContador);
  assert.ok(intacto.body.tipos.some((t) => t.id === id && t.nombre === 'Solo del otro tipo'));
}

async function testSoloContadorYAuxiliar() {
  for (const cuenta of [administrador, sistema]) {
    const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, token)).statusCode, 403);
    assert.strictEqual((await crear(token, { nombre: 'No debe' })).statusCode, 403);
    assert.strictEqual(
      (await peticion(servidor.puerto, 'PATCH', '/tipos-actividad/1', { nombre: 'No debe' }, token)).statusCode,
      403
    );
  }
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/tipos-actividad')).statusCode, 401);
}

describe('/tipos-actividad', () => {
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

  test('el seed crea la tabla tipos_actividad y se puede repetir', testSeedCreaLaTablaDeFormaIdempotente);
  test('el alta responde 201 y cobrable es falso por defecto', testAltaDevuelve201ConCobrableApagadoPorDefecto);
  test('rechaza datos inválidos con mensaje en tres partes', testRechazaDatosInvalidosConTresPartes);
  test('nombre repetido da 409 sin distinguir mayúsculas ni acentos', testNombreRepetidoDa409SinDistinguirMayusculasNiAcentos);
  test('lista solo lo propio, activos primero', testListaSoloLoPropioConActivosPrimero);
  test('editar cambia nombre, cobrable y activo', testEditarNombreCobrableYActivo);
  test('editar con nombre repetido da 409 y con datos inválidos 400', testEditarConNombreRepetidoDa409YDatosInvalidosDa400);
  test('el tipo de otro usuario da 404', testNoSePuedeTocarElTipoDeOtro);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
