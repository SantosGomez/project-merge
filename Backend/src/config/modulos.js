/**
 * Acceso por usuario a módulos que se habilitan poco a poco (hoy: «Mis actividades»).
 *
 * Variable de entorno USUARIOS_CON_ACTIVIDADES:
 * - lista de ids separados por comas (`7917` o `7917,8001`): solo esas cuentas entran al módulo;
 * - `*`: todas las cuentas que ya trabajan casos (contador y auxiliar);
 * - definida pero vacía: nadie entra;
 * - sin definir: abierta para todos en desarrollo y pruebas, y cerrada para todos en producción
 *   (si se olvida configurarla, el módulo no se abre por accidente).
 * Se lee en cada consulta para poder cambiarla en pruebas sin reiniciar.
 */

/**
 * Indica si una cuenta puede usar el módulo «Mis actividades».
 * @param {number|string} usuarioId - id de la cuenta (del token).
 * @param {Object} [env] - variables de entorno (por defecto process.env).
 * @returns {boolean} true si la cuenta tiene el módulo habilitado.
 */
function usuarioTieneActividades(usuarioId, env = process.env) {
  const valor = env.USUARIOS_CON_ACTIVIDADES;
  if (valor === undefined) {
    return env.NODE_ENV !== 'production';
  }
  const ids = valor.split(',').map((id) => id.trim()).filter(Boolean);
  return ids.includes('*') || ids.includes(String(usuarioId));
}

module.exports = { usuarioTieneActividades };
