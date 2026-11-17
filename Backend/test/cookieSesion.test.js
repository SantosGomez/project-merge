const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');
const { crearApp } = require('../src/app');

/**
 * Pruebas de integración de la cookie de sesión HttpOnly (rebanada S8): el login la
 * entrega, las rutas la aceptan, las escrituras solo con cookie exigen la cabecera
 * X-Requested-With (CSRF), el cierre la borra y CORS permite credenciales solo a los
 * orígenes de la lista. Requiere MariaDB (XAMPP, puerto 3306). Solo usa cuentas `zz_test_`.
 */

const ORIGEN = 'http://localhost:9000';
const CSRF = { 'X-Requested-With': 'SeguimientoProyectos' };

let servidor;
let contador;

/** Inicia sesión y devuelve la respuesta completa. */
function login(extra, cabeceras) {
  return peticion(
    servidor.puerto,
    'POST',
    '/auth/login',
    { correo: contador.correo, password: contador.password, ...(extra || {}) },
    null,
    cabeceras
  );
}

/** Extrae la línea Set-Cookie de la sesión y su par `nombre=valor`. */
function paresCookie(respuesta) {
  const set = respuesta.headers['set-cookie'] || [];
  const linea = set.find((c) => c.startsWith('sp_sesion='));
  return { linea, par: linea ? linea.split(';')[0] : null };
}

async function testLoginEntregaLaCookieHttpOnly() {
  const r = await login();
  assert.strictEqual(r.statusCode, 200);
  const { linea } = paresCookie(r);
  assert.ok(linea, 'el login entrega la cookie sp_sesion');
  assert.match(linea, /; HttpOnly/);
  assert.match(linea, /; SameSite=Strict/);
  assert.match(linea, /; Path=\//);
  assert.doesNotMatch(linea, /Max-Age/i, 'la sesión normal es cookie de sesión');
  assert.doesNotMatch(linea, /Secure/, 'por HTTP plano no lleva Secure');
  assert.ok(linea.startsWith(`sp_sesion=${r.body.token};`), 'la cookie lleva el mismo token');
}

async function testLoginPersistenteTieneMaxAge() {
  const r = await login({ mantener_sesion: true });
  assert.match(paresCookie(r).linea, /; Max-Age=2592000/);
}

async function testLoginPorHttpsLlevaSecure() {
  const r = await login(null, { 'X-Forwarded-Proto': 'https' });
  assert.match(paresCookie(r).linea, /; Secure/);
}

async function testLoginConErrorNoEntregaCookie() {
  const r = await peticion(servidor.puerto, 'POST', '/auth/login', {
    correo: contador.correo,
    password: 'mala-contraseña-1',
  });
  assert.strictEqual(r.statusCode, 401);
  assert.strictEqual(paresCookie(r).linea, undefined);
}

async function testLaCookieAutenticaLecturas() {
  const { par } = paresCookie(await login());
  const r = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Cookie: par });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(r.body.correo, contador.correo);
}

async function testCookieInvalidaResponde401() {
  const r = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Cookie: 'sp_sesion=basura.no.valida' });
  assert.strictEqual(r.statusCode, 401);
}

async function testEscrituraConCookieSinCabeceraResponde403() {
  const { par } = paresCookie(await login());
  const r = await peticion(servidor.puerto, 'POST', '/eventos/pase', {}, null, { Cookie: par });
  assert.strictEqual(r.statusCode, 403);
  assert.ok(r.body.mensaje);
}

async function testEscrituraConCookieYCabeceraFunciona() {
  const { par } = paresCookie(await login());
  const r = await peticion(servidor.puerto, 'POST', '/eventos/pase', {}, null, { Cookie: par, ...CSRF });
  assert.strictEqual(r.statusCode, 200);
}

async function testEscrituraConCabeceraDeOtroValorResponde403() {
  const { par } = paresCookie(await login());
  const r = await peticion(servidor.puerto, 'POST', '/eventos/pase', {}, null, {
    Cookie: par,
    'X-Requested-With': 'otra',
  });
  assert.strictEqual(r.statusCode, 403);
}

async function testBearerNoExigeLaCabecera() {
  const token = (await login()).body.token;
  const r = await peticion(servidor.puerto, 'POST', '/eventos/pase', {}, token);
  assert.strictEqual(r.statusCode, 200);
}

async function testBearerTienePrioridadSobreLaCookie() {
  const token = (await login()).body.token;
  const r = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, token, { Cookie: 'sp_sesion=basura.no.valida' });
  assert.strictEqual(r.statusCode, 200);
}

