const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const jwt = require('jsonwebtoken');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { crearRegistroEventos } = require('../src/utils/eventos');
const SessionModel = require('../src/models/SessionModel');

/**
 * Revocación de sesiones al cambiar contraseñas (S2).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306).
 */

let servidor;

const tokenValido = async (token) =>
  (await peticion(servidor.puerto, 'GET', '/auth/perfil', null, token)).statusCode === 200;

describe('registro de eventos: cerrar sesiones de una cuenta', () => {
  test('cierra las conexiones de la cuenta y respeta la excepción', () => {
    const registro = crearRegistroEventos();
    const cerradas = [];
    const conexion = (usuarioId, jti) => ({ usuarioId, jti, res: { end: () => cerradas.push(jti) } });
    registro.agregar(conexion(1, 'a'));
    registro.agregar(conexion(1, 'b'));
    registro.agregar(conexion(2, 'c'));
    registro.cerrarSesionesDeUsuario(1, 'b');
    assert.deepStrictEqual(cerradas, ['a']);
    registro.cerrarSesionesDeUsuario(1);
    assert.deepStrictEqual(cerradas.sort(), ['a', 'a', 'b']);
  });
});

describe('revocación de sesiones al cambiar la contraseña', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
  });
  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('revocarSesionesDeUsuario con excepción deja viva solo esa sesión', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const t1 = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    const t2 = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    await SessionModel.revocarSesionesDeUsuario(cuenta.id, jwt.decode(t2).jti);
    assert.strictEqual(await tokenValido(t1), false);
    assert.strictEqual(await tokenValido(t2), true);
  });

  test('restablecer la contraseña revoca todas las sesiones de la cuenta', async () => {
    const admin = await crearUsuarioDePrueba('administrador');
    const tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    const cuenta = await crearUsuarioDePrueba('contador');
    const t1 = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    const t2 = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    const r = await peticion(
      servidor.puerto,
      'PATCH',
      '/usuarios/restablecer-contrasena',
      { correo: cuenta.correo, password: 'Restablecida-2026' },
      tokenAdmin
    );
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(await tokenValido(t1), false);
    assert.strictEqual(await tokenValido(t2), false);
  });

  test('cambiar la contraseña propia revoca las demás sesiones y deja la actual', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const otra = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    const actual = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    const r = await peticion(
      servidor.puerto,
      'PATCH',
      '/auth/mi-contrasena',
      { password_actual: cuenta.password, password: 'Cambiada-Propia-77' },
      actual
    );
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(await tokenValido(otra), false, 'la otra sesión se revoca');
    assert.strictEqual(await tokenValido(actual), true, 'la sesión actual sigue');
  });
});
