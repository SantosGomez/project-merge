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

const { findByUsername, create, findById, findAll } = UserModel;

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

async function testFindByUsernameDevuelveUsuarioExistente() {
  const propio = await crearUsuarioDePrueba('administrador');
  const usuario = await findByUsername(propio.usuario);
  assert.ok(usuario, 'findByUsername debe devolver el usuario cuando existe');
  assert.strictEqual(usuario.usuario, propio.usuario);
  assert.ok(usuario.password_hash, 'el usuario debe tener password_hash');
  assert.strictEqual(usuario.rol, 'administrador');
}

async function testFindByUsernameDevuelveNullCuandoNoExiste() {
  const usuario = await findByUsername('usuario_que_no_existe_xyz');
  assert.strictEqual(
    usuario,
    null,
    'findByUsername debe devolver null cuando el usuario no existe'
  );
}

async function testCreateInsertaUsuarioYDevuelveId() {
  const nombre = nombreDePrueba('usuario_create');
  const id = await create(nombre, 'hash_prueba_t5', 'contador');
  registrarUsuarioCreado(nombre);
  assert.strictEqual(
    typeof id,
    'number',
    'create debe devolver el id numérico del usuario insertado'
  );
  assert.ok(id > 0, 'el id devuelto por create debe ser mayor que cero');
  const usuario = await findById(id);
  assert.ok(usuario, 'el registro insertado debe existir con el id devuelto');
  assert.strictEqual(usuario.id, id);
  assert.strictEqual(usuario.usuario, nombre);
  assert.strictEqual(usuario.rol, 'contador');
}

async function testFindByIdDevuelveUsuarioExistente() {
  const nombre = nombreDePrueba('usuario_findid');
  const id = await create(nombre, 'hash_prueba_t5', 'contador');
  registrarUsuarioCreado(nombre);
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

// ---------- RF-36, criterio 31: findByUsername distingue mayúsculas ----------
async function testFindByUsernameDistingueMayusculas() {
  const nombre = nombreDePrueba('ana');
  await create(nombre, 'hash_prueba_t12', 'contador');
  registrarUsuarioCreado(nombre);

  const conOtraCapitalizacion = await findByUsername(nombre.toUpperCase());
  assert.strictEqual(
    conOtraCapitalizacion,
    null,
    'findByUsername debe devolver null si el nombre solo coincide sin distinguir mayúsculas'
  );

  const exacto = await findByUsername(nombre);
  assert.ok(exacto, 'findByUsername debe devolver la cuenta con el nombre exacto');
  assert.strictEqual(exacto.usuario, nombre, 'la cuenta devuelta debe tener el nombre exacto');
}

// ---------- RF-45, criterio 40: duplicados sin distinguir mayúsculas ----------
async function testUsuarioExisteIgnoreCase() {
  assert.strictEqual(
    typeof UserModel.usuarioExisteIgnoreCase,
    'function',
    'UserModel debe exponer usuarioExisteIgnoreCase'
  );

  const nombre = nombreDePrueba('ana');
  await create(nombre, 'hash_prueba_t12', 'contador');
  registrarUsuarioCreado(nombre);

  assert.strictEqual(
    await UserModel.usuarioExisteIgnoreCase(nombre.toUpperCase()),
    true,
    'debe encontrar la cuenta aunque el nombre llegue con otra capitalización'
  );
  assert.strictEqual(
    await UserModel.usuarioExisteIgnoreCase(nombreDePrueba('no_existe')),
    false,
    'debe devolver false con un nombre que no existe'
  );
}

describe('UserModel', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('findByUsername devuelve el usuario cuando existe', testFindByUsernameDevuelveUsuarioExistente);
  test('findByUsername devuelve null cuando no existe', testFindByUsernameDevuelveNullCuandoNoExiste);
  test('create inserta el usuario y devuelve su id', testCreateInsertaUsuarioYDevuelveId);
  test('findById devuelve el usuario cuando existe', testFindByIdDevuelveUsuarioExistente);
  test('findById devuelve null cuando no existe', testFindByIdDevuelveNullCuandoNoExiste);
  test('findAll devuelve un array de usuarios', testFindAllDevuelveArray);
  test('findAll por rol contador solo devuelve contadores', testFindAllPorRolContadorSoloDevuelveContadores);
  test('findByUsername solo devuelve la cuenta con el nombre exacto', testFindByUsernameDistingueMayusculas);
  test('usuarioExisteIgnoreCase encuentra el nombre sin distinguir mayúsculas', testUsuarioExisteIgnoreCase);
});
