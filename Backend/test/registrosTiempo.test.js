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
 * Pruebas de integración del cronómetro y los bloques de tiempo (rebanada 14): `/tiempo` y los
 * `minutos` de `GET /actividades`. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo usa y borra cuentas `zz_test_` (sus filas se borran en cascada). Las duraciones no se esperan:
 * se envejece el `inicio` de bloques de esas cuentas con un UPDATE filtrado por el usuario de prueba.
 */

const MES = '2026-11';
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
let secuencia = 0;

async function nuevoCliente(token, nombre) {
  secuencia += 1;
  const respuesta = await peticion(
    servidor.puerto, 'POST', '/clientes', { nombre: nombre ?? `Cliente tiempo ${secuencia}` }, token
  );
  assert.strictEqual(respuesta.statusCode, 201);
  return respuesta.body.cliente;
}

async function nuevoTipo(token, extra = {}) {
  secuencia += 1;
  const respuesta = await peticion(
    servidor.puerto, 'POST', '/tipos-actividad', { nombre: `Tipo tiempo ${secuencia}`, ...extra }, token
  );
  assert.strictEqual(respuesta.statusCode, 201);
  return respuesta.body.tipo;
}

async function asignar(token, tipo, clientes) {
  const respuesta = await peticion(
    servidor.puerto, 'PUT', `/tipos-actividad/${tipo.id}/clientes`, { agregar: clientes.map((c) => c.id) }, token
  );
  assert.strictEqual(respuesta.statusCode, 200);
}

/** Crea un cliente y un tipo del usuario y los deja en su cartera. */
async function nuevoRenglon(token, extraTipo = {}) {
  const cliente = await nuevoCliente(token);
  const tipo = await nuevoTipo(token, extraTipo);
  await asignar(token, tipo, [cliente]);
  return { cliente, tipo };
}

const iniciar = (token, { cliente, tipo }, mes = MES) =>
  peticion(servidor.puerto, 'POST', '/tiempo/iniciar', { cliente_id: cliente.id, tipo_id: tipo.id, mes }, token);
const detener = (token) => peticion(servidor.puerto, 'POST', '/tiempo/detener', {}, token);
const activo = (token) => peticion(servidor.puerto, 'GET', '/tiempo/activo', null, token);
const bloques = (token, { cliente, tipo }, mes = MES) =>
  peticion(servidor.puerto, 'GET', `/tiempo?cliente_id=${cliente.id}&tipo_id=${tipo.id}&mes=${mes}`, null, token);
const manual = (token, { cliente, tipo }, minutos, mes = MES) =>
  peticion(servidor.puerto, 'POST', '/tiempo/manual', { cliente_id: cliente.id, tipo_id: tipo.id, mes, minutos }, token);
const borrar = (token, id) => peticion(servidor.puerto, 'DELETE', `/tiempo/${id}`, null, token);
const listarMes = (token, mes = MES) => peticion(servidor.puerto, 'GET', `/actividades?mes=${mes}`, null, token);
const renglonDe = (cuerpo, { cliente, tipo }) =>
  cuerpo.actividades.find((r) => r.cliente_id === cliente.id && r.tipo_id === tipo.id);

/** Atrasa el inicio de un bloque de una cuenta de prueba para simular que lleva ese tiempo. */
async function envejecerBloque(usuario, id, minutos) {
  await query(
    'UPDATE registros_tiempo SET inicio = DATE_SUB(inicio, INTERVAL ? MINUTE) WHERE id = ? AND usuario_id = ?',
    [minutos, id, usuario.id]
  );
}

async function enMarcha(usuario) {
  const filas = await query('SELECT id FROM registros_tiempo WHERE usuario_id = ? AND fin IS NULL', [usuario.id]);
  return filas.map((f) => f.id);
}

