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

/**
 * Pruebas de integración: el administrador cambia la prioridad de los casos de
 * cualquier contador y el dueño del caso recibe un aviso dentro de la app.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

// Lunes 2 de noviembre de 2026: con Alta (5 días hábiles) vence el lunes 9; con Baja (15), el lunes 23.
const FECHA_INICIO = '2026-11-02';

let servidor;
let administrador;
let contador;
let otroContador;

const tokenAdmin = () => iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
const tokenContador = () => iniciarSesion(servidor.puerto, contador.correo, contador.password);

/** Caso de prueba del contador, con prioridad Media e inicio fijo. */
async function casoDelContador(cliente = 'zz_test Gamesa') {
  const id = await crearCasoDePrueba(contador.id, { cliente, prioridad: 'Media' });
  await query('UPDATE casos SET fecha_inicio = ?, fecha_vencimiento = ? WHERE id = ?', [FECHA_INICIO, '2026-11-16', id]);
  return id;
}

function cambiarPrioridad(id, cuerpo, token) {
  return peticion(servidor.puerto, 'PATCH', `/casos/${id}/prioridad`, cuerpo, token);
}

async function avisosDe(usuarioId) {
  return query('SELECT caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);
}

async function filaCaso(id) {
  const [fila] = await query(
    "SELECT prioridad, DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS vence FROM casos WHERE id = ?",
    [id]
  );
  return fila;
}

// ---------- La tabla de avisos existe con sus columnas ----------
async function testTablaNotificaciones() {
  const columnas = (await query('SHOW COLUMNS FROM notificaciones')).map((columna) => columna.Field);
  assert.deepStrictEqual(columnas, ['id', 'usuario_id', 'caso_id', 'junta_id', 'mensaje', 'leida', 'creado_en']);
}

// ---------- El administrador cambia la prioridad: el vencimiento no se mueve y se avisa al dueño ----------
async function testAdminCambiaPrioridadYAvisa() {
  const id = await casoDelContador();

  const respuesta = await cambiarPrioridad(id, { prioridad: 'Alta' }, await tokenAdmin());

  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.caso.prioridad, 'Alta');
  assert.match(respuesta.body.caso.fecha_vencimiento, /^2026-11-16/, 'el vencimiento lo decide el contador');
  assert.deepStrictEqual(await filaCaso(id), { prioridad: 'Alta', vence: '2026-11-16' });

  const avisos = await avisosDe(contador.id);
  assert.strictEqual(avisos.length, 1, 'un aviso para el dueño del caso');
  assert.strictEqual(avisos[0].caso_id, id);
  assert.strictEqual(avisos[0].leida, 0);
  assert.strictEqual(
    avisos[0].mensaje,
    `${administrador.nombre} cambió la prioridad de «zz_test Gamesa» de Media a Alta.`
  );
}

// ---------- Si la prioridad no cambia, no se modifica nada ni se avisa ----------
async function testMismaPrioridadNoAvisa() {
  const id = await casoDelContador('zz_test Barcel');
  const antes = (await avisosDe(contador.id)).length;

  const respuesta = await cambiarPrioridad(id, { prioridad: 'Media' }, await tokenAdmin());

  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(await filaCaso(id), { prioridad: 'Media', vence: '2026-11-16' }, 'el vencimiento no cambia');
  assert.strictEqual((await avisosDe(contador.id)).length, antes, 'no se crea aviso');
}

