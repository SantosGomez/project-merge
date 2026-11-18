const http = require('node:http');
const { crearApp } = require('../src/app');

// Las pruebas del resto de la API no dependen de qué cuentas tienen «Mis actividades»: todas entran.
// Las pruebas del acceso por usuario (moduloActividades.test.js) fijan su propia lista.
process.env.USUARIOS_CON_ACTIVIDADES = '*';

/**
 * Apoyos de servidor HTTP para las pruebas de integración: levantan la app real
 * en un puerto libre, hacen peticiones y cierran el servidor para que el proceso
 * de la prueba termine.
 */

/**
 * Inicia la aplicación Express en un puerto libre.
 * @param {import('express').Express} [app] - Aplicación a servir; por defecto la real.
 * @returns {Promise<{servidor: Object, puerto: number, cerrar: Function}>} Servidor, puerto y función de cierre.
 */
async function iniciarServidor(app = crearApp({ limitarLogin: false, limitarPeticiones: false })) {
  const servidor = http.createServer(app);

  await new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });

  const puerto = servidor.address().port;

  /**
   * Cierra el servidor y también las conexiones que sigan abiertas.
   * @returns {Promise<void>}
   */
  async function cerrar() {
    const cerrado = new Promise((resolve, reject) => {
      servidor.close((error) => (error ? reject(error) : resolve()));
    });
    if (typeof servidor.closeAllConnections === 'function') {
      servidor.closeAllConnections();
    }
    await cerrado;
  }

  return { servidor, puerto, cerrar };
}

/**
 * Hace una petición HTTP al servidor de pruebas.
 * @param {number} puerto - Puerto del servidor.
 * @param {string} metodo - Método HTTP.
 * @param {string} ruta - Ruta solicitada, por ejemplo '/auth/login'.
 * @param {Object} [cuerpo] - Cuerpo que se envía como JSON (opcional).
 * @param {string} [token] - Token de acceso para la cabecera Authorization (opcional).
 * @param {Object} [cabeceras] - Cabeceras adicionales (opcional).
 * @returns {Promise<{statusCode: number, body: any, headers: Object}>} Respuesta con el cuerpo ya interpretado.
 */
async function peticion(puerto, metodo, ruta, cuerpo, token, cabeceras) {
  const cabecerasFinales = { ...(cabeceras || {}) };
  let datos = null;

  if (cuerpo !== undefined && cuerpo !== null) {
    datos = JSON.stringify(cuerpo);
    cabecerasFinales['Content-Type'] = cabecerasFinales['Content-Type'] || 'application/json';
    cabecerasFinales['Content-Length'] = Buffer.byteLength(datos);
  }

  if (token) {
    cabecerasFinales.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    const solicitud = http.request(
      {
        host: '127.0.0.1',
        port: puerto,
        path: ruta,
        method: metodo,
        headers: cabecerasFinales,
        agent: false,
      },
      (respuesta) => {
        const trozos = [];
        respuesta.on('data', (trozo) => trozos.push(trozo));
        respuesta.on('end', () => {
          const texto = Buffer.concat(trozos).toString('utf8');
          let body = texto;
          try {
            body = texto ? JSON.parse(texto) : null;
          } catch (error) {
            body = texto;
          }
          resolve({ statusCode: respuesta.statusCode, body, headers: respuesta.headers });
        });
      }
    );

    solicitud.on('error', reject);
    if (datos) {
      solicitud.write(datos);
    }
    solicitud.end();
  });
}

/**
 * Inicia sesión con el login real y devuelve el token emitido.
 * @param {number} puerto - Puerto del servidor.
 * @param {string} correo - Correo de acceso.
 * @param {string} password - Contraseña en texto plano.
 * @returns {Promise<string>} Token de acceso.
 */
async function iniciarSesion(puerto, correo, password) {
  const respuesta = await peticion(puerto, 'POST', '/auth/login', { correo, password });
  if (respuesta.statusCode !== 200 || !respuesta.body || !respuesta.body.token) {
    throw new Error(`No se pudo iniciar sesión con ${correo}: estado ${respuesta.statusCode}`);
  }
  return respuesta.body.token;
}

module.exports = { iniciarServidor, peticion, iniciarSesion };
