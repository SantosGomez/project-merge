const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const {
  findById,
  findByCounter,
  countByStatus,
  create,
  updateStatus,
  updatePriority,
} = require('../src/models/CaseModel');

/**
 * Pruebas del modelo de casos (consultas SQL contra MariaDB).
 * RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-22.
 *
 * Requieren que exista `src/models/CaseModel.js` (tarea T6) y una base de
 * datos MariaDB de prueba configurada en `src/config/db.js`.
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T5.
 *
 * Aislamiento (plan 9.2 y 9.3): cada prueba crea sus propios contadores con
 * prefijo `zz_test_` y asigna los casos a ellos, de modo que las cantidades se
 * comprueban sobre datos propios y la limpieza del `after` los borra.
 */

async function testFindByIdDevuelveCasoExistente() {
  const contador = await crearUsuarioDePrueba('contador');
  const casoId = await create({
    contador_id: contador.id,
    cliente: 'Cliente Caso T5',
    estado: 'Pendiente',
    prioridad: 'Alta',
  });
  const caso = await findById(casoId);
  assert.ok(caso, 'findById debe devolver el caso cuando existe');
  assert.strictEqual(caso.id, casoId);
  assert.strictEqual(caso.cliente, 'Cliente Caso T5');
  assert.strictEqual(caso.estado, 'Pendiente');
  assert.strictEqual(caso.prioridad, 'Alta');
}

async function testFindByIdDevuelveNullCuandoNoExiste() {
  const caso = await findById(99999999);
  assert.strictEqual(
    caso,
    null,
    'findById debe devolver null cuando el caso no existe'
  );
}

async function testFindByCounterDevuelveCasosDelContador() {
  const contador = await crearUsuarioDePrueba('contador');
  await create({
    contador_id: contador.id,
    cliente: 'Cliente A',
    estado: 'Pendiente',
    prioridad: 'Alta',
  });
  await create({
    contador_id: contador.id,
    cliente: 'Cliente B',
    estado: 'Finalizado',
    prioridad: 'Baja',
  });
  const casos = await findByCounter(contador.id);
  assert.ok(Array.isArray(casos), 'findByCounter debe devolver un array');
  assert.strictEqual(
    casos.length,
    2,
    'findByCounter debe devolver exactamente los dos casos del contador'
  );
  casos.forEach((c) => {
    assert.strictEqual(
      c.contador_id,
      contador.id,
      'cada caso debe pertenecer al contador consultado'
    );
  });
}

async function testCountByStatusIncluyeCeros() {
  // Un contador sin casos debe devolver ceros en todos los estados (RF-13).
  const contador = await crearUsuarioDePrueba('contador');
  const conteos = await countByStatus(contador.id);
  assert.ok(conteos, 'countByStatus debe devolver un objeto');
  assert.strictEqual(conteos.pendiente, 0, 'pendiente debe ser 0 cuando no hay casos');
  assert.strictEqual(conteos.en_proceso, 0, 'en_proceso debe ser 0 cuando no hay casos');
  assert.strictEqual(conteos.finalizado, 0, 'finalizado debe ser 0 cuando no hay casos');
}

async function testCountByStatusCuentaPorEstado() {
  const contador = await crearUsuarioDePrueba('contador');
  await create({
    contador_id: contador.id,
    cliente: 'Cliente C1',
    estado: 'Pendiente',
    prioridad: 'Alta',
  });
  await create({
    contador_id: contador.id,
    cliente: 'Cliente C2',
    estado: 'Pendiente',
    prioridad: 'Media',
  });
  await create({
    contador_id: contador.id,
    cliente: 'Cliente C3',
    estado: 'En proceso',
    prioridad: 'Baja',
  });
  const conteos = await countByStatus(contador.id);
  assert.strictEqual(conteos.pendiente, 2, 'debe haber 2 casos Pendiente');
  assert.strictEqual(conteos.en_proceso, 1, 'debe haber 1 caso En proceso');
  assert.strictEqual(conteos.finalizado, 0, 'debe haber 0 casos Finalizado');
}

async function testCreateCreaCasoConEstadoPendiente() {
  const contador = await crearUsuarioDePrueba('contador');
  const casoId = await create({
    contador_id: contador.id,
    cliente: 'Cliente Create T5',
    estado: 'Pendiente',
    prioridad: 'Alta',
  });
  assert.strictEqual(
    typeof casoId,
    'number',
    'create debe devolver el id numérico del caso insertado'
  );
  assert.ok(casoId > 0, 'el id devuelto por create debe ser mayor que cero');
  const caso = await findById(casoId);
  assert.ok(caso, 'el caso creado debe existir con el id devuelto por create');
  assert.strictEqual(caso.id, casoId);
  assert.strictEqual(
    caso.estado,
    'Pendiente',
    'el estado inicial de todo caso nuevo es Pendiente (RF-18)'
  );
  assert.strictEqual(caso.prioridad, 'Alta');
  assert.strictEqual(caso.cliente, 'Cliente Create T5');
}

async function testUpdateStatusActualizaEstado() {
  const contador = await crearUsuarioDePrueba('contador');
  const casoId = await create({
    contador_id: contador.id,
    cliente: 'Cliente Upd',
    estado: 'Pendiente',
    prioridad: 'Media',
  });
  await updateStatus(casoId, 'En proceso');
  const caso = await findById(casoId);
  assert.strictEqual(caso.estado, 'En proceso', 'updateStatus debe cambiar el estado');
}

async function testUpdatePriorityActualizaPrioridad() {
  const contador = await crearUsuarioDePrueba('contador');
  const casoId = await create({
    contador_id: contador.id,
    cliente: 'Cliente Pri',
    estado: 'Pendiente',
    prioridad: 'Baja',
  });
  await updatePriority(casoId, 'Alta');
  const caso = await findById(casoId);
  assert.strictEqual(caso.prioridad, 'Alta', 'updatePriority debe cambiar la prioridad');
}

describe('CaseModel', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('findById devuelve el caso cuando existe', testFindByIdDevuelveCasoExistente);
  test('findById devuelve null cuando no existe', testFindByIdDevuelveNullCuandoNoExiste);
  test('findByCounter devuelve los casos del contador', testFindByCounterDevuelveCasosDelContador);
  test('countByStatus incluye ceros sin casos', testCountByStatusIncluyeCeros);
  test('countByStatus cuenta por estado', testCountByStatusCuentaPorEstado);
  test('create crea el caso con estado Pendiente', testCreateCreaCasoConEstadoPendiente);
  test('updateStatus actualiza el estado', testUpdateStatusActualizaEstado);
  test('updatePriority actualiza la prioridad', testUpdatePriorityActualizaPrioridad);
});
