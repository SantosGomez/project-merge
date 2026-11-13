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
 * Pruebas de integración de /clientes (rebanada 10): cada contador o auxiliar arma su
 * propia cartera de clientes. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo usa y borra cuentas `zz_test_` (sus clientes se borran en cascada).
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
  return peticion(servidor.puerto, 'POST', '/clientes', cuerpo, token);
}

async function testSeedCreaLaTablaDeFormaIdempotente() {
  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });
  const columnas = await query('SHOW COLUMNS FROM clientes');
  assert.deepStrictEqual(
    columnas.map((c) => c.Field),
    ['id', 'usuario_id', 'nombre', 'rfc', 'activo', 'creado_en']
  );
}

async function testAltaDevuelve201ConElClienteSinEspaciosYRfcEnMayusculas() {
  const respuesta = await crear(tokenContador, { nombre: '  Abarrotes del Norte  ', rfc: 'abc010101xy1' });
  assert.strictEqual(respuesta.statusCode, 201);
  const { cliente } = respuesta.body;
  assert.deepStrictEqual(Object.keys(cliente).sort(), ['activo', 'creado_en', 'id', 'nombre', 'rfc']);
  assert.strictEqual(cliente.nombre, 'Abarrotes del Norte');
  assert.strictEqual(cliente.rfc, 'ABC010101XY1');
  assert.strictEqual(cliente.activo, true);
  assert.match(cliente.creado_en, FORMATO_FECHA);
}

async function testRfcEsOpcionalYAceptaPersonaFisica() {
  const sinRfc = await crear(tokenContador, { nombre: 'Sin RFC' });
  assert.strictEqual(sinRfc.statusCode, 201);
  assert.strictEqual(sinRfc.body.cliente.rfc, null);

  const vacio = await crear(tokenContador, { nombre: 'RFC vacio', rfc: '   ' });
  assert.strictEqual(vacio.statusCode, 201);
  assert.strictEqual(vacio.body.cliente.rfc, null);

  const fisica = await crear(tokenContador, { nombre: 'Persona fisica', rfc: 'GOMS800101AB1' });
  assert.strictEqual(fisica.statusCode, 201);
  assert.strictEqual(fisica.body.cliente.rfc, 'GOMS800101AB1');
}

async function testRechazaDatosInvalidosConTresPartes() {
  const casos = [
    [{}, 'falta el nombre'],
    [{ nombre: '   ' }, 'nombre vacío'],
    [{ nombre: 123 }, 'nombre que no es texto'],
    [{ nombre: 'x'.repeat(151) }, 'nombre de más de 150'],
    [{ nombre: 'RFC corto', rfc: 'ABC0101' }, 'RFC corto'],
    [{ nombre: 'RFC raro', rfc: '12345678901234' }, 'RFC con forma incorrecta'],
    [{ nombre: 'RFC numero', rfc: 12345 }, 'RFC que no es texto'],
  ];
  for (const [cuerpo, descripcion] of casos) {
    const respuesta = await crear(tokenContador, cuerpo);
    assert.strictEqual(respuesta.statusCode, 400, descripcion);
    assert.match(respuesta.body.mensaje, / sobre .+: /, `${descripcion}: mensaje en tres partes`);
  }
  const limite = await crear(tokenContador, { nombre: 'x'.repeat(150) });
  assert.strictEqual(limite.statusCode, 201, '150 caracteres sí se permiten');
}

async function testNombreRepetidoDelMismoUsuarioDa409SinDistinguirMayusculasNiAcentos() {
  assert.strictEqual((await crear(tokenContador, { nombre: 'Café Ñandú' })).statusCode, 201);
  for (const repetido of ['café ñandú', 'CAFE ÑANDÚ', 'Cafe Ñandu', '  Café Ñandú ']) {
    const respuesta = await crear(tokenContador, { nombre: repetido });
    assert.strictEqual(respuesta.statusCode, 409, repetido);
    assert.match(respuesta.body.mensaje, /ya existe/i);
  }
}

async function testDosUsuariosPuedenTenerElMismoNombre() {
  assert.strictEqual((await crear(tokenContador, { nombre: 'Compartido SA' })).statusCode, 201);
  assert.strictEqual((await crear(tokenOtroContador, { nombre: 'Compartido SA' })).statusCode, 201);
}

async function testListaSoloLoPropioConActivosPrimero() {
  await crear(tokenAuxiliar, { nombre: 'Zeta aux' });
  const b = await crear(tokenAuxiliar, { nombre: 'Alfa aux' });
  await crear(tokenAuxiliar, { nombre: 'Beta aux' });
  await peticion(servidor.puerto, 'PATCH', `/clientes/${b.body.cliente.id}`, { activo: false }, tokenAuxiliar);

  const respuesta = await peticion(servidor.puerto, 'GET', '/clientes', null, tokenAuxiliar);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(
    respuesta.body.clientes.map((x) => x.nombre),
    ['Beta aux', 'Zeta aux', 'Alfa aux'],
    'activos primero (por nombre) y luego los desactivados'
  );
  assert.deepStrictEqual(
    respuesta.body.clientes.map((x) => x.activo),
    [true, true, false]
  );
}