async function testSeedCreaLaTablaDeFormaIdempotente() {
  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });
  const columnas = await query('SHOW COLUMNS FROM registros_tiempo');
  assert.deepStrictEqual(
    columnas.map((c) => c.Field),
    ['id', 'usuario_id', 'cliente_id', 'tipo_id', 'mes', 'inicio', 'fin', 'minutos', 'cobrable', 'manual']
  );
  const indices = await query('SHOW KEYS FROM registros_tiempo');
  const porNombre = {};
  for (const k of indices) (porNombre[k.Key_name] ||= []).push(k.Column_name);
  const grupos = Object.values(porNombre).map((c) => c.join(','));
  assert.ok(grupos.includes('usuario_id,mes'), 'índice por (usuario_id, mes)');
  assert.ok(grupos.includes('cliente_id,tipo_id,mes'), 'índice por (cliente_id, tipo_id, mes)');
}

async function testIniciarDejaUnCronometroEnMarchaConLaHoraDelServidor() {
  const renglon = await nuevoRenglon(tokenContador);
  const sinNada = await activo(tokenContador);
  assert.strictEqual(sinNada.statusCode, 200);
  assert.strictEqual(sinNada.body.activo, null);
  assert.match(sinNada.body.ahora, FORMATO_FECHA);

  const respuesta = await iniciar(tokenContador, renglon);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.detenido, null);
  assert.match(respuesta.body.ahora, FORMATO_FECHA);
  const nuevo = respuesta.body.activo;
  assert.strictEqual(nuevo.cliente_id, renglon.cliente.id);
  assert.strictEqual(nuevo.tipo_id, renglon.tipo.id);
  assert.strictEqual(nuevo.mes, MES);
  assert.strictEqual(nuevo.cliente, renglon.cliente.nombre, 'trae los nombres para el aviso fijo');
  assert.strictEqual(nuevo.tipo, renglon.tipo.nombre);
  assert.match(nuevo.inicio, FORMATO_FECHA);
  assert.strictEqual(nuevo.fin, null);

  const consultado = await activo(tokenContador);
  assert.strictEqual(consultado.body.activo.id, nuevo.id, 'sobrevive: el servidor lo recuerda');
  assert.strictEqual(consultado.body.activo.inicio, nuevo.inicio);
  const filas = await query('SELECT fin, minutos, manual FROM registros_tiempo WHERE id = ?', [nuevo.id]);
  assert.strictEqual(filas[0].fin, null);
  assert.strictEqual(filas[0].minutos, null);
  assert.strictEqual(filas[0].manual, 0);
  await detener(tokenContador);
}

async function testDetenerGuardaElBloqueConSusMinutosYMinimoUno() {
  const renglon = await nuevoRenglon(tokenContador);
  assert.strictEqual((await detener(tokenContador)).statusCode, 404, 'sin cronómetro en marcha');

  const corto = (await iniciar(tokenContador, renglon)).body.activo;
  const detenidoCorto = await detener(tokenContador);
  assert.strictEqual(detenidoCorto.statusCode, 200);
  assert.strictEqual(detenidoCorto.body.bloque.id, corto.id);
  assert.strictEqual(detenidoCorto.body.bloque.minutos, 1, 'menos de un minuto se guarda como 1');
  assert.match(detenidoCorto.body.bloque.fin, FORMATO_FECHA);
  assert.strictEqual((await activo(tokenContador)).body.activo, null);
  assert.strictEqual((await detener(tokenContador)).statusCode, 404, 'detener dos veces: ya no hay nada');

  const largo = (await iniciar(tokenContador, renglon)).body.activo;
  await envejecerBloque(contador, largo.id, 80);
  const detenidoLargo = await detener(tokenContador);
  assert.strictEqual(detenidoLargo.body.bloque.minutos, 80);
  assert.strictEqual(detenidoLargo.body.bloque.manual, false);
}

