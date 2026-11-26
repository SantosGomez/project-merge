import { clasificarFallo, mensajeDeFallo } from '../logica/errores.mjs';
import { semaforoDe } from '../logica/semaforo.mjs';
import { normalizarParaBuscar, normalizarRfc } from '../logica/normalizar.mjs';
import { aFechaLocal } from '../logica/fechas.mjs';
import { createRequire } from 'node:module';

// El modelo de contadores es CommonJS: es el único punto que escribe cliente_contador y usuario_id.
const { reemplazarContadores, enTransaccionDePool, SQL_PRINCIPAL_DE_C } = createRequire(import.meta.url)(
  '../../../models/ClienteContadorModel.js'
);

/** Formato de periodo YYYY-MM */
const REGEX_PERIODO = /^\d{4}-\d{2}$/;
/** Formato de RFC (12 caracteres empresa o 13 persona física) */
const REGEX_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
/** Formato básico de correo electrónico */
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contadores de los clientes (el principal primero), agrupados por cliente.
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {number} [idCliente] - Si se da, solo ese cliente.
 * @returns {Promise<Map<number, Array<{ id: number, nombre: string }>>>}
 */
async function contadoresPorCliente(pool, idCliente) {
  const [filas] = await pool.query(
    `SELECT cc.cliente_id AS clienteId, u.id, u.nombre
     FROM cliente_contador cc
     JOIN usuarios u ON u.id = cc.usuario_id
     ${idCliente === undefined ? '' : 'WHERE cc.cliente_id = ?'}
     ORDER BY cc.cliente_id ASC, cc.asignado_en ASC, cc.usuario_id ASC`,
    idCliente === undefined ? [] : [idCliente]
  );
  const mapa = new Map();
  for (const fila of filas) {
    if (!mapa.has(fila.clienteId)) mapa.set(fila.clienteId, []);
    mapa.get(fila.clienteId).push({ id: fila.id, nombre: fila.nombre });
  }
  return mapa;
}

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
      LEFT JOIN usuarios u ON u.id = ${SQL_PRINCIPAL_DE_C}
    `;
    const paramsClientes = [];

    if (!incluirBaja) {
      sqlClientes += ` WHERE c.activo = 1`;
    }

    sqlClientes += ` ORDER BY c.nombre ASC`;

    const [filasClientes] = await pool.query(sqlClientes, paramsClientes);
    const contadores = await contadoresPorCliente(pool);

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
        contadores: contadores.get(cliente.id) || [],
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

/**
 * Valida y normaliza el payload para crear un cliente en el catálogo único.
 * @param {object} datos
 * @returns {{ error: string, campo: string } | { datos: { razonSocial: string, clave: string|null, rfc: string|null, email: string|null, telefono: string|null, contadorId: number|null } }}
 */
export function validarDatosNuevoCliente(datos = {}) {
  const brutoNombre = datos.razonSocial ?? datos.nombre;
  const razonSocial = typeof brutoNombre === 'string' ? brutoNombre.trim() : '';
  if (!razonSocial) {
    return { error: 'La razón social o nombre del cliente es obligatorio.', campo: 'nombre' };
  }
  if (razonSocial.length > 150) {
    return { error: 'La razón social no puede exceder 150 caracteres.', campo: 'nombre' };
  }

  let clave = null;
  if (datos.clave !== null && datos.clave !== undefined && String(datos.clave).trim() !== '') {
    clave = String(datos.clave).trim().toUpperCase();
    if (clave.length > 4 || /\s/.test(clave)) {
      return { error: 'La clave de carpeta debe tener máximo 4 caracteres sin espacios.', campo: 'clave' };
    }
  }

  let rfc = null;
  if (datos.rfc !== null && datos.rfc !== undefined && String(datos.rfc).trim() !== '') {
    rfc = normalizarRfc(String(datos.rfc));
    if (!REGEX_RFC.test(rfc)) {
      return { error: 'El RFC debe tener 12 o 13 caracteres válidos (ej. ABC010101XY1).', campo: 'rfc' };
    }
  }

  let email = null;
  if (datos.email !== null && datos.email !== undefined && String(datos.email).trim() !== '') {
    email = String(datos.email).trim();
    if (email.length > 150 || !REGEX_EMAIL.test(email)) {
      return { error: 'El correo electrónico no tiene un formato válido.', campo: 'email' };
    }
  }

  let telefono = null;
  if (datos.telefono !== null && datos.telefono !== undefined && String(datos.telefono).trim() !== '') {
    telefono = String(datos.telefono).trim();
    if (telefono.length > 20) {
      return { error: 'El teléfono no puede exceder 20 caracteres.', campo: 'telefono' };
    }
  }

  let contadorId = null;
  if (datos.contadorId !== null && datos.contadorId !== undefined && datos.contadorId !== '') {
    const num = Number(datos.contadorId);
    if (!Number.isInteger(num) || num <= 0) {
      return { error: 'El contador asignado no es válido.' };
    }
    contadorId = num;
  }

  return {
    datos: { razonSocial, clave, rfc, email, telefono, contadorId }
  };
}

/**
 * POST /clientes
 *
 * Registra un nuevo cliente en el catálogo único de clientes.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {object} body - Datos del cliente nuevo.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaCrearCliente(pool, body = {}) {
  const validacion = validarDatosNuevoCliente(body);
  if (validacion.error) {
    return {
      status: 400,
      body: { error: 'DATOS_INVALIDOS', mensaje: validacion.error }
    };
  }

  const { razonSocial, clave, rfc, email, telefono, contadorId } = validacion.datos;

  try {
    let nombreContador = null;
    if (contadorId !== null) {
      const [contadores] = await pool.query(
        `SELECT u.id, u.nombre
         FROM usuarios u
         JOIN usuario_modulos m ON m.usuario_id = u.id AND m.modulo = 'documentos' AND m.rol = 'contador'
         WHERE u.id = ?
         LIMIT 1`,
        [contadorId]
      );
      if (contadores.length === 0) {
        return {
          status: 400,
          body: {
            error: 'DATOS_INVALIDOS',
            mensaje: 'El contador seleccionado no existe o no tiene rol de Contador en documentos.'
          }
        };
      }
      nombreContador = contadores[0].nombre;
    }

    // El cliente y su conjunto de contadores ([contadorId], o vacío) se guardan en una sola transacción.
    const resultado = await enTransaccionDePool(pool, async (ejecutar) => {
      const insertado = await ejecutar(
        `INSERT INTO clientes (clave, usuario_id, nombre, rfc, email, telefono, activo, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [clave, contadorId, razonSocial, rfc, email, telefono]
      );
      await reemplazarContadores(insertado.insertId, contadorId === null ? [] : [contadorId], ejecutar);
      return insertado;
    });

    return {
      status: 201,
      body: {
        cliente: {
          id: resultado.insertId,
          clave,
          rfc,
          razonSocial,
          email,
          telefono,
          estado: 'ACTIVO',
          esBaja: false,
          contadorId,
          contador: nombreContador,
          contadores: contadorId === null ? [] : [{ id: contadorId, nombre: nombreContador }],
          semaforo: 'NEUTRO',
          totalDocumentos: 0
        }
      }
    };
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const detalle = String(error.message || '');
      const mensaje = detalle.includes('uq_clientes_clave')
        ? 'Ya existe un cliente registrado con esa clave de carpeta.'
        : 'Ese contador ya tiene un cliente registrado con esa razón social.';
      return {
        status: 409,
        body: { error: 'CLIENTE_DUPLICADO', mensaje }
      };
    }

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

