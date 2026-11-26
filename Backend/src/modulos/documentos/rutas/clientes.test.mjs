import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rutaClientes, rutaCrearCliente, rutaConsultarCliente, rutaEditarCliente } from './clientes.mjs';

const FILA_CLIENTE = {
  id: 5,
  clave: 'A12',
  rfc: 'ACM010101AB1',
  nombre: 'Acme S.A.',
  email: 'contacto@ejemplo.com',
  telefono: '5512345678',
  activo: 1,
  creado_en: new Date(2026, 0, 5, 9, 30, 15),
  usuario_id: 7,
  contador: 'CP Ana'
};

describe('rutaConsultarCliente', () => {
  const poolExpediente = ({ cliente = FILA_CLIENTE, total = 0, recepciones = [] } = {}) => {
    const llamadas = [];
    return {
      llamadas,
      query: async (sql, params = []) => {
        llamadas.push({ sql, params });
        if (sql.includes('FROM clientes')) return [cliente ? [cliente] : []];
        if (sql.includes('COUNT(*)')) return [[{ total }]];
        if (sql.includes('FROM documentos')) return [recepciones];
        return [[]];
      }
    };
  };

  test('id no entero o menor que 1 da 400', async () => {
    const pool = poolExpediente();
    for (const malo of [NaN, 0, -3, 1.5]) {
      const r = await rutaConsultarCliente(pool, malo);
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.body.error, 'DATOS_INVALIDOS');
    }
  });

  test('cliente inexistente da 404', async () => {
    const r = await rutaConsultarCliente(poolExpediente({ cliente: null }), 99);
    assert.strictEqual(r.status, 404);
    assert.strictEqual(r.body.error, 'CLIENTE_NO_ENCONTRADO');
    assert.ok(r.body.mensaje);
  });

  test('devuelve datos del cliente, recepciones y total, con fechas en texto local', async () => {
    const recepciones = [
      { id: 2, folio: 'F-2', tipo: 'Factura', periodo: '2026-10', fechaRecepcion: new Date(2026, 9, 8, 10, 0, 0), estado: 'EN_PROCESO' },
      { id: 1, folio: 'F-1', tipo: 'Nómina', periodo: '2026-09', fechaRecepcion: new Date(2026, 8, 2, 8, 5, 0), estado: 'RECEPCIONADO' }
    ];
    const pool = poolExpediente({ total: 25, recepciones });
    const r = await rutaConsultarCliente(pool, 5);

    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.cliente, {
      id: 5,
      clave: 'A12',
      rfc: 'ACM010101AB1',
      razonSocial: 'Acme S.A.',
      email: 'contacto@ejemplo.com',
      telefono: '5512345678',
      contadorId: 7,
      contador: 'CP Ana',
      contadores: [],
      activo: true,
      estado: 'ACTIVO',
      creadoEn: '2026-01-05 09:30:15'
    });
    assert.strictEqual(r.body.totalRecepciones, 25);
    assert.strictEqual(r.body.recepciones.length, 2);
    assert.deepStrictEqual(r.body.recepciones[0], {
      id: 2,
      folio: 'F-2',
      tipo: 'Factura',
      periodo: '2026-10',
      fechaRecepcion: '2026-10-08 10:00:00',
      estado: 'EN_PROCESO'
    });
  });

  test('pide las recepciones más recientes primero y como máximo 20', async () => {
    const pool = poolExpediente();
    await rutaConsultarCliente(pool, 5);
    const consulta = pool.llamadas.find((l) => l.sql.includes('FROM documentos') && !l.sql.includes('COUNT(*)'));
    assert.match(consulta.sql, /ORDER BY d\.fecha_recepcion DESC, d\.id DESC/);
    assert.match(consulta.sql, /LIMIT 20/);
    assert.deepStrictEqual(consulta.params, [5]);
  });

  test('fechas NULL se devuelven como null, no como 1969-12-31', async () => {
    const pool = poolExpediente({
      cliente: { ...FILA_CLIENTE, creado_en: null },
      total: 1,
      recepciones: [{ id: 1, folio: 'F-1', tipo: 'Nómina', periodo: '2026-09', fechaRecepcion: null, estado: 'RECEPCIONADO' }]
    });
    const r = await rutaConsultarCliente(pool, 5);
    assert.strictEqual(r.body.cliente.creadoEn, null);
    assert.strictEqual(r.body.recepciones[0].fechaRecepcion, null);
  });

  test('cliente sin datos opcionales y dado de baja', async () => {
    const pool = poolExpediente({
      cliente: { ...FILA_CLIENTE, clave: null, rfc: null, email: null, telefono: null, usuario_id: null, contador: null, activo: 0 }
    });
    const r = await rutaConsultarCliente(pool, 5);
    assert.strictEqual(r.body.cliente.activo, false);
    assert.strictEqual(r.body.cliente.estado, 'INACTIVO');
    assert.strictEqual(r.body.cliente.contadorId, null);
    assert.strictEqual(r.body.cliente.contador, null);
    assert.strictEqual(r.body.cliente.rfc, null);
    assert.deepStrictEqual(r.body.recepciones, []);
    assert.strictEqual(r.body.totalRecepciones, 0);
  });
});

