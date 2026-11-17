const { buildError } = require('../utils/errorUtils');
const bitacora = require('../utils/bitacoraSeguridad');

const MAX_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

/**
 * Limitador en memoria de intentos fallidos por correo, además del límite por IP.
 * Cuenta igual los correos que existen y los que no, para no revelar cuáles hay.
 * Con varios backends haría falta un almacén compartido (como el registro de eventos).
 * @param {{ max?: number, ventanaMs?: number, ahora?: Function }} [opciones] - reloj inyectable en pruebas.
 * @returns {{ bloqueado: Function, registrarFallo: Function, limpiar: Function }}
 */
function crearLimitadorCuenta({ max = MAX_FALLOS, ventanaMs = VENTANA_MS, ahora = () => Date.now() } = {}) {
  const fallos = new Map();

  const clave = (correo) => (typeof correo === 'string' ? correo.trim().toLowerCase() : '');

  /** Fallos vigentes de la clave; olvida los que ya salieron de la ventana. */
  function vigentes(k) {
    const limite = ahora() - ventanaMs;
    const lista = (fallos.get(k) || []).filter((momento) => momento > limite);
    if (lista.length === 0) fallos.delete(k);
    else fallos.set(k, lista);
    return lista;
  }

  return {
    bloqueado(correo) {
      const k = clave(correo);
      return k !== '' && vigentes(k).length >= max;
    },
    registrarFallo(correo) {
      const k = clave(correo);
      if (k === '') return;
      const lista = vigentes(k);
      lista.push(ahora());
      fallos.set(k, lista);
    },
    limpiar(correo) {
      fallos.delete(clave(correo));
    },
  };
}

/**
 * Middleware de POST /auth/login: responde 429 si el correo acumuló demasiados fallos
 * y, al terminar la respuesta, cuenta el 401 como fallo o reinicia el contador con un 200.
 * @param {ReturnType<typeof crearLimitadorCuenta>} [limitador] - Limitador a usar (uno nuevo por defecto).
 * @returns {Function} Middleware de Express.
 */
function limitarIntentosPorCuenta(limitador = crearLimitadorCuenta()) {
  return (req, res, next) => {
    const correo = req.body && req.body.correo;
    if (limitador.bloqueado(correo)) {
      bitacora.registrar('login_bloqueado', req, { motivo: 'cuenta', correo }, 'warn');
      return res.status(429).json(
        buildError(
          'Demasiados intentos fallidos',
          'inicio de sesión de esta cuenta',
          'Espera 15 minutos antes de volver a intentarlo'
        )
      );
    }
    res.on('finish', () => {
      if (res.statusCode === 401) limitador.registrarFallo(correo);
      else if (res.statusCode === 200) limitador.limpiar(correo);
    });
    return next();
  };
}

module.exports = { crearLimitadorCuenta, limitarIntentosPorCuenta };
