import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rutaClientes } from './clientes.mjs';

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