/** Máximo de recepciones que muestra el expediente del cliente. */
const LIMITE_RECEPCIONES_EXPEDIENTE = 20;

/** Fecha y hora local como `AAAA-MM-DD HH:mm:ss` (sin zona horaria). */
const aTextoLocal = (valor) => {
  if (valor === null || valor === undefined) return null;
  const f = new Date(valor);
  const dos = (n) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())} ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
};

const esIdValido = (valor) => Number.isInteger(valor) && valor > 0;

const respuestaIdInvalido = () => ({
  status: 400,
  body: { error: 'DATOS_INVALIDOS', mensaje: 'El identificador del cliente no es válido.' }
});

const respuestaNoEncontrado = () => ({
  status: 404,
  body: { error: 'CLIENTE_NO_ENCONTRADO', mensaje: 'No encontramos ese cliente. Actualiza la lista e inténtalo de nuevo.' }
});

/** Convierte un fallo inesperado en la respuesta 503 o 500 de documentos. */
function respuestaDeFallo(error) {
  const motivo = clasificarFallo(error);
  if (motivo === 'SIN_CONEXION' || motivo === 'ESQUEMA_NO_APLICADO') {
    return { status: 503, body: { error: motivo, mensaje: mensajeDeFallo(motivo) } };
  }
  return { status: 500, body: { error: 'INTERNO', mensaje: mensajeDeFallo('OTRO') } };
}

/** Lee un cliente con el nombre de su contador; `null` si no existe. */
async function leerCliente(pool, idCliente) {
  const [filas] = await pool.query(
    `SELECT c.id, c.clave, c.rfc, c.nombre, c.email, c.telefono, c.activo, c.creado_en,
            ${SQL_PRINCIPAL_DE_C} AS usuario_id, u.nombre AS contador
     FROM clientes c
     LEFT JOIN usuarios u ON u.id = ${SQL_PRINCIPAL_DE_C}
     WHERE c.id = ?
     LIMIT 1`,
    [idCliente]
  );
  const fila = filas[0];
  if (!fila) return null;
  const activo = Boolean(fila.activo);
  return {
    id: fila.id,
    clave: fila.clave ?? null,
    rfc: fila.rfc ?? null,
    razonSocial: fila.nombre,
    email: fila.email ?? null,
    telefono: fila.telefono ?? null,
    contadorId: fila.usuario_id ?? null,
    contador: fila.contador ?? null,
    contadores: (await contadoresPorCliente(pool, idCliente)).get(idCliente) || [],
    activo,
    estado: activo ? 'ACTIVO' : 'INACTIVO',
    creadoEn: aTextoLocal(fila.creado_en)
  };
}

