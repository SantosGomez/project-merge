const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const { verifyPassword } = require('../src/utils/passwordUtils');

/**
 * Pruebas de integración de PATCH /auth/mi-contrasena (rebanada 07): la persona cambia
 * su contraseña desde «Mi perfil» escribiendo la actual. Las contraseñas nuevas se generan
 * en cada ejecución. Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra
 * cuentas `zz_test_`.
 */

let servidor;

const contrasenaNueva = () => `Nueva_${crypto.randomBytes(6).toString('hex')}`;

async function hashDe(id) {
  const [fila] = await query('SELECT password_hash FROM usuarios WHERE id = ?', [id]);
  return fila.password_hash;
}

async function cuentaConSesion(rol = 'contador') {
  const cuenta = await crearUsuarioDePrueba(rol);
  const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  return { cuenta, token };
}

function cambiar(token, cuerpo) {
  return peticion(servidor.puerto, 'PATCH', '/auth/mi-contrasena', cuerpo, token);
}

async function testCambiaLaContrasenaConLaActualCorrecta() {
  const { cuenta, token } = await cuentaConSesion();
  const nueva = contrasenaNueva();
  const hashAntes = await hashDe(cuenta.id);

  const respuesta = await cambiar(token, { password_actual: cuenta.password, password: nueva });

  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(typeof respuesta.body.mensaje, 'string');
  const hashNuevo = await hashDe(cuenta.id);
  assert.notStrictEqual(hashNuevo, hashAntes);
  assert.match(hashNuevo, /^\$argon2id\$/, 'se guarda con Argon2id');
  assert.ok(await verifyPassword(nueva, hashNuevo));
}

async function testLaSesionActualSigueAbiertaYSeEntraConLaNueva() {
  const { cuenta, token } = await cuentaConSesion('auxiliar');
  const nueva = contrasenaNueva();

  await cambiar(token, { password_actual: cuenta.password, password: nueva });

  const perfil = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, token);
  assert.strictEqual(perfil.statusCode, 200, 'el token actual sigue valido');
  const login = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: cuenta.correo, password: nueva });
  assert.strictEqual(login.statusCode, 200, 'entra con la contraseña nueva');
  const loginViejo = await peticion(servidor.puerto, 'POST', '/auth/login', {
    correo: cuenta.correo,
    password: cuenta.password,
  });
  assert.strictEqual(loginViejo.statusCode, 401, 'la anterior ya no sirve');
}

async function assertRechazo(cuerpoDe, sobre) {
  const { cuenta, token } = await cuentaConSesion();
  const hashAntes = await hashDe(cuenta.id);

  const respuesta = await cambiar(token, cuerpoDe(cuenta));

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, new RegExp(`sobre ${sobre}:`));
  assert.strictEqual(await hashDe(cuenta.id), hashAntes, 'el hash no cambia');
}

const testActualAusente = () => assertRechazo(() => ({ password: contrasenaNueva() }), 'contraseña actual');
const testActualIncorrecta = () =>
  assertRechazo(() => ({ password_actual: contrasenaNueva(), password: contrasenaNueva() }), 'contraseña actual');
const testActualQueNoEsTexto = () =>
  assertRechazo(() => ({ password_actual: 12345678, password: contrasenaNueva() }), 'contraseña actual');
const testNuevaQueNoEsTexto = () =>
  assertRechazo((cuenta) => ({ password_actual: cuenta.password, password: 12345678 }), 'contraseña');
const testNuevaCorta = () =>
  assertRechazo((cuenta) => ({ password_actual: cuenta.password, password: 'corta' }), 'contraseña');
const testNuevaAusente = () => assertRechazo((cuenta) => ({ password_actual: cuenta.password }), 'contraseña');
const testNuevaIgualALaActual = () =>
  assertRechazo((cuenta) => ({ password_actual: cuenta.password, password: cuenta.password }), 'contraseña');

async function testSinTokenResponde401() {
  const respuesta = await cambiar(undefined, { password_actual: 'x', password: contrasenaNueva() });
  assert.strictEqual(respuesta.statusCode, 401);
}

async function testLaRutaDeLaContrasenaAsignadaNoCambia() {
  const { token } = await cuentaConSesion();
  const respuesta = await peticion(servidor.puerto, 'PATCH', '/auth/contrasena', { password: contrasenaNueva() }, token);
  assert.strictEqual(respuesta.statusCode, 403, 'sin cambio pendiente sigue respondiendo 403');
}

async function testCuentaConCambioPendienteRecibe403() {
  const cuenta = await crearUsuarioDePrueba('contador');
  await query('UPDATE usuarios SET debe_cambiar_contrasena = 1 WHERE id = ?', [cuenta.id]);
  const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  const hashAntes = await hashDe(cuenta.id);

  const respuesta = await cambiar(token, { password_actual: cuenta.password, password: contrasenaNueva() });

  assert.strictEqual(respuesta.statusCode, 403);
  assert.strictEqual(await hashDe(cuenta.id), hashAntes, 'el hash no cambia');
}

describe('PATCH /auth/mi-contrasena', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('cambia la contraseña con la actual correcta y la guarda con Argon2id', testCambiaLaContrasenaConLaActualCorrecta);
  test('la sesión actual sigue abierta y se entra con la nueva', testLaSesionActualSigueAbiertaYSeEntraConLaNueva);
  test('actual ausente: 400 sobre «contraseña actual»', testActualAusente);
  test('actual incorrecta: 400 sobre «contraseña actual»', testActualIncorrecta);
  test('actual que no es texto: 400 sobre «contraseña actual»', testActualQueNoEsTexto);
  test('nueva ausente: 400 sobre «contraseña»', testNuevaAusente);
  test('nueva que no es texto: 400 sobre «contraseña»', testNuevaQueNoEsTexto);
  test('nueva de menos de 12 caracteres: 400 sobre «contraseña»', testNuevaCorta);
  test('nueva igual a la actual: 400 sobre «contraseña»', testNuevaIgualALaActual);
  test('sin token responde 401', testSinTokenResponde401);
  test('PATCH /auth/contrasena no cambia de comportamiento', testLaRutaDeLaContrasenaAsignadaNoCambia);
  test('cuenta con cambio pendiente: 403 y el hash no cambia', testCuentaConCambioPendienteRecibe403);
});
