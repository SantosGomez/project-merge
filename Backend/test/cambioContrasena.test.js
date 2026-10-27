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
 * Pruebas de integración del cambio de contraseña obligatorio (rebanada 1, backend).
 * Las cuentas dadas de alta o restablecidas por el administrador deben crear su propia
 * contraseña tras el primer inicio de sesión; mientras tanto el resto de la API responde 403.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra cuentas `zz_test_`.
 */

const CONTRASENA_ASIGNADA = 'AsignadaAdmin1';
const CONTRASENA_PROPIA = 'MiClavePropia2';

let servidor;
let administrador;
let contador;

function correoDePrueba(prefijo) {
  const correo = `zz_test_${prefijo}_${crypto.randomBytes(4).toString('hex')}@prueba.local`;
  registrarUsuarioCreado(correo);
  return correo;
}

/** Da de alta por la API una cuenta de contador y devuelve su correo. */
async function altaContadorPorAdmin(prefijo) {
  const tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
  const correo = correoDePrueba(prefijo);
  const alta = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { nombre: `zz_test ${prefijo}`, correo, password: CONTRASENA_ASIGNADA, rol: 'contador' },
    tokenAdmin
  );
  assert.strictEqual(alta.statusCode, 201, 'el alta debe funcionar');
  return correo;
}

function cambiarContrasena(token, cuerpo) {
  return peticion(servidor.puerto, 'PATCH', '/auth/contrasena', cuerpo, token);
}

async function marcaDe(correo) {
  const [fila] = await query('SELECT debe_cambiar_contrasena FROM usuarios WHERE correo = ?', [correo]);
  return fila.debe_cambiar_contrasena;
}

// ---------- La migración agrega la columna, obligatoria y en «no» por defecto ----------
async function testColumnaMigrada() {
  const [columna] = await query("SHOW COLUMNS FROM usuarios LIKE 'debe_cambiar_contrasena'");
  assert.ok(columna, 'la tabla usuarios debe tener la columna debe_cambiar_contrasena');
  assert.strictEqual(columna.Null, 'NO', 'la columna no acepta vacío');
  assert.strictEqual(String(columna.Default), '0', 'por defecto las cuentas no deben cambiarla');
}

// ---------- Las cuentas creadas fuera del alta (seed, cuentas actuales) no quedan marcadas ----------
async function testCuentaSinMarcaEntraNormal() {
  const respuesta = await peticion(servidor.puerto, 'POST', '/auth/login', {
    correo: contador.correo,
    password: contador.password,
  });
  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.debe_cambiar_contrasena, false, 'el login avisa que no hay cambio pendiente');

  const casos = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, respuesta.body.token);
  assert.strictEqual(casos.statusCode, 200, 'sin marca usa la API como siempre');
}

// ---------- El alta marca la cuenta y el login lo avisa ----------
async function testAltaMarcaLaCuenta() {
  const correo = await altaContadorPorAdmin('alta');
  assert.strictEqual(await marcaDe(correo), 1, 'la cuenta nueva queda marcada');

  const login = await peticion(servidor.puerto, 'POST', '/auth/login', { correo, password: CONTRASENA_ASIGNADA });
  assert.strictEqual(login.statusCode, 200);
  assert.strictEqual(login.body.debe_cambiar_contrasena, true, 'el login avisa que debe cambiarla');
}

// ---------- El restablecimiento marca la cuenta ----------
async function testRestablecerMarcaLaCuenta() {
  const tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
  const otro = await crearUsuarioDePrueba('contador');
  assert.strictEqual(await marcaDe(otro.correo), 0, 'antes del restablecimiento no está marcada');

  const respuesta = await peticion(
    servidor.puerto,
    'PATCH',
    '/usuarios/restablecer-contrasena',
    { correo: otro.correo, password: CONTRASENA_ASIGNADA },
    tokenAdmin
  );
  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(await marcaDe(otro.correo), 1, 'tras restablecer queda marcada');
}

// ---------- Con la marca, el resto de la API responde 403; cerrar sesión sí funciona ----------
async function testMarcaBloqueaLaApi() {
  const correo = await altaContadorPorAdmin('bloqueo');
  const token = await iniciarSesion(servidor.puerto, correo, CONTRASENA_ASIGNADA);

  const casos = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, token);
  assert.strictEqual(casos.statusCode, 403, 'no puede usar la app sin crear su contraseña');
  assert.match(casos.body.mensaje, /Debe cambiar su contraseña/);

  const salida = await peticion(servidor.puerto, 'POST', '/auth/logout', null, token);
  assert.strictEqual(salida.statusCode, 200, 'puede cerrar sesión');
}

