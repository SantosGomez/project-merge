// Bitácora de seguridad: una línea JSON por evento a stdout, sin dependencias.
// Nunca registra contraseñas, tokens, hashes, cuerpos de petición ni SQL; el correo sale enmascarado.

// Claves que jamás se escriben, aunque alguien las pase por error
const CLAVES_PROHIBIDAS = /pass|contrasena|token|hash|secret|authorization|cookie|body|cuerpo|sql|jwt/i;
const LARGO_MAXIMO_TEXTO = 200;

/**
 * Salida por defecto: stdout. Dentro de `node --test` queda en silencio para no ensuciar
 * el informe de pruebas (las pruebas inyectan su propia salida con `configurarSalida`).
 */
function salidaPorDefecto(linea) {
  if (process.env.NODE_TEST_CONTEXT) return;
  process.stdout.write(`${linea}\n`);
}

let salida = salidaPorDefecto;

/**
 * Cambia la función que recibe cada línea (inyectable para pruebas).
 * @param {(linea: string) => void} funcion - recibe la línea JSON ya serializada.
 * @returns {() => void} función que restaura la salida anterior.
 */
function configurarSalida(funcion) {
  const anterior = salida;
  salida = funcion;
  return () => {
    salida = anterior;
  };
}

/**
 * Enmascara un correo: `santos@delgrow.mx` → `s***@delgrow.mx`. Lo que no parece correo → `***`.
 * @param {*} correo - valor a enmascarar.
 * @returns {string} correo enmascarado.
 */
function enmascararCorreo(correo) {
  if (typeof correo !== 'string') return '***';
  const texto = correo.trim();
  const arroba = texto.lastIndexOf('@');
  if (arroba < 1 || arroba === texto.length - 1) return '***';
  return `${texto[0]}***${texto.slice(arroba)}`.slice(0, LARGO_MAXIMO_TEXTO);
}

/**
 * Limpia un mensaje de error: quita lo que va entre comillas (valores de la BD), correos
 * y cadenas tipo hash, y lo recorta.
 * @param {*} mensaje - mensaje original.
 * @returns {string} mensaje sin datos sensibles.
 */
function limpiarMensaje(mensaje) {
  return String(mensaje ?? '')
    .replace(/(['"`]).*?\1/g, '?')
    .replace(/\$argon2[^\s]*/gi, '?')
    .replace(/[^\s@]+@[^\s@]+/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_MAXIMO_TEXTO);
}

/** Ruta sin cadena de consulta y con los números sustituidos por `:id`. */
function rutaDe(req) {
  const original = String((req && (req.originalUrl || req.url)) || '');
  return original.split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id').slice(0, LARGO_MAXIMO_TEXTO);
}

/** Convierte un valor extra en algo seguro de serializar (solo primitivos, texto recortado). */
function valorSeguro(valor) {
  if (typeof valor === 'string') return valor.slice(0, LARGO_MAXIMO_TEXTO);
  if (typeof valor === 'number' || typeof valor === 'boolean' || valor === null) return valor;
  return undefined;
}

/**
 * Escribe un evento de seguridad.
 * @param {string} evento - nombre del evento (ej. 'login_fallido').
 * @param {Object|null} [req] - petición Express: aporta ip, usuarioId y rol (nunca el cuerpo ni las cabeceras).
 * @param {Object} [extra] - campos adicionales; `correo` se enmascara y las claves sensibles se descartan.
 * @param {'info'|'warn'|'error'} [nivel='info'] - gravedad.
 */
function registrar(evento, req, extra, nivel = 'info') {
  const registro = {
    ts: new Date().toISOString(),
    evento,
    nivel,
    usuarioId: req && req.user ? req.user.id : null,
    rol: req && req.user ? req.user.rol : null,
    ip: (req && req.ip) || null,
  };
  for (const [clave, valor] of Object.entries(extra || {})) {
    if (clave === 'correo') {
      registro.correo = enmascararCorreo(valor);
    } else if (!CLAVES_PROHIBIDAS.test(clave) && !(clave in registro)) {
      const seguro = valorSeguro(valor);
      if (seguro !== undefined) registro[clave] = seguro;
    }
  }
  try {
    salida(JSON.stringify(registro));
  } catch (error) {
    // La bitácora nunca debe romper la petición
  }
}

/**
 * Registra un error interno guardando solo name, message limpio, code, status, método y ruta.
 * Nunca `sql`, `sqlMessage`, `req.body` ni cabeceras (los errores de mysql2 traen los valores).
 * @param {*} err - error capturado.
 * @param {Object} [req] - petición Express.
 */
function registrarError(err, req) {
  const e = err && typeof err === 'object' ? err : {};
  registrar(
    'error_interno',
    req ? { ip: req.ip } : null,
    {
      name: typeof e.name === 'string' ? e.name : typeof err,
      message: limpiarMensaje(e.sql !== undefined || e.sqlMessage !== undefined ? '' : e.message ?? err),
      code: e.code ? String(e.code) : undefined,
      status: Number.isInteger(e.status) ? e.status : undefined,
      metodo: req && req.method,
      ruta: req ? rutaDe(req) : undefined,
    },
    'error'
  );
}

/**
 * Crea el `handler` de express-rate-limit: registra el bloqueo y responde igual que el valor por defecto.
 * @param {string} evento - evento a registrar.
 * @param {Object} [extra] - campos adicionales (ej. { motivo: 'ip' }).
 * @returns {Function} handler (req, res, next, opciones).
 */
function manejadorLimite(evento, extra) {
  return (req, res, next, opciones) => {
    registrar(evento, req, { ...extra, metodo: req.method, ruta: rutaDe(req) }, 'warn');
    res.status(opciones.statusCode).json(opciones.message);
  };
}

/**
 * Middleware que registra todo 403 (rol insuficiente, caso ajeno, etc.) al terminar la respuesta,
 * con el usuario ya identificado. Va después del guardia de origen, que registra el suyo.
 * @returns {Function} middleware de Express.
 */
function vigilarAccesoDenegado() {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode === 403) {
        registrar('acceso_denegado', req, { metodo: req.method, ruta: rutaDe(req) }, 'warn');
      }
    });
    next();
  };
}

module.exports = {
  registrar,
  registrarError,
  configurarSalida,
  enmascararCorreo,
  limpiarMensaje,
  manejadorLimite,
  vigilarAccesoDenegado,
};