async function testIniciarOtroDetieneElAnteriorYGuardaSuBloque() {
  const a = await nuevoRenglon(tokenContador);
  const b = await nuevoRenglon(tokenContador);
  const primero = (await iniciar(tokenContador, a)).body.activo;
  await envejecerBloque(contador, primero.id, 30);

  const segundo = await iniciar(tokenContador, b);
  assert.strictEqual(segundo.statusCode, 200);
  assert.strictEqual(segundo.body.detenido.id, primero.id);
  assert.strictEqual(segundo.body.detenido.minutos, 30);
  assert.strictEqual(segundo.body.detenido.cliente, a.cliente.nombre, 'avisa cuál se detuvo');
  assert.strictEqual(segundo.body.detenido.tipo, a.tipo.nombre);
  assert.strictEqual(segundo.body.activo.cliente_id, b.cliente.id);
  assert.deepStrictEqual(await enMarcha(contador), [segundo.body.activo.id]);

  const guardados = (await bloques(tokenContador, a)).body.bloques;
  assert.strictEqual(guardados.length, 1);
  assert.strictEqual(guardados[0].minutos, 30);
}

async function testDosPeticionesSimultaneasDeIniciarNoDejanDosEnMarcha() {
  const a = await nuevoRenglon(tokenAuxiliar);
  const b = await nuevoRenglon(tokenAuxiliar);
  for (let vuelta = 0; vuelta < 3; vuelta += 1) {
    const [r1, r2] = await Promise.all([iniciar(tokenAuxiliar, a), iniciar(tokenAuxiliar, b)]);
    assert.strictEqual(r1.statusCode, 200);
    assert.strictEqual(r2.statusCode, 200);
    assert.strictEqual((await enMarcha(auxiliar)).length, 1, `vuelta ${vuelta}: un solo cronómetro`);
  }
  const mismo = await Promise.all([iniciar(tokenAuxiliar, a), iniciar(tokenAuxiliar, a), iniciar(tokenAuxiliar, a)]);
  assert.ok(mismo.every((r) => r.statusCode === 200));
  assert.strictEqual((await enMarcha(auxiliar)).length, 1);
  await detener(tokenAuxiliar);
  assert.strictEqual((await enMarcha(auxiliar)).length, 0);
}

async function testCadaUsuarioSoloTocaSuTiempo() {
  const mio = await nuevoRenglon(tokenContador);
  const ajeno = await nuevoRenglon(tokenOtroContador);
  const arrancado = (await iniciar(tokenContador, mio)).body.activo;
  const bloqueMio = (await manual(tokenContador, mio, 15)).body.bloque;

  const suActivo = await activo(tokenOtroContador);
  assert.strictEqual(suActivo.body.activo, null, 'no ve el cronómetro ajeno');
  assert.strictEqual((await detener(tokenOtroContador)).statusCode, 404, 'no detiene el ajeno');
  assert.strictEqual((await borrar(tokenOtroContador, bloqueMio.id)).statusCode, 404, 'no borra el bloque ajeno');
  assert.strictEqual((await borrar(tokenOtroContador, arrancado.id)).statusCode, 404);
  assert.strictEqual((await bloques(tokenOtroContador, mio)).statusCode, 404, 'no lista bloques de clientes ajenos');
  assert.strictEqual((await iniciar(tokenOtroContador, mio)).statusCode, 404);
  assert.strictEqual((await manual(tokenOtroContador, mio, 10)).statusCode, 404);
  assert.strictEqual(
    (await iniciar(tokenOtroContador, { cliente: ajeno.cliente, tipo: mio.tipo })).statusCode, 404, 'mezclar cliente propio y tipo ajeno'
  );
  assert.strictEqual(
    (await manual(tokenOtroContador, { cliente: mio.cliente, tipo: ajeno.tipo }, 10)).statusCode, 404
  );

  assert.strictEqual((await activo(tokenContador)).body.activo.id, arrancado.id, 'lo ajeno no lo tocó');
  const listaAjena = (await listarMes(tokenOtroContador)).body;
  assert.ok(!listaAjena.actividades.some((r) => r.cliente_id === mio.cliente.id), 'ni lo ve en su lista del mes');
  const filas = await query('SELECT COUNT(*) AS n FROM registros_tiempo WHERE usuario_id = ?', [otroContador.id]);
  assert.strictEqual(filas[0].n, 0, 'el otro usuario no quedó con filas');
  await detener(tokenContador);
}