async function testEditarCambiaNombreYRfcYPermiteLimpiarElRfc() {
  const alta = await crear(tokenContador, { nombre: 'Editable', rfc: 'ABC010101XY1' });
  const id = alta.body.cliente.id;

  const cambio = await peticion(
    servidor.puerto, 'PATCH', `/clientes/${id}`, { nombre: ' Editado ', rfc: 'xyz020202ab3' }, tokenContador
  );
  assert.strictEqual(cambio.statusCode, 200);
  assert.strictEqual(cambio.body.cliente.nombre, 'Editado');
  assert.strictEqual(cambio.body.cliente.rfc, 'XYZ020202AB3');

  const soloNombre = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { nombre: 'Editado 2' }, tokenContador);
  assert.strictEqual(soloNombre.body.cliente.rfc, 'XYZ020202AB3', 'lo que no se envía no cambia');

  const limpio = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { rfc: null }, tokenContador);
  assert.strictEqual(limpio.statusCode, 200);
  assert.strictEqual(limpio.body.cliente.rfc, null);

  const mismoNombre = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { nombre: 'EDITADO 2' }, tokenContador);
  assert.strictEqual(mismoNombre.statusCode, 200, 'cambiar solo mayúsculas del propio nombre no es repetido');
}

async function testEditarConNombreRepetidoDa409YDatosInvalidosDa400() {
  const a = await crear(tokenContador, { nombre: 'Uno repetido' });
  await crear(tokenContador, { nombre: 'Dos repetido' });
  const id = a.body.cliente.id;

  const repetido = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { nombre: 'dos REPETIDO' }, tokenContador);
  assert.strictEqual(repetido.statusCode, 409);

  for (const cuerpo of [{}, { nombre: '' }, { rfc: 'mal' }, { activo: 'si' }]) {
    const respuesta = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, cuerpo, tokenContador);
    assert.strictEqual(respuesta.statusCode, 400, JSON.stringify(cuerpo));
  }
}

async function testDesactivarYReactivar() {
  const alta = await crear(tokenContador, { nombre: 'Se desactiva' });
  const id = alta.body.cliente.id;
  const baja = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { activo: false }, tokenContador);
  assert.strictEqual(baja.body.cliente.activo, false);
  const reactivado = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { activo: true }, tokenContador);
  assert.strictEqual(reactivado.body.cliente.activo, true);
}

async function testNoSePuedeTocarElClienteDeOtro() {
  const ajeno = await crear(tokenOtroContador, { nombre: 'Solo del otro' });
  const id = ajeno.body.cliente.id;
  const respuesta = await peticion(servidor.puerto, 'PATCH', `/clientes/${id}`, { nombre: 'Robado' }, tokenContador);
  assert.strictEqual(respuesta.statusCode, 404);
  const inexistente = await peticion(servidor.puerto, 'PATCH', '/clientes/99999999', { nombre: 'X' }, tokenContador);
  assert.strictEqual(inexistente.statusCode, 404);
  const lista = await peticion(servidor.puerto, 'GET', '/clientes', null, tokenContador);
  assert.ok(!lista.body.clientes.some((c) => c.id === id), 'no aparece en la lista del otro');
  const intacto = await peticion(servidor.puerto, 'GET', '/clientes', null, tokenOtroContador);
  assert.ok(intacto.body.clientes.some((c) => c.id === id && c.nombre === 'Solo del otro'));
}

async function testIdInvalidoDa400() {
  const respuesta = await peticion(servidor.puerto, 'PATCH', '/clientes/abc', { nombre: 'X' }, tokenContador);
  assert.strictEqual(respuesta.statusCode, 400);
}

async function testSoloContadorYAuxiliar() {
  for (const cuenta of [administrador, sistema]) {
    const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/clientes', null, token)).statusCode, 403);
    assert.strictEqual((await crear(token, { nombre: 'No debe' })).statusCode, 403);
    assert.strictEqual(
      (await peticion(servidor.puerto, 'PATCH', '/clientes/1', { nombre: 'No debe' }, token)).statusCode,
      403
    );
  }
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/clientes')).statusCode, 401);
}

describe('/clientes', () => {
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

  test('el seed crea la tabla clientes y se puede repetir', testSeedCreaLaTablaDeFormaIdempotente);
  test('el alta responde 201 con nombre recortado y RFC en mayúsculas', testAltaDevuelve201ConElClienteSinEspaciosYRfcEnMayusculas);
  test('el RFC es opcional y acepta persona física', testRfcEsOpcionalYAceptaPersonaFisica);
  test('rechaza datos inválidos con mensaje en tres partes', testRechazaDatosInvalidosConTresPartes);
  test(
    'nombre repetido del mismo usuario da 409 sin distinguir mayúsculas ni acentos',
    testNombreRepetidoDelMismoUsuarioDa409SinDistinguirMayusculasNiAcentos
  );
  test('dos usuarios pueden tener el mismo nombre', testDosUsuariosPuedenTenerElMismoNombre);
  test('lista solo lo propio, activos primero', testListaSoloLoPropioConActivosPrimero);
  test('editar cambia nombre y RFC y permite limpiar el RFC', testEditarCambiaNombreYRfcYPermiteLimpiarElRfc);
  test('editar con nombre repetido da 409 y con datos inválidos 400', testEditarConNombreRepetidoDa409YDatosInvalidosDa400);
  test('se desactiva y se reactiva', testDesactivarYReactivar);
  test('el cliente de otro usuario da 404', testNoSePuedeTocarElClienteDeOtro);
  test('id inválido da 400', testIdInvalidoDa400);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
