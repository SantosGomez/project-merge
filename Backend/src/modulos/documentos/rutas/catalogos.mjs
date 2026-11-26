import { clasificarFallo, mensajeDeFallo } from '../logica/errores.mjs';

/**
 * GET /catalogos
 * Devuelve los 5 catálogos en una sola llamada para poblar los q-select del formulario.
 *
 * Catálogos obligatorios (empresas, tiposDocumento, departamentos):
 *   - Si la tabla está vacía → devuelve lista vacía [], NO error.
 *   - El frontend (T27) deshabilitará el q-select y mostrará qué falta.
 *
 * Catálogos filtrados por activo:
 *   - contadores: solo usuarios con rol 'Contador' y activo = 1.
 *   - clientes: solo clientes con estado = 'ACTIVO' (para que un cliente suspendido
 *     no pueda recibir documentos nuevos).
 *
 * @param {Pool} pool - Grupo de conexiones mysql2.
 * @returns {{status: number, body: object}} Respuesta con los 5 catálogos.
 */
export async function rutaCatalogos(pool) {
  try {
    // 1. Empresas (obligatorio: si vacío → [])
    const [empresas] = await pool.query(
      `SELECT id, nombre FROM empresas ORDER BY nombre`
    );

    // 2. Tipos de documento (obligatorio: si vacío → [])
    const [tiposDocumento] = await pool.query(
      `SELECT id, nombre FROM tipos_documento ORDER BY nombre`
    );

    // 3. Departamentos (obligatorio: si vacío → [])
    const [departamentos] = await pool.query(
      `SELECT id, nombre FROM departamentos ORDER BY nombre`
    );

    // 4. Contadores: cuentas con el módulo de documentos y rol 'contador' en él (unión, fase 3)
    const [contadores] = await pool.query(
      `SELECT u.id, u.nombre
       FROM usuarios u
       JOIN usuario_modulos m ON m.usuario_id = u.id AND m.modulo = 'documentos' AND m.rol = 'contador'
       ORDER BY u.nombre`
    );

    // 5. Clientes: todos (sin filtrar por estado), para que el formulario
    // pueda elegir incluso clientes suspendidos; el guardado validará.
    // contadorId es el contador principal (cliente_contador), el que Recepción propone.
    // Unión, fase 3: el catálogo único de clientes guarda la razón social en 'nombre'.
    const [clientes] = await pool.query(
      `SELECT c.id, c.clave, c.nombre AS razonSocial, c.rfc,
              (SELECT x.usuario_id FROM cliente_contador x WHERE x.cliente_id = c.id ORDER BY x.asignado_en ASC, x.usuario_id ASC LIMIT 1) AS contadorId
       FROM clientes c
       ORDER BY c.nombre`
    );

    return {
      status: 200,
      body: {
        empresas,
        tiposDocumento,
        departamentos,
        contadores,
        clientes,
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
    // Cualquier otro fallo es interno
    return {
      status: 500,
      body: { error: 'INTERNO', mensaje: mensajeDeFallo('OTRO') },
    };
  }
}