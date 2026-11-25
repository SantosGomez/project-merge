import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
  rutaDocumentos,
  rutaListaDocumentos,
  rutaCambiarEstado,
  rutaListaDireccionamiento,
  rutaEntregarDocumento,
  rutaListaEntregados,
} from "./documentos.mjs";

describe("rutaListaDocumentos (Dashboard con documentos reales)", () => {
  // Doble de la base: devuelve las filas cuya fecha de recepción cae en el
  // rango [params[0], params[1]) de la consulta (el mes pedido), como haría el
  // `WHERE d.fecha_recepcion >= ? AND d.fecha_recepcion < ?`.
  const dos = (n) => String(n).padStart(2, "0");
  const textoLocal = (f) =>
    `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())} ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
  const poolMock = (filas = []) => ({
    query: async (sql, params = []) => [
      filas.filter((f) => {
        const recibido = textoLocal(f.fechaRecepcion);
        return recibido >= params[0] && recibido < params[1];
      }),
    ],
  });

  test("devuelve los documentos del periodo pedido, con la fecha en hora local", async () => {
    const filas = [
      {
        id: 7,
        folio: "DCA-2026-0007",
        cliente: "Comercializadora del Norte S.A.",
        tipo: "Facturas",
        periodo: "2026-10",
        fechaRecepcion: new Date(2026, 9, 8, 10, 15, 0),
        estado: "RECEPCIONADO",
      },
      {
        id: 3,
        folio: "DCA-2026-0003",
        cliente: "Constructora Hábitat",
        tipo: "Estados de cuenta",
        periodo: "2026-09",
        fechaRecepcion: new Date(2026, 8, 30, 9, 0, 0),
        estado: "COMPLETADO",
      },
    ];

    const res = await rutaListaDocumentos(poolMock(filas), {
      periodo: "2026-10",
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.periodo, "2026-10");
    assert.deepStrictEqual(res.body.documentos, [
      {
        id: 7,
        folio: "DCA-2026-0007",
        cliente: "Comercializadora del Norte S.A.",
        tipo: "Facturas",
        periodo: "2026-10",
        fechaRecepcion: "2026-10-08T10:15:00",
        fechaLimite: null,
        estado: "RECEPCIONADO",
      },
    ]);
  });

  test("el mes se decide por la fecha de recepción, no por el periodo contable", async () => {
    const filas = [
      {
        id: 11,
        folio: "DCA-2026-0011",
        cliente: "Cliente A",
        tipo: "Facturas",
        periodo: "2026-01",
        fechaRecepcion: new Date(2026, 9, 31, 23, 59, 59),
        estado: "COMPLETADO",
      },
      {
        id: 12,
        folio: "DCA-2026-0012",
        cliente: "Cliente A",
        tipo: "Facturas",
        periodo: "2026-10",
        fechaRecepcion: new Date(2026, 10, 1, 0, 0, 0),
        estado: "RECEPCIONADO",
      },
    ];

    const res = await rutaListaDocumentos(poolMock(filas), {
      periodo: "2026-10",
    });

    assert.deepStrictEqual(
      res.body.documentos.map((d) => d.folio),
      ["DCA-2026-0011"],
    );
  });

  test("en diciembre el rango termina el primero de enero del año siguiente", async () => {
    let paramsEjecutados = [];
    const poolEspia = {
      query: async (sql, params) => {
        paramsEjecutados = params;
        return [[]];
      },
    };
    await rutaListaDocumentos(poolEspia, { periodo: "2026-12" });
    assert.deepStrictEqual(paramsEjecutados.slice(0, 2), [
      "2026-12-01 00:00:00",
      "2027-01-01 00:00:00",
    ]);
  });

  test("devuelve la fecha límite en hora local, o null si el documento no tiene", async () => {
    const filas = [
      {
        id: 1,
        folio: "DCA-2026-0001",
        cliente: "Cliente A",
        tipo: "Facturas",
        periodo: "2026-10",
        fechaRecepcion: new Date(2026, 9, 1, 9, 0, 0),
        fechaLimite: new Date(2026, 9, 6, 18, 30, 0),
        estado: "EN_PROCESO",
      },
      {
        id: 2,
        folio: "DCA-2026-0002",
        cliente: "Cliente B",
        tipo: "Facturas",
        periodo: "2026-10",
        fechaRecepcion: new Date(2026, 9, 2, 9, 0, 0),
        fechaLimite: null,
        estado: "RECEPCIONADO",
      },
    ];

    const res = await rutaListaDocumentos(poolMock(filas), {
      periodo: "2026-10",
    });

    assert.deepStrictEqual(
      res.body.documentos.map((d) => d.fechaLimite),
      ["2026-10-06T18:30:00", null],
    );
  });

  test("sin periodo, o con uno mal formado, consulta el mes en curso", async () => {
    const hoy = new Date();
    const mesEnCurso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

    for (const query of [{}, { periodo: "2026-1" }, { periodo: "octubre" }]) {
      const res = await rutaListaDocumentos(poolMock([]), query);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        res.body.periodo,
        mesEnCurso,
        `con ${JSON.stringify(query)}`,
      );
    }
  });

  test("con la base caída responde 503 con el motivo, sin lanzar la excepción", async () => {
    const poolCaido = {
      query: async () => {
        throw Object.assign(new Error("connect ECONNREFUSED"), {
          code: "ECONNREFUSED",
        });
      },
    };

    const res = await rutaListaDocumentos(poolCaido, { periodo: "2026-10" });

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, "SIN_CONEXION");
    assert.ok(
      !res.body.mensaje.includes("ECONNREFUSED"),
      "el mensaje no lleva detalle técnico",
    );
  });

  test("con misDocumentos=1 y rol Contador, filtra por contador_id del documento o del cliente", async () => {
    let sqlEjecutada = "";
    let paramsEjecutados = [];
    const poolEspia = {
      query: async (sql, params) => {
        sqlEjecutada = sql;
        paramsEjecutados = params;
        return [[]];
      },
    };

    const usuarioContador = { id: 5, rol: "Contador" };
    await rutaListaDocumentos(
      poolEspia,
      { periodo: "2026-10", misDocumentos: "1" },
      usuarioContador,
    );

    assert.ok(
      sqlEjecutada.includes("d.contador_id = ? OR c.usuario_id = ?"),
      "la SQL incluye filtro de contador",
    );
    assert.deepStrictEqual(
      paramsEjecutados,
      [
        "2026-10-01 00:00:00",
        "2026-11-01 00:00:00",
        "2026-10-01 00:00:00",
        5,
        5,
      ],
      "pasa el rango de recepción del mes y los parámetros del contador",
    );
  });

  test("sin misDocumentos o con rol Administrador, no filtra por contador", async () => {
    let sqlEjecutada = "";
    let paramsEjecutados = [];
    const poolEspia = {
      query: async (sql, params) => {
        sqlEjecutada = sql;
        paramsEjecutados = params;
        return [[]];
      },
    };

    const usuarioAdmin = { id: 1, rol: "Administrador" };
    await rutaListaDocumentos(
      poolEspia,
      { periodo: "2026-10", misDocumentos: "1" },
      usuarioAdmin,
    );
    assert.ok(
      !sqlEjecutada.includes("d.contador_id = ? OR c.usuario_id = ?"),
      "Administrador no filtra por contador",
    );
    assert.deepStrictEqual(paramsEjecutados, [
      "2026-10-01 00:00:00",
      "2026-11-01 00:00:00",
      "2026-10-01 00:00:00",
    ]);

    await rutaListaDocumentos(
      poolEspia,
      { periodo: "2026-10" },
      { id: 5, rol: "Contador" },
    );
    assert.ok(
      !sqlEjecutada.includes("d.contador_id = ? OR c.usuario_id = ?"),
      "sin misDocumentos=1 Contador no filtra",
    );
    assert.deepStrictEqual(paramsEjecutados, [
      "2026-10-01 00:00:00",
      "2026-11-01 00:00:00",
      "2026-10-01 00:00:00",
    ]);
  });
});

describe("rutaCambiarEstado (cambio de estado desde el Dashboard)", () => {
  /**
   * Base simulada en memoria: `documentos` es { id: estado } (asignado al contador 9)
   * o { id: { estado, contadorId } }, y `historial` guarda
   * cada fila insertada. Entiende solo las tres consultas de la ruta, y cuenta
   * cuántas conexiones se pidieron para comprobar que lo inválido no toca la base.
   */
  const baseSimulada = (documentos = {}, { fallaEn } = {}) => {
    const base = {
      documentos: { ...documentos },
      historial: [],
      conexiones: 0,
      confirmada: false,
      deshecha: false,
    };
    const conexion = {
      beginTransaction: async () => {},
      commit: async () => {
        base.confirmada = true;
      },
      rollback: async () => {
        base.deshecha = true;
      },
      release: () => {},
      query: async (sql, params = []) => {
        // `fallaEn`: un trozo de SQL; esa consulta falla como si se cayera la conexión
        if (fallaEn && sql.includes(fallaEn)) {
          throw Object.assign(new Error("read ECONNRESET"), {
            code: "ECONNRESET",
          });
        }
        if (
          sql.includes(
            "SELECT estado, contador_id AS contadorId FROM documentos",
          )
        ) {
          const fila = base.documentos[params[0]];
          if (fila === undefined) return [[]];
          return [
            [typeof fila === "string" ? { estado: fila, contadorId: 9 } : fila],
          ];
        }
        if (sql.includes("UPDATE documentos")) {
          base.documentos[params[1]] = params[0];
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("INSERT INTO documento_historial")) {
          const [
            documentoId,
            usuarioId,
            estadoAnterior,
            estadoNuevo,
            comentarios,
          ] = params;
          base.historial.push({
            documentoId,
            usuarioId,
            estadoAnterior,
            estadoNuevo,
            comentarios,
          });
          return [{ insertId: base.historial.length }];
        }
        throw new Error(`consulta no prevista en la base simulada: ${sql}`);
      },
    };
    base.pool = {
      getConnection: async () => {
        base.conexiones++;
        return conexion;
      },
    };
    return base;
  };

  test("un cambio válido actualiza el documento y deja su fila en el historial", async () => {
    const base = baseSimulada({ 5: "EN_PROCESO" });

    const res = await rutaCambiarEstado(
      base.pool,
      5,
      { estado: "COMPLETADO", comentario: "Se revisa el lunes" },
      9,
      "Contador",
    );

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      id: 5,
      estadoAnterior: "EN_PROCESO",
      estado: "COMPLETADO",
    });
    assert.strictEqual(base.documentos[5], "COMPLETADO");
    assert.deepStrictEqual(base.historial, [
      {
        documentoId: 5,
        usuarioId: 9,
        estadoAnterior: "EN_PROCESO",
        estadoNuevo: "COMPLETADO",
        comentarios: "Se revisa el lunes",
      },
    ]);
    assert.strictEqual(base.confirmada, true, "la transacción se confirma");
  });

  test("un estado que no es de los cinco se rechaza con 400 sin tocar la base", async () => {
    const base = baseSimulada({ 5: "RECEPCIONADO" });

    for (const estado of ["APROBADO", "completado", "", undefined]) {
      const res = await rutaCambiarEstado(
        base.pool,
        5,
        { estado },
        9,
        "Contador",
      );
      assert.strictEqual(res.status, 400, String(estado));
      assert.strictEqual(res.body.error, "VALIDACION");
    }
    assert.strictEqual(base.conexiones, 0, "no se pidió ninguna conexión");
    assert.strictEqual(base.documentos[5], "RECEPCIONADO");
  });

  test("un documento que no existe responde 404 y no deja historial", async () => {
    const base = baseSimulada({ 5: "RECEPCIONADO" });

    const res = await rutaCambiarEstado(
      base.pool,
      999,
      { estado: "COMPLETADO" },
      9,
      "Contador",
    );

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "NO_ENCONTRADO");
    assert.deepStrictEqual(base.historial, []);
    assert.strictEqual(base.confirmada, false);
  });

  test("elegir el mismo estado que ya tiene se rechaza con 400 y no deja historial", async () => {
    const base = baseSimulada({ 5: "EN_PROCESO" });

    const res = await rutaCambiarEstado(
      base.pool,
      5,
      { estado: "EN_PROCESO" },
      9,
      "Contador",
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
    assert.deepStrictEqual(base.historial, []);
    assert.strictEqual(base.confirmada, false);
  });

  test("si la base falla a mitad del cambio, se deshace y responde 503 sin lanzar", async () => {
    const base = baseSimulada(
      { 5: "EN_PROCESO" },
      { fallaEn: "INSERT INTO documento_historial" },
    );

    const res = await rutaCambiarEstado(
      base.pool,
      5,
      { estado: "COMPLETADO" },
      9,
      "Contador",
    );

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, "SIN_CONEXION");
    assert.ok(
      !res.body.mensaje.includes("ECONNRESET"),
      "el mensaje no lleva detalle técnico",
    );
    assert.strictEqual(base.deshecha, true, "la transacción se deshace");
    assert.strictEqual(base.confirmada, false);
  });
  test("⚠️ un recepcionado no pasa a En proceso desde aquí: la entrega es en Direccionamiento", async () => {
    const base = baseSimulada({
      5: { estado: "RECEPCIONADO", contadorId: null },
    });

    const res = await rutaCambiarEstado(
      base.pool,
      5,
      { estado: "EN_PROCESO" },
      1,
      "Administrador",
    );

    assert.strictEqual(res.status, 400);
    assert.match(res.body.mensaje, /Direccionamiento/);
    assert.strictEqual(base.documentos[5].estado, "RECEPCIONADO");
    assert.deepStrictEqual(base.historial, []);
  });

  test("⚠️ un contador que no es el asignado recibe 403 y no cambia nada", async () => {
    const base = baseSimulada({ 5: "EN_PROCESO" });

    const res = await rutaCambiarEstado(
      base.pool,
      5,
      { estado: "COMPLETADO" },
      4,
      "Contador",
    );

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error, "SIN_PERMISO");
    assert.match(res.body.mensaje, /contador asignado/);
    assert.strictEqual(base.documentos[5], "EN_PROCESO");
    assert.deepStrictEqual(base.historial, []);
  });

  test("el Administrador y Sistemas cambian el estado sin estar asignados", async () => {
    for (const rol of ["Administrador", "Sistemas"]) {
      const base = baseSimulada({ 5: "EN_PROCESO" });
      const res = await rutaCambiarEstado(
        base.pool,
        5,
        { estado: "CANCELADO" },
        1,
        rol,
      );
      assert.strictEqual(res.status, 200, rol);
    }
  });

  test("se reabre un completado y se reactiva un cancelado: vuelven a En proceso", async () => {
    for (const desde of ["COMPLETADO", "CANCELADO"]) {
      const base = baseSimulada({ 5: desde });
      const res = await rutaCambiarEstado(
        base.pool,
        5,
        { estado: "EN_PROCESO" },
        9,
        "Contador",
      );
      assert.strictEqual(res.status, 200, desde);
      assert.strictEqual(base.documentos[5], "EN_PROCESO", desde);
    }
  });

  test("nada vuelve a Recepcionado", async () => {
    const base = baseSimulada({ 5: "EN_PROCESO" });
    const res = await rutaCambiarEstado(
      base.pool,
      5,
      { estado: "RECEPCIONADO" },
      9,
      "Contador",
    );
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(base.historial, []);
  });
});

describe("rutaListaDireccionamiento (documentos por entregar al contador)", () => {
  /** Doble de la base que guarda la consulta para poder mirar el WHERE. */
  const poolConConsulta = (filas = []) => {
    const consultas = [];
    return {
      consultas,
      query: async (sql, params = []) => {
        consultas.push({ sql, params });
        return [filas];
      },
    };
  };

  test("devuelve los pendientes con la fecha local y el contador resuelto", async () => {
    const filas = [
      {
        id: 7,
        folio: "DCA-2026-0007",
        cliente: "Comercializadora del Norte S.A.",
        rfc: "CNO120415AB3",
        tipo: "Facturas",
        asunto: "Facturas de septiembre",
        periodo: "2026-10",
        fechaRecepcion: new Date(2026, 9, 8, 9, 12, 0),
        fechaLimite: new Date(2026, 9, 21, 18, 0, 0),
        prioridad: "URGENTE",
        estado: "RECEPCIONADO",
        contadorId: 13,
        contador: "Contador Test",
        recibidoPor: "Recepcionista Test",
      },
      {
        id: 8,
        folio: "DCA-2026-0008",
        cliente: "Cliente Test",
        rfc: "XAXX010101000",
        tipo: "Declaración",
        asunto: "Declaración mensual",
        periodo: "2026-10",
        fechaRecepcion: new Date(2026, 9, 9, 10, 0, 0),
        fechaLimite: null,
        prioridad: "MEDIA",
        estado: "RECEPCIONADO",
        contadorId: null,
        contador: null,
        recibidoPor: "Recepción DCA",
      },
    ];

    const res = await rutaListaDireccionamiento(poolConConsulta(filas));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.documentos, [
      {
        id: 7,
        folio: "DCA-2026-0007",
        cliente: "Comercializadora del Norte S.A.",
        rfc: "CNO120415AB3",
        tipo: "Facturas",
        asunto: "Facturas de septiembre",
        periodo: "2026-10",
        fechaRecepcion: "2026-10-08T09:12:00",
        fechaLimite: "2026-10-21T18:00:00",
        prioridad: "URGENTE",
        estado: "RECEPCIONADO",
        contadorId: 13,
        contador: "Contador Test",
        recibidoPor: "Recepcionista Test",
      },
      {
        id: 8,
        folio: "DCA-2026-0008",
        cliente: "Cliente Test",
        rfc: "XAXX010101000",
        tipo: "Declaración",
        asunto: "Declaración mensual",
        periodo: "2026-10",
        fechaRecepcion: "2026-10-09T10:00:00",
        fechaLimite: null,
        prioridad: "MEDIA",
        estado: "RECEPCIONADO",
        contadorId: null,
        contador: null,
        recibidoPor: "Recepción DCA",
      },
    ]);
  });

  test("consulta solo los documentos pendientes de entrega", async () => {
    const pool = poolConConsulta([]);

    await rutaListaDireccionamiento(pool);

    assert.match(pool.consultas[0].sql, /d\.estado = 'RECEPCIONADO'/);
  });

  test("con la base caída responde 503 sin lanzar la excepción", async () => {
    const poolCaido = {
      query: async () => {
        throw Object.assign(new Error("connect ECONNREFUSED"), {
          code: "ECONNREFUSED",
        });
      },
    };

    const res = await rutaListaDireccionamiento(poolCaido);

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, "SIN_CONEXION");
  });
});

describe("rutaEntregarDocumento (entrega formal al contador)", () => {
  /** Las firmas válidas que viajan como data URL, igual que las del formulario. */
  const FIRMA_ENTREGA = "data:image/png;base64,AAAA";
  const FIRMA_RECIBE = "data:image/png;base64,BBBB";

  /**
   * Base simulada en memoria. `documentos` es { id: estado } y `contadores` es
   * { id: { nombre, activo, esContador } }. Guarda cada actualización, cada fila
   * de historial y si la transacción se confirmó o se deshizo.
   */
  const baseSimulada = (
    { documentos = {}, contadores = {}, asignados = {} } = {},
    { fallaEn } = {},
  ) => {
    const base = {
      documentos: { ...documentos },
      asignados: { ...asignados },
      contadores: { ...contadores },
      actualizaciones: [],
      historial: [],
      conexiones: 0,
      confirmada: false,
      deshecha: false,
    };
    const conexion = {
      beginTransaction: async () => {},
      commit: async () => {
        base.confirmada = true;
      },
      rollback: async () => {
        base.deshecha = true;
      },
      release: () => {},
      query: async (sql, params = []) => {
        if (fallaEn && sql.includes(fallaEn)) {
          throw Object.assign(new Error("read ECONNRESET"), {
            code: "ECONNRESET",
          });
        }
        if (sql.includes("FROM documentos d") && sql.includes("FOR UPDATE")) {
          const estado = base.documentos[params[0]];
          const { contadorId = null, contadorCliente = null } =
            base.asignados[params[0]] ?? {};
          return [
            estado === undefined
              ? []
              : [{ estado, contadorId, contadorCliente }],
          ];
        }
        if (sql.includes("SELECT u.id, u.nombre FROM usuarios")) {
          const cuenta = base.contadores[params[0]];
          return [
            cuenta && cuenta.activo && cuenta.esContador
              ? [{ id: params[0], nombre: cuenta.nombre }]
              : [],
          ];
        }
        if (/UPDATE documentos\s+SET contador_id/.test(sql)) {
          const [contadorId, firmaRecep, firmaContador, documentoId] = params;
          base.actualizaciones.push({
            contadorId,
            firmaRecep,
            firmaContador,
            documentoId,
          });
          base.documentos[documentoId] = "EN_PROCESO";
          return [{ affectedRows: 1 }];
        }
        if (sql.includes("INSERT INTO documento_historial")) {
          const [
            documentoId,
            usuarioId,
            estadoAnterior,
            estadoNuevo,
            comentarios,
          ] = params;
          base.historial.push({
            documentoId,
            usuarioId,
            estadoAnterior,
            estadoNuevo,
            comentarios,
          });
          return [{ insertId: base.historial.length }];
        }
        throw new Error(`consulta no prevista en la base simulada: ${sql}`);
      },
    };
    base.pool = {
      getConnection: async () => {
        base.conexiones++;
        return conexion;
      },
    };
    return base;
  };

  test("una entrega válida guarda contador, firmas, estado e historial", async () => {
    const base = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: {
        13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
      },
    });

    const res = await rutaEntregarDocumento(
      base.pool,
      5,
      {
        contadorId: 13,
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
        observaciones: "Se revisa el lunes",
      },
      9,
    );

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      id: 5,
      estado: "EN_PROCESO",
      contadorId: 13,
      contador: "C.P. Ana Martínez",
    });
    assert.deepStrictEqual(base.actualizaciones, [
      {
        contadorId: 13,
        firmaRecep: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
        documentoId: 5,
      },
    ]);
    assert.strictEqual(base.documentos[5], "EN_PROCESO");
    assert.deepStrictEqual(base.historial, [
      {
        documentoId: 5,
        usuarioId: 9,
        estadoAnterior: "RECEPCIONADO",
        estadoNuevo: "EN_PROCESO",
        comentarios: "Entregado a C.P. Ana Martínez. Se revisa el lunes",
      },
    ]);
    assert.strictEqual(base.confirmada, true);
  });

  test("sin observaciones, el historial solo dice a quién se entregó", async () => {
    const base = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: {
        13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
      },
    });

    await rutaEntregarDocumento(
      base.pool,
      5,
      {
        contadorId: 13,
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
      },
      9,
    );

    assert.strictEqual(
      base.historial[0].comentarios,
      "Entregado a C.P. Ana Martínez",
    );
  });

  test("un documento que ya no está pendiente se rechaza con 400 sin escribir", async () => {
    const base = baseSimulada({
      documentos: { 5: "EN_PROCESO" },
      contadores: {
        13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
      },
    });

    const res = await rutaEntregarDocumento(
      base.pool,
      5,
      {
        contadorId: 13,
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
      },
      9,
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
    assert.deepStrictEqual(base.actualizaciones, []);
    assert.deepStrictEqual(base.historial, []);
    assert.strictEqual(base.confirmada, false);
  });

  test("un documento que no existe responde 404 sin escribir", async () => {
    const base = baseSimulada({
      contadores: {
        13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
      },
    });

    const res = await rutaEntregarDocumento(
      base.pool,
      999,
      {
        contadorId: 13,
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
      },
      9,
    );

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "NO_ENCONTRADO");
    assert.deepStrictEqual(base.historial, []);
  });

  test("un contador inactivo o que no es Contador se rechaza con 400", async () => {
    for (const cuenta of [
      { nombre: "Inactivo", activo: 0, esContador: true },
      { nombre: "Recepcionista", activo: 1, esContador: false },
    ]) {
      const base = baseSimulada({
        documentos: { 5: "RECEPCIONADO" },
        contadores: { 13: cuenta },
      });

      const res = await rutaEntregarDocumento(
        base.pool,
        5,
        {
          contadorId: 13,
          firmaEntrega: FIRMA_ENTREGA,
          firmaContador: FIRMA_RECIBE,
        },
        9,
      );

      assert.strictEqual(res.status, 400, cuenta.nombre);
      assert.strictEqual(res.body.error, "VALIDACION", cuenta.nombre);
      assert.deepStrictEqual(base.actualizaciones, [], cuenta.nombre);
    }
  });

  const datosEntrega = (contadorId) => ({
    contadorId,
    firmaEntrega: FIRMA_ENTREGA,
    firmaContador: FIRMA_RECIBE,
  });
  const dosContadores = {
    13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
    14: { nombre: "C.P. Luis Pérez", activo: 1, esContador: true },
  };

  test("con contador asignado en el documento, entregar a otro se rechaza con 400 y no cambia nada", async () => {
    const base = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: dosContadores,
      asignados: { 5: { contadorId: 13, contadorCliente: 14 } },
    });

    const res = await rutaEntregarDocumento(base.pool, 5, datosEntrega(14), 9);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
    assert.match(res.body.mensaje, /asignado/i);
    assert.deepStrictEqual(base.actualizaciones, []);
    assert.deepStrictEqual(base.historial, []);
    assert.strictEqual(base.confirmada, false);
  });

  test("con contador asignado en el documento, entregar a ese mismo contador funciona", async () => {
    const base = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: dosContadores,
      asignados: { 5: { contadorId: 13, contadorCliente: 14 } },
    });

    const res = await rutaEntregarDocumento(base.pool, 5, datosEntrega(13), 9);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.contadorId, 13);
    assert.strictEqual(base.actualizaciones[0].contadorId, 13);
  });

  test("documento anterior sin contador: se entrega al contador habitual del cliente y a otro se rechaza", async () => {
    const rechazo = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: dosContadores,
      asignados: { 5: { contadorId: null, contadorCliente: 14 } },
    });
    const resRechazo = await rutaEntregarDocumento(
      rechazo.pool,
      5,
      datosEntrega(13),
      9,
    );
    assert.strictEqual(resRechazo.status, 400);
    assert.deepStrictEqual(rechazo.actualizaciones, []);

    const acepta = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: dosContadores,
      asignados: { 5: { contadorId: null, contadorCliente: 14 } },
    });
    const resAcepta = await rutaEntregarDocumento(
      acepta.pool,
      5,
      datosEntrega(14),
      9,
    );
    assert.strictEqual(resAcepta.status, 200);
    assert.strictEqual(acepta.actualizaciones[0].contadorId, 14);
  });

  test("sin contador en el documento ni en el cliente, acepta el contador elegido", async () => {
    const base = baseSimulada({
      documentos: { 5: "RECEPCIONADO" },
      contadores: dosContadores,
    });

    const res = await rutaEntregarDocumento(base.pool, 5, datosEntrega(14), 9);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(base.actualizaciones[0].contadorId, 14);
  });

  test("sin las dos firmas o con un contador inválido responde 400 sin tocar la base", async () => {
    const casos = [
      { contadorId: 13, firmaEntrega: "", firmaContador: FIRMA_RECIBE },
      { contadorId: 13, firmaEntrega: FIRMA_ENTREGA, firmaContador: null },
      {
        contadorId: 13,
        firmaEntrega: "no-es-una-firma",
        firmaContador: FIRMA_RECIBE,
      },
      {
        contadorId: 0,
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
      },
      {
        contadorId: "trece",
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
      },
      { firmaEntrega: FIRMA_ENTREGA, firmaContador: FIRMA_RECIBE },
    ];

    for (const [indice, datos] of casos.entries()) {
      const base = baseSimulada({
        documentos: { 5: "RECEPCIONADO" },
        contadores: {
          13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
        },
      });

      const res = await rutaEntregarDocumento(base.pool, 5, datos, 9);

      assert.strictEqual(res.status, 400, `caso ${indice}`);
      assert.strictEqual(res.body.error, "VALIDACION", `caso ${indice}`);
      assert.strictEqual(
        base.conexiones,
        0,
        `caso ${indice}: no se pidió conexión`,
      );
    }
  });

  test("si la base falla a mitad de la entrega, se deshace y responde 503", async () => {
    const base = baseSimulada(
      {
        documentos: { 5: "RECEPCIONADO" },
        contadores: {
          13: { nombre: "C.P. Ana Martínez", activo: 1, esContador: true },
        },
      },
      { fallaEn: "INSERT INTO documento_historial" },
    );

    const res = await rutaEntregarDocumento(
      base.pool,
      5,
      {
        contadorId: 13,
        firmaEntrega: FIRMA_ENTREGA,
        firmaContador: FIRMA_RECIBE,
      },
      9,
    );

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, "SIN_CONEXION");
    assert.strictEqual(base.deshecha, true);
    assert.strictEqual(base.confirmada, false);
  });
});

describe("rutaListaEntregados contra MariaDB", () => {
  const require = createRequire(import.meta.url);
  const { seedDatabase } = require("../../../utils/seed.js");
  const { pool: poolApp } = require("../../../config/db.js");
  // created_at es TIMESTAMP (tope 2038): por eso 2036-2037 y no 2090
  const MARCA = `ZZT${Date.now().toString(36)}-`;

  let pool = null;
  let motivo = null;
  let clienteId = null;
  let recepId = null;
  let contadorId = null;

  before(async () => {
    try {
      await seedDatabase({ cuentasDemo: false });
      pool = poolApp;
      const nuevoUsuario = async (nombre, rol) => {
        const [r] = await pool.query(
          "INSERT INTO usuarios (nombre, correo, password_hash, rol, creado_en, actualizado_en) VALUES (?, ?, 'x', ?, NOW(), NOW())",
          [`zz_test_${nombre}`, `zz_test_${MARCA}${nombre}@ejemplo.com`, rol],
        );
        return r.insertId;
      };
      recepId = await nuevoUsuario("recepcion", "recepcionista");
      contadorId = await nuevoUsuario("contador", "contador");
      const [cliente] = await pool.query(
        "INSERT INTO clientes (usuario_id, nombre, rfc, activo, creado_en) VALUES (NULL, ?, 'XAXX010101000', 1, NOW())",
        [`${MARCA}Cliente de prueba`],
      );
      clienteId = cliente.insertId;
      const [[empresa]] = await pool.query("SELECT MIN(id) AS id FROM empresas");
      const [[tipo]] = await pool.query("SELECT MIN(id) AS id FROM tipos_documento");
      const [[departamento]] = await pool.query("SELECT MIN(id) AS id FROM departamentos");
      const documento = async (clave, estado) => {
        const [r] = await pool.query(
          `INSERT INTO documentos (folio, cliente_id, empresa_id, tipo_doc_id, departamento_id,
                                   usuario_recep_id, contador_id, via_entrega, fecha_recepcion, periodo, asunto, estado, prioridad)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PRESENCIAL', '2036-11-02 09:00:00', '2036-11', 'Prueba', ?, 'MEDIA')`,
          [MARCA + clave, clienteId, empresa.id, tipo.id, departamento.id, recepId, contadorId, estado],
        );
        return r.insertId;
      };
      const historial = (docId, anterior, nuevo, fecha, comentarios = null) =>
        pool.query(
          `INSERT INTO documento_historial (documento_id, usuario_id, estado_anterior, estado_nuevo, comentarios, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [docId, recepId, anterior, nuevo, comentarios, fecha],
        );
      const entrega = async (clave, fecha, comentarios) =>
        historial(await documento(clave, "EN_PROCESO"), "RECEPCIONADO", "EN_PROCESO", fecha, comentarios);

      await entrega("NOV-INICIO", "2036-11-01 00:00:00", "Entregado a X. Con originales.");
      await entrega("NOV-FIN", "2036-11-30 23:59:59");
      await entrega("DIC-INICIO", "2036-12-01 00:00:00");
      await entrega("DIC-FIN", "2036-12-31 23:59:59");
      await entrega("ENE-INICIO", "2037-01-01 00:00:00");
      await entrega("OCT", "2036-10-31 23:59:59");
      // El estado actual cambió después de la entrega
      const cambiado = await documento("NOV-COMPLETADO", "COMPLETADO");
      await historial(cambiado, "RECEPCIONADO", "EN_PROCESO", "2036-11-10 10:00:00");
      await historial(cambiado, "EN_PROCESO", "COMPLETADO", "2036-11-20 10:00:00");
      // Solo un cambio de estado que no es entrega
      const noEntrega = await documento("NOV-SIN-ENTREGA", "COMPLETADO");
      await historial(noEntrega, "EN_PROCESO", "COMPLETADO", "2036-11-15 10:00:00");
      // Dos entregas: cuenta la más reciente
      const doble = await documento("DOBLE", "EN_PROCESO");
      await historial(doble, "RECEPCIONADO", "EN_PROCESO", "2036-11-05 10:00:00");
      await historial(doble, "RECEPCIONADO", "EN_PROCESO", "2036-12-05 10:00:00");
    } catch (error) {
      motivo = `no hay base de pruebas de status-conta — ${error.message}`;
    }
  });

  after(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM documentos WHERE folio LIKE ?", [`${MARCA}%`]);
    if (clienteId) await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    for (const id of [recepId, contadorId]) {
      if (id) await pool.query("DELETE FROM usuarios WHERE id = ?", [id]);
    }
    // El pool compartido lo cierra el bloque «contra MariaDB» siguiente
  });

  const foliosDe = async (mes) => {
    const res = await rutaListaEntregados(pool, { mes });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    return res.body.documentos
      .filter((d) => d.folio.startsWith(MARCA))
      .map((d) => d.folio.replace(MARCA, ""));
  };

  test("noviembre trae solo lo entregado en noviembre, con sus bordes, y lo más reciente primero", async (t) => {
    if (motivo) return t.skip(motivo);
    assert.deepStrictEqual(await foliosDe("2036-11"), [
      "NOV-FIN",
      "NOV-COMPLETADO",
      "NOV-INICIO",
    ]);
  });

  test("diciembre incluye el 31 a las 23:59:59 y no el 1 de enero; la doble entrega cuenta en su fecha más reciente", async (t) => {
    if (motivo) return t.skip(motivo);
    assert.deepStrictEqual(await foliosDe("2036-12"), ["DIC-FIN", "DOBLE", "DIC-INICIO"]);
    assert.deepStrictEqual(await foliosDe("2037-01"), ["ENE-INICIO"]);
  });

  test("no sale en un mes lo que se entregó en otro ni lo que no es entrega", async (t) => {
    if (motivo) return t.skip(motivo);
    const nov = await foliosDe("2036-11");
    assert.ok(!nov.includes("OCT"));
    assert.ok(!nov.includes("DOBLE"));
    assert.ok(!nov.includes("NOV-SIN-ENTREGA"));
    assert.deepStrictEqual(await foliosDe("2036-10"), ["OCT"]);
  });

  test("trae el estado actual, el contador, quien entregó, la observación y las fechas locales", async (t) => {
    if (motivo) return t.skip(motivo);
    const res = await rutaListaEntregados(pool, { mes: "2036-11" });
    const completado = res.body.documentos.find((d) => d.folio === MARCA + "NOV-COMPLETADO");
    assert.strictEqual(completado.estado, "COMPLETADO");
    assert.strictEqual(completado.fechaEntrega, "2036-11-10T10:00:00");
    assert.strictEqual(completado.fechaRecepcion, "2036-11-02T09:00:00");
    assert.strictEqual(completado.contadorId, contadorId);
    assert.strictEqual(completado.contador, "zz_test_contador");
    assert.strictEqual(completado.entregadoPor, "zz_test_recepcion");
    assert.strictEqual(completado.rfc, "XAXX010101000");
    const inicio = res.body.documentos.find((d) => d.folio === MARCA + "NOV-INICIO");
    assert.strictEqual(inicio.comentarios, "Entregado a X. Con originales.");
    assert.strictEqual(inicio.fechaEntrega, "2036-11-01T00:00:00");
  });
});

describe("rutaListaDocumentos contra MariaDB: lo pendiente de meses anteriores no se pierde", () => {
  // El doble de arriba imita el WHERE en JavaScript y no puede probar el SQL:
  // aquí la consulta corre de verdad sobre la base de pruebas de status-conta
  // (unión, fase 3), con periodos de 2090 para no mezclarse con otros datos.
  const require = createRequire(import.meta.url);
  const { seedDatabase } = require("../../../utils/seed.js");
  const { pool: poolApp } = require("../../../config/db.js");
  const PERIODOS = { "2026-09": "2090-09", "2026-10": "2090-10", "2026-11": "2090-11", "2026-12": "2090-12" };
  const MARCA = `ZZT${Date.now().toString(36)}-`;

  let pool = null;
  let motivo = null;
  let clienteId = null;
  let usuarioId = null;

  before(async () => {
    try {
      await seedDatabase({ cuentasDemo: false });
      pool = poolApp;
      const [usuario] = await pool.query(
        "INSERT INTO usuarios (nombre, correo, password_hash, rol, creado_en, actualizado_en) VALUES ('zz_test_recepcion', ?, 'x', 'recepcionista', NOW(), NOW())",
        [`zz_test_${MARCA}@prueba.local`],
      );
      usuarioId = usuario.insertId;
      const [cliente] = await pool.query(
        "INSERT INTO clientes (usuario_id, nombre, rfc, activo, creado_en) VALUES (NULL, ?, NULL, 1, NOW())",
        [`${MARCA}Cliente de prueba`],
      );
      clienteId = cliente.insertId;
      const [[empresa]] = await pool.query("SELECT MIN(id) AS id FROM empresas");
      const [[tipo]] = await pool.query("SELECT MIN(id) AS id FROM tipos_documento");
      const [[departamento]] = await pool.query("SELECT MIN(id) AS id FROM departamentos");
      // [folio, mes de recepción, estado, prioridad, periodo contable]
      // El periodo contable no coincide a propósito con el mes de recepción
      // en algunos: el Dashboard se rige por la fecha de recepción.
      const documentos = [
        ["NOV-RECIBIDO", "2026-11", "RECEPCIONADO", "MEDIA", "2026-11"],
        ["NOV-COMPLETADO", "2026-11", "COMPLETADO", "BAJA", "2026-11"],
        ["NOV-COMPLETADO-OTRO-PERIODO", "2026-11", "COMPLETADO", "BAJA", "2026-09"],
        ["OCT-RECIBIDO", "2026-10", "RECEPCIONADO", "URGENTE", "2026-10"],
        ["OCT-EN-PROCESO", "2026-10", "EN_PROCESO", "ALTA", "2026-10"],
        ["SEP-PENDIENTE-CLIENTE", "2026-09", "PENDIENTE_CLIENTE", "MEDIA", "2026-09"],
        ["OCT-COMPLETADO", "2026-10", "COMPLETADO", "MEDIA", "2026-10"],
        ["OCT-CANCELADO", "2026-10", "CANCELADO", "MEDIA", "2026-10"],
        ["OCT-COMPLETADO-PERIODO-NOV", "2026-10", "COMPLETADO", "MEDIA", "2026-11"],
        ["DIC-RECIBIDO", "2026-12", "RECEPCIONADO", "MEDIA", "2026-12"],
      ];
      for (const [folio, mesRecepcion, estado, prioridad, periodo] of documentos) {
        await pool.query(
          `INSERT INTO documentos (folio, cliente_id, empresa_id, tipo_doc_id, departamento_id,
                                   usuario_recep_id, via_entrega, fecha_recepcion, periodo, asunto, estado, prioridad)
           VALUES (?, ?, ?, ?, ?, ?, 'PRESENCIAL', ?, ?, 'Prueba', ?, ?)`,
          [MARCA + folio, clienteId, empresa.id, tipo.id, departamento.id, usuarioId, `${PERIODOS[mesRecepcion]}-15 10:00:00`, PERIODOS[periodo], estado, prioridad],
        );
      }
    } catch (error) {
      motivo = `no hay base de pruebas de status-conta — ${error.message}`;
    }
  });

  after(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM documentos WHERE folio LIKE ?", [`${MARCA}%`]);
    if (clienteId) await pool.query("DELETE FROM clientes WHERE id = ?", [clienteId]);
    if (usuarioId) await pool.query("DELETE FROM usuarios WHERE id = ?", [usuarioId]);
    await pool.end();
  });

  const foliosDe = async (periodo) => {
    const res = await rutaListaDocumentos(pool, { periodo: PERIODOS[periodo] });
    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    // Solo los de esta prueba: la base puede tener documentos reales en trámite
    return res.body.documentos
      .filter((d) => d.folio.startsWith(MARCA))
      .map((d) => d.folio.replace(MARCA, ""))
      .sort();
  };

  test("trae todo el periodo pedido más lo que sigue vivo de meses anteriores", async (t) => {
    if (motivo) return t.skip(motivo);
    assert.deepStrictEqual(await foliosDe("2026-11"), [
      "NOV-COMPLETADO",
      "NOV-COMPLETADO-OTRO-PERIODO",
      "NOV-RECIBIDO",
      "OCT-EN-PROCESO",
      "OCT-RECIBIDO",
      "SEP-PENDIENTE-CLIENTE",
    ]);
  });

  test("un documento recibido en el mes con otro periodo contable sale con cualquier estado", async (t) => {
    if (motivo) return t.skip(motivo);
    assert.ok((await foliosDe("2026-11")).includes("NOV-COMPLETADO-OTRO-PERIODO"));
    assert.ok(!(await foliosDe("2026-09")).includes("NOV-COMPLETADO-OTRO-PERIODO"));
  });

  test("lo terminado o cancelado de meses anteriores no se arrastra, ni lo de meses posteriores", async (t) => {
    if (motivo) return t.skip(motivo);
    const folios = await foliosDe("2026-11");
    for (const ausente of [
      "OCT-COMPLETADO",
      "OCT-CANCELADO",
      "OCT-COMPLETADO-PERIODO-NOV",
      "DIC-RECIBIDO",
    ]) {
      assert.ok(!folios.includes(ausente), ausente);
    }
  });

  test("en un periodo pasado arrastra solo lo anterior a ese periodo", async (t) => {
    if (motivo) return t.skip(motivo);
    assert.deepStrictEqual(await foliosDe("2026-10"), [
      "OCT-CANCELADO",
      "OCT-COMPLETADO",
      "OCT-COMPLETADO-PERIODO-NOV",
      "OCT-EN-PROCESO",
      "OCT-RECIBIDO",
      "SEP-PENDIENTE-CLIENTE",
    ]);
  });

  test("cada documento trae el contador asignado (o null si aún no se entrega)", async (t) => {
    if (motivo) return t.skip(motivo);
    await pool.query(
      "UPDATE documentos SET contador_id = ? WHERE folio = ?", [usuarioId, MARCA + "OCT-EN-PROCESO"],
    );
    const res = await rutaListaDocumentos(pool, { periodo: PERIODOS["2026-11"] });
    const porFolio = Object.fromEntries(
      res.body.documentos.map((d) => [d.folio.replace(MARCA, ""), d.contadorId]),
    );
    assert.strictEqual(porFolio["OCT-EN-PROCESO"], usuarioId);
    assert.strictEqual(porFolio["OCT-RECIBIDO"], null);
  });

  test("cada documento trae su prioridad", async (t) => {
    if (motivo) return t.skip(motivo);
    const res = await rutaListaDocumentos(pool, { periodo: PERIODOS["2026-11"] });
    const urgente = res.body.documentos.find((d) => d.folio === MARCA + "OCT-RECIBIDO");
    assert.strictEqual(urgente.prioridad, "URGENTE");
  });

  test("misDocumentos=1 en MariaDB filtra solo documentos asignados al contador o a clientes del contador", async (t) => {
    if (motivo) return t.skip(motivo);
    await pool.query(
      "UPDATE documentos SET contador_id = ? WHERE folio = ?", [usuarioId, MARCA + "OCT-EN-PROCESO"],
    );
    await pool.query("UPDATE clientes SET usuario_id = ? WHERE id = ?", [usuarioId, clienteId]); // cliente de OCT-RECIBIDO
    const res = await rutaListaDocumentos(
      pool,
      { periodo: PERIODOS["2026-11"], misDocumentos: "1" },
      { id: usuarioId, rol: "Contador" },
    );
    const folios = res.body.documentos.map((d) => d.folio.replace(MARCA, "")).sort();
    assert.ok(
      folios.includes("OCT-EN-PROCESO"),
      "incluye documento asignado al contador",
    );
  });
});

describe("rutaDocumentos (vinculación automática con cliente_doc_requeridos)", () => {
  const datosValidos = {
    clienteId: 5,
    empresaId: 1,
    tipoDocId: 2,
    departamentoId: 1,
    contadorId: 13,
    asunto: "Entrega de Opinión de Cumplimiento",
    prioridad: "MEDIA",
    periodo: "2026-10",
    viaEntrega: "CORREO",
    observaciones: null,
    fechaLimiteSla: "2026-10-25T14:00:00",
    firmaCliente: "data:image/png;base64,abc",
    firmaRecep: "data:image/png;base64,def",
    adjuntos: [],
  };

  test("al crear documento vincula y marca entregado en cliente_doc_requeridos", async () => {
    const consultas = [];
    const poolSimulado = {
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        query: async (sql, params) => {
          consultas.push({ sql, params });
          if (sql.includes("AS estado FROM clientes")) {
            return [[{ estado: "ACTIVO" }]];
          }
          if (sql.includes("SELECT u.id FROM usuarios")) {
            return [[{ id: params[0] }]];
          }
          if (sql.includes("SELECT consecutivo FROM contador_folio")) {
            return [[{ consecutivo: 10 }]];
          }
          if (sql.includes("INSERT INTO documentos")) {
            return [{ insertId: 77 }];
          }
          return [[]];
        },
      }),
    };

    const res = await rutaDocumentos(poolSimulado, datosValidos, 1);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 77);

    const actualizacionRequerido = consultas.find((c) =>
      c.sql.includes("UPDATE cliente_doc_requeridos"),
    );
    assert.ok(
      actualizacionRequerido,
      "debe ejecutar UPDATE en cliente_doc_requeridos",
    );
    assert.ok(actualizacionRequerido.sql.includes("documento_id = ?"));
    assert.ok(actualizacionRequerido.sql.includes("entregado = 1"));
    // Parámetros: documentoId (77), clienteId (5), tipoDocId (2), periodo ('2026-10')
    assert.strictEqual(actualizacionRequerido.params[0], 77);
    assert.strictEqual(actualizacionRequerido.params[1], 5);
    assert.strictEqual(actualizacionRequerido.params[2], 2);
    assert.strictEqual(actualizacionRequerido.params[3], "2026-10");
  });

  /** Pool simulado: `esContador` dice si la cuenta tiene el rol Contador en documentos. */
  const poolConContador = (esContador) => {
    const consultas = [];
    let deshecha = false;
    const pool = {
      getConnection: async () => ({
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {
          deshecha = true;
        },
        release: () => {},
        query: async (sql, params) => {
          consultas.push({ sql, params });
          if (sql.includes("AS estado FROM clientes")) {
            return [[{ estado: "ACTIVO" }]];
          }
          if (sql.includes("SELECT u.id FROM usuarios")) {
            return [esContador ? [{ id: params[0] }] : []];
          }
          if (sql.includes("SELECT consecutivo FROM contador_folio")) {
            return [[{ consecutivo: 10 }]];
          }
          if (sql.includes("INSERT INTO documentos")) {
            return [{ insertId: 77 }];
          }
          return [[]];
        },
      }),
    };
    return { pool, consultas, fueDeshecha: () => deshecha };
  };

  test("guarda el contador asignado en documentos.contador_id", async () => {
    const { pool, consultas } = poolConContador(true);

    const res = await rutaDocumentos(pool, datosValidos, 1);

    assert.strictEqual(res.status, 200);
    const insercion = consultas.find((c) =>
      c.sql.includes("INSERT INTO documentos"),
    );
    assert.ok(insercion.sql.includes("contador_id"));
    assert.ok(
      insercion.params.includes(13),
      "el id del contador va en los parámetros",
    );
    const consultaContador = consultas.find((c) =>
      c.sql.includes("SELECT u.id FROM usuarios"),
    );
    assert.deepStrictEqual(consultaContador.params, [13]);
  });

  test("sin contador responde 400 VALIDACION y no guarda nada", async () => {
    const { pool, consultas } = poolConContador(true);
    const { contadorId, ...sinContador } = datosValidos;

    const res = await rutaDocumentos(pool, sinContador, 1);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
    assert.ok(res.body.faltantes.some((f) => f.campo === "contadorId"));
    assert.strictEqual(
      consultas.some((c) => c.sql.includes("INSERT INTO documentos")),
      false,
    );
  });

  test("una cuenta que no es Contador de documentos se rechaza con 400 y se deshace", async () => {
    const { pool, consultas, fueDeshecha } = poolConContador(false);

    const res = await rutaDocumentos(pool, datosValidos, 1);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "VALIDACION");
    assert.match(res.body.mensaje, /contador/i);
    assert.strictEqual(
      consultas.some((c) => c.sql.includes("INSERT INTO documentos")),
      false,
    );
    assert.strictEqual(fueDeshecha(), true);
  });
});

describe("rutaListaEntregados (documentos ya entregados al contador, por mes de entrega)", () => {
  const poolConConsulta = (filas = []) => {
    const consultas = [];
    return {
      consultas,
      query: async (sql, params = []) => {
        consultas.push({ sql, params });
        return [filas];
      },
    };
  };

  test("devuelve los campos pedidos con fechas locales y la entrega más reciente primero", async () => {
    const filas = [
      {
        id: 7,
        folio: "DCA-2026-0007",
        cliente: "Cliente Test",
        rfc: "XAXX010101000",
        tipo: "Facturas",
        periodo: "2026-10",
        prioridad: "ALTA",
        estado: "COMPLETADO",
        fechaRecepcion: new Date(2026, 10, 3, 9, 0, 0),
        fechaEntrega: new Date(2026, 10, 5, 16, 30, 15),
        contadorId: 13,
        contador: "Contador Test",
        entregadoPor: "Recepcionista Test",
        comentarios: "Entregado a Contador Test. Con originales.",
      },
    ];
    const pool = poolConConsulta(filas);

    const res = await rutaListaEntregados(pool, { mes: "2026-11" });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      documentos: [
        {
          id: 7,
          folio: "DCA-2026-0007",
          cliente: "Cliente Test",
          rfc: "XAXX010101000",
          tipo: "Facturas",
          periodo: "2026-10",
          prioridad: "ALTA",
          estado: "COMPLETADO",
          fechaRecepcion: "2026-11-03T09:00:00",
          fechaEntrega: "2026-11-05T16:30:15",
          contadorId: 13,
          contador: "Contador Test",
          entregadoPor: "Recepcionista Test",
          comentarios: "Entregado a Contador Test. Con originales.",
        },
      ],
    });
    assert.match(pool.consultas[0].sql, /ORDER BY h\.created_at DESC/);
  });

  test("filtra por rango de texto local del mes, sin DATE_FORMAT sobre la columna", async () => {
    const pool = poolConConsulta();
    await rutaListaEntregados(pool, { mes: "2026-11" });
    assert.deepStrictEqual(pool.consultas[0].params, [
      "2026-11-01 00:00:00",
      "2026-12-01 00:00:00",
    ]);
    assert.ok(!/DATE_FORMAT/i.test(pool.consultas[0].sql));
    assert.match(pool.consultas[0].sql, /estado_anterior = 'RECEPCIONADO'/);
    assert.match(pool.consultas[0].sql, /estado_nuevo = 'EN_PROCESO'/);
  });

  test("diciembre termina en el 1 de enero del año siguiente", async () => {
    const pool = poolConConsulta();
    await rutaListaEntregados(pool, { mes: "2026-12" });
    assert.deepStrictEqual(pool.consultas[0].params, [
      "2026-12-01 00:00:00",
      "2027-01-01 00:00:00",
    ]);
  });

  test("sin mes válido (o con mes 00 o 13) usa el mes en curso", async () => {
    const hoy = new Date();
    const dos = (n) => String(n).padStart(2, "0");
    const esperado = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-01 00:00:00`;
    for (const mes of [undefined, "abc", "2026-13", "2026-00", "2026-1"]) {
      const pool = poolConConsulta();
      await rutaListaEntregados(pool, mes === undefined ? {} : { mes });
      assert.strictEqual(pool.consultas[0].params[0], esperado, String(mes));
    }
  });

  test("con la base caída responde 503", async () => {
    const poolCaido = {
      query: async () => {
        throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
      },
    };
    const res = await rutaListaEntregados(poolCaido, { mes: "2026-11" });
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, "SIN_CONEXION");
  });
});