async function testHistorialSigueAunqueElClienteSalgaDeLaCartera() {
  const renglon = await nuevoRenglon(tokenContador);
  const activoAhora = (await iniciar(tokenContador, renglon)).body.activo;
  await envejecerBloque(contador, activoAhora.id, 45);
  await detener(tokenContador);
  await manual(tokenContador, renglon, 15);

  await peticion(
    servidor.puerto, 'PUT', `/tipos-actividad/${renglon.tipo.id}/clientes`, { quitar: [renglon.cliente.id] }, tokenContador
  );
  const alSalir = renglonDe((await listarMes(tokenContador)).body, renglon);
  assert.ok(alSalir, 'el renglón con tiempo sigue saliendo en su mes');
  assert.strictEqual(alSalir.minutos, 60);
  assert.strictEqual(alSalir.hecha, false);
  assert.strictEqual(
    renglonDe((await listarMes(tokenContador, '2026-10')).body, renglon),
    undefined,
    'solo en el mes donde se registró el tiempo'
  );

  await peticion(servidor.puerto, 'PATCH', `/clientes/${renglon.cliente.id}`, { activo: false }, tokenContador);
  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${renglon.tipo.id}`, { activo: false }, tokenContador);
  const desactivado = renglonDe((await listarMes(tokenContador)).body, renglon);
  assert.ok(desactivado);
  assert.strictEqual(desactivado.cliente_activo, false);
  assert.strictEqual(desactivado.tipo_activo, false);
  assert.strictEqual(desactivado.minutos, 60);

  const historial = await bloques(tokenContador, renglon);
  assert.strictEqual(historial.statusCode, 200);
  assert.deepStrictEqual(historial.body.bloques.map((b) => b.minutos), [45, 15]);
}

async function testIniciarYAgregarExigenCarteraActivaPeroDetenerYBorrarNo() {
  const renglon = await nuevoRenglon(tokenContador);
  const arrancado = (await iniciar(tokenContador, renglon)).body.activo;
  const bloque = (await manual(tokenContador, renglon, 20)).body.bloque;
  await peticion(
    servidor.puerto, 'PUT', `/tipos-actividad/${renglon.tipo.id}/clientes`, { quitar: [renglon.cliente.id] }, tokenContador
  );

  const noInicia = await iniciar(tokenContador, renglon);
  assert.strictEqual(noInicia.statusCode, 400);
  assert.match(noInicia.body.mensaje, / sobre .+: /);
  const noAgrega = await manual(tokenContador, renglon, 10);
  assert.strictEqual(noAgrega.statusCode, 400);
  assert.match(noAgrega.body.mensaje, / sobre .+: /);
  assert.deepStrictEqual(await enMarcha(contador), [arrancado.id], 'el rechazo no tocó el cronómetro en marcha');

  const detenido = await detener(tokenContador);
  assert.strictEqual(detenido.statusCode, 200, 'detener solo exige que sea propio');
  assert.strictEqual(detenido.body.bloque.id, arrancado.id);
  assert.strictEqual((await borrar(tokenContador, bloque.id)).statusCode, 200, 'borrar solo exige que sea propio');
}

async function testTiempoManualConLimitesYCopiaDeCobrable() {
  const cobrable = await nuevoRenglon(tokenContador, { cobrable: true });
  const noCobrable = await nuevoRenglon(tokenContador, { cobrable: false });

  const uno = await manual(tokenContador, cobrable, 1);
  assert.strictEqual(uno.statusCode, 201);
  assert.strictEqual(uno.body.bloque.minutos, 1);
  assert.strictEqual(uno.body.bloque.manual, true);
  assert.strictEqual(uno.body.bloque.cobrable, true, 'copia el valor del tipo al crear el bloque');
  assert.match(uno.body.bloque.inicio, FORMATO_FECHA);
  assert.match(uno.body.bloque.fin, FORMATO_FECHA);
  const maximo = await manual(tokenContador, cobrable, 1440);
  assert.strictEqual(maximo.statusCode, 201);
  assert.strictEqual((await manual(tokenContador, noCobrable, 5)).body.bloque.cobrable, false);

  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${cobrable.tipo.id}`, { cobrable: false }, tokenContador);
  const guardados = (await bloques(tokenContador, cobrable)).body.bloques;
  assert.ok(guardados.every((b) => b.cobrable === true), 'cambiar el tipo después no reescribe los bloques');

  for (const minutos of [0, -5, 1441, 1.5, '30', null, undefined, 'abc', true]) {
    const respuesta = await manual(tokenContador, cobrable, minutos);
    assert.strictEqual(respuesta.statusCode, 400, `minutos ${JSON.stringify(minutos)}`);
    assert.match(respuesta.body.mensaje, / sobre .+: /);
  }
  const filas = await query('SELECT COUNT(*) AS n FROM registros_tiempo WHERE cliente_id = ?', [cobrable.cliente.id]);
  assert.strictEqual(filas[0].n, 2, 'los rechazados no guardaron nada');
}

