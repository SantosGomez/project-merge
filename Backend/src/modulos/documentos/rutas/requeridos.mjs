import { evaluarCumplimiento } from "../logica/cumplimiento.mjs";
import { aFechaLocal } from "../logica/fechas.mjs";
import { clasificarFallo, mensajeDeFallo } from "../logica/errores.mjs";

const aTextoFecha = (valor) => {
  if (!valor) return null;
  const f = aFechaLocal(valor);
  const dos = (n) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}`;
};

const aTextoFechaHora = (valor) => {
  if (!valor) return null;
  const f = aFechaLocal(valor);
  const dos = (n) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
};

/**
 * GET /clientes/:id/requeridos?periodo=YYYY-MM
 *
 * Consulta la matriz de documentos requeridos para un cliente y periodo.
 */
export async function rutaConsultarRequeridos(pool, clienteId, query = {}) {
  let periodo = query.periodo;
  if (typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo)) {
    const hoy = new Date();
    periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  }

  try {
    const [filas] = await pool.query(
      `SELECT r.id, r.cliente_id AS clienteId, r.tipo_doc_id AS tipoDocId,
              t.nombre AS tipo, r.documento_id AS documentoId,
              r.periodo, r.entregado,
              r.fecha_limite_entrega AS fechaLimite,
              r.fecha_entrega AS fechaEntrega,
              d.folio AS folioDocumento
       FROM cliente_doc_requeridos r
       JOIN tipos_documento t ON r.tipo_doc_id = t.id
       LEFT JOIN documentos d ON r.documento_id = d.id
       WHERE r.cliente_id = ? AND r.periodo = ?
       ORDER BY t.nombre ASC`,
      [Number(clienteId), periodo],
    );

    const hoyServidor = new Date();
    const resumen = evaluarCumplimiento(filas, hoyServidor);

    return {
      status: 200,
      body: {
        clienteId: Number(clienteId),
        periodo,
        resumen,
        requeridos: filas.map((fila) => ({
          id: fila.id,
          clienteId: fila.clienteId,
          tipoDocId: fila.tipoDocId,
          tipo: fila.tipo,
          documentoId: fila.documentoId,
          folioDocumento: fila.folioDocumento,
          periodo: fila.periodo,
          entregado: Boolean(fila.entregado) || fila.documentoId != null,
          fechaLimite: aTextoFecha(fila.fechaLimite),
          fechaEntrega: aTextoFechaHora(fila.fechaEntrega),
        })),
      },
    };
  } catch (error) {
    const motivo = clasificarFallo(error);
    if (motivo === "SIN_CONEXION" || motivo === "ESQUEMA_NO_APLICADO") {
      return {
        status: 503,
        body: { error: motivo, mensaje: mensajeDeFallo(motivo) },
      };
    }
    return {
      status: 500,
      body: { error: "INTERNO", mensaje: mensajeDeFallo("OTRO") },
    };
  }
}

/**
 * POST /clientes/:id/requeridos
 *
 * Registra un documento requerido para un cliente en un periodo.
 */
export async function rutaCrearRequerido(pool, clienteId, datos = {}) {
  const faltantes = [];
  if (!datos.tipoDocId) faltantes.push("tipoDocId");
  if (!datos.periodo) faltantes.push("periodo");
  if (!datos.fechaLimite) faltantes.push("fechaLimite");

  if (faltantes.length > 0) {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        faltantes,
        mensaje: "Faltan campos obligatorios para el requisito",
      },
    };
  }

  if (
    typeof datos.periodo !== "string" ||
    !/^\d{4}-\d{2}$/.test(datos.periodo)
  ) {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        mensaje: "El formato de periodo debe ser YYYY-MM",
      },
    };
  }

  try {
    // Validar que el cliente exista
    const [clientes] = await pool.query(
      "SELECT id FROM clientes WHERE id = ?",
      [Number(clienteId)],
    );
    if (!clientes.length) {
      return {
        status: 404,
        body: { error: "NO_ENCONTRADO", mensaje: "El cliente no existe" },
      };
    }

    // Validar que el tipo de documento exista
    const [tipos] = await pool.query(
      "SELECT id FROM tipos_documento WHERE id = ?",
      [Number(datos.tipoDocId)],
    );
    if (!tipos.length) {
      return {
        status: 404,
        body: {
          error: "NO_ENCONTRADO",
          mensaje: "El tipo de documento no existe",
        },
      };
    }

    const [resultado] = await pool.query(
      `INSERT INTO cliente_doc_requeridos
        (cliente_id, tipo_doc_id, periodo, entregado, fecha_limite_entrega)
       VALUES (?, ?, ?, 0, ?)`,
      [
        Number(clienteId),
        Number(datos.tipoDocId),
        datos.periodo,
        aTextoFecha(datos.fechaLimite),
      ],
    );

    return {
      status: 201,
      body: {
        id: resultado.insertId,
        clienteId: Number(clienteId),
        tipoDocId: Number(datos.tipoDocId),
        periodo: datos.periodo,
        fechaLimite: datos.fechaLimite,
        entregado: false,
      },
    };
  } catch (error) {
    const motivo = clasificarFallo(error);
    if (motivo === "SIN_CONEXION" || motivo === "ESQUEMA_NO_APLICADO") {
      return {
        status: 503,
        body: { error: motivo, mensaje: mensajeDeFallo(motivo) },
      };
    }
    return {
      status: 500,
      body: { error: "INTERNO", mensaje: mensajeDeFallo("OTRO") },
    };
  }
}
