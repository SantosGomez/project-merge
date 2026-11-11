// Validaciones puras de los formularios de P-1 y P-4.
// Síncronas, sin Vue, sin navegador y sin efectos secundarios (RF-03, RF-21, RF-22, RF-23).

import {
  MAX_CLIENT_LENGTH,
  MAX_NOMBRE_CORREO_LENGTH,
  MIN_PASSWORD_LENGTH,
  PROFILES,
} from './constants.js'

/** Claves de los campos de P-1, las mismas que usa `LoginPage.vue` (RF-03). */
const LOGIN_FIELDS = {
  username: 'username',
  password: 'password',
}

/** Prioridades que acepta el backend, en su forma capitalizada (RF-22). */
const PRIORIDADES_BACKEND = ['Alta', 'Media', 'Baja']

/** Quita los espacios al inicio y al final; cualquier valor que no sea texto cuenta como vacío. */
const normalizar = (valor) => (typeof valor === 'string' ? valor.trim() : '')

/** Comprueba que usuario y contraseña estén completos (RF-03).
 * Señala cada campo faltante por separado y en el orden de P-1.
 */
export const validarCredenciales = (usuario, password) => {
  const faltantes = []

  if (normalizar(usuario).length === 0) {
    faltantes.push(LOGIN_FIELDS.username)
  }

  if (normalizar(password).length === 0) {
    faltantes.push(LOGIN_FIELDS.password)
  }

  return { valido: faltantes.length === 0, faltantes }
}

/** Valida el cliente de un caso nuevo (RF-21, RF-23).
 * Los espacios extremos no cuentan ni para la obligatoriedad ni para el límite de 80.
 */
export const validarCliente = (cliente) => {
  const clienteLimpio = normalizar(cliente)

  if (clienteLimpio.length === 0) {
    return { valido: false, error: 'cliente_requerido' }
  }

  if (clienteLimpio.length > MAX_CLIENT_LENGTH) {
    return { valido: false, error: 'cliente_demasiado_largo' }
  }

  return { valido: true, error: null }
}

/** Valida la prioridad de un caso nuevo (RF-22).
 * Recibe la forma del backend ('Alta', 'Media', 'Baja'): P-4 traduce antes de validar.
 */
export const validarPrioridad = (prioridad) => {
  const prioridadLimpia = normalizar(prioridad)

  if (prioridadLimpia.length === 0) {
    return { valido: false, error: 'prioridad_requerida' }
  }

  if (!PRIORIDADES_BACKEND.includes(prioridadLimpia)) {
    return { valido: false, error: 'prioridad_invalida' }
  }

  return { valido: true, error: null }
}

/** Valida un campo de texto opcional (descripción u observaciones): vacío es válido
 * (se guarda como null), pero si se envía debe ser texto y respetar el máximo.
 * Los espacios extremos no cuentan para el límite.
 * @param {*} valor - valor recibido del formulario.
 * @param {string} campo - nombre del campo, para el código de error.
 * @param {number} maximo - longitud máxima permitida.
 * @returns {{ valido: boolean, error: string|null }}
 */
export const validarTextoOpcional = (valor, campo, maximo) => {
  if (valor === null || valor === undefined) return { valido: true, error: null }
  if (typeof valor !== 'string') {
    return { valido: false, error: `${campo}_tipo_invalido` }
  }

  const limpio = normalizar(valor)
  if (limpio.length === 0) return { valido: true, error: null }
  if (limpio.length > maximo) {
    return { valido: false, error: `${campo}_demasiado_largo` }
  }

  return { valido: true, error: null }
}

/** Forma de un correo: algo@dominio.ext, sin espacios (la misma regla que el backend). */
const FORMA_DE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Error de un texto obligatorio con máximo, o null si es válido. Los espacios extremos no cuentan.
 * @returns {string|null} `<campo>_requerido`, `<campo>_demasiado_largo` o null.
 */
const errorDeTextoObligatorio = (valor, campo) => {
  const limpio = normalizar(valor)
  if (limpio.length === 0) return `${campo}_requerido`
  if (limpio.length > MAX_NOMBRE_CORREO_LENGTH) return `${campo}_demasiado_largo`
  return null
}

/** Valida el alta de una cuenta (historia 9a, con nombre y correo).
 * Mismas reglas que el backend: nombre y correo de hasta 150 caracteres, correo con forma
 * de correo, contraseña de al menos 8 y uno de los tres roles.
 * @returns {{ valido: boolean, errores: { nombre: string|null, correo: string|null, password: string|null, rol: string|null } }}
 */
export const validarAltaUsuario = (nombre, correo, password, rol) => {
  const errores = {
    nombre: errorDeTextoObligatorio(nombre, 'nombre'),
    correo: errorDeTextoObligatorio(correo, 'correo'),
    password: normalizar(password).length === 0 ? 'password_requerida' : null,
    rol: Object.values(PROFILES).includes(rol) ? null : 'rol_requerido',
  }

  if (errores.correo === null && !FORMA_DE_CORREO.test(normalizar(correo))) {
    errores.correo = 'correo_invalido'
  }

  // El login recorta la contraseña antes de enviarla, así que el mínimo se mide igual.
  if (errores.password === null && normalizar(password).length < MIN_PASSWORD_LENGTH) {
    errores.password = 'password_corta'
  }

  return { valido: Object.values(errores).every((error) => error === null), errores }
}