describe('contadores en la ficha y el listado (rebanada 55b)', () => {
  const contadores = [
    { clienteId: 5, id: 7, nombre: 'CP Ana' },
    { clienteId: 5, id: 9, nombre: 'CP Luis' }
  ];
  const poolConContadores = {
    query: async (sql) => {
      if (sql.includes('FROM cliente_contador cc')) return [contadores];
      if (sql.includes('FROM clientes')) return [[{ ...FILA_CLIENTE, razonSocial: 'Acme S.A.', estado: 'ACTIVO', contador: 'CP Ana' }]];
      return [[]];
    }
  };

  test('la ficha trae a todos los contadores y conserva el principal en contadorId y contador', async () => {
    const r = await rutaConsultarCliente(poolConContadores, 5);
    assert.strictEqual(r.body.cliente.contadorId, 7);
    assert.strictEqual(r.body.cliente.contador, 'CP Ana');
    assert.deepStrictEqual(r.body.cliente.contadores, [
      { id: 7, nombre: 'CP Ana' },
      { id: 9, nombre: 'CP Luis' }
    ]);
  });

  test('el listado trae contadores por cliente, vacío si no tiene', async () => {
    const pool = {
      query: async (sql) => {
        if (sql.includes('FROM cliente_contador cc')) return [contadores];
        if (sql.includes('FROM clientes')) {
          return [[
            { id: 5, rfc: 'A', razonSocial: 'Con dos', estado: 'ACTIVO', contador: 'CP Ana' },
            { id: 6, rfc: 'B', razonSocial: 'Sin contador', estado: 'ACTIVO', contador: null }
          ]];
        }
        return [[]];
      }
    };
    const r = await rutaClientes(pool, {});
    assert.deepStrictEqual(r.body.clientes[0].contadores.map((c) => c.id), [7, 9]);
    assert.deepStrictEqual(r.body.clientes[1].contadores, []);
  });
});

describe('rutaEditarCliente', () => {
  const poolEdicion = ({ existe = true, contadorValido = true, errorUpdate = null } = {}) => {
    const estado = { update: null };
    return {
      estado,
      query: async (sql, params = []) => {
        if (sql.includes('UPDATE clientes') && sql.includes('SET clave')) {
          if (errorUpdate) throw errorUpdate;
          estado.update = params;
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('FROM usuarios u') && sql.includes('usuario_modulos')) {
          return [contadorValido ? [{ id: 7, nombre: 'CP Ana' }] : []];
        }
        if (sql.includes('FROM clientes')) return [existe ? [FILA_CLIENTE] : []];
        return [[]];
      }
    };
  };

  const datos = { razonSocial: ' Acme Nueva ', clave: 'b1', rfc: 'acm-010101-ab1', email: 'x@ejemplo.com', telefono: '55', contadorId: 7, activo: false };

  test('id inválido y datos inválidos dan 400', async () => {
    const pool = poolEdicion();
    assert.strictEqual((await rutaEditarCliente(pool, 0, datos)).status, 400);
    assert.strictEqual((await rutaEditarCliente(pool, 5, { ...datos, razonSocial: '  ' })).status, 400);
    assert.strictEqual((await rutaEditarCliente(pool, 5, { ...datos, clave: '12345' })).status, 400);
    assert.strictEqual(pool.estado.update, null);
  });

  test('activo debe ser booleano', async () => {
    const pool = poolEdicion();
    for (const malo of ['si', 1, 'false', null]) {
      const r = await rutaEditarCliente(pool, 5, { ...datos, activo: malo });
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.body.error, 'DATOS_INVALIDOS');
    }
    assert.strictEqual(pool.estado.update, null);
  });

  test('cliente inexistente da 404', async () => {
    const r = await rutaEditarCliente(poolEdicion({ existe: false }), 5, datos);
    assert.strictEqual(r.status, 404);
  });

  test('contador sin rol de Contador da 400', async () => {
    const pool = poolEdicion({ contadorValido: false });
    const r = await rutaEditarCliente(pool, 5, datos);
    assert.strictEqual(r.status, 400);
    assert.strictEqual(pool.estado.update, null);
  });

  test('actualiza los campos normalizados y devuelve el cliente', async () => {
    const pool = poolEdicion();
    const r = await rutaEditarCliente(pool, 5, datos);
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.cliente);
    assert.deepStrictEqual(pool.estado.update, ['B1', 7, 'Acme Nueva', 'ACM010101AB1', 'x@ejemplo.com', '55', 0, 5]);
  });

  test('sin activo en el cuerpo conserva el estado actual', async () => {
    const pool = poolEdicion();
    const { activo, ...sinActivo } = datos;
    const r = await rutaEditarCliente(pool, 5, sinActivo);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(pool.estado.update[6], 1);
  });

  test('clave o razón social repetida da 409', async () => {
    const err = new Error("Duplicate entry 'B1' for key 'uq_clientes_clave'");
    err.code = 'ER_DUP_ENTRY';
    const r = await rutaEditarCliente(poolEdicion({ errorUpdate: err }), 5, datos);
    assert.strictEqual(r.status, 409);
    assert.strictEqual(r.body.error, 'CLIENTE_DUPLICADO');
  });
});

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

