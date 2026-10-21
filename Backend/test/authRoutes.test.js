const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');

/**
 * Pruebas de integración de las rutas de autenticación (authRoutes).
 * RF-01 a RF-07, RF-23, RF-26, RF-31, RNF-5, RNF-6.
 *
 * Levanta la aplicación real en un puerto libre y hace peticiones HTTP reales.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea su propio contador con
 * prefijo `zz_test_` en vez de depender de `contador_seed`; el `after` cierra el
 * servidor, borra solo los datos que este proceso registró y cierra el pool.
 */

let servidor;
let contador;

// ---------- RF-01: login válido devuelve token, rol y usuario ----------
async function testLoginValidoDevuelveToken() {
  const respuesta = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
    password: contador.password,
  });

  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con credenciales válidas');
  assert.ok(respuesta.body.token, 'debe incluir un token de acceso');
  assert.strictEqual(respuesta.body.rol, 'contador', 'debe incluir el rol del usuario');
  assert.strictEqual(respuesta.body.usuario, contador.usuario, 'debe incluir el nombre de usuario');
}

// ---------- RF-02: login sin campos falla con 400 ----------
async function testLoginSinCamposRechazaCon400() {
  // Sin cuerpo
  const respuesta1 = await peticion(servidor.puerto, 'POST', '/auth/login', {});
  assert.strictEqual(respuesta1.statusCode, 400, 'debe responder 400 cuando faltan credenciales');
  assert.ok(respuesta1.body.mensaje, 'debe incluir mensaje de error');

  // Con campos vacíos
  const respuesta2 = await peticion(servidor.puerto, 'POST', '/auth/login', {
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
}

// ---------- RF-03: credenciales incorrectas falla con 401 (mensaje genérico) ----------
async function testCredencialesIncorrectasRechazanCon401() {
  // Usuario inexistente
  const respuesta1 = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: 'usuario_inexistente',
    password: 'cualquiercosa123',
  });
  assert.strictEqual(respuesta1.statusCode, 401, 'debe responder 401 con usuario inexistente');
  assert.ok(respuesta1.body.mensaje, 'debe incluir mensaje de error');

  // Contraseña incorrecta (usuario existe, contraseña mala)
  const respuesta2 = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
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
}

// ---------- RF-26 / RF-31: logout revoca el token de forma persistente ----------
async function testLogoutRevocado() {
  // Primero hacer login para obtener un token válido
  const loginResp = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
    password: contador.password,
  });
  assert.strictEqual(loginResp.statusCode, 200, 'login debe ser exitoso');
  const token = loginResp.body.token;

  // Hacer logout con ese token
  const logoutResp = await peticion(servidor.puerto, 'POST', '/auth/logout', null, token);
  assert.strictEqual(logoutResp.statusCode, 200, 'debe responder 200 al cerrar sesión');
  assert.ok(
    logoutResp.body.mensaje.includes('Sesión cerrada correctamente'),
    'debe incluir mensaje de cierre de sesión correcto'
  );

  // El mismo token ya no debe servir: la sesión quedó revocada en la base de datos (RF-26, RF-31)
  const reintento = await peticion(servidor.puerto, 'POST', '/auth/logout', null, token);
  assert.strictEqual(
    reintento.statusCode,
    401,
    'el mismo token debe ser rechazado con 401 después de cerrar sesión'
  );
  assert.ok(reintento.body.mensaje, 'el rechazo debe incluir un mensaje de error');
}

describe('rutas de autenticación', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el login válido devuelve token, rol y usuario', testLoginValidoDevuelveToken);
  test('el login sin campos responde 400', testLoginSinCamposRechazaCon400);
  test('las credenciales incorrectas responden 401 con mensaje genérico', testCredencialesIncorrectasRechazanCon401);
  test('el logout revoca el token y el mismo token recibe 401', testLogoutRevocado);
});
