const ESTADOS_VALIDOS = ['Pendiente', 'En proceso', 'Finalizado'];
const PRIORIDADES_VALIDAS = ['Alta', 'Media', 'Baja'];
const ROLES_VALIDOS = ['administrador', 'contador', 'usuarios_de_sistema', 'auxiliar'];
const LONGITUD_MAX_CLIENTE = 80;

/**
 * Clasifica un campo de texto recibido en el cuerpo de una petición sin llamar
 * nunca a `.trim()` sobre un valor que no sea texto.
 * RF-37 (y RF-02, RF-19, RF-20, RF-30 para el dato que falta).
 * @param {*} valor - Valor recibido.
 * @param {string} nombre - Nombre del campo, para indicarlo en el error.
 * @returns {{ estado: 'faltante' | 'tipo_invalido' | 'valido', campo: string, valor?: string }}
 */
function validarCampoTexto(valor, nombre) {
  if (valor === null || valor === undefined) {
    return { estado: 'faltante', campo: nombre };
  }
  if (typeof valor !== 'string') {
    return { estado: 'tipo_invalido', campo: nombre };
  }
  if (valor.trim() === '') {
    return { estado: 'faltante', campo: nombre };
  }
  return { estado: 'valido', campo: nombre, valor: valor.trim() };
}

/**
 * Clasifica un campo de texto opcional (descripción, observaciones) sin llamar
 * nunca a `.trim()` sobre un valor que no sea texto.
 * @param {*} valor - Valor recibido.
 * @param {string} nombre - Nombre del campo, para indicarlo en el error.
 * @param {number} maximo - Longitud máxima permitida, medida sobre el texto recortado.
 * @returns {{ estado: 'ausente' | 'tipo_invalido' | 'demasiado_largo' | 'valido', campo: string, valor?: string }}
 */
function validarTextoOpcional(valor, nombre, maximo) {
  if (valor === null || valor === undefined) {
    return { estado: 'ausente', campo: nombre };
  }
  if (typeof valor !== 'string') {
    return { estado: 'tipo_invalido', campo: nombre };
  }

  const texto = valor.trim();
  if (texto === '') {
    return { estado: 'ausente', campo: nombre };
  }
  if (texto.length > maximo) {
    return { estado: 'demasiado_largo', campo: nombre, valor: texto };
  }
  return { estado: 'valido', campo: nombre, valor: texto };
}

/**
 * Valida un identificador (correo en el login, usuario en el alta) y una contraseña.
 * RF-02, RF-37.
 * @param {*} identificador - Correo o nombre de usuario.
 * @param {*} password - Contraseña.
 * @param {string} [nombreCampo='usuario'] - Nombre del identificador en los mensajes.
 * @returns {{ valido: boolean, faltantes: string[], tipoInvalido: string[] }} Objeto con valido,
 *   campos faltantes y campos enviados con un tipo distinto de texto.
 */
function validateLoginInput(identificador, password, nombreCampo = 'usuario') {
  const faltantes = [];
  const tipoInvalido = [];

  for (const campo of [validarCampoTexto(identificador, nombreCampo), validarCampoTexto(password, 'contraseña')]) {
    if (campo.estado === 'faltante') {
      faltantes.push(campo.campo);
    } else if (campo.estado === 'tipo_invalido') {
      tipoInvalido.push(campo.campo);
    }
  }

  return { valido: faltantes.length === 0 && tipoInvalido.length === 0, faltantes, tipoInvalido };
}

/**
 * Valida los datos de entrada para registrar un nuevo caso.
 * RF-19, RF-20, RF-21, RF-37.
 * @param {*} cliente - Nombre del cliente.
 * @param {*} prioridad - Prioridad del caso (Alta, Media, Baja).
 * @returns {{ valido: boolean, error: string | null }} Objeto con valido y código de error.
 */
function validateNewCaseInput(cliente, prioridad) {
  const campoCliente = validarCampoTexto(cliente, 'cliente');
  if (campoCliente.estado === 'faltante') {
    return { valido: false, error: 'cliente_requerido' };
  }
  if (campoCliente.estado === 'tipo_invalido') {
    return { valido: false, error: 'cliente_tipo_invalido' };
  }

  if (campoCliente.valor.length > LONGITUD_MAX_CLIENTE) {
    return { valido: false, error: 'cliente_demasiado_largo' };
  }

  const campoPrioridad = validarCampoTexto(prioridad, 'prioridad');
  if (campoPrioridad.estado === 'faltante') {
    return { valido: false, error: 'prioridad_requerida' };
  }
  if (campoPrioridad.estado === 'tipo_invalido') {
    return { valido: false, error: 'prioridad_tipo_invalida' };
  }

  if (!PRIORIDADES_VALIDAS.includes(campoPrioridad.valor)) {
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
  return typeof estado === 'string' && ESTADOS_VALIDOS.includes(estado);
}

/**
 * Valida que una prioridad sea una de las permitidas: Alta, Media, Baja.
 * @param {string} prioridad - Prioridad del caso.
 * @returns {boolean} true si es válida, false en caso contrario.
 */
function validatePriority(prioridad) {
  return typeof prioridad === 'string' && PRIORIDADES_VALIDAS.includes(prioridad);
}

/**
 * Valida que un rol sea uno de los permitidos: administrador, contador, usuarios_de_sistema, auxiliar.
 * RF-30.
 * @param {string} rol - Rol de usuario a validar.
 * @returns {boolean} true si es válido, false en caso contrario.
 */
function validateRol(rol) {
  return typeof rol === 'string' && ROLES_VALIDOS.includes(rol);
}

/**
 * Indica si un texto tiene forma de correo (algo@dominio.ext, sin espacios).
 * Se usa en el alta de cuentas y en la importación desde el Excel.
 * @param {string} correo - Correo ya recortado.
 * @returns {boolean} true si tiene forma de correo.
 */
function esCorreoValido(correo) {
  return typeof correo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

/**
 * Convierte un identificador de contador en un entero positivo.
 * RF-35.
 * Solo acepta valores formados exclusivamente por dígitos ('12' -> 12);
 * cualquier otro (letras, signos, decimales, espacios, vacío o cero) devuelve null.
 * @param {string|number} valor - Identificador recibido en la ruta.
 * @returns {number|null} El entero positivo o null si el identificador no es válido.
 */
function parseCounterId(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  const texto = String(valor);
  if (!/^\d+$/.test(texto)) {
    return null;
  }

  const numero = Number(texto);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return null;
  }

  return numero;
}

module.exports = {
  validarCampoTexto,
  validarTextoOpcional,
  validateLoginInput,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
  validateRol,
  esCorreoValido,
  parseCounterId,
};
