const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const authRoutes = require('../src/routes/authRoutes');
const userRoutes = require('../src/routes/userRoutes');

/**
 * Pruebas de integración de las rutas de usuarios (userRoutes).
 * RF-28 a RF-30, RF-23, RNF-5, RNF-6.
 *
 * Inicia un servidor Express mínimo con las rutas de auth y usuarios montadas.
 * Requiere MariaDB de prueba.
 */

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use('/usuarios', userRoutes);
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

async function loginAdmin(puerto) {
  const resp = await hacerPeticion(puerto, 'POST', '/auth/login', {
    usuario: 'admin_seed',
    password: 'Admin1234',
  });
  assert.strictEqual(resp.statusCode, 200, 'login del admin debe ser exitoso');
  return resp.body.token;
}

async function loginContador(puerto) {
  const resp = await hacerPeticion(puerto, 'POST', '/auth/login', {
    usuario: 'contador_seed',
    password: 'Contador1234',
  });
  assert.strictEqual(resp.statusCode, 200, 'login del contador debe ser exitoso');
  return resp.body.token;
}

// ---------- RF-28: admin da de alta un usuario ----------
async function testAltaUsuarioComoAdmin() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginAdmin(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'POST',
      '/usuarios',
      { usuario: 'nuevo_usuario_t9', password: 'NuevoPass1234', rol: 'contador' },
      token
    );
    assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al dar de alta usuario');
    assert.ok(
      respuesta.body.mensaje.includes('Usuario dado de alta correctamente'),
      'mensaje debe indicar alta exitosa'
    );
  } finally {
    server.close();
  }
}

// ---------- RF-29: contador no puede dar de alta usuarios (acceso denegado) ----------
async function testAltaUsuarioComoContadorEsDenegado() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'POST',
      '/usuarios',
      { usuario: 'otro_usuario_t9', password: 'OtroPass1234', rol: 'contador' },
      token
    );
    assert.strictEqual(respuesta.statusCode, 403, 'debe responder 403 para contador');
    assert.ok(
      respuesta.body.mensaje.includes('Acceso denegado') || respuesta.body.mensaje.includes('Rol insuficiente'),
      'mensaje debe ser de acceso denegado'
    );
  } finally {
    server.close();
  }
}

// ---------- RF-30: datos inválidos al dar de alta ----------
async function testAltaUsuarioDatosInvalidos() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginAdmin(puerto);

    // Usuario vacío
    const r1 = await hacerPeticion(
      puerto,
      'POST',
      '/usuarios',
      { usuario: '', password: 'Pass1234', rol: 'contador' },
      token
    );
    assert.strictEqual(r1.statusCode, 400, 'debe responder 400 con usuario vacío');

    // Contraseña corta (< 8 caracteres)
    const r2 = await hacerPeticion(
      puerto,
      'POST',
      '/usuarios',
      { usuario: 'usuario_valido_t9', password: 'corto', rol: 'contador' },
      token
    );
    assert.strictEqual(r2.statusCode, 400, 'debe responder 400 con contraseña corta');
    assert.ok(r2.body.mensaje.includes('contraseña'), 'mensaje debe mencionar contraseña');

    // Rol no permitido
    const r3 = await hacerPeticion(
      puerto,
      'POST',
      '/usuarios',
      { usuario: 'usuario_rol_invalido_t9', password: 'Pass1234', rol: 'invitado' },
      token
    );
    assert.strictEqual(r3.statusCode, 400, 'debe responder 400 con rol inválido');
    assert.ok(r3.body.mensaje.includes('rol'), 'mensaje debe mencionar rol');

    // Usuario ya existe
    const r4 = await hacerPeticion(
      puerto,
      'POST',
      '/usuarios',
      { usuario: 'admin_seed', password: 'Pass1234', rol: 'contador' },
      token
    );
    assert.strictEqual(r4.statusCode, 400, 'debe responder 400 si el usuario ya existe');
    assert.ok(r4.body.mensaje.includes('usuario ya existe'), 'mensaje debe indicar que el usuario ya existe');
  } finally {
    server.close();
  }
}

module.exports = {
  testAltaUsuarioComoAdmin,
  testAltaUsuarioComoContadorEsDenegado,
  testAltaUsuarioDatosInvalidos,
};
