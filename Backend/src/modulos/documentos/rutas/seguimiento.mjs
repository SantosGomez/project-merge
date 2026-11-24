import { clasificarFallo, mensajeDeFallo } from '../logica/errores.mjs';

/** Formato de fecha y hora local como `AAAA-MM-DDTHH:mm:ss`, SIN Z. */
const aTextoLocal = (valor) => {
  const f = new Date(valor);
  const dos = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
};

/** Máximo de expedientes por consulta: una búsqueda de una letra no puede traer toda la base. */
const LIMITE_EXPEDIENTES = 50;

/** `%`, `_` y `\` son comodines de LIKE: se escapan para buscarlos como texto. */
const escaparLike = (texto) => texto.replace(/[\\%_]/g, '\\$&');

/** Tamaño legible: KB por debajo de 1 MB, para que un XML pequeño no salga como «0.0 MB». */
const tamanoLegible = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Tipo del archivo para el icono: solo PDF y XML tienen uno propio. */
const tipoDeArchivo = (mimeType = '') => {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('xml')) return 'xml';
  return 'otro';
};

/**
 * GET /seguimiento?q=...
 *
 * Portal de seguimiento para clientes, contadores y administradores.
 *
 * - Cliente: filtra por su `cliente_id` (viene de la sesión). Busca por folio o RFC.
 * - Contador/Administrador: buscan en todos los clientes.
 *
 * Devuelve `{ expedientes: [...], aviso?: string }`, del más reciente al más
 * antiguo y como mucho `LIMITE_EXPEDIENTES`; si hay más, `aviso` lo dice. Cada
 * expediente trae:
 * - folio, cliente, rfc, empresa, tipo, periodo, fechaRecepcion, estado
 * - contadorId, contador (nombre del contador asignado)
 * - hitos: [{ titulo, fecha, comentario, usuario }] desde `documento_historial`
 * - archivos: [{ nombre, tamano, fecha, tipo }] desde `documento_archivos`
 *
 * Son tres consultas en total, sin importar cuántos expedientes salgan.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {object} query - Parámetros: { q?: string }.
 * @param {number} clienteId - ID del cliente (solo usado si rol === 'Cliente').
 * @param {string} rol - Rol del usuario en sesión.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaSeguimiento(pool, query = {}, clienteId, rol) {
  const termino = (query.q ?? '').trim();
  const esCliente = rol === 'Cliente';
  const patron = `%${escaparLike(termino)}%`;

  try {
    // 1. Expedientes base. Se pide uno de más para saber si hubo recorte.
    const [filas] = await pool.query(
      `SELECT d.id, d.folio, c.nombre AS cliente, c.rfc, e.nombre AS empresa,
              t.nombre AS tipo, d.periodo, d.fecha_recepcion AS fechaRecepcion,
              d.estado, d.contador_id AS contadorId, uc.nombre AS contador
       FROM documentos d
       JOIN clientes c ON c.id = d.cliente_id
       JOIN empresas e ON e.id = d.empresa_id
       JOIN tipos_documento t ON t.id = d.tipo_doc_id
       LEFT JOIN usuarios uc ON uc.id = d.contador_id
       WHERE 1=1
         ${termino ? `AND (d.folio LIKE ? OR c.rfc LIKE ?)` : ''}
         ${esCliente ? 'AND d.cliente_id = ?' : ''}
       ORDER BY d.fecha_recepcion DESC, d.id DESC
       LIMIT ?`,
      [
        ...(termino ? [patron, patron] : []),
        ...(esCliente ? [clienteId] : []),
        LIMITE_EXPEDIENTES + 1,
      ]
    );

    if (filas.length === 0) {
      return {
        status: 200,
        body: { expedientes: [] },
      };
    }

    const recortado = filas.length > LIMITE_EXPEDIENTES;
    const expedientes = filas.slice(0, LIMITE_EXPEDIENTES);
    const ids = expedientes.map((exp) => exp.id);

    // 2. Historial y archivos de todos los expedientes, una consulta cada uno
    const [historial] = await pool.query(
      `SELECT dh.documento_id AS documentoId, dh.estado_nuevo AS titulo,
              dh.created_at AS fecha, dh.comentarios AS comentario, u.nombre AS usuario
       FROM documento_historial dh
       LEFT JOIN usuarios u ON u.id = dh.usuario_id
       WHERE dh.documento_id IN (?)
       ORDER BY dh.created_at ASC, dh.id ASC`,
      [ids]
    );
    const [archivos] = await pool.query(
      `SELECT da.id AS id, da.documento_id AS documentoId, da.nombre_original AS nombre,
              da.tamano_bytes AS tamano, da.created_at AS fecha, da.mime_type AS mimeType,
              da.ruta_storage AS ruta
       FROM documento_archivos da
       WHERE da.documento_id IN (?)
       ORDER BY da.created_at ASC, da.id ASC`,
      [ids]
    );

    const expedientesConDetalle = expedientes.map((exp) => ({
      ...exp,
      fechaRecepcion: aTextoLocal(exp.fechaRecepcion),
      contadorId: exp.contadorId ?? null,
      contador: exp.contador ?? null,
      hitos: historial
        .filter((h) => h.documentoId === exp.id)
        .map((h) => ({
          titulo: h.titulo,
          fecha: aTextoLocal(h.fecha),
          comentario: h.comentario ?? null,
          usuario: h.usuario ?? 'Sistema',
        })),
      archivos: archivos
        .filter((a) => a.documentoId === exp.id)
        .map((a) => ({
          id: a.id,
          nombre: a.nombre,
          tamano: tamanoLegible(a.tamano),
          fecha: aTextoLocal(a.fecha),
          tipo: tipoDeArchivo(a.mimeType ?? ''),
          disponible: Boolean(a.ruta),
        })),
    }));

    return {
      status: 200,
      body: {
        expedientes: expedientesConDetalle,
        ...(recortado
          ? {
              aviso: `Se muestran los ${LIMITE_EXPEDIENTES} más recientes. Escribe el folio o el RFC completo para afinar la búsqueda.`,
            }
          : {}),
      },
    };
  } catch (error) {
    const motivo = clasificarFallo(error);
    if (motivo === 'SIN_CONEXION' || motivo === 'ESQUEMA_NO_APLICADO') {
      return {
        status: 503,
        body: { error: motivo, mensaje: mensajeDeFallo(motivo) },
      };
    }
    return {
      status: 500,
      body: { error: 'INTERNO', mensaje: mensajeDeFallo('OTRO') },
    };
  }
}
