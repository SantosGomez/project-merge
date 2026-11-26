const assert = require('node:assert');
const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const {
  prepararBaseDeDatos,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { query, pool } = require('../src/config/db');
const bitacora = require('../src/utils/bitacoraSeguridad');
const { asegurarIndiceUnicoNombre } = require('../src/utils/seed');

/**
 * Rebanada 56a: el nombre del cliente es único en todo el catálogo. El índice `uq_clientes_nombre`
 * se crea solo si no hay nombres repetidos; si los hay, se avisa en la bitácora y no se toca nada.
 * Las dos ramas se prueban en una tabla TEMPORAL (vive en una sola conexión y desaparece sola).
 */

let lineas;
let restaurar;
const avisos = () => lineas.map((l) => JSON.parse(l)).filter((e) => e.evento === 'indice_nombre_clientes_omitido');

let conexion;
let tabla;
let numero = 0;
const ejecutar = async (sql, params = []) => (await conexion.query(sql, params))[0];

describe('índice único del nombre de cliente (rebanada 56a)', () => {
  before(async () => {
    await prepararBaseDeDatos();
    conexion = await pool.getConnection();
  });

  beforeEach(async () => {
    lineas = [];
    restaurar = bitacora.configurarSalida((linea) => lineas.push(linea));
    numero += 1;
    tabla = `zz_test_clientes_temporal_${numero}`;
    await ejecutar(
      `CREATE TEMPORARY TABLE ${tabla} (
         id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(150) NOT NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    );
  });

  afterEach(() => restaurar());

  after(async () => {
    conexion.release();
    await limpiarDatosDePrueba();
    const [restos] = await query("SELECT COUNT(*) AS n FROM clientes WHERE nombre LIKE 'zz\\_test\\_%'");
    assert.strictEqual(Number(restos.n), 0, 'no deben quedar clientes zz_test_');
    await cerrarBaseDeDatos();
  });

  const indices = async () => ejecutar(`SHOW INDEX FROM ${tabla} WHERE Key_name = 'uq_clientes_nombre'`);

  test('sin nombres repetidos crea el índice, y correrlo otra vez no falla ni vuelve a crearlo', async () => {
    await ejecutar(`INSERT INTO ${tabla} (nombre) VALUES ('zz_test_ Uno'), ('zz_test_ Dos')`);

    assert.strictEqual(await asegurarIndiceUnicoNombre(ejecutar, tabla), true);
    assert.strictEqual((await indices()).length, 1);
    assert.strictEqual(await asegurarIndiceUnicoNombre(ejecutar, tabla), true);
    assert.strictEqual((await indices()).length, 1);
    assert.deepStrictEqual(avisos(), []);
  });

  test('con un índice creado, un nombre que solo cambia en mayúsculas o acentos se rechaza', async () => {
    await ejecutar(`INSERT INTO ${tabla} (nombre) VALUES ('zz_test_ Peña Nieto')`);
    await asegurarIndiceUnicoNombre(ejecutar, tabla);
    for (const repetido of ['ZZ_TEST_ PEÑA NIETO', 'zz_test_ pena nieto']) {
      await assert.rejects(
        ejecutar(`INSERT INTO ${tabla} (nombre) VALUES (?)`, [repetido]),
        (error) => error.code === 'ER_DUP_ENTRY',
        repetido
      );
    }
  });

  test('con nombres repetidos (aunque solo cambien en acentos o mayúsculas) no crea el índice, avisa y no borra nada', async () => {
    await ejecutar(
      `INSERT INTO ${tabla} (nombre) VALUES ('zz_test_ Ñandú'), ('ZZ_TEST_ NANDU'), ('zz_test_ Otro')`
    );

    assert.strictEqual(await asegurarIndiceUnicoNombre(ejecutar, tabla), false);
    assert.strictEqual((await indices()).length, 0, 'no se crea el índice');
    const [{ n }] = await ejecutar(`SELECT COUNT(*) AS n FROM ${tabla}`);
    assert.strictEqual(Number(n), 3, 'no se borra ninguna fila');

    const registrados = avisos();
    assert.strictEqual(registrados.length, 1);
    assert.strictEqual(registrados[0].nivel, 'warn');
    assert.strictEqual(registrados[0].repetidos, 1, 'un nombre repetido');
  });

  test('el seed deja el índice en clientes cuando no hay nombres repetidos', async () => {
    const [{ repetidos }] = await query(
      'SELECT COUNT(*) AS repetidos FROM (SELECT 1 FROM clientes GROUP BY nombre HAVING COUNT(*) > 1) r'
    );
    const indice = await query("SHOW INDEX FROM clientes WHERE Key_name = 'uq_clientes_nombre'");
    if (Number(repetidos) === 0) {
      assert.strictEqual(indice.length, 1, 'el seed debe crear uq_clientes_nombre');
      assert.strictEqual(Number(indice[0].Non_unique), 0);
    } else {
      assert.strictEqual(indice.length, 0, 'con repetidos el seed no lo crea');
    }
  });
});
