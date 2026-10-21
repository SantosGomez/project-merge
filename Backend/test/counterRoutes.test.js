const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const authRoutes = require('../src/routes/authRoutes');
const counterRoutes = require('../src/routes/counterRoutes');

/**
 * Pruebas de integración de las rutas de contadores (counterRoutes).
 * RF-12 a RF-16, RF-08, RF-09, RF-23, RNF-5, RNF-6.
 *
 * Inicia un servidor Express mínimo con las rutas de auth y contadores montadas.
 * Requiere MariaDB de prueba.
 */

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use('/contadores', counterRoutes);
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

// ---------- RF-12: listar contadores (solo admin) ----------
async function testListarContadoresComoAdmin() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginAdmin(puerto);

    const respuesta = await hacerPeticion(puerto, 'GET', '/contadores', null, token);
    assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 al listar contadores');
    assert.ok(Array.isArray(respuesta.body.contadores), 'debe devolver un array de contadores');
    assert.ok(respuesta.body.contadores.length > 0, 'debe haber al menos un contador (seed)');
  } finally {
    server.close();
  }
}

// ---------- RF-08: contador no puede listar contadores (acceso denegado) ----------
async function testListarContadoresComoContadorEsDenegado() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const respuesta = await hacerPeticion(puerto, 'GET', '/contadores', null, token);
    assert.strictEqual(respuesta.statusCode, 403, 'debe responder 403 para contador');
    assert.ok(respuesta.body.mensaje.includes('Acceso denegado') || respuesta.body.mensaje.includes('Rol insuficiente'), 'mensaje debe ser de acceso denegado');
  } finally {
    server.close();
  }
}

// ---------- RF-13: conteos por estado con ceros ----------
async function testConteosPorEstado() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginAdmin(puerto);

    // Primero obtener un contador existente para consultar sus conteos
    const listaResp = await hacerPeticion(puerto, 'GET', '/contadores', null, token);
    const contadorId = listaResp.body.contadores[0].id;

    const respuesta = await hacerPeticion(
      puerto,
      'GET',
      `/contadores/${contadorId}/conteos`,
      null,
      token
    );
    assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con los conteos');
    assert.ok(typeof respuesta.body.pendiente === 'number', 'debe incluir conteo pendiente');
    assert.ok(typeof respuesta.body.en_proceso === 'number', 'debe incluir conteo en_proceso');
    assert.ok(typeof respuesta.body.finalizado === 'number', 'debe incluir conteo finalizado');
  } finally {
    server.close();
  }
}

// ---------- RF-16: contador inexistente devuelve 404 ----------
async function testContadorInexistenteDevuelve404() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginAdmin(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'GET',
      '/contadores/99999999/conteos',
      null,
      token
    );
    assert.strictEqual(respuesta.statusCode, 404, 'debe responder 404 para contador inexistente');
    assert.ok(respuesta.body.mensaje.includes('No se encontró el contador'), 'mensaje debe indicar no encontrado');
  } finally {
    server.close();
  }
}

// ---------- RF-14: casos de un contador (admin) ----------
async function testCasosDeContadorComoAdmin() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginAdmin(puerto);

    const listaResp = await hacerPeticion(puerto, 'GET', '/contadores', null, token);
    const contadorId = listaResp.body.contadores[0].id;

    const respuesta = await hacerPeticion(
      puerto,
      'GET',
      `/contadores/${contadorId}/casos`,
      null,
      token
    );
    assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con los casos del contador');
    assert.ok(Array.isArray(respuesta.body.casos), 'debe devolver un array de casos');
  } finally {
    server.close();
  }
}

module.exports = {
  testListarContadoresComoAdmin,
  testListarContadoresComoContadorEsDenegado,
  testConteosPorEstado,
  testContadorInexistenteDevuelve404,
  testCasosDeContadorComoAdmin,
};
