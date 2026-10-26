const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { seedDatabase, debeSembrarCuentasDemo } = require('../src/utils/seed');
const { findByCorreo, findAll } = require('../src/models/UserModel');
const { pool, query } = require('../src/config/db');

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
  await seedDatabase({ cuentasDemo: true });
  const administrador = await findByCorreo(CORREO_ADMIN);
  assert.ok(administrador, 'el seed debe crear la cuenta admin_seed');
  assert.strictEqual(administrador.rol, 'administrador');
  const contador = await findByCorreo(CORREO_CONTADOR);
  assert.ok(contador, 'el seed debe crear la cuenta contador_seed');
  assert.strictEqual(contador.rol, 'contador');
}

async function testSeedContraseñasEstanHasheadasConArgon2id() {
  await seedDatabase({ cuentasDemo: true });
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
  await seedDatabase({ cuentasDemo: true });
  const admins1 = await contarPorCorreo(CORREO_ADMIN);
  const contadores1 = await contarPorCorreo(CORREO_CONTADOR);

  await seedDatabase({ cuentasDemo: true }); // segunda ejecución: no debe duplicar ni fallar

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
  await seedDatabase({ cuentasDemo: true });
  const columnas = (await query('SHOW COLUMNS FROM usuarios')).map((c) => c.Field);
  for (const columna of ['nombre', 'correo', 'actualizado_en', 'ultimo_acceso_en']) {
    assert.ok(columnas.includes(columna), `la tabla usuarios debe tener la columna ${columna}`);
  }

  // El correo es único: la migración crea su índice.
  const indices = await query("SHOW INDEX FROM usuarios WHERE Column_name = 'correo' AND Non_unique = 0");
  assert.ok(indices.length > 0, 'el correo debe ser único');
}

async function testMigracionDaCorreoYNombreALasCuentasExistentes() {
  await seedDatabase({ cuentasDemo: true });
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

  await seedDatabase({ cuentasDemo: true });

  assert.strictEqual(await contarPorCorreo(CORREO_ADMIN), 1, 'no crea otra cuenta admin_seed');
  assert.strictEqual((await findByCorreo(CORREO_ADMIN)).id, antes.id, 'conserva la cuenta existente');
}

// ---------- Revisión de la rebanada 5: las cuentas demo solo se siembran si se pide ----------
function testBanderaDeCuentasDemo() {
  assert.strictEqual(debeSembrarCuentasDemo({}), false, 'sin la variable, apagada por defecto');
  assert.strictEqual(debeSembrarCuentasDemo({ SEED_CUENTAS_DEMO: 'true' }), true);
  for (const valor of ['false', 'TRUE', '1', 'yes', '', ' true']) {
    assert.strictEqual(debeSembrarCuentasDemo({ SEED_CUENTAS_DEMO: valor }), false, `«${valor}» no la enciende`);
  }
}

// Aparta la cuenta admin_seed (le cambia el correo) con el mismo cerrojo que usa prepararBaseDeDatos,
// ejecuta la semilla como una base sin esa cuenta y lo deja todo como estaba.
async function conAdminSeedApartado(prueba) {
  const conexion = await pool.getConnection();
  const apartado = `apartado_${CORREO_ADMIN}`;
  const [original] = await query('SELECT id FROM usuarios WHERE correo = ?', [CORREO_ADMIN]);
  try {
    await conexion.query("SELECT GET_LOCK('delgrow_pruebas_seed', 30)");
    await query('UPDATE usuarios SET correo = ? WHERE id = ?', [apartado, original.id]);
    await prueba();
  } finally {
    await query('DELETE FROM usuarios WHERE correo = ?', [CORREO_ADMIN]);
    await query('UPDATE usuarios SET correo = ? WHERE id = ?', [CORREO_ADMIN, original.id]);
    await conexion.query("SELECT RELEASE_LOCK('delgrow_pruebas_seed')");
    conexion.release();
  }
}

async function testSinBanderaNoSiembraCuentasDemo() {
  await conAdminSeedApartado(async () => {
    await seedDatabase({ cuentasDemo: false });
    assert.strictEqual(await contarPorCorreo(CORREO_ADMIN), 0, 'con la bandera apagada no crea admin_seed');
  });
}

async function testConBanderaSiembraCuentasDemo() {
  await conAdminSeedApartado(async () => {
    await seedDatabase({ cuentasDemo: true });
    assert.strictEqual(await contarPorCorreo(CORREO_ADMIN), 1, 'con la bandera encendida crea admin_seed');
  });
}

// ---------- Rebanada 5c: la migración borra la columna usuario, con respaldo previo ----------
async function columnasDeUsuarios(tabla = 'usuarios') {
  return (await query(`SHOW COLUMNS FROM ${tabla}`)).map((c) => c.Field);
}

async function testMigracionBorraLaColumnaUsuario() {
  await seedDatabase({ cuentasDemo: true });
  assert.ok(!(await columnasDeUsuarios()).includes('usuario'), 'la tabla usuarios ya no tiene la columna usuario');
}

