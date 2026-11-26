import {
  validarDocumento,
  validarAdjuntos,
  LIMITE_ADJUNTO_BYTES,
} from "../logica/validacion.mjs";
import { formarFolio } from "../logica/folio.mjs";
import { anioDe, aFechaLocal } from "../logica/fechas.mjs";
import { clasificarFallo, mensajeDeFallo } from "../logica/errores.mjs";
import {
  esResponsable,
  motivoTransicionInvalida,
} from "../logica/estadosDocumento.mjs";
import {
  rutaRelativaArchivo,
  escribirArchivo,
  buscarCarpetaCliente,
} from "../logica/almacenamiento.mjs";
import { createRequire } from "node:module";

// El modelo de contadores es CommonJS: aquí solo se toma su subconsulta del contador principal.
const { SQL_PRINCIPAL_DE_C } = createRequire(import.meta.url)("../../../models/ClienteContadorModel.js");

/**
 * POST /documentos
 * Registra un documento con folio, transacción, bloqueo de fila y reintento.
 *
 * Body esperado (JSON):
 * {
 *   "clienteId": 1,
 *   "empresaId": 1,
 *   "tipoDocId": 1,
 *   "departamentoId": 1,
 *   "contadorId": 13,
 *   "asunto": "string",
 *   "prioridad": "BAJA|MEDIA|ALTA|URGENTE",
 *   "periodo": "2026-10",
 *   "viaEntrega": "PRESENCIAL|CORREO|DIGITAL|OTRO",
 *   "observaciones": "string|null",
 *   "fechaLimiteSla": "2026-10-20T14:30:00",  // SIN Z, hora local
 *   "notificarCorreo": false,
 *   "firmaCliente": "base64...",
 *   "firmaRecep": "base64...",
 *   "adjuntos": [
 *     { "nombreOriginal": "archivo.pdf", "mimeType": "application/pdf", "tamanoBytes": 102400 }
 *   ]
 * }
 *
 * Respuesta 200:
 * {
 *   "id": 123,
 *   "folio": "DCA-2026-0001",
 *   "periodo": "2026-10",
 *   "fechaRecepcion": "2026-10-15T14:30:00",
 *   "fechaLimite": "2026-10-20T14:30:00",
 *   "firmas": { "cliente": true, "recepcionista": true }
 * }
 *
 * @param {Pool} pool - Grupo de conexiones mysql2.
 * @param {object} datos - Cuerpo de la petición parseado.
 * @param {number} usuarioId - ID del usuario que hace la recepción (desde la sesión).
 * @returns {{status: number, body: object}} Respuesta HTTP.
 */
