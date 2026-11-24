import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { rutaConsultarRequeridos, rutaCrearRequerido } from "./requeridos.mjs";

describe("rutaConsultarRequeridos (GET /clientes/:id/requeridos)", () => {
  test("devuelve lista de requeridos y resumen de cumplimiento", async () => {
    const filasMock = [
      {
        id: 1,
        clienteId: 10,
        tipoDocId: 2,
        tipo: "Opinión de Cumplimiento",
        documentoId: null,
        periodo: "2026-10",
        entregado: 0,
        fechaLimite: new Date(2026, 9, 20),
        fechaEntrega: null,
        folioDocumento: null,
      },
      {
        id: 2,
        clienteId: 10,
        tipoDocId: 3,
        tipo: "Declaración Mensual",
        documentoId: 55,
        periodo: "2026-10",
        entregado: 1,
        fechaLimite: new Date(2026, 9, 15),
        fechaEntrega: new Date(2026, 9, 12),
        folioDocumento: "DCA-2026-0055",
      },
    ];

    const pool = {
      query: async (sql, params) => {
        assert.deepStrictEqual(params, [10, "2026-10"]);
        return [filasMock];
      },
    };

    const res = await rutaConsultarRequeridos(pool, 10, { periodo: "2026-10" });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.periodo, "2026-10");
    assert.strictEqual(res.body.requeridos.length, 2);
    assert.strictEqual(res.body.resumen.total, 2);
    assert.strictEqual(res.body.resumen.entregados, 1);
    assert.strictEqual(res.body.resumen.pendientes, 1);
    assert.strictEqual(res.body.resumen.porcentaje, 50);
  });

  test("si el cliente no tiene requeridos devuelve lista vacía y 100% de cumplimiento", async () => {
    const pool = {
      query: async () => [[]],
    };

    const res = await rutaConsultarRequeridos(pool, 99, { periodo: "2026-10" });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.requeridos, []);
    assert.strictEqual(res.body.resumen.porcentaje, 100);
    assert.strictEqual(res.body.resumen.alDia, true);
  });
});

describe("rutaCrearRequerido (POST /clientes/:id/requeridos)", () => {
  test("valida campos obligatorios (tipoDocId, periodo, fechaLimite)", async () => {
    const pool = {};
    const res = await rutaCrearRequerido(pool, 10, {});
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
    assert.ok(Array.isArray(res.body.faltantes));
  });

  test("valida formato de periodo YYYY-MM", async () => {
    const pool = {};
    const res = await rutaCrearRequerido(pool, 10, {
      tipoDocId: 1,
      periodo: "invalido",
      fechaLimite: "2026-10-20",
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
  });

  test("inserta el requisito cuando los datos son válidos", async () => {
    let sqlEjecutada = "";
    let paramsEjecutados = [];
    const pool = {
      query: async (sql, params) => {
        sqlEjecutada = sql;
        paramsEjecutados = params;
        if (sql.includes("SELECT id FROM clientes")) {
          return [[{ id: 10 }]];
        }
        if (sql.includes("SELECT id FROM tipos_documento")) {
          return [[{ id: 1 }]];
        }
        if (sql.includes("INSERT INTO cliente_doc_requeridos")) {
          return [{ insertId: 42 }];
        }
        return [[]];
      },
    };

    const res = await rutaCrearRequerido(pool, 10, {
      tipoDocId: 1,
      periodo: "2026-10",
      fechaLimite: "2026-10-20",
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.id, 42);
    assert.strictEqual(res.body.clienteId, 10);
    assert.strictEqual(res.body.tipoDocId, 1);
    assert.strictEqual(res.body.periodo, "2026-10");
  });

  test("rechaza si el cliente o el tipo de documento no existen", async () => {
    const pool = {
      query: async (sql) => {
        if (sql.includes("SELECT id FROM clientes")) {
          return [[]]; // Cliente no encontrado
        }
        return [[]];
      },
    };

    const res = await rutaCrearRequerido(pool, 999, {
      tipoDocId: 1,
      periodo: "2026-10",
      fechaLimite: "2026-10-20",
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "NO_ENCONTRADO");
  });
});