async function testMigracionDejaElRespaldoAntesDeBorrar() {
  await seedDatabase({ cuentasDemo: true });
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
  await seedDatabase({ cuentasDemo: true });
  await seedDatabase({ cuentasDemo: true }); // sin la columna usuario: no debe fallar
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

// ---------- Migración de fechas de los casos anteriores a fecha_inicio/fecha_vencimiento ----------
// Las tablas viejas tenían estas columnas vacías; para simularlo se vuelven a permitir NULL
// (la migración las deja otra vez obligatorias) y se vacían solo en los casos propios.
async function casoAntiguo(contadorId, { creadoEn, prioridad, fechaInicio = null, fechaVencimiento = null }) {
  await query('ALTER TABLE casos MODIFY fecha_inicio DATE NULL, MODIFY fecha_vencimiento DATE NULL');
  const id = await crearCasoDePrueba(contadorId, { cliente: 'zz_test_migracion', prioridad });
  await query('UPDATE casos SET creado_en = ?, fecha_inicio = ?, fecha_vencimiento = ? WHERE id = ?', [
    creadoEn,
    fechaInicio,
    fechaVencimiento,
    id,
  ]);
  return id;
}

async function fechasDelCaso(id) {
  const [fila] = await query(
    "SELECT DATE_FORMAT(fecha_inicio, '%Y-%m-%d') AS inicio, DATE_FORMAT(fecha_vencimiento, '%Y-%m-%d') AS vence FROM casos WHERE id = ?",
    [id]
  );
  return fila;
}

async function testMigracionRellenaFechasDeCasosAntiguos() {
  const contador = await crearUsuarioDePrueba('contador');
  // Como «Cliente Test 2»: sin inicio y con un vencimiento calculado desde otro día.
  const sinInicio = await casoAntiguo(contador.id, {
    creadoEn: '2026-10-20 15:42:21',
    prioridad: 'Media',
    fechaVencimiento: '2026-11-09',
  });
  // Creado casi a medianoche: el día no se desplaza.
  const deNoche = await casoAntiguo(contador.id, { creadoEn: '2026-10-23 23:30:00', prioridad: 'Alta' });

  await seedDatabase({ cuentasDemo: false });

  assert.deepStrictEqual(await fechasDelCaso(sinInicio), { inicio: '2026-10-20', vence: '2026-11-03' });
  assert.deepStrictEqual(await fechasDelCaso(deNoche), { inicio: '2026-10-23', vence: '2026-10-30' });
}

async function testMigracionRespetaLasFechasQueYaExisten() {
  const contador = await crearUsuarioDePrueba('contador');
  const sinVencimiento = await casoAntiguo(contador.id, {
    creadoEn: '2026-10-20 10:00:00',
    prioridad: 'Alta',
    fechaInicio: '2026-12-31',
  });
  const completo = await casoAntiguo(contador.id, {
    creadoEn: '2026-10-20 10:00:00',
    prioridad: 'Baja',
    fechaInicio: '2026-12-31',
    fechaVencimiento: '2030-01-01',
  });

  await seedDatabase({ cuentasDemo: false });

  assert.deepStrictEqual(await fechasDelCaso(sinVencimiento), { inicio: '2026-12-31', vence: '2027-01-07' }, 'solo se calcula el vencimiento');
  assert.deepStrictEqual(await fechasDelCaso(completo), { inicio: '2026-12-31', vence: '2030-01-01' }, 'un caso completo no cambia');
}

async function testMigracionDeFechasSePuedeRepetirYDejaColumnasObligatorias() {
  const contador = await crearUsuarioDePrueba('contador');
  const id = await casoAntiguo(contador.id, { creadoEn: '2026-10-26 12:37:39', prioridad: 'Alta' });

  await seedDatabase({ cuentasDemo: false });
  const primera = await fechasDelCaso(id);
  await seedDatabase({ cuentasDemo: false });

  assert.deepStrictEqual(await fechasDelCaso(id), primera, 'la segunda vez no cambia nada');
  assert.deepStrictEqual(primera, { inicio: '2026-10-26', vence: '2026-11-02' });
  const columnas = await query(
    "SELECT COLUMN_NAME AS columna, IS_NULLABLE AS nulo FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'casos' AND COLUMN_NAME IN ('fecha_inicio', 'fecha_vencimiento') ORDER BY COLUMN_NAME"
  );
  assert.deepStrictEqual(columnas.map((c) => c.nulo), ['NO', 'NO'], 'las fechas vuelven a ser obligatorias');
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
  test('la bandera SEED_CUENTAS_DEMO solo se enciende con el valor exacto true', testBanderaDeCuentasDemo);
  test('con la bandera apagada la semilla no crea las cuentas demo', testSinBanderaNoSiembraCuentasDemo);
  test('con la bandera encendida la semilla crea las cuentas demo', testConBanderaSiembraCuentasDemo);
  test('la migración borra la columna usuario', testMigracionBorraLaColumnaUsuario);
  test('antes de borrarla deja el respaldo usuarios_respaldo_5c con el usuario de cada cuenta', testMigracionDejaElRespaldoAntesDeBorrar);
  test('la migración se puede correr dos veces sin la columna', testMigracionSePuedeCorrerDosVeces);
  test('la migración de fechas rellena los casos antiguos sin cuentas demo', testMigracionRellenaFechasDeCasosAntiguos);
  test('la migración de fechas respeta las fechas que ya existen', testMigracionRespetaLasFechasQueYaExisten);
  test('la migración de fechas se puede repetir y deja las columnas obligatorias', testMigracionDeFechasSePuedeRepetirYDejaColumnasObligatorias);
});