/** Valida la contraseña propia que crea la persona tras entrar con la asignada:
 * de al menos 8 (sin contar espacios extremos, como el login) y confirmada igual.
 * Que sea distinta a la asignada lo comprueba el backend.
 * @returns {{ valido: boolean, errores: { nueva: string|null, confirmacion: string|null } }}
 */
export const validarContrasenaNueva = (nueva, confirmacion) => {
  const errores = {
    nueva: normalizar(nueva).length === 0 ? 'password_requerida' : null,
    confirmacion: normalizar(confirmacion).length === 0 ? 'confirmacion_requerida' : null,
  }

  if (errores.nueva === null && normalizar(nueva).length < MIN_PASSWORD_LENGTH) {
    errores.nueva = 'password_corta'
  }
  // Se avisa en cuanto la confirmación no coincide, aunque la nueva todavía no cumpla el mínimo.
  if (errores.confirmacion === null && normalizar(nueva) !== normalizar(confirmacion)) {
    errores.confirmacion = 'confirmacion_distinta'
  }

  return { valido: Object.values(errores).every((error) => error === null), errores }
}

/** Valida el cambio voluntario de la contraseña propia: la actual es obligatoria y la nueva
 * sigue las reglas de `validarContrasenaNueva`, además de ser distinta a la actual
 * (se compara tal cual, como el backend).
 * @returns {{ valido: boolean, errores: { actual: string|null, nueva: string|null, confirmacion: string|null } }}
 */
export const validarCambioContrasenaPropia = (actual, nueva, confirmacion) => {
  const { errores: erroresNueva } = validarContrasenaNueva(nueva, confirmacion)
  const errores = {
    actual: String(actual ?? '').length === 0 ? 'actual_requerida' : null,
    nueva: erroresNueva.nueva,
    confirmacion: erroresNueva.confirmacion,
  }

  if (errores.nueva === null && nueva === actual) {
    errores.nueva = 'nueva_igual_actual'
  }

  return { valido: Object.values(errores).every((error) => error === null), errores }
}

/** Valida el restablecimiento de contraseña (historia 9b) con las mismas reglas que el alta:
 * correo obligatorio, de hasta 150 caracteres y con forma de correo; contraseña de al menos 8.
 * @returns {{ valido: boolean, errores: { correo: string|null, password: string|null } }}
 */
export const validarRestablecimiento = (correo, password) => {
  const errores = {
    correo: errorDeTextoObligatorio(correo, 'correo'),
    password: normalizar(password).length === 0 ? 'password_requerida' : null,
  }

  if (errores.correo === null && !FORMA_DE_CORREO.test(normalizar(correo))) {
    errores.correo = 'correo_invalido'
  }
  if (errores.password === null && normalizar(password).length < MIN_PASSWORD_LENGTH) {
    errores.password = 'password_corta'
  }

  return { valido: Object.values(errores).every((error) => error === null), errores }
}

/**
 * Valida que la fecha de inicio tenga un formato DD-MM-YYYY y sea una fecha real.
 * @param {string} fecha - cadena de texto a validar.
 * @returns {{ valido: boolean, error: string|null }}
 */
export const validarFechaInicio = (fecha) => {
  if (!fecha) return { valido: true, error: null } // opcional
  const re = /^\d{2}-\d{2}-\d{4}$/;
  if (!re.test(fecha)) return { valido: false, error: 'fecha_formato_invalido' };
  const [d, m, a] = fecha.split('-').map(Number);
  const fechaObj = new Date(a, m - 1, d);
  if (fechaObj.getDate() !== d || fechaObj.getMonth() + 1 !== m) return { valido: false, error: 'fecha_invalida' };
  return { valido: true, error: null }
};

/**
 * Valida la fecha de vencimiento que captura el contador (DD-MM-AAAA, obligatoria).
 * No puede ser anterior a la fecha de inicio; si el inicio va vacío, el backend usa hoy.
 * @param {string} vencimiento - fecha escrita en el formulario.
 * @param {string} fechaInicio - fecha de inicio del formulario (DD-MM-AAAA o vacía).
 * @param {string} hoy - fecha local de hoy en AAAA-MM-DD.
 * @returns {{ valido: boolean, error: string|null }}
 */
export const validarFechaVencimiento = (vencimiento, fechaInicio, hoy) => {
  const texto = typeof vencimiento === 'string' ? vencimiento.trim() : '';
  if (!texto) return { valido: false, error: 'vencimiento_requerido' };

  const validacion = validarFechaInicio(texto);
  if (!validacion.valido) return validacion;

  // DD-MM-AAAA → AAAA-MM-DD para comparar como texto sin usar Date
  const aISO = (fecha) => fecha.split('-').reverse().join('-');
  const inicio = fechaInicio ? aISO(fechaInicio.trim()) : hoy;
  if (aISO(texto) < inicio) return { valido: false, error: 'vencimiento_antes_del_inicio' };

  return { valido: true, error: null }
};