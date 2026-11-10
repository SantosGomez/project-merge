const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const {
  findByCounterYAuxiliares,
} = require('../src/models/CaseModel');

/**
 * Pruebas del modelo de casos con auxiliares (RF-AX-07 a RF-AX-09).
 * Requiere que exista `src/models/CaseModel.js` con la función `findByCounterYAuxiliares`.
 *
 * Aislamiento: cada prueba crea sus propios contadores y casos con prefijo zz_test_.
 */

async function testFindByCounterYAuxiliaresDevuelveCasosPropiosYDeAuxiliares() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('contador');

  // Asignar auxiliar al contador
  const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
  await asignarAuxiliar(contador.id, auxiliar.id);

  // Caso propio del contador
  const casoPropio = await crearCasoDePrueba(contador.id, { cliente: 'Caso propio del contador' });
  // Caso del auxiliar
  const casoAuxiliar = await crearCasoDePrueba(auxiliar.id, { cliente: 'Caso del auxiliar' });

  const casos = await findByCounterYAuxiliares(contador.id);

  const clientes = casos.map((c) => c.cliente).sort();
  assert.ok(clientes.includes('Caso propio del contador'), 'incluye el caso propio del contador');
  assert.ok(clientes.includes('Caso del auxiliar'), 'incluye el caso del auxiliar');
  assert.strictEqual(casos.length, 2, 'devuelve exactamente 2 casos (propio + del auxiliar)');
}

async function testFindByCounterYAuxiliaresContadorSinAuxiliaresDevuelveSoloPropios() {
  const contador = await crearUsuarioDePrueba('contador');

  const casoPropio = await crearCasoDePrueba(contador.id, { cliente: 'Solo caso propio' });

  const casos = await findByCounterYAuxiliares(contador.id);

  assert.strictEqual(casos.length, 1, 'sin auxiliares devuelve solo los casos propios');
  assert.strictEqual(casos[0].cliente, 'Solo caso propio');
}

async function testFindByCounterYAuxiliaresNoDuplicaCasos() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('contador');

  const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
  await asignarAuxiliar(contador.id, auxiliar.id);

  // El contador también es auxiliar de sí mismo? No, eso está prohibido. Pero si el auxiliar
  // también tiene al contador como auxiliar, no debería duplicar.
  const casoPropio = await crearCasoDePrueba(contador.id, { cliente: 'Caso único' });

  const casos = await findByCounterYAuxiliares(contador.id);

  assert.strictEqual(casos.length, 1, 'no duplica el caso propio');
  assert.strictEqual(casos[0].cliente, 'Caso único');
}

async function testFindByCounterYAuxiliaresIncluyeContadorDueñoEnCadaCaso() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('contador');

  const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
  await asignarAuxiliar(contador.id, auxiliar.id);

  const casoPropio = await crearCasoDePrueba(contador.id, { cliente: 'Caso del contador' });
  const casoAuxiliar = await crearCasoDePrueba(auxiliar.id, { cliente: 'Caso del auxiliar' });

  const casos = await findByCounterYAuxiliares(contador.id);

  const casoPropioEncontrado = casos.find((c) => c.id === casoPropio);
  const casoAuxiliarEncontrado = casos.find((c) => c.id === casoAuxiliar);

  assert.ok(casoPropioEncontrado, 'el caso propio se encuentra');
  assert.ok(casoAuxiliarEncontrado, 'el caso del auxiliar se encuentra');
  assert.strictEqual(casoPropioEncontrado.contador_id, contador.id, 'el caso propio indica al contador como dueño');
  assert.strictEqual(
    casoAuxiliarEncontrado.contador_id,
    auxiliar.id,
    'el caso del auxiliar indica al auxiliar como dueño'
  );
}

async function testFindByCounterYAuxiliaresIncluyeNombreDelContadorDueño() {
  const contador = await crearUsuarioDePrueba('contador');
  const auxiliar = await crearUsuarioDePrueba('contador');

  const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
  await asignarAuxiliar(contador.id, auxiliar.id);

  const casoPropio = await crearCasoDePrueba(contador.id, { cliente: 'Caso propio' });
  const casoAuxiliar = await crearCasoDePrueba(auxiliar.id, { cliente: 'Caso del auxiliar' });

  const casos = await findByCounterYAuxiliares(contador.id);

  const casoPropioEncontrado = casos.find((c) => c.id === casoPropio);
  const casoAuxiliarEncontrado = casos.find((c) => c.id === casoAuxiliar);

  assert.ok(casoPropioEncontrado, 'el caso propio se encuentra');
  assert.ok(casoAuxiliarEncontrado, 'el caso del auxiliar se encuentra');
  assert.strictEqual(
    casoPropioEncontrado.nombre_contador,
    contador.nombre,
    'el caso propio trae el nombre del contador dueño'
  );
  assert.strictEqual(
    casoAuxiliarEncontrado.nombre_contador,
    auxiliar.nombre,
    'el caso del auxiliar trae el nombre del auxiliar como dueño'
  );
}

describe('modelo de casos con auxiliares', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('devuelve casos propios y de auxiliares', testFindByCounterYAuxiliaresDevuelveCasosPropiosYDeAuxiliares);
  test('contador sin auxiliares devuelve solo casos propios', testFindByCounterYAuxiliaresContadorSinAuxiliaresDevuelveSoloPropios);
  test('no duplica casos', testFindByCounterYAuxiliaresNoDuplicaCasos);
  test('incluye el contador dueño en cada caso', testFindByCounterYAuxiliaresIncluyeContadorDueñoEnCadaCaso);
  test('incluye el nombre del contador dueño en cada caso', testFindByCounterYAuxiliaresIncluyeNombreDelContadorDueño);
});
