import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluarCumplimiento } from "./cumplimiento.mjs";

describe("evaluarCumplimiento (lógica pura de matriz de documentos requeridos)", () => {
  const hoy = new Date(2026, 9, 15, 12, 0, 0); // 15 oct 2026

  test("con lista vacía de requeridos indica 100% y al día (nada que exigir)", () => {
    const res = evaluarCumplimiento([], hoy);
    assert.deepStrictEqual(res, {
      total: 0,
      entregados: 0,
      pendientes: 0,
      vencidos: 0,
      porcentaje: 100,
      alDia: true,
    });
  });

  test("calcula entregados, pendientes y porcentaje redondeado", () => {
    const requeridos = [
      {
        id: 1,
        tipoDocId: 1,
        entregado: 1,
        documentoId: 10,
        fechaLimite: "2026-10-20",
      },
      {
        id: 2,
        tipoDocId: 2,
        entregado: 1,
        documentoId: 11,
        fechaLimite: "2026-10-20",
      },
      {
        id: 3,
        tipoDocId: 3,
        entregado: 0,
        documentoId: null,
        fechaLimite: "2026-10-25",
      },
    ];
    const res = evaluarCumplimiento(requeridos, hoy);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.entregados, 2);
    assert.strictEqual(res.pendientes, 1);
    assert.strictEqual(res.vencidos, 0);
    assert.strictEqual(res.porcentaje, 67); // Math.round((2/3) * 100) = 67
    assert.strictEqual(res.alDia, false);
  });

  test("un requisito con documentoId no nulo cuenta como entregado aunque entregado sea 0", () => {
    const requeridos = [
      {
        id: 1,
        tipoDocId: 1,
        entregado: 0,
        documentoId: 99,
        fechaLimite: "2026-10-20",
      },
    ];
    const res = evaluarCumplimiento(requeridos, hoy);
    assert.strictEqual(res.entregados, 1);
    assert.strictEqual(res.pendientes, 0);
    assert.strictEqual(res.alDia, true);
    assert.strictEqual(res.porcentaje, 100);
  });

  test("detecta requisitos pendientes cuya fecha límite ya venció", () => {
    const requeridos = [
      // Vencido (límite 10 oct, hoy es 15 oct)
      {
        id: 1,
        tipoDocId: 1,
        entregado: 0,
        documentoId: null,
        fechaLimite: "2026-10-10",
      },
      // En plazo (límite 20 oct)
      {
        id: 2,
        tipoDocId: 2,
        entregado: 0,
        documentoId: null,
        fechaLimite: "2026-10-20",
      },
      // Límite pasado pero ya entregado: no cuenta como vencido
      {
        id: 3,
        tipoDocId: 3,
        entregado: 1,
        documentoId: 5,
        fechaLimite: "2026-10-05",
      },
    ];
    const res = evaluarCumplimiento(requeridos, hoy);
    assert.strictEqual(res.total, 3);
    assert.strictEqual(res.entregados, 1);
    assert.strictEqual(res.pendientes, 2);
    assert.strictEqual(res.vencidos, 1);
    assert.strictEqual(res.alDia, false);
  });

  test("el mismo día de la fecha límite no cuenta como vencido (está en plazo)", () => {
    const requeridos = [
      {
        id: 1,
        tipoDocId: 1,
        entregado: 0,
        documentoId: null,
        fechaLimite: "2026-10-15",
      },
    ];
    const res = evaluarCumplimiento(requeridos, hoy);
    assert.strictEqual(res.vencidos, 0);
    assert.strictEqual(res.pendientes, 1);
  });
});
