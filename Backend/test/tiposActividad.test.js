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
    ['id', 'usuario_id', 'nombre', 'cobrable', 'activo', 'creado_en', 'regla_vencimiento', 'dia_del_mes']
  );
}

async function testMigracionDeVencimientoNoPierdeDatosYDejaLosTiposEnNinguna() {
  // Sin DDL destructivo: la base de pruebas se comparte con el backend de desarrollo y quitar las
  // columnas borraría las reglas de los tipos reales. Se comprueba que repetir la migración conserva
  // lo guardado y que la columna deja en «ninguna» a los tipos que ya existían (su valor por defecto).
  const alta = await crear(tokenContador, {
    nombre: 'Tipo con regla antes de migrar',
    regla_vencimiento: 'dia_del_mes',
    dia_del_mes: 5,
  });
  const id = alta.body.tipo.id;

  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });

  const filas = await query('SELECT nombre, regla_vencimiento, dia_del_mes FROM tipos_actividad WHERE id = ?', [id]);
  assert.strictEqual(filas[0].nombre, 'Tipo con regla antes de migrar');
  assert.strictEqual(filas[0].regla_vencimiento, 'dia_del_mes');
  assert.strictEqual(filas[0].dia_del_mes, 5);
  const columnas = await query('SHOW COLUMNS FROM tipos_actividad');
  const regla = columnas.find((c) => c.Field === 'regla_vencimiento');
  assert.strictEqual(regla.Type, "enum('ninguna','dia_del_mes','fin_de_mes','dia_17_rfc')");
  assert.strictEqual(regla.Null, 'NO');
  assert.strictEqual(regla.Default, 'ninguna');
  assert.strictEqual(columnas.find((c) => c.Field === 'dia_del_mes').Null, 'YES');
}

async function testAltaDevuelve201ConCobrableApagadoPorDefecto() {
  const respuesta = await crear(tokenContador, { nombre: '  Revisión de facturas  ' });
  assert.strictEqual(respuesta.statusCode, 201);
  const { tipo } = respuesta.body;
  assert.deepStrictEqual(Object.keys(tipo).sort(), ['activo', 'cobrable', 'creado_en', 'dia_del_mes', 'id', 'nombre', 'regla_vencimiento', 'total_clientes']);
  assert.strictEqual(tipo.total_clientes, 0);
  assert.strictEqual(tipo.regla_vencimiento, 'ninguna');
  assert.strictEqual(tipo.dia_del_mes, null);
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

async function testAltaConCadaReglaDeVencimiento() {
  const fijo = await crear(tokenContador, { nombre: 'Vence día 3', regla_vencimiento: 'dia_del_mes', dia_del_mes: 3 });
  assert.strictEqual(fijo.statusCode, 201);
  assert.strictEqual(fijo.body.tipo.regla_vencimiento, 'dia_del_mes');
  assert.strictEqual(fijo.body.tipo.dia_del_mes, 3);

  const limites = await crear(tokenContador, { nombre: 'Vence día 28', regla_vencimiento: 'dia_del_mes', dia_del_mes: 28 });
  assert.strictEqual(limites.body.tipo.dia_del_mes, 28);
  const uno = await crear(tokenContador, { nombre: 'Vence día 1', regla_vencimiento: 'dia_del_mes', dia_del_mes: 1 });
  assert.strictEqual(uno.body.tipo.dia_del_mes, 1);

  const fin = await crear(tokenContador, { nombre: 'Vence a fin de mes', regla_vencimiento: 'fin_de_mes', dia_del_mes: 9 });
  assert.strictEqual(fin.body.tipo.regla_vencimiento, 'fin_de_mes');
  assert.strictEqual(fin.body.tipo.dia_del_mes, null, 'con otra regla el día se guarda NULL');

  const rfc = await crear(tokenContador, { nombre: 'Vence el 17', regla_vencimiento: 'dia_17_rfc' });
  assert.strictEqual(rfc.body.tipo.regla_vencimiento, 'dia_17_rfc');
  assert.strictEqual(rfc.body.tipo.dia_del_mes, null);

  const ninguna = await crear(tokenContador, { nombre: 'Sin fecha explícita', regla_vencimiento: 'ninguna' });
  assert.strictEqual(ninguna.body.tipo.regla_vencimiento, 'ninguna');

  const lista = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, tokenContador);
  const dia3 = lista.body.tipos.find((t) => t.nombre === 'Vence día 3');
  assert.strictEqual(dia3.regla_vencimiento, 'dia_del_mes');
  assert.strictEqual(dia3.dia_del_mes, 3);
}

