// Cookie de sesión HttpOnly (rebanada S8): el token de acceso viaja en una cookie que el
// JavaScript de la página no puede leer, así un XSS no puede robarlo.
// Sin dependencias: lectura de la cabecera Cookie y construcción de Set-Cookie a mano.

const NOMBRE_COOKIE_SESION = 'sp_sesion';

// Cabecera personalizada que exigen las escrituras autenticadas solo por cookie (defensa CSRF):
// un formulario o una imagen de otro sitio no pueden añadirla.
const CABECERA_CSRF = 'x-requested-with';
const VALOR_CSRF = 'SeguimientoProyectos';

// Duración de la cookie de «Mantener sesión iniciada»: igual al tope del token persistente (30 días).
const MAX_AGE_PERSISTENTE_SEGUNDOS = 30 * 24 * 60 * 60;

/**
 * Lee una cookie de la cabecera Cookie.
 * @param {string|undefined} cabecera - valor de la cabecera Cookie.
 * @param {string} nombre - nombre exacto de la cookie.
 * @returns {string|null} valor de la cookie, o null si falta o está vacía.
 */
function leerCookie(cabecera, nombre) {
  if (typeof cabecera !== 'string' || cabecera === '') {
    return null;
  }
  for (const parte of cabecera.split(';')) {
    const igual = parte.indexOf('=');
    if (igual === -1) {
      continue;
    }
    if (parte.slice(0, igual).trim() === nombre) {
      const valor = parte.slice(igual + 1).trim();
      return valor === '' ? null : valor;
    }
  }
  return null;
}

/**
 * Construye el Set-Cookie de la sesión.
 * @param {string} token - token de acceso (JWT: solo caracteres seguros para una cookie).
 * @param {{ persistente: boolean, seguro: boolean }} opciones - persistente añade Max-Age de
 * 30 días (sin él es cookie de sesión); seguro añade Secure (petición por HTTPS).
 * @returns {string} valor de la cabecera Set-Cookie.
 */
function construirCookieSesion(token, { persistente, seguro }) {
  const partes = [`${NOMBRE_COOKIE_SESION}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/'];
  if (persistente) {
    partes.push(`Max-Age=${MAX_AGE_PERSISTENTE_SEGUNDOS}`);
  }
  if (seguro) {
    partes.push('Secure');
  }
  return partes.join('; ');
}

/**
 * Construye el Set-Cookie que borra la cookie de sesión.
 * @param {boolean} seguro - añade Secure (petición por HTTPS).
 * @returns {string} valor de la cabecera Set-Cookie.
 */
function construirCookieBorrada(seguro) {
  const partes = [`${NOMBRE_COOKIE_SESION}=`, 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=0'];
  if (seguro) {
    partes.push('Secure');
  }
  return partes.join('; ');
}

/**
 * Indica si la petición llegó por HTTPS. `req.secure` ya considera X-Forwarded-Proto
 * cuando `trust proxy` está activo (TRUST_PROXY=1 detrás de Nginx).
 * @param {Object} req - petición Express.
 * @returns {boolean}
 */
function esPeticionSegura(req) {
  return Boolean(req && req.secure);
}

module.exports = {
  NOMBRE_COOKIE_SESION,
  CABECERA_CSRF,
  VALOR_CSRF,
  leerCookie,
  construirCookieSesion,
  construirCookieBorrada,
  esPeticionSegura,
};
