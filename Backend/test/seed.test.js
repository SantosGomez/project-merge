const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { seedDatabase } = require('../src/utils/seed');
const { findByUsername, findAll } = require('../src/models/UserModel');

/**
 * Pruebas del seed de datos maestros (RF-27).
 * Requieren que exista `src/utils/seed.js` (tarea T6) y una base de datos
 * MariaDB de prueba configurada en `src/config/db.js`.
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T5.
 *
 * Aislamiento (plan 9.2): solo se comprueban las cuentas que crea el seed
 * (`admin_seed` y `contador_seed`), nunca el resto de la tabla, y ninguna
 * prueba las borra ni las modifica.
 */

// Cuenta cuántas filas hay con un nombre exacto (detecta duplicados del seed).
async function contarPorNombre(nombre) {
  const usuarios = await findAll();
  return usuarios.filter((u) => u.usuario === nombre).length;
}

async function testSeedCreaAlmenosUnAdministradorYUnContador() {
  await seedDatabase();
  const administrador = await findByUsername('admin_seed');
  assert.ok(administrador, 'el seed debe crear la cuenta admin_seed');
  assert.strictEqual(administrador.rol, 'administrador');
  const contador = await findByUsername('contador_seed');
  assert.ok(contador, 'el seed debe crear la cuenta contador_seed');
  assert.strictEqual(contador.rol, 'contador');
}

async function testSeedContraseñasEstanHasheadasConArgon2id() {
  await seedDatabase();
  const administrador = await findByUsername('admin_seed');
  assert.ok(administrador, 'debe existir admin_seed para verificar su hash');
  assert.ok(
    typeof administrador.password_hash === 'string' &&
      administrador.password_hash.startsWith('$argon2id$'),
    'la contraseña del administrador debe estar hasheada con Argon2id (RNF-1)'
  );
  const contador = await findByUsername('contador_seed');
  assert.ok(contador, 'debe existir contador_seed para verificar su hash');
  assert.ok(
    typeof contador.password_hash === 'string' &&
      contador.password_hash.startsWith('$argon2id$'),
    'la contraseña del contador debe estar hasheada con Argon2id (RNF-1)'
  );
}

async function testSeedNoDuplicaUsuariosAlEjecutarseDosVeces() {
  await seedDatabase();
  const admins1 = await contarPorNombre('admin_seed');
  const contadores1 = await contarPorNombre('contador_seed');

  await seedDatabase(); // segunda ejecución: no debe duplicar ni fallar

  const admins2 = await contarPorNombre('admin_seed');
  const contadores2 = await contarPorNombre('contador_seed');
  assert.strictEqual(
    admins2,
    admins1,
    'el seed no debe duplicar admin_seed cuando ya existe'
  );
  assert.strictEqual(
    contadores2,
    contadores1,
    'el seed no debe duplicar contador_seed cuando ya existe'
  );
  assert.strictEqual(admins2, 1, 'debe existir una sola cuenta admin_seed');
  assert.strictEqual(contadores2, 1, 'debe existir una sola cuenta contador_seed');
}

describe('seed de datos maestros', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('crea al menos un administrador y un contador', testSeedCreaAlmenosUnAdministradorYUnContador);
  test('las contraseñas están hasheadas con Argon2id', testSeedContraseñasEstanHasheadasConArgon2id);
  test('no duplica usuarios al ejecutarse dos veces', testSeedNoDuplicaUsuariosAlEjecutarseDosVeces);
});