async function testBorrarBloqueYListarBloquesDelRenglon() {
  const renglon = await nuevoRenglon(tokenContador);
  const otroMes = await manual(tokenContador, renglon, 7, '2026-10');
  const a = (await manual(tokenContador, renglon, 10)).body.bloque;
  const b = (await manual(tokenContador, renglon, 25)).body.bloque;

  const lista = (await bloques(tokenContador, renglon)).body.bloques;
  assert.deepStrictEqual(lista.map((x) => x.id), [a.id, b.id], 'solo el mes pedido, en orden');
  assert.deepStrictEqual(
    Object.keys(lista[0]).sort(),
    ['cliente', 'cliente_id', 'cobrable', 'fin', 'id', 'inicio', 'manual', 'mes', 'minutos', 'tipo', 'tipo_id']
  );
  assert.ok(otroMes.body.bloque.id);

  const borrado = await borrar(tokenContador, a.id);
  assert.strictEqual(borrado.statusCode, 200);
  assert.deepStrictEqual(borrado.body, { ok: true });
  assert.deepStrictEqual((await bloques(tokenContador, renglon)).body.bloques.map((x) => x.id), [b.id]);
  assert.strictEqual((await borrar(tokenContador, a.id)).statusCode, 404, 'ya no existe');
  assert.strictEqual((await borrar(tokenContador, 'abc')).statusCode, 400);
  assert.strictEqual((await borrar(tokenContador, 99999999)).statusCode, 404);
  assert.strictEqual(renglonDe((await listarMes(tokenContador)).body, renglon).minutos, 25);
}

async function testActividadesSumaSoloBloquesTerminados() {
  const renglon = await nuevoRenglon(tokenContador);
  const otro = await nuevoRenglon(tokenContador);
  assert.strictEqual(renglonDe((await listarMes(tokenContador)).body, renglon).minutos, 0, 'sin bloques: cero');

  await manual(tokenContador, renglon, 30);
  const terminado = (await iniciar(tokenContador, renglon)).body.activo;
  await envejecerBloque(contador, terminado.id, 20);
  await detener(tokenContador);
  const enCurso = (await iniciar(tokenContador, renglon)).body.activo;
  await envejecerBloque(contador, enCurso.id, 500);

  const lista = (await listarMes(tokenContador)).body;
  assert.strictEqual(renglonDe(lista, renglon).minutos, 50, 'el bloque en marcha no suma');
  assert.strictEqual(renglonDe(lista, otro).minutos, 0);
  assert.strictEqual(typeof renglonDe(lista, renglon).minutos, 'number');

  await detener(tokenContador);
  assert.strictEqual(renglonDe((await listarMes(tokenContador)).body, renglon).minutos, 550, 'al detener ya suma');
}

