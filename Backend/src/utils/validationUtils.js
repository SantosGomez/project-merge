const ESTADOS_VALIDOS = ['Pendiente', 'En proceso', 'Finalizado'];
const PRIORIDADES_VALIDAS = ['Alta', 'Media', 'Baja'];
const ROLES_VALIDOS = ['administrador', 'contador', 'usuarios_de_sistema'];
const LONGITUD_MAX_CLIENTE = 80;

/**
 * Valida los campos de inicio de sesión (usuario y contraseña).
 * RF-02.
 * @param {string} usuario - Nombre de usuario.
 * @param {string} password - Contraseña.
 * @returns {{ valido: boolean, faltantes: string[] }} Objeto con valido y lista de campos faltantes.
 */
function validateLoginInput(usuario, password) {
  const faltantes = [];

  if (!usuario || usuario.trim() === '') {
    faltantes.push('usuario');
  }

  if (!password || password.trim() === '') {
    faltantes.push('contraseña');
  }

  return { valido: faltantes.length === 0, faltantes };
}

/**
 * Valida los datos de entrada para registrar un nuevo caso.
 * RF-19, RF-20, RF-21.
 * @param {string} cliente - Nombre del cliente.
 * @param {string} prioridad - Prioridad del caso (Alta, Media, Baja).
 * @returns {{ valido: boolean, error: string | null }} Objeto con valido y código de error.
 */
function validateNewCaseInput(cliente, prioridad) {
  if (!cliente || cliente.trim() === '') {
    return { valido: false, error: 'cliente_requerido' };
  }

  if (cliente.trim().length > LONGITUD_MAX_CLIENTE) {
    return { valido: false, error: 'cliente_demasiado_largo' };
  }

  if (!prioridad || prioridad.trim() === '') {
    return { valido: false, error: 'prioridad_requerida' };
  }

  if (!PRIORIDADES_VALIDAS.includes(prioridad.trim())) {
    return { valido: false, error: 'prioridad_invalida' };
  }

  return { valido: true, error: null };
}

/**
 * Valida que un estado sea uno de los permitidos: Pendiente, En proceso, Finalizado.
 * @param {string} estado - Estado del caso.
 * @returns {boolean} true si es válido, false en caso contrario.
 */
function validateStatus(estado) {
  return ESTADOS_VALIDOS.includes(estado);
}

/**
 * Valida que una prioridad sea una de las permitidas: Alta, Media, Baja.
 * @param {string} prioridad - Prioridad del caso.
 * @returns {boolean} true si es válida, false en caso contrario.
 */
function validatePriority(prioridad) {
  return PRIORIDADES_VALIDAS.includes(prioridad);
}

/**
 * Valida que un rol sea uno de los permitidos: administrador, contador, usuarios_de_sistema.
 * RF-30.
 * @param {string} rol - Rol de usuario a validar.
 * @returns {boolean} true si es válido, false en caso contrario.
 */
function validateRol(rol) {
  return ROLES_VALIDOS.includes(rol);
}

module.exports = {
  validateLoginInput,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
  validateRol,
};
