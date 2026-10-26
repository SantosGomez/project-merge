const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  prepararBaseDeDatos,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { seedDatabase } = require('../src/utils/seed');
const { findByCorreo, findAll } = require('../src/models/UserModel');
const { query } = require('../src/config/db');

const CORREO_ADMIN = 'admin_seed@prueba.local';
const CORREO_CONTADOR = 'contador_seed@prueba.local';

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

// Cuenta cuántas filas hay con un correo exacto (detecta duplicados del seed).
async function contarPorCorreo(correo) {
  const usuarios = await findAll();
  return usuarios.filter((u) => u.correo === correo).length;
}

async function testSeedCreaAlmenosUnAdministradorYUnContador() {
  await seedDatabase();
  const administrador = await findByCorreo(CORREO_ADMIN);
  assert.ok(administrador, 'el seed debe crear la cuenta admin_seed');
  assert.strictEqual(administrador.rol, 'administrador');
  const contador = await findByCorreo(CORREO_CONTADOR);
  assert.ok(contador, 'el seed debe crear la cuenta contador_seed');
  assert.strictEqual(contador.rol, 'contador');
}

async function testSeedContraseñasEstanHasheadasConArgon2id() {
  await seedDatabase();
  const administrador = await findByCorreo(CORREO_ADMIN);
  assert.ok(administrador, 'debe existir admin_seed para verificar su hash');
  assert.ok(
    typeof administrador.password_hash === 'string' &&
      administrador.password_hash.startsWith('$argon2id$'),
    'la contraseña del administrador debe estar hasheada con Argon2id (RNF-1)'
  );
  const contador = await findByCorreo(CORREO_CONTADOR);
  assert.ok(contador, 'debe existir contador_seed para verificar su hash');
  assert.ok(
    typeof contador.password_hash === 'string' &&
      contador.password_hash.startsWith('$argon2id$'),
    'la contraseña del contador debe estar hasheada con Argon2id (RNF-1)'
  );
}

