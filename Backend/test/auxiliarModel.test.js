const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const {
  asignarAuxiliar,
  quitarAuxiliar,
  listarAuxiliares,
  listarContadoresQueMeTienenComoAuxiliar,
} = require('../src/models/AuxiliarModel');
const { query } = require('../src/config/db');

/**
 * Pruebas del modelo de auxiliares (consultas SQL contra MariaDB).
 * RF-AX-01 a RF-AX-06: tabla contador_auxiliar (contador ↔ auxiliares).
 *
 * Requieren que exista `src/models/AuxiliarModel.js` y una base de datos
 * MariaDB de prueba configurada en `src/config/db.js`.
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo).
 *
 * Aislamiento: cada prueba crea sus propios contadores con prefijo zz_test_
 * y la limpieza del `after` borra los datos de prueba.
 */

async function testLaTablaContadorAuxiliarExisteDespuesDelSeed() {
  await prepararBaseDeDatos();
  const tablas = await query("SHOW TABLES LIKE 'contador_auxiliar'");
  assert.strictEqual(tablas.length, 1, 'la tabla contador_auxiliar debe existir');
  const columnas = (await query('SHOW COLUMNS FROM contador_auxiliar')).map((c) => c.Field);
  assert.ok(columnas.includes('contador_id'), 'tiene la columna contador_id');
  assert.ok(columnas.includes('auxiliar_id'), 'tiene la columna auxiliar_id');
  assert.ok(columnas.includes('asignado_en'), 'tiene la columna asignado_en');
}

async function testSePuedeAsignarUnAuxiliar() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('auxiliar');

  await asignarAuxiliar(contador.id, auxiliar.id);

  const auxiliares = await listarAuxiliares(contador.id);
  assert.ok(
    auxiliares.some((a) => a.id === auxiliar.id),
    'el auxiliar asignado debe aparecer en la lista del contador'
  );
}

async function testNoSePermiteAutoAsignacion() {
  const contador = await crearUsuarioDePrueba('contador');

  await assert.rejects(
    () => asignarAuxiliar(contador.id, contador.id),
    /no se puede auto-asignar|no es un contador válido|ya es su propio auxiliar/i,
    'asignar a sí mismo debe fallar'
  );
}

async function testNoSePuedeDuplicarLaRelacion() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('auxiliar');

  await asignarAuxiliar(contador.id, auxiliar.id);
  await assert.rejects(
    () => asignarAuxiliar(contador.id, auxiliar.id),
    /ya está asignado|relación ya existe|duplicate/i,
    'asignar dos veces al mismo auxiliar debe fallar'
  );
}

async function testSePuedeQuitarUnAuxiliar() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('auxiliar');

  await asignarAuxiliar(contador.id, auxiliar.id);
  await quitarAuxiliar(contador.id, auxiliar.id);

  const auxiliares = await listarAuxiliares(contador.id);
  assert.ok(
    !auxiliares.some((a) => a.id === auxiliar.id),
    'el auxiliar quitado ya no debe aparecer en la lista'
  );
}

async function testListarAuxiliaresDevuelveIdsYNombres() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar1 = await crearUsuarioDePrueba('auxiliar');
  const auxiliar2 = await crearUsuarioDePrueba('auxiliar');

  await asignarAuxiliar(contador.id, auxiliar1.id);
  await asignarAuxiliar(contador.id, auxiliar2.id);

  const auxiliares = await listarAuxiliares(contador.id);
  assert.strictEqual(auxiliares.length, 2, 'debe devolver los dos auxiliares');
  for (const a of auxiliares) {
    assert.ok(typeof a.id === 'number', 'cada auxiliar tiene id numérico');
    assert.ok(typeof a.nombre === 'string' && a.nombre.length > 0, 'cada auxiliar tiene nombre');
  }
}

async function testListarContadoresQueMeTienenComoAuxiliar() {
  const contador1 = await crearUsuarioDePrueba('contador');
  const contador2 = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('auxiliar');

  await asignarAuxiliar(contador1.id, auxiliar.id);
  // Un auxiliar apoya a un solo contador: el segundo vínculo se rechaza.
  await assert.rejects(
    asignarAuxiliar(contador2.id, auxiliar.id),
    (error) => error.codigo === 'AUXILIAR_CON_OTRO_CONTADOR'
  );

  const contadores = await listarContadoresQueMeTienenComoAuxiliar(auxiliar.id);
  assert.deepStrictEqual(
    contadores.map((c) => c.id),
    [contador1.id],
    'el auxiliar solo aparece con su contador'
  );
}

// Desde 2026-11-10 solo una cuenta con rol auxiliar se asigna como auxiliar.
async function testNoSePuedeAsignarAuxiliarQueNoEsContador() {
  const contador = await crearUsuarioDePrueba('contador');
  const deSistema = await crearUsuarioDePrueba('usuarios_de_sistema');
  const otroContador = await crearUsuarioDePrueba('contador');

  for (const cuenta of [deSistema, otroContador]) {
    await assert.rejects(
      () => asignarAuxiliar(contador.id, cuenta.id),
      (error) => error.codigo === 'AUXILIAR_NO_ES_AUXILIAR',
      'solo una cuenta con rol auxiliar puede ser auxiliar'
    );
  }
}

async function testNoSePuedeAsignarAuxiliarQueNoExiste() {
  const contador = await crearUsuarioDePrueba('contador');

  await assert.rejects(
    () => asignarAuxiliar(contador.id, 99999999),
    (error) => error.codigo === 'AUXILIAR_NO_EXISTE',
    'asignar un id inexistente debe fallar'
  );
}

describe('modelo de auxiliares (contador_auxiliar)', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('la tabla contador_auxiliar existe después del seed', testLaTablaContadorAuxiliarExisteDespuesDelSeed);
  test('se puede asignar un auxiliar', testSePuedeAsignarUnAuxiliar);
  test('no se permite auto-asignación', testNoSePermiteAutoAsignacion);
  test('no se puede duplicar la relación', testNoSePuedeDuplicarLaRelacion);
  test('se puede quitar un auxiliar', testSePuedeQuitarUnAuxiliar);
  test('listar auxiliares devuelve ids y nombres', testListarAuxiliaresDevuelveIdsYNombres);
  test('listar contadores que me tienen como auxiliar', testListarContadoresQueMeTienenComoAuxiliar);
  test('no se puede asignar como auxiliar una cuenta sin rol auxiliar', testNoSePuedeAsignarAuxiliarQueNoEsContador);
  test('no se puede asignar un auxiliar que no existe', testNoSePuedeAsignarAuxiliarQueNoExiste);
});
