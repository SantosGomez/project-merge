const assert = require('node:assert');
const {
  findByUsername,
  create,
  findById,
  findAll,
} = require('../src/models/UserModel');

/**
 * Pruebas del modelo de usuarios (consultas SQL contra MariaDB).
 * RF-01, RF-03, RF-27, RF-28, RF-29, RF-30.
 *
 * Requieren que exista `src/models/UserModel.js` (tarea T6) y una base de
 * datos MariaDB de prueba configurada en `src/config/db.js`.
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T5.
 */

async function testFindByUsernameDevuelveUsuarioExistente() {
  const usuario = await findByUsername('admin_seed');
  assert.ok(usuario, 'findByUsername debe devolver el usuario cuando existe');
  assert.strictEqual(usuario.usuario, 'admin_seed');
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
  const id = await create('usuario_create_t5', 'hash_prueba_t5', 'contador');
  assert.ok(
    typeof id === 'number' && id > 0,
    'create debe devolver el id numérico del usuario insertado'
  );
  const usuario = await findById(id);
  assert.strictEqual(usuario.usuario, 'usuario_create_t5');
  assert.strictEqual(usuario.rol, 'contador');
}

async function testFindByIdDevuelveUsuarioExistente() {
  const id = await create('usuario_findid_t5', 'hash_prueba_t5', 'contador');
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
  const todos = await findAll();
  assert.ok(Array.isArray(todos), 'findAll debe devolver un array');
}

async function testFindAllPorRolContadorSoloDevuelveContadores() {
  const contadores = await findAll({ rol: 'contador' });
  assert.ok(
    Array.isArray(contadores),
    'findAll({ rol: "contador" }) debe devolver un array'
  );
  contadores.forEach((c) => {
    assert.strictEqual(
      c.rol,
      'contador',
      'cada fila de findAll(contador) debe tener rol contador'
    );
  });
}

module.exports = {
  testFindByUsernameDevuelveUsuarioExistente,
  testFindByUsernameDevuelveNullCuandoNoExiste,
  testCreateInsertaUsuarioYDevuelveId,
  testFindByIdDevuelveUsuarioExistente,
  testFindByIdDevuelveNullCuandoNoExiste,
  testFindAllDevuelveArray,
  testFindAllPorRolContadorSoloDevuelveContadores,
};
