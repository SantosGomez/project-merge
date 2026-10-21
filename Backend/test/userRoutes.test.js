const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración de las rutas de usuarios (userRoutes).
 * RF-28 a RF-30, RF-23, RNF-1, RNF-5, RNF-6.
 *
 * Levanta la aplicación real en un puerto libre con las rutas de autenticación y
 * de usuarios montadas. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea su propio administrador y su
 * propio contador con prefijo `zz_test_`; los usuarios dados de alta por la API
 * se registran para la limpieza y el `after` borra solo lo que este proceso creó.
 */

let servidor;
let administrador;
let contador;

// Nombre único de usuario de prueba con el prefijo acordado (plan 9.3).
function nombreDePrueba(prefijo) {
  return `zz_test_${prefijo}_${crypto.randomBytes(4).toString('hex')}`;
}

async function loginAdmin() {
  return iniciarSesion(servidor.puerto, administrador.usuario, administrador.password);
}

async function loginContador() {
  return iniciarSesion(servidor.puerto, contador.usuario, contador.password);
}

// ---------- RF-28: admin da de alta un usuario ----------
async function testAltaUsuarioComoAdmin() {
  const token = await loginAdmin();
  const nombre = nombreDePrueba('alta');

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombre, password: 'NuevoPass1234', rol: 'contador' },
    token
  );
  // El usuario queda registrado para que la limpieza lo borre, aunque falle un aserto.
  registrarUsuarioCreado(nombre);

  assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al dar de alta usuario');
  assert.ok(
    respuesta.body.mensaje.includes('Usuario dado de alta correctamente'),
    'mensaje debe indicar alta exitosa'
  );

  // El alta deja una sola fila con ese nombre, con la contraseña hasheada con Argon2id (RF-28, RNF-1).
  const filas = await query(
    'SELECT id, usuario, password_hash, rol FROM usuarios WHERE usuario = ?',
    [nombre]
  );
  assert.strictEqual(filas.length, 1, 'debe existir una sola fila con el nombre dado de alta');
  assert.strictEqual(filas[0].usuario, nombre, 'la fila debe tener el nombre dado de alta');
  assert.ok(
    filas[0].password_hash.startsWith('$argon2id$'),
    'la contraseña debe estar hasheada con Argon2id'
  );
  assert.strictEqual(filas[0].rol, 'contador', 'la fila debe tener el rol indicado en el alta');
}

// ---------- RF-29: contador no puede dar de alta usuarios (acceso denegado) ----------
async function testAltaUsuarioComoContadorEsDenegado() {
  const token = await loginContador();
  const nombre = nombreDePrueba('denegado');

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombre, password: 'OtroPass1234', rol: 'contador' },
    token
  );
  assert.strictEqual(respuesta.statusCode, 403, 'debe responder 403 para contador');
  assert.ok(
    respuesta.body.mensaje.includes('Acceso denegado') || respuesta.body.mensaje.includes('Rol insuficiente'),
    'mensaje debe ser de acceso denegado'
  );

  // El contador no dio de alta a nadie: no debe existir ninguna fila con ese nombre.
  const filas = await query('SELECT id FROM usuarios WHERE usuario = ?', [nombre]);
  assert.strictEqual(filas.length, 0, 'el contador no debe poder crear usuarios');
}

// ---------- RF-30: datos inválidos al dar de alta ----------
async function testAltaUsuarioDatosInvalidos() {
  const token = await loginAdmin();

  // Usuario vacío
  const r1 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: '', password: 'Pass1234', rol: 'contador' },
    token
  );
  assert.strictEqual(r1.statusCode, 400, 'debe responder 400 con usuario vacío');

  // Contraseña corta (< 8 caracteres)
  const r2 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreDePrueba('clave_corta'), password: 'corto', rol: 'contador' },
    token
  );
  assert.strictEqual(r2.statusCode, 400, 'debe responder 400 con contraseña corta');
  assert.ok(r2.body.mensaje.includes('contraseña'), 'mensaje debe mencionar contraseña');

  // Rol no permitido
  const r3 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreDePrueba('rol_invalido'), password: 'Pass1234', rol: 'invitado' },
    token
  );
  assert.strictEqual(r3.statusCode, 400, 'debe responder 400 con rol inválido');
  assert.ok(r3.body.mensaje.includes('rol'), 'mensaje debe mencionar rol');

  // Usuario ya existe (el administrador propio de esta prueba)
  const r4 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: administrador.usuario, password: 'Pass1234', rol: 'contador' },
    token
  );
  assert.strictEqual(r4.statusCode, 400, 'debe responder 400 si el usuario ya existe');
  assert.ok(r4.body.mensaje.includes('usuario ya existe'), 'mensaje debe indicar que el usuario ya existe');
}

describe('rutas de usuarios', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el administrador da de alta un usuario con contraseña Argon2id', testAltaUsuarioComoAdmin);
  test('el contador no puede dar de alta usuarios', testAltaUsuarioComoContadorEsDenegado);
  test('los datos inválidos de alta responden 400', testAltaUsuarioDatosInvalidos);
});
