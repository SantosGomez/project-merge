const crypto = require('node:crypto');

// Cada cuánto se manda un latido: Cloudflare corta las conexiones inactivas a los ~100 s
const LATIDO_MS = 25 * 1000;
// Un pase sirve una sola vez y solo durante este tiempo
const VIGENCIA_PASE_MS = 60 * 1000;
// Máximo de conexiones de tiempo real abiertas a la vez por cuenta
const MAX_CONEXIONES_POR_USUARIO = 5;

/**
 * Registro en memoria de las conexiones de tiempo real (Server-Sent Events) y de sus pases.
 * Con un solo backend basta con la memoria; con varios haría falta algo compartido (p. ej. Redis).
 * @param {{ ahora?: Function }} [opciones] - reloj inyectable en pruebas (milisegundos).
 * @returns {Object} funciones del registro.
 */
function crearRegistroEventos({ ahora = () => Date.now() } = {}) {
  const pases = new Map();
  const conexiones = new Set();
  let latidoMs = LATIDO_MS;

  /**
   * Entrega un pase aleatorio para abrir GET /eventos sin poner el token en la URL.
   * @param {{ usuarioId: number, rol: string, jti: string }} datos - sesión que pidió el pase.
   * @returns {string} pase en hexadecimal.
   */
  function crearPase(datos) {
    const momento = ahora();
    for (const [pase, registro] of pases) {
      if (momento > registro.vence) pases.delete(pase);
    }
    const pase = crypto.randomBytes(32).toString('hex');
    pases.set(pase, { datos, vence: momento + VIGENCIA_PASE_MS });
    return pase;
  }

  /**
   * Canjea un pase: se borra en el acto (un solo uso).
   * @param {string} pase - pase recibido.
   * @returns {Object|null} datos de la sesión, o null si no existe o ya venció.
   */
  function canjearPase(pase) {
    const registro = pases.get(pase);
    pases.delete(pase);
    if (!registro || ahora() > registro.vence) return null;
    return registro.datos;
  }

  /** Escribe un evento con nombre y datos en formato SSE. */
  function escribir(conexion, nombre, datos) {
    conexion.res.write(`event: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`);
  }

  /** Avisa a todas las conexiones que cumplan el filtro. */
  function enviar(filtro, nombre, datos) {
    for (const conexion of conexiones) {
      if (filtro(conexion)) escribir(conexion, nombre, datos);
    }
  }

  return {
    crearPase,
    canjearPase,
    escribir,
    /** Cuántas conexiones abiertas tiene una cuenta (todas sus pestañas y equipos). */
    contarDeUsuario: (usuarioId) => {
      let total = 0;
      for (const conexion of conexiones) {
        if (conexion.usuarioId === usuarioId) total += 1;
      }
      return total;
    },
    agregar: (conexion) => conexiones.add(conexion),
    quitar: (conexion) => conexiones.delete(conexion),
    /** Aviso para una cuenta (todas sus pestañas y equipos). */
    enviarAUsuario: (usuarioId, nombre, datos) => enviar((c) => c.usuarioId === usuarioId, nombre, datos),
    /** Aviso para todas las cuentas de un rol. */
    enviarARol: (rol, nombre, datos) => enviar((c) => c.rol === rol, nombre, datos),
    /** Cierra las conexiones de una sesión (al cerrar sesión). */
    cerrarSesion: (jti) => {
      for (const conexion of conexiones) {
        if (conexion.jti === jti) conexion.res.end();
      }
    },
    /** Cierra las conexiones de una cuenta, salvo la sesión indicada (al cambiar o restablecer su contraseña). */
    cerrarSesionesDeUsuario: (usuarioId, exceptoJti) => {
      for (const conexion of conexiones) {
        if (conexion.usuarioId === usuarioId && conexion.jti !== exceptoJti) conexion.res.end();
      }
    },
    /** Cambia el intervalo de latido (solo pruebas); sin valor vuelve a 25 s. */
    configurarLatido: (ms = LATIDO_MS) => {
      latidoMs = ms;
    },
    obtenerLatido: () => latidoMs,
  };
}

// Registro único del servidor
const eventos = crearRegistroEventos();

module.exports = { crearRegistroEventos, eventos, MAX_CONEXIONES_POR_USUARIO };