describe('contadores del cliente (rebanada 55a)', () => {
  // Doble que anota cada instrucción y simula las respuestas mínimas de alta y edición.
  const poolEspia = () => {
    const sqls = [];
    return {
      sqls,
      query: async (sql, params = []) => {
        sqls.push({ sql, params });
        if (sql.includes('FROM usuarios u') && sql.includes('usuario_modulos')) return [[{ id: 7, nombre: 'CP Ana' }]];
        if (sql.includes('INSERT INTO clientes')) return [{ insertId: 42 }];
        if (sql.includes('FROM clientes')) return [[FILA_CLIENTE]];
        return [[]];
      }
    };
  };
  const deContadores = (pool) => pool.sqls.filter((c) => c.sql.includes('cliente_contador'));

  test('el alta con contador deja el conjunto en [contadorId]', async () => {
    const pool = poolEspia();
    const r = await rutaCrearCliente(pool, { razonSocial: 'Acme', contadorId: 7 });
    assert.strictEqual(r.status, 201);
    const insercion = deContadores(pool).find((c) => c.sql.includes('INSERT INTO cliente_contador'));
    assert.deepStrictEqual(insercion.params, [42, 7]);
  });

  test('el alta sin contador deja el conjunto vacío', async () => {
    const pool = poolEspia();
    await rutaCrearCliente(pool, { razonSocial: 'Acme' });
    const llamadas = deContadores(pool);
    assert.ok(llamadas.some((c) => c.sql.includes('DELETE FROM cliente_contador') && c.params[0] === 42));
    assert.ok(!llamadas.some((c) => c.sql.includes('INSERT INTO cliente_contador')));
  });

  test('la edición reemplaza el conjunto por [contadorId] o lo vacía', async () => {
    const conContador = poolEspia();
    await rutaEditarCliente(conContador, 5, { razonSocial: 'Acme', contadorId: 7 });
    const insercion = deContadores(conContador).find((c) => c.sql.includes('INSERT INTO cliente_contador'));
    assert.deepStrictEqual(insercion.params, [5, 7]);

    const sinContador = poolEspia();
    await rutaEditarCliente(sinContador, 5, { razonSocial: 'Acme', contadorId: null });
    assert.ok(deContadores(sinContador).some((c) => c.sql.includes('DELETE FROM cliente_contador') && c.params[0] === 5));
    assert.ok(!deContadores(sinContador).some((c) => c.sql.includes('INSERT INTO cliente_contador')));
  });

  test('con un pool real guarda dentro de una transacción y la deshace si algo falla', async () => {
    const eventos = [];
    const conexion = {
      beginTransaction: async () => eventos.push('begin'),
      commit: async () => eventos.push('commit'),
      rollback: async () => eventos.push('rollback'),
      release: () => eventos.push('release'),
      query: async (sql) => {
        if (sql.includes('INSERT INTO cliente_contador')) throw new Error('falla a la mitad');
        if (sql.includes('INSERT INTO clientes')) return [{ insertId: 42 }];
        return [[]];
      }
    };
    const pool = {
      getConnection: async () => conexion,
      query: async (sql) => (sql.includes('usuario_modulos') ? [[{ id: 7, nombre: 'CP Ana' }]] : [[]])
    };
    const r = await rutaCrearCliente(pool, { razonSocial: 'Acme', contadorId: 7 });
    assert.strictEqual(r.status, 500);
    assert.deepStrictEqual(eventos, ['begin', 'rollback', 'release']);
  });
});