// ---------- Solo el administrador; datos inválidos o caso inexistente no cambian nada ----------
async function testPermisosYValidaciones() {
  const id = await casoDelContador('zz_test Sabritas');

  assert.strictEqual((await cambiarPrioridad(id, { prioridad: 'Alta' }, await tokenContador())).statusCode, 403, 'contador');
  assert.strictEqual((await cambiarPrioridad(id, { prioridad: 'Alta' })).statusCode, 401, 'sin sesión');

  const token = await tokenAdmin();
  for (const cuerpo of [{}, { prioridad: 'Urgente' }, { prioridad: 3 }]) {
    assert.strictEqual((await cambiarPrioridad(id, cuerpo, token)).statusCode, 400, JSON.stringify(cuerpo));
  }
  assert.strictEqual((await cambiarPrioridad(999999999, { prioridad: 'Alta' }, token)).statusCode, 404);
  assert.strictEqual((await cambiarPrioridad(`${id}abc`, { prioridad: 'Alta' }, token)).statusCode, 404);

  assert.deepStrictEqual(await filaCaso(id), { prioridad: 'Media', vence: '2026-11-16' }, 'nada cambió');
  const avisos = await avisosDe(contador.id);
  assert.ok(!avisos.some((aviso) => aviso.caso_id === id), 'ningún aviso de este caso');
}

// ---------- Cada quien ve solo sus avisos, del más reciente al más antiguo ----------
async function testListarAvisosPropios() {
  const id = await casoDelContador('zz_test Bimbo');
  const token = await tokenAdmin();
  await cambiarPrioridad(id, { prioridad: 'Alta' }, token);
  await cambiarPrioridad(id, { prioridad: 'Baja' }, token);

  const lista = await peticion(servidor.puerto, 'GET', '/notificaciones', null, await tokenContador());
  assert.strictEqual(lista.statusCode, 200);
  assert.ok(lista.body.no_leidas >= 2);
  const [masReciente] = lista.body.notificaciones;
  assert.match(masReciente.mensaje, /«zz_test Bimbo» de Alta a Baja\.$/);
  assert.strictEqual(masReciente.leida, false);
  assert.match(masReciente.creado_en, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'fecha en hora local');
  assert.deepStrictEqual(Object.keys(masReciente).sort(), ['caso_id', 'creado_en', 'id', 'junta_id', 'junta_inicio', 'leida', 'mensaje']);

  const ajena = await peticion(
    servidor.puerto,
    'GET',
    '/notificaciones',
    null,
    await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password)
  );
  assert.deepStrictEqual(ajena.body, { notificaciones: [], no_leidas: 0 }, 'otro contador no ve avisos ajenos');
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/notificaciones')).statusCode, 401);
}

// ---------- Marcar como leídos solo afecta los avisos propios ----------
async function testMarcarLeidas() {
  const id = await casoDelContador('zz_test Marinela');
  await cambiarPrioridad(id, { prioridad: 'Alta' }, await tokenAdmin());
  await query('INSERT INTO notificaciones (usuario_id, caso_id, mensaje, leida, creado_en) VALUES (?, ?, ?, 0, NOW())', [
    otroContador.id,
    id,
    'zz_test aviso ajeno',
  ]);

  const respuesta = await peticion(servidor.puerto, 'PATCH', '/notificaciones/leidas', null, await tokenContador());
  assert.strictEqual(respuesta.statusCode, 200);

  const lista = await peticion(servidor.puerto, 'GET', '/notificaciones', null, await tokenContador());
  assert.strictEqual(lista.body.no_leidas, 0);
  assert.ok(lista.body.notificaciones.every((aviso) => aviso.leida === true));

  const [ajeno] = await query('SELECT leida FROM notificaciones WHERE usuario_id = ?', [otroContador.id]);
  assert.strictEqual(ajeno.leida, 0, 'el aviso de otra cuenta sigue sin leer');
}

describe('prioridad cambiada por el administrador y avisos al contador', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('existe la tabla notificaciones con sus columnas', testTablaNotificaciones);
  test('el administrador cambia la prioridad, el vencimiento no se mueve y el dueño recibe un aviso', testAdminCambiaPrioridadYAvisa);
  test('con la misma prioridad no cambia nada ni se avisa', testMismaPrioridadNoAvisa);
  test('solo el administrador; datos inválidos o caso inexistente no cambian nada', testPermisosYValidaciones);
  test('cada quien ve solo sus avisos, del más reciente al más antiguo', testListarAvisosPropios);
  test('marcar como leídos solo afecta los avisos propios', testMarcarLeidas);
});
