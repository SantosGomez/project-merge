const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración de GET /auth/perfil (rebanada 06): la cuenta de la sesión
 * ve sus propios datos, con fechas en hora local y sin el hash de la contraseña.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra cuentas `zz_test_`.
 */

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

let servidor;
let contador;
let auxiliar;

async function testDevuelveLosDatosDeLaCuentaDeLaSesion() {
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  const respuesta = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, token);

  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(
    Object.keys(respuesta.body).sort(),
    ['correo', 'creado_en', 'id', 'nombre', 'rol', 'ultimo_acceso_en'],
    'solo trae los datos de la cuenta, sin password_hash'
  );
  assert.strictEqual(String(respuesta.body.id), String(contador.id));
  assert.strictEqual(respuesta.body.nombre, contador.nombre);
  assert.strictEqual(respuesta.body.correo, contador.correo);
  assert.strictEqual(respuesta.body.rol, 'contador');
  assert.match(respuesta.body.creado_en, FORMATO_FECHA);
  assert.match(respuesta.body.ultimo_acceso_en, FORMATO_FECHA, 'iniciar sesión registra el último acceso');
}

async function testUltimoAccesoPuedeSerNulo() {
  const token = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
  await query('UPDATE usuarios SET ultimo_acceso_en = NULL WHERE id = ?', [auxiliar.id]);
  const respuesta = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, token);

  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.rol, 'auxiliar');
  assert.strictEqual(respuesta.body.ultimo_acceso_en, null);
}

async function testSinTokenResponde401() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/auth/perfil');
  assert.strictEqual(respuesta.statusCode, 401);
}

describe('GET /auth/perfil', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('devuelve los datos de la cuenta de la sesión, sin el hash', testDevuelveLosDatosDeLaCuentaDeLaSesion);
  test('ultimo_acceso_en es null si la cuenta nunca entró', testUltimoAccesoPuedeSerNulo);
  test('sin token responde 401', testSinTokenResponde401);
});
