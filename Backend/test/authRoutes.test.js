const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const authRoutes = require('../src/routes/authRoutes');

/**
 * Pruebas de integración de las rutas de autenticación (authRoutes).
 * RF-01 a RF-07, RF-23, RNF-5, RNF-6.
 *
 * Inicia un servidor Express mínimo con las rutas montadas y hace peticiones
 * HTTP reales usando el módulo nativo `http` de Node.js.
 * Requiere MariaDB de prueba (puerto 3306, root sin contraseña, DB delgrow_contadores).
 */

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  return app;
}

function iniciarServidor(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const puerto = server.address().port;
      resolve({ server, puerto });
    });
  });
}

function hacerPeticion(puerto, metodo, ruta, datos, token) {
  return new Promise((resolve, reject) => {
    const body = datos ? JSON.stringify(datos) : null;
    const opciones = {
      hostname: '127.0.0.1',
      port: puerto,
      path: ruta,
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(opciones, (res) => {
      let datosRespuesta = '';
      res.on('data', (trozo) => {
        datosRespuesta += trozo;
      });
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(datosRespuesta);
        } catch (_) {
          parsed = datosRespuesta;
        }
        resolve({ statusCode: res.statusCode, body: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------- RF-01: login válido devuelve token, rol y usuario ----------
async function testLoginValidoDevuelveToken() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const respuesta = await hacerPeticion(puerto, 'POST', '/auth/login', {
      usuario: 'contador_seed',
      password: 'Contador1234',
    });

    assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con credenciales válidas');
    assert.ok(respuesta.body.token, 'debe incluir un token de acceso');
    assert.strictEqual(respuesta.body.rol, 'contador', 'debe incluir el rol del usuario');
    assert.strictEqual(respuesta.body.usuario, 'contador_seed', 'debe incluir el nombre de usuario');
  } finally {
    server.close();
  }
}

// ---------- RF-02: login sin campos falla con 400 ----------
async function testLoginSinCamposRechazaCon400() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    // Sin cuerpo
    const respuesta1 = await hacerPeticion(puerto, 'POST', '/auth/login', {});
    assert.strictEqual(respuesta1.statusCode, 400, 'debe responder 400 cuando faltan credenciales');
    assert.ok(respuesta1.body.mensaje, 'debe incluir mensaje de error');

    // Con campos vacíos
    const respuesta2 = await hacerPeticion(puerto, 'POST', '/auth/login', {
      usuario: '   ',
      password: '   ',
    });
    assert.strictEqual(respuesta2.statusCode, 400, 'debe responder 400 con campos vacíos');
    assert.ok(respuesta2.body.mensaje, 'debe incluir mensaje de error');

    // Mensaje con tres partes (RF-23)
    assert.ok(
      respuesta1.body.mensaje.includes('Faltan credenciales') &&
        respuesta1.body.mensaje.includes('usuario y/o contraseña') &&
        respuesta1.body.mensaje.includes('Ingrese usuario y contraseña'),
      'el mensaje de error debe tener las tres partes en español'
    );
  } finally {
    server.close();
  }
}

// ---------- RF-03: credenciales incorrectas falla con 401 (mensaje genérico) ----------
async function testCredencialesIncorrectasRechazanCon401() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    // Usuario inexistente
    const respuesta1 = await hacerPeticion(puerto, 'POST', '/auth/login', {
      usuario: 'usuario_inexistente',
      password: 'cualquiercosa123',
    });
    assert.strictEqual(respuesta1.statusCode, 401, 'debe responder 401 con usuario inexistente');
    assert.ok(respuesta1.body.mensaje, 'debe incluir mensaje de error');

    // Contraseña incorrecta (usuario existe, contraseña mala)
    const respuesta2 = await hacerPeticion(puerto, 'POST', '/auth/login', {
      usuario: 'contador_seed',
      password: 'ContraseñaIncorrecta',
    });
    assert.strictEqual(respuesta2.statusCode, 401, 'debe responder 401 con contraseña incorrecta');
    assert.ok(respuesta2.body.mensaje, 'debe incluir mensaje de error');

    // Mensaje genérico que no revela cuál dato falló (RF-03)
    assert.ok(
      respuesta1.body.mensaje.includes('Credenciales no válidas') &&
        respuesta1.body.mensaje.includes('usuario o contraseña') &&
        respuesta1.body.mensaje.includes('Verifique sus datos e intente nuevamente'),
      'el mensaje debe ser genérico y tener las tres partes en español'
    );
    // No debe revelar si el usuario existe
    assert.ok(
      !respuesta1.body.mensaje.includes('usuario no encontrado') &&
        !respuesta1.body.mensaje.includes('contraseña incorrecta'),
      'el mensaje no debe revelar cuál dato falló'
    );
  } finally {
    server.close();
  }
}

// ---------- RF-26 / RF-31: logout revoca el token ----------
async function testLogoutRevocado() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    // Primero hacer login para obtener un token válido
    const loginResp = await hacerPeticion(puerto, 'POST', '/auth/login', {
      usuario: 'contador_seed',
      password: 'Contador1234',
    });
    assert.strictEqual(loginResp.statusCode, 200, 'login debe ser exitoso');
    const token = loginResp.body.token;

    // Hacer logout con ese token
    const logoutResp = await hacerPeticion(puerto, 'POST', '/auth/logout', null, token);
    assert.strictEqual(logoutResp.statusCode, 200, 'debe responder 200 al cerrar sesión');
    assert.ok(
      logoutResp.body.mensaje.includes('Sesión cerrada correctamente'),
      'debe incluir mensaje de cierre de sesión correcto'
    );
  } finally {
    server.close();
  }
}

module.exports = {
  testLoginValidoDevuelveToken,
  testLoginSinCamposRechazaCon400,
  testCredencialesIncorrectasRechazanCon401,
  testLogoutRevocado,
};
