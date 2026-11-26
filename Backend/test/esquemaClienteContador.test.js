const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { query } = require('../src/config/db');

/**
 * Rebanada 54: tabla `cliente_contador` (varios contadores por cliente); la llave
 * `clientes.usuario_id` sigue en CASCADE. Datos de prueba `zz_test_`; al terminar no queda ninguno.
 */

const clientesCreados = [];

async function crearCliente(usuarioId, nombre) {
  const resultado = await query('INSERT INTO clientes (usuario_id, nombre, creado_en) VALUES (?, ?, NOW())', [
    usuarioId,
    nombre,
  ]);
  clientesCreados.push(resultado.insertId);
  return resultado.insertId;
}

async function filasDe(clienteId) {
  return query('SELECT cliente_id, usuario_id FROM cliente_contador WHERE cliente_id = ?', [clienteId]);
}

async function totalFilas() {
  const [fila] = await query('SELECT COUNT(*) AS n FROM cliente_contador');
  return Number(fila.n);
}

describe('esquema de cliente_contador (rebanada 54)', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    if (clientesCreados.length > 0) {
      const marcas = clientesCreados.map(() => '?').join(', ');
      await query(`DELETE FROM clientes WHERE id IN (${marcas})`, clientesCreados);
    }
    await limpiarDatosDePrueba();
    const [restos] = await query("SELECT COUNT(*) AS n FROM clientes WHERE nombre LIKE 'zz\\_test\\_%'");
    assert.strictEqual(Number(restos.n), 0, 'no deben quedar clientes zz_test_');
    await cerrarBaseDeDatos();
  });

  test('la tabla tiene su llave primaria, su índice por usuario y sus llaves foráneas en cascada', async () => {
    const columnas = await query(
      `SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cliente_contador'`
    );
    const nombres = columnas.map((c) => c.COLUMN_NAME).sort();
    assert.deepStrictEqual(nombres, ['asignado_en', 'cliente_id', 'usuario_id']);
    assert.ok(columnas.every((c) => c.IS_NULLABLE === 'NO'), 'las tres columnas son NOT NULL');

    const llave = await query(
      `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cliente_contador' AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`
    );
    assert.deepStrictEqual(
      llave.map((c) => c.COLUMN_NAME),
      ['cliente_id', 'usuario_id']
    );

    const indices = await query(
      `SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cliente_contador' AND SEQ_IN_INDEX = 1`
    );
    assert.ok(
      indices.some((i) => i.COLUMN_NAME === 'usuario_id'),
      'debe haber un índice que empiece por usuario_id'
    );

    const llaves = await query(
      `SELECT k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, r.DELETE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r
         ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = 'cliente_contador' AND k.REFERENCED_TABLE_NAME IS NOT NULL`
    );
    const porColumna = Object.fromEntries(llaves.map((l) => [l.COLUMN_NAME, l]));
    assert.strictEqual(porColumna.cliente_id.REFERENCED_TABLE_NAME, 'clientes');
    assert.strictEqual(porColumna.cliente_id.DELETE_RULE, 'CASCADE');
    assert.strictEqual(porColumna.usuario_id.REFERENCED_TABLE_NAME, 'usuarios');
    assert.strictEqual(porColumna.usuario_id.DELETE_RULE, 'CASCADE');
  });

  test('clientes.usuario_id sigue apuntando a usuarios con ON DELETE CASCADE', async () => {
    const [regla] = await query(
      `SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'clientes' AND CONSTRAINT_NAME = 'fk_clientes_usuario'`
    );
    assert.ok(regla, 'debe existir fk_clientes_usuario');
    assert.strictEqual(regla.DELETE_RULE, 'CASCADE');
  });

  test('el relleno copia a los clientes con contador y omite a los que no lo tienen', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    const conContador = await crearCliente(contador.id, `zz_test_cliente_con_${Date.now()}`);
    const sinContador = await crearCliente(null, `zz_test_cliente_sin_${Date.now()}`);

    await prepararBaseDeDatos();

    const copiadas = await filasDe(conContador);
    assert.strictEqual(copiadas.length, 1);
    assert.strictEqual(Number(copiadas[0].usuario_id), contador.id);
    assert.strictEqual((await filasDe(sinContador)).length, 0);
  });

  test('correr la migración dos veces no cambia el número de filas', async () => {
    await prepararBaseDeDatos();
    const antes = await totalFilas();
    await prepararBaseDeDatos();
    assert.strictEqual(await totalFilas(), antes);
  });

  test('borrar una cuenta quita sus filas de cliente_contador', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    const cliente = await crearCliente(contador.id, `zz_test_cliente_cuenta_${Date.now()}`);
    await prepararBaseDeDatos();
    assert.strictEqual((await filasDe(cliente)).length, 1);

    await query('DELETE FROM sesiones WHERE usuario_id = ?', [contador.id]);
    await query('DELETE FROM usuarios WHERE id = ?', [contador.id]);

    assert.strictEqual((await filasDe(cliente)).length, 0);
  });

  test('borrar un cliente quita sus asignaciones', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    const cliente = await crearCliente(contador.id, `zz_test_cliente_borrar_${Date.now()}`);
    await prepararBaseDeDatos();
    assert.strictEqual((await filasDe(cliente)).length, 1);

    await query('DELETE FROM clientes WHERE id = ?', [cliente]);

    assert.strictEqual((await filasDe(cliente)).length, 0);
  });
});
