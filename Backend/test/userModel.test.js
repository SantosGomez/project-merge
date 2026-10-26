const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const UserModel = require('../src/models/UserModel');
const { query } = require('../src/config/db');

const { create, findById, findAll } = UserModel;

/**
 * Pruebas del modelo de usuarios (consultas SQL contra MariaDB).
 * RF-01, RF-03, RF-27, RF-28, RF-29, RF-30, RF-36, RF-45.
 *
 * Requieren que exista `src/models/UserModel.js` (tarea T6) y una base de
 * datos MariaDB de prueba configurada en `src/config/db.js`.
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T5.
 *
 * Aislamiento (plan 9.2 y 9.3): cada prueba crea sus propios usuarios con
 * prefijo `zz_test_` y nombre único, y la limpieza del `after` borra solo lo
 * que este proceso registró.
 */

// Nombre único de usuario de prueba con el prefijo acordado (plan 9.3).
function nombreDePrueba(prefijo) {
  return `zz_test_${prefijo}_${crypto.randomBytes(4).toString('hex')}`;
}

// ---------- Rebanada 5c: create pide nombre y correo y ya no escribe la columna usuario ----------
async function testCreateCreaLaCuentaPorCorreo() {
  const correos = [`${nombreDePrueba('create')}@prueba.local`, `${nombreDePrueba('create')}@prueba.local`];
  const ids = [];
  try {
    // Dos altas seguidas: si la columna usuario siguiera siendo obligatoria y única, la segunda fallaría.
    for (const correo of correos) {
      ids.push(await create({ nombre: 'Zz Cuenta Create', correo, passwordHash: 'hash_prueba_5c', rol: 'contador' }));
    }
    for (const [i, id] of ids.entries()) {
      assert.strictEqual(typeof id, 'number', 'create devuelve el id numérico');
      const cuenta = await findById(id);
      assert.strictEqual(cuenta.nombre, 'Zz Cuenta Create');
      assert.strictEqual(cuenta.correo, correos[i]);
      assert.strictEqual(cuenta.rol, 'contador');
      assert.ok(cuenta.actualizado_en, 'actualizado_en se llena al crear');
      assert.strictEqual(cuenta.usuario ?? null, null, 'no escribe la columna usuario');
    }
  } finally {
    if (ids.length > 0) await query('DELETE FROM usuarios WHERE id IN (?)', [ids]);
  }
}

async function testFindByIdDevuelveUsuarioExistente() {
  const nombre = nombreDePrueba('usuario_findid');
  const correo = `${nombre}@prueba.local`;
  const id = await create({ nombre, correo, passwordHash: 'hash_prueba_t5', rol: 'contador' });
  registrarUsuarioCreado(correo);
  const usuario = await findById(id);
  assert.ok(usuario, 'findById debe devolver el usuario cuando existe');
  assert.strictEqual(usuario.id, id);
  assert.strictEqual(usuario.rol, 'contador');
}

async function testFindByIdDevuelveNullCuandoNoExiste() {
  const usuario = await findById(99999999);
  assert.strictEqual(
    usuario,
    null,
    'findById debe devolver null cuando el usuario no existe'
  );
}

async function testFindAllDevuelveArray() {
  const propio = await crearUsuarioDePrueba('administrador');
  const todos = await findAll();
  assert.ok(Array.isArray(todos), 'findAll debe devolver un array');
  assert.ok(
    todos.some((u) => u.id === propio.id),
    'findAll debe incluir el usuario creado por la prueba'
  );
}

async function testFindAllPorRolContadorSoloDevuelveContadores() {
  const propio = await crearUsuarioDePrueba('contador');
  const contadores = await findAll({ rol: 'contador' });
  assert.ok(
    Array.isArray(contadores),
    'findAll({ rol: "contador" }) debe devolver un array'
  );
  assert.ok(
    contadores.some((c) => c.id === propio.id),
    'findAll(contador) debe incluir el contador creado por la prueba'
  );
  contadores.forEach((c) => {
    assert.strictEqual(
      c.rol,
      'contador',
      'cada fila de findAll(contador) debe tener rol contador'
    );
  });
}

describe('UserModel', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('create crea la cuenta con nombre y correo, sin usuario, y devuelve su id', testCreateCreaLaCuentaPorCorreo);
  test('findById devuelve el usuario cuando existe', testFindByIdDevuelveUsuarioExistente);
  test('findById devuelve null cuando no existe', testFindByIdDevuelveNullCuandoNoExiste);
  test('findAll devuelve un array de usuarios', testFindAllDevuelveArray);
  test('findAll por rol contador solo devuelve contadores', testFindAllPorRolContadorSoloDevuelveContadores);
});