async function testSeedNoDuplicaUsuariosAlEjecutarseDosVeces() {
  await seedDatabase();
  const admins1 = await contarPorCorreo(CORREO_ADMIN);
  const contadores1 = await contarPorCorreo(CORREO_CONTADOR);

  await seedDatabase(); // segunda ejecución: no debe duplicar ni fallar

  const admins2 = await contarPorCorreo(CORREO_ADMIN);
  const contadores2 = await contarPorCorreo(CORREO_CONTADOR);
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

async function testMigracionAgregaColumnasDeLaCuenta() {
  await seedDatabase();
  const columnas = (await query('SHOW COLUMNS FROM usuarios')).map((c) => c.Field);
  for (const columna of ['nombre', 'correo', 'actualizado_en', 'ultimo_acceso_en']) {
    assert.ok(columnas.includes(columna), `la tabla usuarios debe tener la columna ${columna}`);
  }

  // El correo es único: la migración crea su índice.
  const indices = await query("SHOW INDEX FROM usuarios WHERE Column_name = 'correo' AND Non_unique = 0");
  assert.ok(indices.length > 0, 'el correo debe ser único');
}

async function testMigracionDaCorreoYNombreALasCuentasExistentes() {
  await seedDatabase();
  const administrador = await findByCorreo(CORREO_ADMIN);
  assert.strictEqual(administrador.correo, 'admin_seed@prueba.local', 'cuenta sin correo recibe uno de prueba');
  assert.strictEqual(administrador.nombre, 'admin_seed', 'el nombre parte del usuario actual');
  assert.ok(administrador.actualizado_en, 'actualizado_en arranca con la fecha de creación');

  const sinCorreo = await query('SELECT COUNT(*) AS n FROM usuarios WHERE correo IS NULL OR nombre IS NULL');
  assert.strictEqual(Number(sinCorreo[0].n), 0, 'ninguna cuenta queda sin correo o sin nombre');
}

// ---------- Rebanada 5c: la semilla reconoce sus cuentas por correo, ya sin la columna usuario ----------
async function testSeedReconoceSusCuentasPorCorreo() {
  const antes = await findByCorreo(CORREO_ADMIN);

  await seedDatabase();

  assert.strictEqual(await contarPorCorreo(CORREO_ADMIN), 1, 'no crea otra cuenta admin_seed');
  assert.strictEqual((await findByCorreo(CORREO_ADMIN)).id, antes.id, 'conserva la cuenta existente');
}

// ---------- Rebanada 5c: la migración borra la columna usuario, con respaldo previo ----------
async function columnasDeUsuarios(tabla = 'usuarios') {
  return (await query(`SHOW COLUMNS FROM ${tabla}`)).map((c) => c.Field);
}

async function testMigracionBorraLaColumnaUsuario() {
  await seedDatabase();
  assert.ok(!(await columnasDeUsuarios()).includes('usuario'), 'la tabla usuarios ya no tiene la columna usuario');
}

async function testMigracionDejaElRespaldoAntesDeBorrar() {
  await seedDatabase();
  const respaldo = await query("SHOW TABLES LIKE 'usuarios_respaldo_5c'");
  assert.strictEqual(respaldo.length, 1, 'existe el respaldo usuarios_respaldo_5c');
  assert.ok((await columnasDeUsuarios('usuarios_respaldo_5c')).includes('usuario'), 'el respaldo conserva la columna usuario');

  // Las cuentas del seed están en el respaldo con su usuario de siempre.
  const filas = await query(
    "SELECT usuario FROM usuarios_respaldo_5c WHERE correo IN ('admin_seed@prueba.local', 'contador_seed@prueba.local') ORDER BY id"
  );
  assert.deepStrictEqual(filas.map((f) => f.usuario), ['admin_seed', 'contador_seed'], 'el respaldo guarda el usuario de cada cuenta');
}

async function testMigracionSePuedeCorrerDosVeces() {
  await seedDatabase();
  await seedDatabase(); // sin la columna usuario: no debe fallar
  assert.ok(!(await columnasDeUsuarios()).includes('usuario'), 'la columna sigue sin existir');
}

// ---------- Rebanada 5c: una base nueva crea la tabla usuarios sin la columna usuario ----------
// Verificación estática: no hay una base vacía para probarlo de verdad.
function testCreateTableDeUsuariosSinUsuario() {
  const fuente = readFileSync(join(__dirname, '../src/utils/seed.js'), 'utf8');
  const inicio = fuente.indexOf('CREATE TABLE IF NOT EXISTS usuarios');
  const tabla = fuente.slice(inicio, fuente.indexOf(') ENGINE=InnoDB', inicio));

  assert.doesNotMatch(tabla, /\busuario\s+VARCHAR/, 'la tabla nueva no tiene la columna usuario');
  assert.match(tabla, /\bnombre VARCHAR\(150\) NOT NULL/, 'el nombre es obligatorio');
  assert.match(tabla, /\bcorreo VARCHAR\(150\) NOT NULL/, 'el correo es obligatorio');
  assert.match(tabla, /UNIQUE KEY uq_usuarios_correo \(correo\)/, 'el correo es único con el mismo índice que la migración');
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
  test('la migración agrega nombre, correo único, actualizado_en y ultimo_acceso_en', testMigracionAgregaColumnasDeLaCuenta);
  test('la migración da correo y nombre a las cuentas existentes', testMigracionDaCorreoYNombreALasCuentasExistentes);
  test('la semilla reconoce sus cuentas por correo aunque no tengan usuario', testSeedReconoceSusCuentasPorCorreo);
  test('una base nueva crea la tabla usuarios sin la columna usuario', testCreateTableDeUsuariosSinUsuario);
  test('la migración borra la columna usuario', testMigracionBorraLaColumnaUsuario);
  test('antes de borrarla deja el respaldo usuarios_respaldo_5c con el usuario de cada cuenta', testMigracionDejaElRespaldoAntesDeBorrar);
  test('la migración se puede correr dos veces sin la columna', testMigracionSePuedeCorrerDosVeces);
});