export async function rutaDocumentos(pool, datos, usuarioId) {
  // 1. Validación del documento (campos obligatorios, formato de periodo y vía de entrega)
  const faltantes = validarDocumento(datos);
  if (faltantes.length > 0) {
    return {
      status: 400,
      body: { error: "VALIDACION", faltantes },
    };
  }

  // 2. Validación de adjuntos (los que pasan de 25 MiB se rechazan solos, no bloquean el documento)
  const adjuntosRechazados = validarAdjuntos(datos.adjuntos ?? []);
  const adjuntosValidos = (datos.adjuntos ?? []).filter(
    (a) =>
      !adjuntosRechazados.some(
        (r) =>
          r.nombreOriginal === a.nombreOriginal &&
          r.tamanoBytes === a.tamanoBytes,
      ),
  );

  // 3. Fecha de hoy para el folio (la usa el servidor, no el cliente)
  const hoy = new Date();

  // 4. Reintento hasta 3 veces por folio repetido
  for (let intento = 1; intento <= 3; intento++) {
    let conexion;
    try {
      // Obtener conexión del pool para la transacción
      conexion = await pool.getConnection();
      await conexion.beginTransaction();

      // Validación: el cliente debe seguir activo (caso límite:
      // puede pasar a baja entre carga y guardado).
      const [clienteEstado] = await conexion.query(
        `SELECT IF(activo = 1, 'ACTIVO', 'INACTIVO') AS estado FROM clientes WHERE id = ?`,
        [datos.clienteId],
      );
      if (!clienteEstado.length || clienteEstado[0].estado !== "ACTIVO") {
        await conexion.rollback();
        return {
          status: 400,
          body: {
            error: "VALIDACION",
            mensaje:
              "El cliente seleccionado está dado de baja; no se puede registrar un documento. Verifique el catálogo o contacte a administración.",
          },
        };
      }

      // El contador asignado se comprueba en el servidor: debe ser una cuenta con
      // el módulo de documentos y rol Contador.
      const [contadores] = await conexion.query(
        `SELECT u.id FROM usuarios u
         JOIN usuario_modulos m ON m.usuario_id = u.id AND m.modulo = 'documentos' AND m.rol = 'contador'
         WHERE u.id = ?`,
        [datos.contadorId],
      );
      if (contadores.length === 0) {
        await conexion.rollback();
        return {
          status: 400,
          body: {
            error: "VALIDACION",
            mensaje:
              "El contador asignado no existe o no tiene el rol Contador en documentos. Elige otro contador de la lista y vuelve a guardar.",
          },
        };
      }

      // Obtener y incrementar el consecutivo de forma ATÓMICA
      // INSERT ... ON DUPLICATE KEY UPDATE adquiere bloqueo exclusivo en la fila.
      // Insertamos con 1 para que el primer folio sea 0001; en duplicado se incrementa.
      // Luego leemos el valor actualizado en la misma transacción (seguro por el bloqueo).
      const anio = anioDe(hoy);
      await conexion.query(
        `INSERT INTO contador_folio (anio, consecutivo) VALUES (?, 1)
         ON DUPLICATE KEY UPDATE consecutivo = consecutivo + 1`,
        [anio],
      );
      const [filas] = await conexion.query(
        "SELECT consecutivo FROM contador_folio WHERE anio = ?",
        [anio],
      );
      const siguiente = filas[0].consecutivo;

      const folio = formarFolio(anio, siguiente);

      // Insertar documento
      const [resultado] = await conexion.query(
        `INSERT INTO documentos (
           folio, cliente_id, empresa_id, tipo_doc_id, departamento_id,
           usuario_recep_id, contador_id, via_entrega, periodo, observaciones, asunto,
           prioridad, fecha_limite_sla, notificar_correo,
           firma_cliente, firma_recep, estado
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEPCIONADO')`,
        [
          folio,
          datos.clienteId,
          datos.empresaId,
          datos.tipoDocId,
          datos.departamentoId,
          usuarioId,
          datos.contadorId,
          datos.viaEntrega,
          datos.periodo,
          datos.observaciones ?? null,
          datos.asunto,
          datos.prioridad,
          datos.fechaLimiteSla ?? null, // Se guarda tal cual: sin Z, hora local
          datos.notificarCorreo ? 1 : 0,
          datos.firmaCliente,
          datos.firmaRecep,
        ],
      );

      const documentoId = resultado.insertId;

      // Primera entrada del historial (sin estado anterior)
      await conexion.query(
        `INSERT INTO documento_historial (documento_id, usuario_id, estado_anterior, estado_nuevo)
         VALUES (?, ?, NULL, 'RECEPCIONADO')`,
        [documentoId, usuarioId],
      );

      // Insertar adjuntos (ruta_storage = NULL)
      for (const adjunto of adjuntosValidos) {
        await conexion.query(
          `INSERT INTO documento_archivos (documento_id, ruta_storage, nombre_original, mime_type, tamano_bytes)
           VALUES (?, NULL, ?, ?, ?)`,
          [
            documentoId,
            adjunto.nombreOriginal,
            adjunto.mimeType,
            adjunto.tamanoBytes,
          ],
        );
      }

      // 8. Vincular automáticamente con requisito pendiente en cliente_doc_requeridos si existe
      await conexion.query(
        `UPDATE cliente_doc_requeridos
         SET documento_id = ?, entregado = 1, fecha_entrega = NOW()
         WHERE cliente_id = ? AND tipo_doc_id = ? AND periodo = ? AND documento_id IS NULL
         LIMIT 1`,
        [documentoId, datos.clienteId, datos.tipoDocId, datos.periodo],
      );

      // Confirmar transacción
      await conexion.commit();

      // Respuesta exitosa
      return {
        status: 200,
        body: {
          id: documentoId,
          folio,
          periodo: datos.periodo,
          fechaRecepcion: (() => {
            const f = aFechaLocal(new Date());
            return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}T${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}:${String(f.getSeconds()).padStart(2, "0")}`;
          })(),
          fechaLimite: datos.fechaLimiteSla ?? null,
          firmas: {
            cliente: true,
            recepcionista: true,
          },
        },
      };
    } catch (error) {
      // Deshacer transacción si hay conexión activa
      if (conexion) {
        try {
          await conexion.rollback();
        } catch {
          // Ignorar errores de rollback
        }
      }

      const motivo = clasificarFallo(error);

      // FOLIO_REPETIDO: reintentar (continua el bucle)
      if (motivo === "FOLIO_REPETIDO") {
        continue;
      }

      // SIN_CONEXION o ESQUEMA_NO_APLICADO: 503
      if (motivo === "SIN_CONEXION" || motivo === "ESQUEMA_NO_APLICADO") {
        return {
          status: 503,
          body: { error: motivo, mensaje: mensajeDeFallo(motivo) },
        };
      }

      // Cualquier otro fallo: 500 INTERNO
      return {
        status: 500,
        body: { error: "INTERNO", mensaje: mensajeDeFallo("OTRO") },
      };
    } finally {
      // Liberar conexión
      if (conexion) {
        conexion.release();
      }
    }
  }

  // Si se agotan los 3 intentos por folio repetido
  return {
    status: 500,
    body: { error: "INTERNO", mensaje: mensajeDeFallo("OTRO") },
  };
}

/** Fecha y hora local como `AAAA-MM-DDTHH:mm:ss`, SIN Z: así no se desplaza el día. */
const aTextoLocal = (valor) => {
  const f = aFechaLocal(valor);
  const dos = (n) => String(n).padStart(2, "0");
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
};

/**
 * GET /documentos
 *
 * Lista los documentos recibidos en un mes (`periodo`, `AAAA-MM`, comparado con
 * la fecha de recepción) para el Dashboard, más los recibidos antes que siguen
 * en trámite (recibidos, en proceso o pendientes del cliente). Cada fila trae su prioridad y su fecha límite.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {object} query - Objeto con los searchParams parseados (`periodo`: 'YYYY-MM', `misDocumentos`: '1').
 * @param {{ id: number, rol: string } | null} usuario - Usuario de la sesión (opcional).
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaListaDocumentos(pool, query = {}, usuario = null) {
  // Sin periodo válido, el mes en curso del servidor (igual que GET /clientes)
  let periodo = query.periodo;
  if (typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo)) {
    const hoy = new Date();
    periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  }

  const filtrarMisDocumentos =
    (query.misDocumentos === "1" || query.misDocumentos === "true") &&
    usuario?.rol === "Contador" &&
    Boolean(usuario?.id);

  try {
    // Lo recibido en el mes elegido (por fecha de recepción, no por periodo
    // contable), más lo que sigue vivo de meses anteriores: lo pendiente de
    // octubre sigue pendiente en noviembre y no debe desaparecer del control
    // al cambiar de mes (igual que en Direccionamiento). Rango en hora local.
    const [anio, mes] = periodo.split("-").map(Number);
    const dos = (n) => String(n).padStart(2, "0");
    const inicioMes = `${anio}-${dos(mes)}-01 00:00:00`;
    const inicioSiguiente =
      mes === 12
        ? `${anio + 1}-01-01 00:00:00`
        : `${anio}-${dos(mes + 1)}-01 00:00:00`;
    let sql = `SELECT d.id, d.folio, c.nombre AS cliente, t.nombre AS tipo,
              d.periodo, d.fecha_recepcion AS fechaRecepcion,
              d.fecha_limite_sla AS fechaLimite, d.estado, d.prioridad,
              d.contador_id AS contadorId
       FROM documentos d
       JOIN clientes c ON d.cliente_id = c.id
       JOIN tipos_documento t ON d.tipo_doc_id = t.id
       WHERE ((d.fecha_recepcion >= ? AND d.fecha_recepcion < ?)
          OR (d.fecha_recepcion < ? AND d.estado IN ('RECEPCIONADO', 'EN_PROCESO', 'PENDIENTE_CLIENTE')))`;
    const params = [inicioMes, inicioSiguiente, inicioMes];

    if (filtrarMisDocumentos) {
      // Es suyo el documento asignado a él o el de un cliente donde figura como uno de sus contadores.
      sql += ` AND (d.contador_id = ? OR EXISTS (SELECT 1 FROM cliente_contador cc WHERE cc.cliente_id = c.id AND cc.usuario_id = ?))`;
      params.push(usuario.id, usuario.id);
    }

    sql += ` ORDER BY d.fecha_recepcion DESC`;

    const [filas] = await pool.query(sql, params);

    return {
      status: 200,
      body: {
        periodo,
        documentos: filas.map((fila) => ({
          ...fila,
          fechaRecepcion: aTextoLocal(fila.fechaRecepcion),
          fechaLimite: fila.fechaLimite ? aTextoLocal(fila.fechaLimite) : null,
        })),
      },
    };
  } catch (error) {
    const motivo = clasificarFallo(error);

    // SIN_CONEXION o ESQUEMA_NO_APLICADO: 503
    if (motivo === "SIN_CONEXION" || motivo === "ESQUEMA_NO_APLICADO") {
      return {
        status: 503,
        body: { error: motivo, mensaje: mensajeDeFallo(motivo) },
      };
    }

    // Cualquier otro fallo: 500 INTERNO
    return {
      status: 500,
      body: { error: "INTERNO", mensaje: mensajeDeFallo("OTRO") },
    };
  }
}

/**
 * GET /documentos/direccionamiento
 *
 * Lista los documentos pendientes de entregar al contador (estado
 * `RECEPCIONADO`), sin importar el periodo: lo pendiente de agosto sigue
 * pendiente en noviembre. El contador sugerido es el del documento y, si no
 * tiene, el contador habitual del cliente.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaListaDireccionamiento(pool) {
  try {
    const [filas] = await pool.query(
      `SELECT d.id, d.folio, c.nombre AS cliente, c.rfc,
              t.nombre AS tipo, d.asunto, d.periodo,
              d.fecha_recepcion AS fechaRecepcion,
              d.fecha_limite_sla AS fechaLimite,
              d.prioridad, d.estado,
              COALESCE(d.contador_id, ${SQL_PRINCIPAL_DE_C}) AS contadorId,
              COALESCE(uc.nombre, ucl.nombre) AS contador,
              ur.nombre AS recibidoPor
       FROM documentos d
       JOIN clientes c ON c.id = d.cliente_id
       JOIN tipos_documento t ON t.id = d.tipo_doc_id
       JOIN usuarios ur ON ur.id = d.usuario_recep_id
       LEFT JOIN usuarios uc ON uc.id = d.contador_id
       LEFT JOIN usuarios ucl ON ucl.id = ${SQL_PRINCIPAL_DE_C}
       WHERE d.estado = 'RECEPCIONADO'
       ORDER BY d.fecha_recepcion ASC, d.id ASC`,
    );

    return {
      status: 200,
      body: {
        documentos: filas.map((fila) => ({
          ...fila,
          fechaRecepcion: aTextoLocal(fila.fechaRecepcion),
          fechaLimite: fila.fechaLimite ? aTextoLocal(fila.fechaLimite) : null,
          contadorId: fila.contadorId ?? null,
          contador: fila.contador ?? null,
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
 * GET /documentos/entregados
 *
 * Lista los documentos que se entregaron al contador en un mes (`mes`,
 * `AAAA-MM`; sin mes válido, el mes en curso). La entrega es la fila de
 * `documento_historial` que pasó de `RECEPCIONADO` a `EN_PROCESO`; si hubiera
 * más de una por documento, cuenta la más reciente. El estado que se devuelve
 * es el actual, que pudo cambiar después de la entrega. Solo consulta.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {object} query - searchParams parseados (`mes`: 'AAAA-MM').
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaListaEntregados(pool, query = {}) {
  let mes = query.mes;
  if (typeof mes !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    const hoy = new Date();
    mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  }

  try {
    // Rango del mes en texto local (sin DATE_FORMAT sobre la columna)
    const [anio, numeroMes] = mes.split("-").map(Number);
    const dos = (n) => String(n).padStart(2, "0");
    const inicioMes = `${anio}-${dos(numeroMes)}-01 00:00:00`;
    const inicioSiguiente =
      numeroMes === 12
        ? `${anio + 1}-01-01 00:00:00`
        : `${anio}-${dos(numeroMes + 1)}-01 00:00:00`;

    const [filas] = await pool.query(
      `SELECT d.id, d.folio, c.nombre AS cliente, c.rfc,
              t.nombre AS tipo, d.periodo, d.prioridad, d.estado,
              d.fecha_recepcion AS fechaRecepcion,
              h.created_at AS fechaEntrega,
              d.contador_id AS contadorId,
              uc.nombre AS contador,
              ue.nombre AS entregadoPor,
              h.comentarios
       FROM documento_historial h
       JOIN (SELECT documento_id, MAX(id) AS ultimoId
               FROM documento_historial
              WHERE estado_anterior = 'RECEPCIONADO' AND estado_nuevo = 'EN_PROCESO'
              GROUP BY documento_id) u ON u.ultimoId = h.id
       JOIN documentos d ON d.id = h.documento_id
       JOIN clientes c ON c.id = d.cliente_id
       JOIN tipos_documento t ON t.id = d.tipo_doc_id
       LEFT JOIN usuarios uc ON uc.id = d.contador_id
       LEFT JOIN usuarios ue ON ue.id = h.usuario_id
       WHERE h.created_at >= ? AND h.created_at < ?
       ORDER BY h.created_at DESC, h.id DESC`,
      [inicioMes, inicioSiguiente],
    );

    return {
      status: 200,
      body: {
        documentos: filas.map((fila) => ({
          ...fila,
          fechaRecepcion: aTextoLocal(fila.fechaRecepcion),
          fechaEntrega: aTextoLocal(fila.fechaEntrega),
          contadorId: fila.contadorId ?? null,
          contador: fila.contador ?? null,
          entregadoPor: fila.entregadoPor ?? null,
          comentarios: fila.comentarios ?? null,
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

/** Tope de cada firma en caracteres: dos caben de sobra en el cuerpo de 2 MiB. */
const LIMITE_FIRMA = 700_000;

/** Una firma válida es una data URL de imagen, como la que produce `toDataURL()`. */
const esFirmaValida = (valor) =>
  typeof valor === "string" &&
  valor.startsWith("data:image/") &&
  valor.length <= LIMITE_FIRMA;

/**
 * POST /documentos/:id/entrega
 *
 * Formaliza la entrega de un documento de recepción al contador: guarda las dos
 * firmas, asigna el contador y pasa el documento a `EN_PROCESO`, todo en una
 * transacción. La observación de la entrega va al historial, no a
 * `documentos.observaciones`, que es la de la recepción.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {number} documentoId - ID del documento (de la ruta).
 * @param {object} datos - { contadorId, firmaEntrega, firmaContador, observaciones? }.
 * @param {number} usuarioId - ID del usuario que entrega (de la sesión).
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaEntregarDocumento(
  pool,
  documentoId,
  datos,
  usuarioId,
) {
  // Se valida antes de pedir conexión: lo incompleto no llega a la base
  if (!Number.isInteger(datos?.contadorId) || datos.contadorId <= 0) {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        mensaje: "Elige el contador que recibe la documentación.",
      },
    };
  }
  if (
    !esFirmaValida(datos?.firmaEntrega) ||
    !esFirmaValida(datos?.firmaContador)
  ) {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        mensaje: "Las dos firmas son obligatorias para confirmar la entrega.",
      },
    };
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // Bloqueo de fila: dos entregas simultáneas no pueden pasar las dos
    const [filas] = await conexion.query(
      `SELECT d.estado, d.contador_id AS contadorId, ${SQL_PRINCIPAL_DE_C} AS contadorCliente
       FROM documentos d
       LEFT JOIN clientes c ON c.id = d.cliente_id
       WHERE d.id = ? FOR UPDATE`,
      [documentoId],
    );
    if (filas.length === 0) {
      await conexion.rollback();
      return {
        status: 404,
        body: {
          error: "NO_ENCONTRADO",
          mensaje: "El documento no existe o ya no está disponible.",
        },
      };
    }
    const estadoAnterior = filas[0].estado;
    if (estadoAnterior !== "RECEPCIONADO") {
      await conexion.rollback();
      return {
        status: 400,
        body: {
          error: "VALIDACION",
          mensaje:
            "El documento ya fue entregado al contador o ya no está pendiente de entrega.",
        },
      };
    }

    // Quien recibe es el contador asignado en la recepción o, en documentos
    // anteriores, el habitual del cliente. Solo sin ninguno de los dos se elige.
    const contadorAsignado = filas[0].contadorId ?? filas[0].contadorCliente;
    if (contadorAsignado != null && contadorAsignado !== datos.contadorId) {
      await conexion.rollback();
      return {
        status: 400,
        body: {
          error: "VALIDACION",
          mensaje:
            "No se puede entregar a otro contador. Este documento tiene un contador asignado y solo él puede recibirlo. Actualiza la pantalla y entrega al contador que aparece asignado.",
        },
      };
    }

    // El contador se comprueba en el servidor: el cliente no decide quién recibe
    const [cuentas] = await conexion.query(
      `SELECT u.id, u.nombre FROM usuarios u
       JOIN usuario_modulos m ON m.usuario_id = u.id AND m.modulo = 'documentos' AND m.rol = 'contador'
       WHERE u.id = ?`,
      [datos.contadorId],
    );
    if (cuentas.length === 0) {
      await conexion.rollback();
      return {
        status: 400,
        body: {
          error: "VALIDACION",
          mensaje:
            "El contador elegido no existe, no está activo o no tiene el rol Contador.",
        },
      };
    }
    const nombreContador = cuentas[0].nombre;

    await conexion.query(
      `UPDATE documentos
       SET contador_id = ?, firma_contador_recep = ?, firma_contador = ?, estado = 'EN_PROCESO'
       WHERE id = ?`,
      [datos.contadorId, datos.firmaEntrega, datos.firmaContador, documentoId],
    );

    const observaciones =
      typeof datos.observaciones === "string" ? datos.observaciones.trim() : "";
    const comentario = `Entregado a ${nombreContador}${observaciones ? `. ${observaciones}` : ""}`;
    await conexion.query(
      `INSERT INTO documento_historial (documento_id, usuario_id, estado_anterior, estado_nuevo, comentarios)
       VALUES (?, ?, ?, ?, ?)`,
      [documentoId, usuarioId, estadoAnterior, "EN_PROCESO", comentario],
    );

    await conexion.commit();

    return {
      status: 200,
      body: {
        id: documentoId,
        estado: "EN_PROCESO",
        contadorId: datos.contadorId,
        contador: nombreContador,
      },
    };
  } catch (error) {
    try {
      await conexion.rollback();
    } catch {
      // Ignorar errores de rollback
    }

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
  } finally {
    conexion.release();
  }
}

/** Los cinco valores del ENUM `documentos.estado` (Backend/schema.sql). */
const ESTADOS_DOCUMENTO = [
  "RECEPCIONADO",
  "EN_PROCESO",
  "PENDIENTE_CLIENTE",
  "COMPLETADO",
  "CANCELADO",
];

/**
 * POST /documentos/:id/estado
 *
 * Cambia el estado de un documento y deja la fila correspondiente en
 * `documento_historial`, en la misma transacción. Solo lo cambia el contador
 * asignado al documento, o Administrador/Sistemas, y solo por los caminos de
 * `logica/estadosDocumento.js` (2026-11-04).
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {number} documentoId - ID del documento (de la ruta).
 * @param {object} datos - Cuerpo: { estado, comentario? }.
 * @param {number} usuarioId - ID del usuario que hace el cambio (desde la sesión).
 * @param {string} rol - Rol del usuario (desde la sesión).
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaCambiarEstado(
  pool,
  documentoId,
  datos,
  usuarioId,
  rol,
) {
  // Se valida antes de pedir conexión: un estado inventado no llega a la base
  if (!ESTADOS_DOCUMENTO.includes(datos?.estado)) {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        mensaje: "El estado elegido no es válido. Elige uno de la lista.",
      },
    };
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // Se bloquea la fila para que dos cambios simultáneos no lean el mismo estado anterior
    const [filas] = await conexion.query(
      "SELECT estado, contador_id AS contadorId FROM documentos WHERE id = ? FOR UPDATE",
      [documentoId],
    );
    if (filas.length === 0) {
      await conexion.rollback();
      return {
        status: 404,
        body: {
          error: "NO_ENCONTRADO",
          mensaje: "El documento no existe o ya no está disponible.",
        },
      };
    }
    const estadoAnterior = filas[0].estado;
    if (!esResponsable(filas[0], { id: usuarioId, rol })) {
      await conexion.rollback();
      return {
        status: 403,
        body: {
          error: "SIN_PERMISO",
          mensaje:
            "Solo el contador asignado a este documento o un administrador pueden cambiar su estado.",
        },
      };
    }
    const motivo = motivoTransicionInvalida(estadoAnterior, datos.estado);
    if (motivo) {
      await conexion.rollback();
      return { status: 400, body: { error: "VALIDACION", mensaje: motivo } };
    }

    await conexion.query("UPDATE documentos SET estado = ? WHERE id = ?", [
      datos.estado,
      documentoId,
    ]);
    await conexion.query(
      `INSERT INTO documento_historial (documento_id, usuario_id, estado_anterior, estado_nuevo, comentarios)
       VALUES (?, ?, ?, ?, ?)`,
      [
        documentoId,
        usuarioId,
        estadoAnterior,
        datos.estado,
        datos.comentario ?? null,
      ],
    );

    await conexion.commit();

    return {
      status: 200,
      body: { id: documentoId, estadoAnterior, estado: datos.estado },
    };
  } catch (error) {
    // Deshacer: ni el estado ni el historial quedan a medias
    try {
      await conexion.rollback();
    } catch {
      // Ignorar errores de rollback
    }

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
  } finally {
    conexion.release();
  }
}

/**
 * POST /documentos/:id/archivos
 *
 * Guarda en disco un archivo asociado a un documento y deja su ruta en
 * `documento_archivos`. Acepta el archivo en crudo (Buffer). Si ya existe una
 * fila pendiente (ruta_storage NULL) con el mismo nombre, la actualiza; si no,
 * inserta una nueva.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {string} carpetaBase - Raíz donde se guardan los archivos.
 * @param {number} documentoId - ID del documento.
 * @param {string} nombreOriginal - Nombre original del archivo.
 * @param {string} [mimeType] - Tipo MIME.
 * @param {Buffer|Uint8Array} contenido - Bytes del archivo.
 * @param {number} [usuarioId] - Usuario que sube (reservado).
 * @returns {Promise<{status:number, body:object}>}
 */
export async function rutaSubirArchivo(
  pool,
  carpetaBase,
  documentoId,
  nombreOriginal,
  mimeType,
  contenido,
  usuarioId,
) {
  if (!Number.isInteger(documentoId) || documentoId <= 0) {
    return {
      status: 400,
      body: { error: "VALIDACION", mensaje: "El documento no es válido." },
    };
  }
  if (typeof nombreOriginal !== "string" || nombreOriginal.trim() === "") {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        mensaje: "El nombre del archivo es obligatorio.",
      },
    };
  }
  if (!contenido || !contenido.length) {
    return {
      status: 400,
      body: { error: "VALIDACION", mensaje: "El archivo está vacío." },
    };
  }
  if (contenido.length > 25 * 1024 * 1024) {
    return {
      status: 413,
      body: {
        error: "ARCHIVO_DEMASIADO_GRANDE",
        mensaje: "El archivo supera los 25 MB.",
      },
    };
  }

  try {
    const [filas] = await pool.query(
      `SELECT d.folio, d.periodo, c.clave, c.nombre AS razonSocial
       FROM documentos d
       JOIN clientes c ON c.id = d.cliente_id
       WHERE d.id = ?`,
      [documentoId],
    );
    if (!filas.length) {
      return {
        status: 404,
        body: { error: "NO_ENCONTRADO", mensaje: "El documento no existe." },
      };
    }
    const { folio, periodo, clave, razonSocial } = filas[0];

    // Carpeta del cliente / año / mes del periodo / folio. Si ya hay una carpeta
    // con su clave se reutiliza, y un archivo con el mismo nombre no se pisa: la
    // ruta que se guarda es la que de verdad quedó en disco.
    const carpetaCliente = await buscarCarpetaCliente(
      carpetaBase,
      clave,
      razonSocial,
    );
    const rutaDeseada = rutaRelativaArchivo({
      carpetaCliente,
      periodo,
      folio,
      nombreOriginal: nombreOriginal.trim(),
    });
    const { rutaRelativa } = await escribirArchivo(
      carpetaBase,
      rutaDeseada,
      contenido,
    );

    const [update] = await pool.query(
      `UPDATE documento_archivos
       SET ruta_storage = ?, mime_type = COALESCE(?, mime_type), tamano_bytes = ?
       WHERE documento_id = ? AND nombre_original = ? AND ruta_storage IS NULL
       LIMIT 1`,
      [
        rutaRelativa,
        mimeType ?? null,
        contenido.length,
        documentoId,
        nombreOriginal.trim(),
      ],
    );

    let archivoId;
    if (update.affectedRows > 0) {
      const [busqueda] = await pool.query(
        `SELECT id FROM documento_archivos WHERE documento_id = ? AND ruta_storage = ? LIMIT 1`,
        [documentoId, rutaRelativa],
      );
      archivoId = busqueda[0]?.id ?? null;
    } else {
      const [ins] = await pool.query(
        `INSERT INTO documento_archivos (documento_id, ruta_storage, nombre_original, mime_type, tamano_bytes)
         VALUES (?, ?, ?, ?, ?)`,
        [
          documentoId,
          rutaRelativa,
          nombreOriginal.trim(),
          mimeType ?? null,
          contenido.length,
        ],
      );
      archivoId = ins.insertId;
    }

    return {
      status: 200,
      body: {
        id: archivoId,
        nombreOriginal: nombreOriginal.trim(),
        rutaStorage: rutaRelativa,
        tamanoBytes: contenido.length,
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
 * GET /documentos/:id/archivos/:archivoId
 *
 * Lee un archivo del disco para su descarga. Devuelve un objeto `archivo`
 * con el Buffer, el tipo MIME y el nombre original; el servidor lo envía
 * en crudo.
 *
 * @param {Pool} pool
 * @param {string} carpetaBase
 * @param {number} documentoId
 * @param {number} archivoId
 * @param {number} usuarioId
 * @param {string} rol
 * @param {number|null} clienteId
 * @returns {Promise<{status:number, body?:object, archivo?:{buffer:Buffer, mimeType:string, nombre:string}}>}
 */
export async function rutaDescargarArchivo(
  pool,
  carpetaBase,
  documentoId,
  archivoId,
  usuarioId,
  rol,
  clienteId,
) {
  if (
    !Number.isInteger(documentoId) ||
    documentoId <= 0 ||
    !Number.isInteger(archivoId) ||
    archivoId <= 0
  ) {
    return {
      status: 400,
      body: {
        error: "VALIDACION",
        mensaje: "Los identificadores no son válidos.",
      },
    };
  }

  try {
    // Verificar que el documento existe y, si es Cliente, que es suyo
    const [docs] = await pool.query(
      `SELECT d.id, d.cliente_id AS clienteId FROM documentos d WHERE d.id = ?`,
      [documentoId],
    );
    if (!docs.length) {
      return {
        status: 404,
        body: { error: "NO_ENCONTRADO", mensaje: "El documento no existe." },
      };
    }
    // Falla cerrado: un Cliente sin cliente vinculado (`clienteId` nulo) no es
    // dueño de ningún documento, igual que en Seguimiento.
    if (
      rol === "Cliente" &&
      (clienteId === null || docs[0].clienteId !== clienteId)
    ) {
      return {
        status: 403,
        body: {
          error: "SIN_PERMISO",
          mensaje: "No tienes permiso para ver este documento.",
        },
      };
    }

    const [archivos] = await pool.query(
      `SELECT nombre_original AS nombre, mime_type AS mimeType, ruta_storage AS ruta
       FROM documento_archivos
       WHERE id = ? AND documento_id = ?`,
      [archivoId, documentoId],
    );
    if (!archivos.length || !archivos[0].ruta) {
      return {
        status: 404,
        body: {
          error: "NO_ENCONTRADO",
          mensaje: "El archivo no está disponible.",
        },
      };
    }

    const { leerArchivo } = await import("../logica/almacenamiento.mjs");
    const buffer = await leerArchivo(carpetaBase, archivos[0].ruta);

    return {
      status: 200,
      archivo: {
        buffer,
        mimeType: archivos[0].mimeType || "application/octet-stream",
        nombre: archivos[0].nombre,
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
    // Si el archivo no está en disco, ENOENT -> 404
    if (error && error.code === "ENOENT") {
      return {
        status: 404,
        body: {
          error: "NO_ENCONTRADO",
          mensaje: "El archivo no está disponible.",
        },
      };
    }
    return {
      status: 500,
      body: { error: "INTERNO", mensaje: mensajeDeFallo("OTRO") },
    };
  }
}
