/**
 * A qué administradores atiende la recepcionista como secretaria (rebanada 28).
 *
 * Variable de entorno ADMINISTRADORES_DE_RECEPCION:
 * - lista de ids separados por comas (`7947` o `1,7947`): solo esos administradores tienen secretaria;
 * - definida pero vacía: ningún administrador tiene secretaria;
 * - sin definir: todos en desarrollo y pruebas, y ninguno en producción
 *   (si se olvida configurarla, el acceso no se abre por accidente).
 * Un id que no es administrador o no existe no da error: simplemente nunca coincide con un administrador.
 * Se lee en cada consulta para poder cambiarla en pruebas sin reiniciar.
 */

/**
 * Indica si la recepcionista atiende al administrador con ese id.
 * @param {number|string} administradorId - id del administrador.
 * @param {Object} [env] - variables de entorno (por defecto process.env).
 * @returns {boolean} true si la recepcionista administra su agenda.
 */
function administradorEsAtendido(administradorId, env = process.env) {
  const valor = env.ADMINISTRADORES_DE_RECEPCION;
  if (valor === undefined) {
    return env.NODE_ENV !== 'production';
  }
  const ids = valor.split(',').map((id) => id.trim()).filter(Boolean);
  return ids.includes(String(administradorId));
}

module.exports = { administradorEsAtendido };
