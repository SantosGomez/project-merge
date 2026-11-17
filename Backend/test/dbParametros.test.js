const assert = require('node:assert');
const { describe, test, after } = require('node:test');
const { query, pool, conTransaccion, validarParametros } = require('../src/config/db');

/**
 * Defensa en profundidad de `db.js`: `pool.query` de mysql2 expande objetos y arreglos
 * (`{a:1}` → `` `a` = 1 ``), así que `query` y `conTransaccion` solo aceptan primitivos.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). No crea datos.
 */

after(async () => {
  await pool.end();
});

const RECHAZADOS = [
  ['objeto', { a: 1 }],
  ['arreglo', [1, 2]],
  ['arreglo anidado', [[1, 2]]],
  ['función', () => 1],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['símbolo', Symbol('x')],
];

const ACEPTADOS = [
  ['texto', "' OR '1'='1"],
  ['número', 7],
  ['booleano', true],
  ['nulo', null],
  ['undefined (mysql2 lo envía como NULL)', undefined],
  ['fecha', new Date()],
  ['buffer', Buffer.from('abc')],
  ['bigint', 10n],
];

describe('validarParametros', () => {
  for (const [nombre, valor] of RECHAZADOS) {
    test(`rechaza ${nombre}`, () => {
      assert.throws(() => validarParametros([valor]), /Parámetro SQL no permitido/);
    });
  }

  for (const [nombre, valor] of ACEPTADOS) {
    test(`acepta ${nombre}`, () => {
      assert.doesNotThrow(() => validarParametros([valor]));
    });
  }

  test('rechaza que los parámetros no sean un arreglo', () => {
    assert.throws(() => validarParametros({ a: 1 }), /Parámetro SQL no permitido/);
  });
});

describe('query y conTransaccion estrictos', () => {
  test('query rechaza un objeto antes de llegar a la base', async () => {
    await assert.rejects(() => query('SELECT 1 WHERE 1 = ?', [{ a: 1 }]), /Parámetro SQL no permitido/);
  });

  test('query rechaza un arreglo (ya no se expande IN (?))', async () => {
    await assert.rejects(() => query('SELECT 1 WHERE 1 IN (?)', [[1, 2]]), /Parámetro SQL no permitido/);
  });

  test('query sigue aceptando primitivos', async () => {
    const filas = await query('SELECT ? AS texto, ? AS numero, ? AS nulo', ["' OR '1'='1", 5, null]);
    assert.deepStrictEqual(
      { texto: filas[0].texto, numero: filas[0].numero, nulo: filas[0].nulo },
      { texto: "' OR '1'='1", numero: 5, nulo: null }
    );
  });

  test('conTransaccion rechaza objetos y arreglos en su función de ejecución', async () => {
    await assert.rejects(
      () => conTransaccion((ejecutar) => ejecutar('SELECT 1 WHERE 1 = ?', [{ a: 1 }])),
      /Parámetro SQL no permitido/
    );
    await assert.rejects(
      () => conTransaccion((ejecutar) => ejecutar('SELECT 1 WHERE 1 IN (?)', [[1]])),
      /Parámetro SQL no permitido/
    );
  });

  test('conTransaccion acepta primitivos', async () => {
    const filas = await conTransaccion((ejecutar) => ejecutar('SELECT ? AS n', [3]));
    assert.strictEqual(filas[0].n, 3);
  });
});
