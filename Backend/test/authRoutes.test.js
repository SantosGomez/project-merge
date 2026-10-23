const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  envejecerSesion,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const { hashPassword } = require('../src/utils/passwordUtils');

/**
 * Pruebas de integración de las rutas de autenticación (authRoutes).
 * RF-01 a RF-07, RF-23, RF-26, RF-31, RF-36, RF-41, RNF-5, RNF-6.
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

// ---------- RF-36, criterio 31: el login distingue mayúsculas en el nombre ----------
async function testLoginDistingueMayusculas() {
  const conOtraCapitalizacion = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario.toUpperCase(),
    password: contador.password,
  });
  assert.strictEqual(
    conOtraCapitalizacion.statusCode,
    401,
    'debe responder 401 si el nombre llega con otra capitalización'
  );
  assert.ok(
    conOtraCapitalizacion.body.mensaje && conOtraCapitalizacion.body.mensaje.includes('Credenciales no válidas'),
    'el rechazo debe usar el mensaje genérico'
  );

  const exacto = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
    password: contador.password,
  });
  assert.strictEqual(exacto.statusCode, 200, 'debe responder 200 con el nombre exacto');
}

// ---------- RF-41, criterio 36: dos inicios de sesión simultáneos son independientes ----------
async function testDosSesionesSimultaneasSonIndependientes() {
  const credenciales = { usuario: contador.usuario, password: contador.password };
  const [primero, segundo] = await Promise.all([
    peticion(servidor.puerto, 'POST', '/auth/login', credenciales),
    peticion(servidor.puerto, 'POST', '/auth/login', credenciales),
  ]);
  assert.strictEqual(primero.statusCode, 200, 'el primer inicio de sesión debe responder 200');
  assert.strictEqual(segundo.statusCode, 200, 'el segundo inicio de sesión debe responder 200');
  assert.notStrictEqual(primero.body.token, segundo.body.token, 'cada inicio de sesión debe tener su propio token');

  const logout = await peticion(servidor.puerto, 'POST', '/auth/logout', null, primero.body.token);
  assert.strictEqual(logout.statusCode, 200, 'debe cerrar la primera sesión');

  const conCerrado = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, primero.body.token);
  assert.strictEqual(conCerrado.statusCode, 401, 'el token cerrado debe recibir 401');

  const conAbierto = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, segundo.body.token);
  assert.strictEqual(conAbierto.statusCode, 200, 'la otra sesión debe seguir abierta');
}

// ---------- RF-36, criterio 31: la contraseña distingue mayúsculas ----------
async function testContrasenaDistingueMayusculas() {
  const otraCapitalizacion = contador.password.toUpperCase();
  assert.notStrictEqual(otraCapitalizacion, contador.password, 'la contraseña de prueba debe tener minúsculas');

  const respuesta = await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
    password: otraCapitalizacion,
  });
  assert.strictEqual(respuesta.statusCode, 401, 'la contraseña con otra capitalización debe responder 401');
  assert.ok(respuesta.body.mensaje.includes('Credenciales no válidas'), 'el rechazo debe usar el mensaje genérico');
  assert.strictEqual(respuesta.body.token, undefined, 'no debe devolver token');
}

// ---------- RF-36, criterio 31: el nombre del seed con otra capitalización ----------
// Se sustituye un momento el hash de admin_seed por uno conocido y se restaura en `finally`.
async function testSeedDistingueMayusculas() {
  const [filas] = await pool.query('SELECT id, usuario, password_hash FROM usuarios WHERE usuario = ?', ['admin_seed']);
  const seed = filas.find((fila) => fila.usuario === 'admin_seed');
  assert.ok(seed, 'la cuenta admin_seed debe existir');
  const passwordConocida = 'ClaveTemporal123';
  const tokens = [];

  await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [await hashPassword(passwordConocida), seed.id]);
  try {
    const conMayusculas = await peticion(servidor.puerto, 'POST', '/auth/login', {
      usuario: 'ADMIN_SEED',
      password: passwordConocida,
    });
    if (conMayusculas.body.token) tokens.push(conMayusculas.body.token);
    assert.strictEqual(conMayusculas.statusCode, 401, 'ADMIN_SEED debe responder 401');
    assert.ok(conMayusculas.body.mensaje.includes('Credenciales no válidas'), 'el rechazo debe usar el mensaje genérico');

    const exacto = await peticion(servidor.puerto, 'POST', '/auth/login', {
      usuario: 'admin_seed',
      password: passwordConocida,
    });
    if (exacto.body.token) tokens.push(exacto.body.token);
    assert.strictEqual(exacto.statusCode, 200, 'admin_seed debe responder 200');
  } finally {
    await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [seed.password_hash, seed.id]);
    for (const token of tokens) {
      await pool.query('DELETE FROM sesiones WHERE jti = ?', [jwt.decode(token).jti]);
    }
  }
}

// ---------- RF-41, criterio 43: caducar una sesión por inactividad no afecta a otra ----------
async function testCaducarUnaSesionNoAfectaAOtra() {
  const credenciales = { usuario: contador.usuario, password: contador.password };
  const caducada = await peticion(servidor.puerto, 'POST', '/auth/login', credenciales);
  const vigente = await peticion(servidor.puerto, 'POST', '/auth/login', credenciales);
  assert.strictEqual(caducada.statusCode, 200, 'el primer inicio de sesión debe responder 200');
  assert.strictEqual(vigente.statusCode, 200, 'el segundo inicio de sesión debe responder 200');

  await envejecerSesion(caducada.body.token, 31);

  const conCaducada = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, caducada.body.token);
  assert.strictEqual(conCaducada.statusCode, 401, 'la sesión inactiva más de 30 minutos debe recibir 401');
  assert.ok(conCaducada.body.mensaje.includes('Sesión caducada'), 'el aviso debe ser de sesión caducada');

  const conVigente = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, vigente.body.token);
  assert.strictEqual(conVigente.statusCode, 200, 'la otra sesión del mismo usuario debe seguir abierta');
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
  test('el login solo acepta el nombre de usuario con su capitalización exacta', testLoginDistingueMayusculas);
  test('dos inicios de sesión simultáneos tienen tokens independientes', testDosSesionesSimultaneasSonIndependientes);
  test('la contraseña con otra capitalización responde 401', testContrasenaDistingueMayusculas);
  test('el nombre del seed solo entra con su capitalización exacta', testSeedDistingueMayusculas);
  test('caducar una sesión por inactividad no afecta a otra del mismo usuario', testCaducarUnaSesionNoAfectaAOtra);
});
