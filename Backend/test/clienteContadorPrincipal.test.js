const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { query } = require('../src/config/db');
const ClienteContadorModel = require('../src/models/ClienteContadorModel');

/**
 * Rebanada 56a: `asignado_en` con milisegundos, el primero de la lista queda como contador principal
 * y el fragmento SQL del principal vive en un solo lugar. Datos `zz_test_`; al terminar no queda ninguno.
 */

const clientesCreados = [];

async function crearCliente(nombre) {
  const resultado = await query('INSERT INTO clientes (nombre, creado_en) VALUES (?, NOW())', [nombre]);
  clientesCreados.push(resultado.insertId);
  return resultado.insertId;
}

async function asignaciones(clienteId) {
  return query(
    `SELECT usuario_id, DATE_FORMAT(asignado_en, '%Y-%m-%d %H:%i:%s.%f') AS texto, asignado_en
     FROM cliente_contador WHERE cliente_id = ? ORDER BY asignado_en ASC, usuario_id ASC`,
    [clienteId]
  );
}

async function principalDeCliente(clienteId) {
  const [fila] = await query('SELECT usuario_id FROM clientes WHERE id = ?', [clienteId]);
  return fila.usuario_id;
}

describe('contador principal del catálogo (rebanada 56a)', () => {
  let a;
  let b;
  let c;

  before(async () => {
    await prepararBaseDeDatos();
    a = await crearUsuarioDePrueba('contador');
    b = await crearUsuarioDePrueba('contador');
    c = await crearUsuarioDePrueba('contador');
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

  test('asignado_en guarda milisegundos (DATETIME(3))', async () => {
    const [columna] = await query(
      `SELECT DATETIME_PRECISION AS precision_, COLUMN_TYPE AS tipo FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cliente_contador' AND COLUMN_NAME = 'asignado_en'`
    );
    assert.strictEqual(Number(columna.precision_), 3, columna.tipo);
  });

  test('correr el seed de nuevo conserva los valores de asignado_en', async () => {
    const cliente = await crearCliente('zz_test_ principal conserva fecha');
    await ClienteContadorModel.reemplazarContadores(cliente, [a.id]);
    await query("UPDATE cliente_contador SET asignado_en = '2020-03-04 05:06:07.123' WHERE cliente_id = ?", [cliente]);
    await prepararBaseDeDatos();
    const [fila] = await asignaciones(cliente);
    assert.strictEqual(fila.texto, '2020-03-04 05:06:07.123000');
  });

  test('reemplazar con varios ids deja como principal al primero de la lista, con 1 ms entre cada posición', async () => {
    const cliente = await crearCliente('zz_test_ principal primero');
    await ClienteContadorModel.reemplazarContadores(cliente, [c.id, b.id, a.id]);

    const filas = await asignaciones(cliente);
    assert.deepStrictEqual(filas.map((f) => f.usuario_id), [c.id, b.id, a.id], 'el orden es el de la lista');
    const tiempos = filas.map((f) => new Date(f.asignado_en).getTime());
    assert.strictEqual(tiempos[1] - tiempos[0], 1);
    assert.strictEqual(tiempos[2] - tiempos[1], 1);
    assert.strictEqual(await principalDeCliente(cliente), c.id);
    assert.strictEqual(await ClienteContadorModel.principalDe(cliente), c.id);
    assert.deepStrictEqual(
      (await ClienteContadorModel.contadoresDe(cliente)).map((x) => x.id),
      [c.id, b.id, a.id]
    );
  });

  test('reemplazar con un contador que ya estaba y otro nuevo respeta el orden pedido', async () => {
    const cliente = await crearCliente('zz_test_ principal reordena');
    await ClienteContadorModel.reemplazarContadores(cliente, [a.id]);
    await query("UPDATE cliente_contador SET asignado_en = '2020-01-01 00:00:00' WHERE cliente_id = ?", [cliente]);

    await ClienteContadorModel.reemplazarContadores(cliente, [b.id, a.id]);
    assert.strictEqual(await principalDeCliente(cliente), b.id, 'el primero de la lista es el principal');
    assert.deepStrictEqual(
      (await ClienteContadorModel.contadoresDe(cliente)).map((x) => x.id),
      [b.id, a.id]
    );

    await ClienteContadorModel.reemplazarContadores(cliente, [a.id, b.id]);
    assert.strictEqual(await principalDeCliente(cliente), a.id);
  });

  test('agregar un contador a uno que ya tiene principal no le quita el puesto aunque sea de menor id', async () => {
    const cliente = await crearCliente('zz_test_ principal agregar');
    const [menor, mayor] = [a, b, c].sort((x, y) => x.id - y.id).slice(0, 2);
    await ClienteContadorModel.agregarContador(cliente, mayor.id);
    await query("UPDATE cliente_contador SET asignado_en = '2020-01-01 00:00:00.000' WHERE cliente_id = ?", [cliente]);
    await ClienteContadorModel.agregarContador(cliente, menor.id);
    assert.strictEqual(await principalDeCliente(cliente), mayor.id, 'el más antiguo sigue de principal');
  });

  test('el fragmento SQL del principal se exporta y devuelve al principal del cliente', async () => {
    assert.strictEqual(typeof ClienteContadorModel.SQL_PRINCIPAL_DE_C, 'string');
    const cliente = await crearCliente('zz_test_ principal fragmento');
    await ClienteContadorModel.reemplazarContadores(cliente, [b.id, c.id]);
    const [fila] = await query(`SELECT c.id, ${ClienteContadorModel.SQL_PRINCIPAL_DE_C} AS principal FROM clientes c WHERE c.id = ?`, [
      cliente,
    ]);
    assert.strictEqual(fila.principal, b.id);
  });

  test('ClienteModel, clientes.mjs, documentos.mjs y catalogos.mjs usan el fragmento y no su propia copia', () => {
    const raiz = path.join(__dirname, '..', 'src');
    const archivos = [
      'models/ClienteModel.js',
      'modulos/documentos/rutas/clientes.mjs',
      'modulos/documentos/rutas/documentos.mjs',
      'modulos/documentos/rutas/catalogos.mjs',
    ];
    for (const archivo of archivos) {
      const texto = fs.readFileSync(path.join(raiz, archivo), 'utf8');
      assert.ok(texto.includes('SQL_PRINCIPAL_DE_C'), `${archivo} debe usar SQL_PRINCIPAL_DE_C`);
      assert.ok(!/SELECT x\.usuario_id FROM cliente_contador/.test(texto), `${archivo} no debe repetir la subconsulta`);
    }
  });
});
