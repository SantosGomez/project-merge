import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rutaClientes, rutaCrearCliente } from './clientes.mjs';

describe('rutaClientes (T30, RF-7, RF-8)', () => {
  const poolMock = (clientes = [], docs = []) => ({
    query: async (sql, params = []) => {
      if (sql.includes('FROM clientes')) {
        // Filtrar según si incluye estado = 'ACTIVO'
        if (sql.includes("WHERE c.activo = 1")) {
          return [clientes.filter((c) => c.estado === 'ACTIVO')];
        }
        return [clientes];
      }
      if (sql.includes('FROM documentos')) {
        const periodo = params[0];
        return [docs.filter((d) => d.periodo === periodo)];
      }
      return [[]];
    }
  });

  test('devuelve solo clientes activos por omisión', async () => {
    const clientes = [
      { id: 1, rfc: 'ACT1', razonSocial: 'Cliente Activo', estado: 'ACTIVO', contador: 'CP Ana' },
      { id: 2, rfc: 'INA1', razonSocial: 'Cliente Inactivo', estado: 'INACTIVO', contador: null },
      { id: 3, rfc: 'SUS1', razonSocial: 'Cliente Suspendido', estado: 'SUSPENDIDO', contador: null }
    ];
    const pool = poolMock(clientes, []);

    const res = await rutaClientes(pool, { periodo: '2026-10' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.clientes.length, 1);
    assert.strictEqual(res.body.clientes[0].rfc, 'ACT1');
    assert.strictEqual(res.body.clientes[0].esBaja, false);
  });

  test('incluye clientes dados de baja cuando incluirBaja es true y los marca', async () => {
    const clientes = [
      { id: 1, rfc: 'ACT1', razonSocial: 'Cliente Activo', estado: 'ACTIVO', contador: 'CP Ana' },
      { id: 2, rfc: 'INA1', razonSocial: 'Cliente Inactivo', estado: 'INACTIVO', contador: null },
    ];
    const pool = poolMock(clientes, []);

    const res = await rutaClientes(pool, { periodo: '2026-10', incluirBaja: 'true' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.clientes.length, 2);

    const inactivo = res.body.clientes.find((c) => c.rfc === 'INA1');
    assert.strictEqual(inactivo.estado, 'INACTIVO');
    assert.strictEqual(inactivo.esBaja, true);
  });

  test('filtra por periodo y calcula el semáforo con documentos del periodo consultado', async () => {
    const clientes = [
      { id: 1, rfc: 'ACT1', razonSocial: 'Cliente Activo', estado: 'ACTIVO', contador: null }
    ];
    const docs = [
      // En 2026-09 tiene completado (verde)
      { clienteId: 1, estado: 'COMPLETADO', fechaLimite: null, periodo: '2026-09' },
      // En 2026-10 tiene cancelado (rojo)
      { clienteId: 1, estado: 'CANCELADO', fechaLimite: null, periodo: '2026-10' }
    ];
    const pool = poolMock(clientes, docs);

    const resSep = await rutaClientes(pool, { periodo: '2026-09' });
    assert.strictEqual(resSep.body.clientes[0].semaforo, 'VERDE');

    const resOct = await rutaClientes(pool, { periodo: '2026-10' });
    assert.strictEqual(resOct.body.clientes[0].semaforo, 'ROJO');
  });

  test('sin documentos en el periodo da semáforo NEUTRO', async () => {
    const clientes = [
      { id: 1, rfc: 'ACT1', razonSocial: 'Cliente Sin Docs', estado: 'ACTIVO', contador: null }
    ];
    const pool = poolMock(clientes, []);

    const res = await rutaClientes(pool, { periodo: '2026-10' });
    assert.strictEqual(res.body.clientes[0].semaforo, 'NEUTRO');
    assert.strictEqual(res.body.clientes[0].totalDocumentos, 0);
  });

  test('búsqueda ignora mayúsculas y acentos (Pérez encuentra perez)', async () => {
    const clientes = [
      { id: 1, rfc: 'PER1', razonSocial: 'Consultores Pérez S.A.', estado: 'ACTIVO', contador: null },
      { id: 2, rfc: 'OTR1', razonSocial: 'Otro Cliente', estado: 'ACTIVO', contador: null }
    ];
    const pool = poolMock(clientes, []);

    const res = await rutaClientes(pool, { periodo: '2026-10', busqueda: 'perez' });
    assert.strictEqual(res.body.clientes.length, 1);
    assert.strictEqual(res.body.clientes[0].id, 1);
  });

  test('búsqueda por RFC ignora guiones y espacios', async () => {
    const clientes = [
      { id: 1, rfc: 'CNO120415AB3', razonSocial: 'Comercializadora', estado: 'ACTIVO', contador: null },
      { id: 2, rfc: 'OTR180920K99', razonSocial: 'Otro', estado: 'ACTIVO', contador: null }
    ];
    const pool = poolMock(clientes, []);

    const res = await rutaClientes(pool, { periodo: '2026-10', busqueda: 'cno-120415-ab3' });
    assert.strictEqual(res.body.clientes.length, 1);
    assert.strictEqual(res.body.clientes[0].id, 1);
  });

  test('la consulta pide la clave y la respuesta la devuelve', async () => {
    let sqlClientes = '';
    const pool = {
      query: async (sql) => {
        if (sql.includes('FROM clientes')) {
          sqlClientes = sql;
          return [[{ id: 1, clave: '0001', rfc: null, razonSocial: 'Acme', estado: 'ACTIVO', contador: null }]];
        }
        return [[]];
      }
    };

    const res = await rutaClientes(pool, { periodo: '2026-10' });
    assert.match(sqlClientes, /c\.clave/);
    assert.strictEqual(res.body.clientes[0].clave, '0001');
  });

  test('búsqueda por clave, y un cliente sin RFC no rompe la búsqueda', async () => {
    const clientes = [
      { id: 1, clave: '0031', rfc: null, razonSocial: 'Comedores', estado: 'ACTIVO', contador: null },
      { id: 2, clave: '0032', rfc: null, razonSocial: 'Kronox', estado: 'ACTIVO', contador: null }
    ];
    const pool = poolMock(clientes, []);

    const res = await rutaClientes(pool, { periodo: '2026-10', busqueda: '0031' });
    assert.strictEqual(res.body.clientes.length, 1);
    assert.strictEqual(res.body.clientes[0].id, 1);
  });
});

describe('rutaCrearCliente', () => {
  test('rechaza razón social vacía o muy larga con 400', async () => {
    const pool = { query: async () => [[]] };
    const r1 = await rutaCrearCliente(pool, { razonSocial: '   ' });
    assert.strictEqual(r1.status, 400);
    assert.strictEqual(r1.body.error, 'DATOS_INVALIDOS');

    const r2 = await rutaCrearCliente(pool, { razonSocial: 'A'.repeat(151) });
    assert.strictEqual(r2.status, 400);
  });

  test('rechaza clave inválida, RFC inválido o correo inválido con 400', async () => {
    const pool = { query: async () => [[]] };
    assert.strictEqual((await rutaCrearCliente(pool, { razonSocial: 'Acme', clave: '12345' })).status, 400);
    assert.strictEqual((await rutaCrearCliente(pool, { razonSocial: 'Acme', rfc: 'MALO' })).status, 400);
    assert.strictEqual((await rutaCrearCliente(pool, { razonSocial: 'Acme', email: 'sin-arroba' })).status, 400);
  });

  test('crea un cliente válido normalizando clave y RFC', async () => {
    let paramsInsert = null;
    const pool = {
      query: async (sql, params) => {
        if (sql.includes('FROM usuarios')) {
          return [[{ id: 7, nombre: 'CP Ana' }]];
        }
        if (sql.includes('INSERT INTO clientes')) {
          paramsInsert = params;
          return [{ insertId: 42 }];
        }
        return [[]];
      }
    };

    const res = await rutaCrearCliente(pool, {
      razonSocial: '  Acme S.A.  ',
      clave: ' a12 ',
      rfc: 'acm-010101-ab1',
      email: 'contacto@acme.com',
      telefono: '5512345678',
      contadorId: 7
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.cliente.id, 42);
    assert.strictEqual(res.body.cliente.clave, 'A12');
    assert.strictEqual(res.body.cliente.rfc, 'ACM010101AB1');
    assert.strictEqual(res.body.cliente.razonSocial, 'Acme S.A.');
    assert.strictEqual(res.body.cliente.contador, 'CP Ana');
    assert.deepStrictEqual(paramsInsert, [
      'A12',
      7,
      'Acme S.A.',
      'ACM010101AB1',
      'contacto@acme.com',
      '5512345678'
    ]);
  });

  test('devuelve 409 si la clave ya está registrada', async () => {
    const pool = {
      query: async () => {
        const err = new Error("Duplicate entry '0001' for key 'uq_clientes_clave'");
        err.code = 'ER_DUP_ENTRY';
        throw err;
      }
    };

    const res = await rutaCrearCliente(pool, { razonSocial: 'Acme', clave: '0001' });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'CLIENTE_DUPLICADO');
  });
});
