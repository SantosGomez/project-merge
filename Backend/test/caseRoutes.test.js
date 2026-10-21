const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const authRoutes = require('../src/routes/authRoutes');
const caseRoutes = require('../src/routes/caseRoutes');

/**
 * Pruebas de integración de las rutas de casos (caseRoutes).
 * RF-10, RF-15, RF-16, RF-17 a RF-22, RF-23, RNF-5, RNF-6.
 *
 * Inicia un servidor Express mínimo con las rutas de auth y casos montadas.
 * Requiere MariaDB de prueba.
 */

function crearApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  app.use('/casos', caseRoutes);
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

async function loginContador(puerto) {
  const resp = await hacerPeticion(puerto, 'POST', '/auth/login', {
    usuario: 'contador_seed',
    password: 'Contador1234',
  });
  assert.strictEqual(resp.statusCode, 200, 'login del contador debe ser exitoso');
  return resp.body.token;
}

// ---------- RF-17, RF-18: registrar caso con cliente y prioridad válidos ----------
async function testRegistrarCasoValido() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'POST',
      '/casos',
      { cliente: 'Cliente de prueba', prioridad: 'Alta' },
      token
    );

    assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al crear caso');
    assert.ok(respuesta.body.mensaje.includes('Caso registrado correctamente'), 'debe incluir mensaje de éxito');
    assert.ok(respuesta.body.caso, 'debe incluir el caso creado');
    assert.strictEqual(respuesta.body.caso.cliente, 'Cliente de prueba', 'cliente debe coincidir');
    assert.strictEqual(respuesta.body.caso.prioridad, 'Alta', 'prioridad debe coincidir');
    assert.strictEqual(respuesta.body.caso.estado, 'Pendiente', 'estado debe ser Pendiente automático (RF-18)');
  } finally {
    server.close();
  }
}

// ---------- RF-19: cliente faltante ----------
async function testRegistroSinClienteRechaza() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'POST',
      '/casos',
      { prioridad: 'Alta' },
      token
    );

    assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 sin cliente');
    assert.ok(respuesta.body.mensaje.includes('cliente'), 'mensaje debe mencionar cliente');
  } finally {
    server.close();
  }
}

// ---------- RF-20: prioridad inválida ----------
async function testRegistroConPrioridadInvalidaRechaza() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'POST',
      '/casos',
      { cliente: 'Cliente X', prioridad: 'Urgente' },
      token
    );

    assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 con prioridad inválida');
    assert.ok(respuesta.body.mensaje.includes('prioridad'), 'mensaje debe mencionar prioridad');
  } finally {
    server.close();
  }
}

// ---------- RF-21: cliente demasiado largo (> 80 caracteres) ----------
async function testRegistroClienteDemasiadoLargoRechaza() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const clienteLargo = 'A'.repeat(81);
    const respuesta = await hacerPeticion(
      puerto,
      'POST',
      '/casos',
      { cliente: clienteLargo, prioridad: 'Media' },
      token
    );

    assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 con cliente demasiado largo');
    assert.ok(respuesta.body.mensaje.includes('80'), 'mensaje debe indicar el máximo de 80 caracteres');
  } finally {
    server.close();
  }
}

// ---------- RF-22: cambiar estado y prioridad de caso propio ----------
async function testCambiarEstadoYPrioridadCasoPropio() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    // Crear un caso primero
    const crearResp = await hacerPeticion(
      puerto,
      'POST',
      '/casos',
      { cliente: 'Cliente para editar', prioridad: 'Media' },
      token
    );
    assert.strictEqual(crearResp.statusCode, 201, 'caso debe crearse');
    const casoId = crearResp.body.caso.id;

    // Cambiar estado a "En proceso"
    const estadoResp = await hacerPeticion(
      puerto,
      'PATCH',
      `/casos/${casoId}`,
      { estado: 'En proceso' },
      token
    );
    assert.strictEqual(estadoResp.statusCode, 200, 'debe responder 200 al cambiar estado');
    assert.strictEqual(estadoResp.body.caso.estado, 'En proceso', 'estado debe ser En proceso');

    // Cambiar prioridad a "Alta"
    const prioridadResp = await hacerPeticion(
      puerto,
      'PATCH',
      `/casos/${casoId}`,
      { prioridad: 'Alta' },
      token
    );
    assert.strictEqual(prioridadResp.statusCode, 200, 'debe responder 200 al cambiar prioridad');
    assert.strictEqual(prioridadResp.body.caso.prioridad, 'Alta', 'prioridad debe ser Alta');

    // Cliente no editable: seguir siendo el mismo
    assert.strictEqual(prioridadResp.body.caso.cliente, 'Cliente para editar', 'cliente no debe cambiar');
  } finally {
    server.close();
  }
}

// ---------- RF-10: cambiar caso ajeno es acceso denegado ----------
async function testCambiarCasoAjenoEsDenegado() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    // Crear un caso como contador_seed
    const crearResp = await hacerPeticion(
      puerto,
      'POST',
      '/casos',
      { cliente: 'Cliente caso ajeno', prioridad: 'Baja' },
      token
    );
    const casoId = crearResp.body.caso.id;

    // Ahora iniciar sesión como administrador (que NO es el contador del caso)
    const adminResp = await hacerPeticion(puerto, 'POST', '/auth/login', {
      usuario: 'admin_seed',
      password: 'Admin1234',
    });
    assert.strictEqual(adminResp.statusCode, 200, 'login admin debe ser exitoso');
    const tokenAdmin = adminResp.body.token;

    // El administrador intenta cambiar el caso (no es dueño, checkCaseOwnership rechaza)
    const patchResp = await hacerPeticion(
      puerto,
      'PATCH',
      `/casos/${casoId}`,
      { estado: 'Finalizado' },
      tokenAdmin
    );
    assert.strictEqual(patchResp.statusCode, 403, 'debe responder 403 al intentar cambiar caso ajeno');
    assert.ok(patchResp.body.mensaje.includes('Acceso denegado'), 'mensaje debe ser de acceso denegado');
  } finally {
    server.close();
  }
}

// ---------- RF-16: caso inexistente devuelve 404 ----------
async function testCasoInexistenteDevuelve404() {
  const app = crearApp();
  const { server, puerto } = await iniciarServidor(app);
  try {
    const token = await loginContador(puerto);

    const respuesta = await hacerPeticion(
      puerto,
      'PATCH',
      '/casos/99999999',
      { estado: 'Finalizado' },
      token
    );
    assert.strictEqual(respuesta.statusCode, 404, 'debe responder 404 para caso inexistente');
    assert.ok(respuesta.body.mensaje.includes('No se encontró el caso'), 'mensaje debe indicar no encontrado');
  } finally {
    server.close();
  }
}

module.exports = {
  testRegistrarCasoValido,
  testRegistroSinClienteRechaza,
  testRegistroConPrioridadInvalidaRechaza,
  testRegistroClienteDemasiadoLargoRechaza,
  testCambiarEstadoYPrioridadCasoPropio,
  testCambiarCasoAjenoEsDenegado,
  testCasoInexistenteDevuelve404,
};
