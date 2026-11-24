import { clasificarFallo, mensajeDeFallo } from "../logica/errores.mjs";

/**
 * GET /clientes/frecuentes
 *
 * Clientes ACTIVO con al menos una recepción registrada en `documentos`. Es la
 * lista que alimenta el modal de autollenado de la recepción: no sirve cualquier
 * cliente, solo los que ya han entregado papelería alguna vez.
 *
 * @param {Pool} pool - Grupo de conexiones mysql2.
 * @returns {Promise<{ status: number, body: object }>} `{ clientes: [...] }`.
 */
export async function rutaClientesFrecuentes(pool) {
  try {
    const [filas] = await pool.query(
      `SELECT c.id, c.clave, c.nombre AS razonSocial, c.rfc
         FROM clientes c
        WHERE c.activo = 1
          AND EXISTS (SELECT 1 FROM documentos d WHERE d.cliente_id = c.id)
        ORDER BY c.nombre ASC`,
    );

    return { status: 200, body: { clientes: filas } };
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