// ---------- Validaciones de la contraseña nueva ----------
async function testValidacionesDeLaNueva() {
  const correo = await altaContadorPorAdmin('valida');
  const token = await iniciarSesion(servidor.puerto, correo, CONTRASENA_ASIGNADA);

  const corta = await cambiarContrasena(token, { password: 'Corta1' });
  assert.strictEqual(corta.statusCode, 400, 'menos de 8 caracteres');
  assert.match(corta.body.mensaje, /al menos 8 caracteres/);

  const igual = await cambiarContrasena(token, { password: CONTRASENA_ASIGNADA });
  assert.strictEqual(igual.statusCode, 400, 'igual a la que dio el administrador');
  assert.match(igual.body.mensaje, /distinta/);

  const noTexto = await cambiarContrasena(token, { password: 12345678 });
  assert.strictEqual(noTexto.statusCode, 400, 'debe llegar como texto');

  assert.strictEqual(await marcaDe(correo), 1, 'ningún intento inválido quita la marca');
}

// ---------- Cambio correcto: guarda la nueva, quita la marca y la misma sesión sigue ----------
async function testCambioCorrecto() {
  const correo = await altaContadorPorAdmin('cambio');
  const token = await iniciarSesion(servidor.puerto, correo, CONTRASENA_ASIGNADA);

  const respuesta = await cambiarContrasena(token, { password: CONTRASENA_PROPIA });
  assert.strictEqual(respuesta.statusCode, 200);
  assert.match(respuesta.body.mensaje, /Contraseña actualizada/);
  assert.strictEqual(await marcaDe(correo), 0, 'se quita la marca');

  const [fila] = await query('SELECT password_hash FROM usuarios WHERE correo = ?', [correo]);
  assert.ok(fila.password_hash.startsWith('$argon2id$'), 'la nueva se guarda con Argon2id');

  const casos = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, token);
  assert.strictEqual(casos.statusCode, 200, 'la misma sesión ya puede usar la app');

  const vieja = await peticion(servidor.puerto, 'POST', '/auth/login', { correo, password: CONTRASENA_ASIGNADA });
  assert.strictEqual(vieja.statusCode, 401, 'la contraseña asignada ya no sirve');
  const nueva = await peticion(servidor.puerto, 'POST', '/auth/login', { correo, password: CONTRASENA_PROPIA });
  assert.strictEqual(nueva.statusCode, 200, 'entra con su contraseña propia');
  assert.strictEqual(nueva.body.debe_cambiar_contrasena, false);
}

// ---------- Sin cambio pendiente no se puede usar el endpoint; sin sesión, 401 ----------
async function testSinMarcaOSinSesion() {
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  const sinMarca = await cambiarContrasena(token, { password: CONTRASENA_PROPIA });
  assert.strictEqual(sinMarca.statusCode, 403, 'solo sirve mientras hay un cambio pendiente');

  const sigueIgual = await peticion(servidor.puerto, 'POST', '/auth/login', {
    correo: contador.correo,
    password: contador.password,
  });
  assert.strictEqual(sigueIgual.statusCode, 200, 'su contraseña no cambió');

  const sinSesion = await cambiarContrasena(undefined, { password: CONTRASENA_PROPIA });
  assert.strictEqual(sinSesion.statusCode, 401);
}

describe('cambio de contraseña obligatorio', () => {
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

  test('la migración agrega debe_cambiar_contrasena, obligatoria y en 0 por defecto', testColumnaMigrada);
  test('una cuenta sin marca entra y usa la API como siempre', testCuentaSinMarcaEntraNormal);
  test('el alta marca la cuenta y el login devuelve debe_cambiar_contrasena', testAltaMarcaLaCuenta);
  test('restablecer la contraseña marca la cuenta', testRestablecerMarcaLaCuenta);
  test('con la marca el resto de la API responde 403 y cerrar sesión funciona', testMarcaBloqueaLaApi);
  test('la contraseña nueva debe ser texto, de 8 o más y distinta a la asignada', testValidacionesDeLaNueva);
  test('el cambio guarda la nueva con Argon2id, quita la marca y la sesión sigue', testCambioCorrecto);
  test('sin cambio pendiente responde 403 y sin sesión 401', testSinMarcaOSinSesion);
});
