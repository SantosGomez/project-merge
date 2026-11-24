import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rutaClientesFrecuentes } from "./clientesFrecuentes.mjs";

describe("rutaClientesFrecuentes (GET /clientes/frecuentes)", () => {
  test("devuelve los clientes que ya tienen recepciones, con la forma que consume la vista", async () => {
    const filas = [
      { id: 7, clave: "0031", razonSocial: "Comercial Uno SA de CV", rfc: null },
      { id: 3, clave: "0001", razonSocial: "Acme Logística SA de CV", rfc: "ACM010101AB1" },
    ];
    const pool = {
      query: async () => [filas],
    };

    const res = await rutaClientesFrecuentes(pool);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.clientes, filas);
  });

  test("solo cuenta clientes ACTIVO con al menos un documento registrado", async () => {
    let sqlEjecutada = "";
    const pool = {
      query: async (sql) => {
        sqlEjecutada = sql;
        return [[]];
      },
    };

    await rutaClientesFrecuentes(pool);

    assert.match(sqlEjecutada, /c\.activo = 1/);
    assert.match(sqlEjecutada, /EXISTS\s*\(/i);
    assert.match(sqlEjecutada, /FROM documentos/i);
  });

  test("sin clientes frecuentes devuelve la lista vacía, no un error", async () => {
    const pool = {
      query: async () => [[]],
    };

    const res = await rutaClientesFrecuentes(pool);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.clientes, []);
  });

  test("si la base no responde devuelve 503 con el motivo, no un 500", async () => {
    const pool = {
      query: async () => {
        const error = new Error("sin base");
        error.code = "ECONNREFUSED";
        throw error;
      },
    };

    const res = await rutaClientesFrecuentes(pool);

    assert.equal(res.status, 503);
    assert.equal(res.body.error, "SIN_CONEXION");
  });
});
