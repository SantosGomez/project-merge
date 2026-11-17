const { buildError } = require('./errorUtils');

const ESTADOS_VALIDOS = ['Pendiente', 'En proceso', 'Finalizado'];
const PRIORIDADES_VALIDAS = ['Alta', 'Media', 'Baja'];
const ROLES_VALIDOS = ['administrador', 'contador', 'usuarios_de_sistema', 'auxiliar'];
const LONGITUD_MAX_CLIENTE = 80;
const LONGITUD_MIN_PASSWORD = 12;
// Contraseñas triviales (base sin dígitos ni símbolos finales); lista pequeña, sin dependencias.
const PASSWORDS_COMUNES = new Set([
  'password', 'contrasena', 'contraseña', 'qwerty', 'qwertyuiop', 'qwertyuiopasdf', 'asdfghjkl', 'zxcvbnm',
  'abcdefgh', 'abcdefghijkl', 'iloveyou', 'letmein', 'welcome', 'admin', 'administrador', 'administrator',
  'contador', 'auxiliar', 'delgrow', 'grupodelgrow', 'seguimiento', 'cambiame', 'cambiar', 'changeme',
  'bienvenido', 'bienvenida', 'monkey', 'dragon', 'football', 'baseball', 'mexico', 'usuario', 'prueba',
  'passw0rd', 'p4ssword', 'secreto', 'secret', 'clave', 'claveclave', 'temporal', 'default', 'test',
]);

/**
 * Regla única de contraseña nueva (alta, restablecimiento, cambio asignado y cambio propio):
 * texto de al menos 12 caracteres que no sea una contraseña común o trivial.
 * @param {*} password - Contraseña propuesta.
 * @returns {{ valida: true } | { valida: false, error: { mensaje: string } }} Resultado; el error ya va en tres partes.
 */
function validarPasswordNueva(password) {
  if (typeof password !== 'string') {
    const faltante = password === undefined || password === null;
    return {
      valida: false,
      error: buildError(
        'Contraseña inválida',
        'contraseña',
        faltante ? 'Escribe una contraseña de al menos 12 caracteres' : 'La contraseña debe enviarse como texto'
      ),
    };
  }
  if (password.length < LONGITUD_MIN_PASSWORD || password.trim() === '') {
    return {
      valida: false,
      error: buildError('Contraseña inválida', 'contraseña', 'La contraseña debe tener al menos 12 caracteres'),
    };
  }
  const minusculas = password.toLowerCase();
  const base = minusculas.replace(/[\d\s!@#$%&*._-]+$/u, '');
  const todoIgual = /^(.)\1+$/u.test(minusculas);
  const soloDigitos = /^\d+$/u.test(minusculas);
  if (todoIgual || soloDigitos || PASSWORDS_COMUNES.has(minusculas) || PASSWORDS_COMUNES.has(base) || base === '') {
    return {
      valida: false,
      error: buildError(
        'Contraseña inválida',
        'contraseña',
        'Esa contraseña es demasiado común: elige una menos predecible, por ejemplo tres palabras con un número'
      ),
    };
  }
  return { valida: true };
}

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
 * Indica si un texto es un mes con la forma AAAA-MM (mes de 01 a 12).
 * @param {*} valor - Mes recibido en la petición.
 * @returns {boolean} true si tiene la forma AAAA-MM.
 */
function esMesValido(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

/**
 * Convierte una lista de identificadores en enteros positivos sin repetir.
 * @param {*} valor - Lista recibida en el cuerpo de la petición.
 * @returns {Array<number>|null} Los ids, o null si no es una lista o algún id no es válido.
 */
function parseListaDeIds(valor) {
  if (!Array.isArray(valor)) return null;
  const ids = valor.map(parseCounterId);
  return ids.includes(null) ? null : [...new Set(ids)];
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
  validarPasswordNueva,
  validarTextoOpcional,
  validateLoginInput,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
  validateRol,
  esCorreoValido,
  parseCounterId,
  parseListaDeIds,
  esMesValido,
};