/**
 * GET /clientes/:id
 *
 * Expediente del cliente: sus datos, sus últimas recepciones (las más recientes primero)
 * y el total de recepciones.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {number} idCliente - Id del cliente.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaConsultarCliente(pool, idCliente) {
  if (!esIdValido(idCliente)) return respuestaIdInvalido();

  try {
    const cliente = await leerCliente(pool, idCliente);
    if (!cliente) return respuestaNoEncontrado();

    const [[conteo]] = await pool.query(`SELECT COUNT(*) AS total FROM documentos WHERE cliente_id = ?`, [idCliente]);
    const [filas] = await pool.query(
      `SELECT d.id, d.folio, t.nombre AS tipo, d.periodo, d.fecha_recepcion AS fechaRecepcion, d.estado
       FROM documentos d
       JOIN tipos_documento t ON t.id = d.tipo_doc_id
       WHERE d.cliente_id = ?
       ORDER BY d.fecha_recepcion DESC, d.id DESC
       LIMIT ${LIMITE_RECEPCIONES_EXPEDIENTE}`,
      [idCliente]
    );

    return {
      status: 200,
      body: {
        cliente,
        recepciones: filas.map((f) => ({
          id: f.id,
          folio: f.folio,
          tipo: f.tipo,
          periodo: f.periodo,
          fechaRecepcion: aTextoLocal(f.fechaRecepcion),
          estado: f.estado
        })),
        totalRecepciones: Number(conteo?.total ?? 0)
      }
    };
  } catch (error) {
    return respuestaDeFallo(error);
  }
}

/**
 * PATCH /clientes/:id
 *
 * Edita razón social, clave, RFC, correo, teléfono, contador y estado (`activo`) de un cliente.
 * Usa las mismas validaciones que el alta. Si `activo` no viene, conserva el estado actual.
 *
 * @param {Pool} pool - Conexiones de base de datos.
 * @param {number} idCliente - Id del cliente.
 * @param {object} body - Datos nuevos.
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function rutaEditarCliente(pool, idCliente, body = {}) {
  if (!esIdValido(idCliente)) return respuestaIdInvalido();

  const validacion = validarDatosNuevoCliente(body);
  if (validacion.error) {
    return { status: 400, body: { error: 'DATOS_INVALIDOS', mensaje: validacion.error } };
  }
  if (body.activo !== undefined && typeof body.activo !== 'boolean') {
    return {
      status: 400,
      body: { error: 'DATOS_INVALIDOS', mensaje: 'El estado del cliente no es válido. Usa activo o inactivo.' }
    };
  }

  const { razonSocial, clave, rfc, email, telefono, contadorId } = validacion.datos;

  try {
    const actual = await leerCliente(pool, idCliente);
    if (!actual) return respuestaNoEncontrado();

    if (contadorId !== null) {
      const [contadores] = await pool.query(
        `SELECT u.id, u.nombre
         FROM usuarios u
         JOIN usuario_modulos m ON m.usuario_id = u.id AND m.modulo = 'documentos' AND m.rol = 'contador'
         WHERE u.id = ?
         LIMIT 1`,
        [contadorId]
      );
      if (contadores.length === 0) {
        return {
          status: 400,
          body: {
            error: 'DATOS_INVALIDOS',
            mensaje: 'El contador seleccionado no existe o no tiene rol de Contador en documentos.'
          }
        };
      }
    }

    const activo = body.activo === undefined ? actual.activo : body.activo;
    // Los datos y el conjunto de contadores (queda en [contadorId], o vacío) se guardan en una sola
    // transacción: si el UPDATE choca con una unicidad, el conjunto tampoco cambia.
    await enTransaccionDePool(pool, async (ejecutar) => {
      await ejecutar(
        `UPDATE clientes
         SET clave = ?, usuario_id = ?, nombre = ?, rfc = ?, email = ?, telefono = ?, activo = ?
         WHERE id = ?`,
        [clave, contadorId, razonSocial, rfc, email, telefono, activo ? 1 : 0, idCliente]
      );
      await reemplazarContadores(idCliente, contadorId === null ? [] : [contadorId], ejecutar);
    });

    return { status: 200, body: { cliente: await leerCliente(pool, idCliente) } };
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const detalle = String(error.message || '');
      const mensaje = detalle.includes('uq_clientes_clave')
        ? 'Ya existe un cliente registrado con esa clave de carpeta.'
        : 'Ese contador ya tiene un cliente registrado con esa razón social.';
      return { status: 409, body: { error: 'CLIENTE_DUPLICADO', mensaje } };
    }
    return respuestaDeFallo(error);
  }
}
