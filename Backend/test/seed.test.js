const assert = require('node:assert');
const { seedDatabase } = require('../src/utils/seed');
const { findAll } = require('../src/models/UserModel');

/**
 * Pruebas del seed de datos maestros (RF-27).
 * Requieren que exista `src/utils/seed.js` (tarea T6) y una base de datos
 * MariaDB de prueba configurada en `src/config/db.js`.
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T5.
 */

async function testSeedCreaAlmenosUnAdministradorYUnContador() {
  await seedDatabase();
  const usuarios = await findAll();
  const administradores = usuarios.filter((u) => u.rol === 'administrador');
  const contadores = usuarios.filter((u) => u.rol === 'contador');
  assert.ok(
    administradores.length >= 1,
    'el seed debe crear al menos una cuenta de administrador'
  );
  assert.ok(
    contadores.length >= 1,
    'el seed debe crear al menos una cuenta de contador'
  );
}

async function testSeedContraseñasEstanHasheadasConArgon2id() {
  await seedDatabase();
  const usuarios = await findAll();
  const administrador = usuarios.find((u) => u.rol === 'administrador');
  const contador = usuarios.find((u) => u.rol === 'contador');
  assert.ok(administrador, 'debe existir un administrador para verificar su hash');
  assert.ok(
    typeof administrador.password_hash === 'string' &&
      administrador.password_hash.startsWith('$argon2id$'),
    'la contraseña del administrador debe estar hasheada con Argon2id (RNF-1)'
  );
  assert.ok(contador, 'debe existir un contador para verificar su hash');
  assert.ok(
    typeof contador.password_hash === 'string' &&
      contador.password_hash.startsWith('$argon2id$'),
    'la contraseña del contador debe estar hasheada con Argon2id (RNF-1)'
  );
}

async function testSeedNoDuplicaUsuariosAlEjecutarseDosVeces() {
  await seedDatabase();
  const usuarios1 = await findAll();
  const admins1 = usuarios1.filter((u) => u.rol === 'administrador').length;
  const contadores1 = usuarios1.filter((u) => u.rol === 'contador').length;

  await seedDatabase(); // segunda ejecución: no debe duplicar ni fallar

  const usuarios2 = await findAll();
  const admins2 = usuarios2.filter((u) => u.rol === 'administrador').length;
  const contadores2 = usuarios2.filter((u) => u.rol === 'contador').length;
  assert.strictEqual(
    admins2,
    admins1,
    'el seed no debe duplicar el administrador cuando ya existe'
  );
  assert.strictEqual(
    contadores2,
    contadores1,
    'el seed no debe duplicar el contador cuando ya existe'
  );
}

module.exports = {
  testSeedCreaAlmenosUnAdministradorYUnContador,
  testSeedContraseñasEstanHasheadasConArgon2id,
  testSeedNoDuplicaUsuariosAlEjecutarseDosVeces,
};