async function testCambioDeContrasenaConCookie() {
  const { par } = paresCookie(await login());
  const r = await peticion(
    servidor.puerto,
    'PATCH',
    '/auth/mi-contrasena',
    { password_actual: 'incorrecta-123456', password: 'Otra-contrasena-segura-987' },
    null,
    { Cookie: par, ...CSRF }
  );
  assert.strictEqual(r.statusCode, 400, 'llega al controlador (contraseña actual incorrecta), no falla por la cookie');
}

async function testLogoutConCookieRevocaYBorraLaCookie() {
  const { par } = paresCookie(await login());
  const salida = await peticion(servidor.puerto, 'POST', '/auth/logout', {}, null, { Cookie: par, ...CSRF });
  assert.strictEqual(salida.statusCode, 200);
  const borrada = paresCookie(salida).linea;
  assert.ok(borrada, 'el cierre envía Set-Cookie para borrarla');
  assert.match(borrada, /^sp_sesion=;/);
  assert.match(borrada, /; Max-Age=0/);
  const despues = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Cookie: par });
  assert.strictEqual(despues.statusCode, 401, 'el token quedó revocado');
}

async function testNuevoLoginRevocaLaSesionDeLaCookiePrevia() {
  const { par } = paresCookie(await login());
  const nuevo = await login(null, { Cookie: par });
  assert.strictEqual(nuevo.statusCode, 200);
  const previa = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Cookie: par });
  assert.strictEqual(previa.statusCode, 401, 'la sesión anterior ya no sirve (RF-10)');
  const { par: parNuevo } = paresCookie(nuevo);
  const actual = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Cookie: parNuevo });
  assert.strictEqual(actual.statusCode, 200);
}

async function testCorsPermiteCredencialesSoloALosOrigenesDeLaLista() {
  const ok = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Origin: ORIGEN });
  assert.strictEqual(ok.headers['access-control-allow-origin'], ORIGEN);
  assert.strictEqual(ok.headers['access-control-allow-credentials'], 'true');

  const mal = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Origin: 'http://otro.example' });
  assert.strictEqual(mal.statusCode, 403);
  assert.strictEqual(mal.headers['access-control-allow-credentials'], undefined);
  assert.strictEqual(mal.headers['access-control-allow-origin'], undefined);
}

async function testPreflightPermiteLaCabeceraPersonalizada() {
  const r = await peticion(servidor.puerto, 'OPTIONS', '/casos', null, null, {
    Origin: ORIGEN,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'x-requested-with,content-type',
  });
  assert.ok(r.statusCode < 300);
  assert.match(String(r.headers['access-control-allow-headers']).toLowerCase(), /x-requested-with/);
  assert.strictEqual(r.headers['access-control-allow-credentials'], 'true');
}

describe('cookie de sesión HttpOnly', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    process.env.TRUST_PROXY = '1';
    servidor = await iniciarServidor(
      crearApp({ limitarLogin: false, limitarPeticiones: false, origenesPermitidos: [ORIGEN] })
    );
  });

  after(async () => {
    delete process.env.TRUST_PROXY;
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el login entrega la cookie HttpOnly SameSite=Strict', testLoginEntregaLaCookieHttpOnly);
  test('el login persistente fija Max-Age de 30 días', testLoginPersistenteTieneMaxAge);
  test('por HTTPS (X-Forwarded-Proto) la cookie lleva Secure', testLoginPorHttpsLlevaSecure);
  test('un login fallido no entrega cookie', testLoginConErrorNoEntregaCookie);
  test('la cookie autentica lecturas', testLaCookieAutenticaLecturas);
  test('una cookie inválida responde 401', testCookieInvalidaResponde401);
  test('escritura solo con cookie y sin X-Requested-With responde 403', testEscrituraConCookieSinCabeceraResponde403);
  test('escritura con cookie y X-Requested-With funciona', testEscrituraConCookieYCabeceraFunciona);
  test('X-Requested-With con otro valor responde 403', testEscrituraConCabeceraDeOtroValorResponde403);
  test('con Bearer no se exige X-Requested-With', testBearerNoExigeLaCabecera);
  test('el Bearer tiene prioridad sobre la cookie', testBearerTienePrioridadSobreLaCookie);
  test('el cambio de contraseña propia funciona con cookie', testCambioDeContrasenaConCookie);
  test('el cierre de sesión con cookie revoca y borra la cookie', testLogoutConCookieRevocaYBorraLaCookie);
  test('un nuevo login revoca la sesión de la cookie previa', testNuevoLoginRevocaLaSesionDeLaCookiePrevia);
  test('CORS permite credenciales solo a los orígenes de la lista', testCorsPermiteCredencialesSoloALosOrigenesDeLaLista);
  test('el preflight permite X-Requested-With con credenciales', testPreflightPermiteLaCabeceraPersonalizada);
});