async function testRechazaCuerposInvalidos() {
  const renglon = await nuevoRenglon(tokenContador);
  const base = { cliente_id: renglon.cliente.id, tipo_id: renglon.tipo.id, mes: MES };
  const invalidos = [
    [{ ...base, mes: '2026-13' }, 'mes inválido'],
    [{ ...base, mes: undefined }, 'falta el mes'],
    [{ ...base, cliente_id: 'x' }, 'cliente inválido'],
    [{ ...base, tipo_id: 0 }, 'tipo inválido'],
  ];
  for (const [cuerpo, descripcion] of invalidos) {
    for (const ruta of ['/tiempo/iniciar', '/tiempo/manual']) {
      const respuesta = await peticion(servidor.puerto, 'POST', ruta, { ...cuerpo, minutos: 5 }, tokenContador);
      assert.strictEqual(respuesta.statusCode, 400, `${ruta}: ${descripcion}`);
      assert.match(respuesta.body.mensaje, / sobre .+: /);
    }
  }
  const sinFiltros = await peticion(servidor.puerto, 'GET', '/tiempo', null, tokenContador);
  assert.strictEqual(sinFiltros.statusCode, 400);
  const mesMalo = await peticion(
    servidor.puerto, 'GET', `/tiempo?cliente_id=${renglon.cliente.id}&tipo_id=${renglon.tipo.id}&mes=2026-99`, null, tokenContador
  );
  assert.strictEqual(mesMalo.statusCode, 400);
  assert.deepStrictEqual(await enMarcha(contador), [], 'ningún rechazo dejó un cronómetro');
}

async function testSoloContadorYAuxiliar() {
  for (const cuenta of [administrador, sistema]) {
    const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    assert.strictEqual((await activo(token)).statusCode, 403);
    assert.strictEqual((await detener(token)).statusCode, 403);
    assert.strictEqual(
      (await peticion(servidor.puerto, 'POST', '/tiempo/iniciar', { cliente_id: 1, tipo_id: 1, mes: MES }, token)).statusCode, 403
    );
    assert.strictEqual(
      (await peticion(servidor.puerto, 'POST', '/tiempo/manual', { cliente_id: 1, tipo_id: 1, mes: MES, minutos: 5 }, token)).statusCode, 403
    );
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/tiempo?cliente_id=1&tipo_id=1&mes=2026-11', null, token)).statusCode, 403);
    assert.strictEqual((await borrar(token, 1)).statusCode, 403);
  }
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/tiempo/activo')).statusCode, 401);
  assert.strictEqual((await peticion(servidor.puerto, 'POST', '/tiempo/iniciar', {})).statusCode, 401);
  assert.strictEqual((await peticion(servidor.puerto, 'DELETE', '/tiempo/1')).statusCode, 401);
}

describe('/tiempo (cronómetro y bloques)', () => {
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

  test('el seed crea registros_tiempo y se puede repetir', testSeedCreaLaTablaDeFormaIdempotente);
  test('iniciar deja un cronómetro en marcha con la hora del servidor', testIniciarDejaUnCronometroEnMarchaConLaHoraDelServidor);
  test('detener guarda el bloque con sus minutos (mínimo 1)', testDetenerGuardaElBloqueConSusMinutosYMinimoUno);
  test('iniciar otro detiene el anterior y guarda su bloque', testIniciarOtroDetieneElAnteriorYGuardaSuBloque);
  test('dos iniciar simultáneos no dejan dos cronómetros en marcha', testDosPeticionesSimultaneasDeIniciarNoDejanDosEnMarcha);
  test('cada usuario solo toca su tiempo (lo ajeno es 404)', testCadaUsuarioSoloTocaSuTiempo);
  test('el historial sigue aunque el cliente salga de la cartera o se desactive', testHistorialSigueAunqueElClienteSalgaDeLaCartera);
  test('iniciar y agregar exigen cartera activa; detener y borrar no', testIniciarYAgregarExigenCarteraActivaPeroDetenerYBorrarNo);
  test('tiempo manual con límites y copia de cobrable', testTiempoManualConLimitesYCopiaDeCobrable);
  test('borrar un bloque y listar los bloques del renglón', testBorrarBloqueYListarBloquesDelRenglon);
  test('GET /actividades suma solo bloques terminados', testActividadesSumaSoloBloquesTerminados);
  test('rechaza cuerpos y consultas inválidos (400)', testRechazaCuerposInvalidos);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
