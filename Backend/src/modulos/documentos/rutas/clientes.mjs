import { clasificarFallo, mensajeDeFallo } from '../logica/errores.mjs';
import { semaforoDe } from '../logica/semaforo.mjs';
import { normalizarParaBuscar, normalizarRfc } from '../logica/normalizar.mjs';
import { aFechaLocal } from '../logica/fechas.mjs';

/** Formato de periodo YYYY-MM */
const REGEX_PERIODO = /^\d{4}-\d{2}$/;

/**
 * GET /clientes
 *
 * Devuelve el directorio de clientes con su semáforo fiscal precalculado según los
 * documentos registrados en el periodo consultado (RF-7, RF-8).
 *
 * Query params opcionales:
 * - `periodo`: 'YYYY-MM' (por omisión, mes en curso del servidor)
 * - `busqueda`: string (busca por razón social sin acentos/mayúsculas, RFC sin guiones o clave de carpeta)
 * - `incluirBaja`: 'true' | '1' (si se incluye, muestra también clientes INACTIVO y SUSPENDIDO)
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {object} query - Objeto con los searchParams parseados.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaClientes(pool, query = {}) {
  try {
    // 1. Resolver el periodo a consultar
    let periodo = query.periodo;
    if (!periodo || typeof periodo !== 'string' || !REGEX_PERIODO.test(periodo)) {
      const hoy = new Date();
      const anio = hoy.getFullYear();
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      periodo = `${anio}-${mes}`;
    }

    const incluirBaja = query.incluirBaja === 'true' || query.incluirBaja === '1';
    const terminoBusqueda = typeof query.busqueda === 'string' ? query.busqueda.trim() : '';

    // 2. Consultar clientes
    // Si no incluye baja, solo ACTIVO. Si incluye baja, todos (ACTIVO, INACTIVO, SUSPENDIDO).
    let sqlClientes = `
      SELECT c.id, c.clave, c.rfc, c.nombre AS razonSocial, IF(c.activo = 1, 'ACTIVO', 'INACTIVO') AS estado,
             u.nombre AS contador
      FROM clientes c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
    `;
    const paramsClientes = [];

    if (!incluirBaja) {
      sqlClientes += ` WHERE c.activo = 1`;
    }

    sqlClientes += ` ORDER BY c.nombre ASC`;

    const [filasClientes] = await pool.query(sqlClientes, paramsClientes);

    // 3. Consultar documentos del periodo consultado
    // Traemos estado, fecha_limite_sla y cliente_id
    const [filasDocs] = await pool.query(
      `SELECT cliente_id AS clienteId, estado, fecha_limite_sla AS fechaLimite
       FROM documentos
       WHERE periodo = ?`,
      [periodo]
    );

    // Agrupar documentos por clienteId
    const docsPorCliente = new Map();
    for (const doc of filasDocs) {
      if (!docsPorCliente.has(doc.clienteId)) {
        docsPorCliente.set(doc.clienteId, []);
      }
      docsPorCliente.get(doc.clienteId).push({
        estado: doc.estado,
        fechaLimite: doc.fechaLimite
      });
    }

    const hoyServidor = aFechaLocal(new Date());

    // 4. Mapear y calcular semáforo por cliente
    const resultado = [];

    for (const cliente of filasClientes) {
      const docsCliente = docsPorCliente.get(cliente.id) || [];
      const semaforo = semaforoDe(docsCliente, hoyServidor);

      resultado.push({
        id: cliente.id,
        clave: cliente.clave ?? null,
        rfc: cliente.rfc,
        razonSocial: cliente.razonSocial,
        estado: cliente.estado,
        esBaja: cliente.estado !== 'ACTIVO',
        contador: cliente.contador || null,
        semaforo,
        totalDocumentos: docsCliente.length
      });
    }

    // 5. Filtrar por término de búsqueda si se proporcionó
    let clientesFiltrados = resultado;
    if (terminoBusqueda) {
      const busquedaTextoNorm = normalizarParaBuscar(terminoBusqueda);
      const busquedaRfcNorm = normalizarRfc(terminoBusqueda);

      clientesFiltrados = resultado.filter((c) => {
        const razonSocialNorm = normalizarParaBuscar(c.razonSocial);
        const rfcNorm = normalizarRfc(c.rfc);

        const coincideTexto = busquedaTextoNorm.length > 0 && razonSocialNorm.includes(busquedaTextoNorm);
        const coincideRfc = busquedaRfcNorm.length > 0 && rfcNorm.includes(busquedaRfcNorm);

        const coincideClave = Boolean(c.clave) && c.clave.includes(terminoBusqueda);

        return coincideTexto || coincideRfc || coincideClave;
      });
    }

    return {
      status: 200,
      body: {
        periodo,
        clientes: clientesFiltrados
      }
    };
  } catch (error) {
    const motivo = clasificarFallo(error);
    if (motivo === 'SIN_CONEXION' || motivo === 'ESQUEMA_NO_APLICADO') {
      return {
        status: 503,
        body: { error: motivo, mensaje: mensajeDeFallo(motivo) }
      };
    }

    return {
      status: 500,
      body: { error: 'INTERNO', mensaje: mensajeDeFallo('OTRO') }
    };
  }
}