async function testRechazaVencimientoInvalidoConErrorDeCampo() {
  const casos = [
    [{ regla_vencimiento: 'cada_lunes' }, 'regla desconocida'],
    [{ regla_vencimiento: 5 }, 'regla que no es texto'],
    [{ regla_vencimiento: 'dia_del_mes' }, 'día fijo sin día'],
    [{ regla_vencimiento: 'dia_del_mes', dia_del_mes: 0 }, 'día 0'],
    [{ regla_vencimiento: 'dia_del_mes', dia_del_mes: 29 }, 'día 29'],
    [{ regla_vencimiento: 'dia_del_mes', dia_del_mes: 3.5 }, 'día con decimales'],
    [{ regla_vencimiento: 'dia_del_mes', dia_del_mes: '3' }, 'día como texto'],
  ];
  for (const [extra, descripcion] of casos) {
    const respuesta = await crear(tokenContador, { nombre: `Inválido ${descripcion}`, ...extra });
    assert.strictEqual(respuesta.statusCode, 400, descripcion);
    assert.match(respuesta.body.mensaje, / sobre .+: /, `${descripcion}: mensaje en tres partes`);
  }
  const campoRegla = await crear(tokenContador, { nombre: 'Campo regla', regla_vencimiento: 'cada_lunes' });
  assert.match(campoRegla.body.mensaje, / sobre vencimiento: /);
  const campoDia = await crear(tokenContador, { nombre: 'Campo día', regla_vencimiento: 'dia_del_mes', dia_del_mes: 40 });
  assert.match(campoDia.body.mensaje, / sobre día del mes: /);
}

async function testEditarLaReglaDeVencimiento() {
  const alta = await crear(tokenContador, { nombre: 'Editable vencimiento' });
  const id = alta.body.tipo.id;
  const patch = (cuerpo) => peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${id}`, cuerpo, tokenContador);

  const fijo = await patch({ regla_vencimiento: 'dia_del_mes', dia_del_mes: 10 });
  assert.strictEqual(fijo.statusCode, 200);
  assert.strictEqual(fijo.body.tipo.regla_vencimiento, 'dia_del_mes');
  assert.strictEqual(fijo.body.tipo.dia_del_mes, 10);

  const soloDia = await patch({ dia_del_mes: 12 });
  assert.strictEqual(soloDia.body.tipo.dia_del_mes, 12, 'cambiar solo el día conserva la regla');
  assert.strictEqual(soloDia.body.tipo.regla_vencimiento, 'dia_del_mes');

  const soloNombre = await patch({ nombre: 'Editable vencimiento 2' });
  assert.strictEqual(soloNombre.body.tipo.regla_vencimiento, 'dia_del_mes', 'lo que no se envía no cambia');
  assert.strictEqual(soloNombre.body.tipo.dia_del_mes, 12);

  const fin = await patch({ regla_vencimiento: 'fin_de_mes' });
  assert.strictEqual(fin.body.tipo.regla_vencimiento, 'fin_de_mes');
  assert.strictEqual(fin.body.tipo.dia_del_mes, null, 'al salir de día fijo el día se borra');

  const sinDia = await patch({ regla_vencimiento: 'dia_del_mes' });
  assert.strictEqual(sinDia.statusCode, 400, 'volver a día fijo exige el día');
  const diaFueraDeRegla = await patch({ dia_del_mes: 5 });
  assert.strictEqual(diaFueraDeRegla.statusCode, 200);
  assert.strictEqual(diaFueraDeRegla.body.tipo.dia_del_mes, null, 'sin regla de día fijo el día no se guarda');

  const rfc = await patch({ regla_vencimiento: 'dia_17_rfc' });
  assert.strictEqual(rfc.body.tipo.regla_vencimiento, 'dia_17_rfc');
  const ninguna = await patch({ regla_vencimiento: 'ninguna' });
  assert.strictEqual(ninguna.body.tipo.regla_vencimiento, 'ninguna');
  const invalida = await patch({ regla_vencimiento: 'xx' });
  assert.strictEqual(invalida.statusCode, 400);
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
  test('la migración de vencimiento no pierde datos y deja los tipos en «ninguna»', testMigracionDeVencimientoNoPierdeDatosYDejaLosTiposEnNinguna);
  test('el alta responde 201 y cobrable es falso por defecto', testAltaDevuelve201ConCobrableApagadoPorDefecto);
  test('rechaza datos inválidos con mensaje en tres partes', testRechazaDatosInvalidosConTresPartes);
  test('nombre repetido da 409 sin distinguir mayúsculas ni acentos', testNombreRepetidoDa409SinDistinguirMayusculasNiAcentos);
  test('lista solo lo propio, activos primero', testListaSoloLoPropioConActivosPrimero);
  test('editar cambia nombre, cobrable y activo', testEditarNombreCobrableYActivo);
  test('editar con nombre repetido da 409 y con datos inválidos 400', testEditarConNombreRepetidoDa409YDatosInvalidosDa400);
  test('el tipo de otro usuario da 404', testNoSePuedeTocarElTipoDeOtro);
  test('el alta acepta cada regla de vencimiento', testAltaConCadaReglaDeVencimiento);
  test('rechaza vencimientos inválidos con error de campo', testRechazaVencimientoInvalidoConErrorDeCampo);
  test('editar la regla de vencimiento', testEditarLaReglaDeVencimiento);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
