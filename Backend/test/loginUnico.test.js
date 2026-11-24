const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const { verifyPassword, necesitaRehash } = require('../src/utils/passwordUtils');

/**
 * Fase 2 de la unión con Proyecto-documentos: un solo login.
 * - Se entra con el correo o con el alias que se usaba en documentos.
 * - Las contraseñas que vienen de documentos (scrypt) se aceptan y, al entrar, se guardan en Argon2id.
 * - El login y el perfil dicen qué módulos ve la cuenta.
 */

let servidor;

/** Hash con el formato de Proyecto-documentos: `scrypt$N$sal$hash` (hex). */
function hashScrypt(clave, { N = 16384, sal = crypto.randomBytes(16) } = {}) {
  const derivada = crypto.scryptSync(clave, sal, 64, { N });
  return ['scrypt', N, sal.toString('hex'), derivada.toString('hex')].join('$');
}

async function entrar(correo, password) {
  return peticion(servidor.puerto, 'POST', '/auth/login', { correo, password });
}

async function cerrarSesionDe(respuesta) {
  if (respuesta.body && respuesta.body.token) {
    const { jti } = JSON.parse(Buffer.from(respuesta.body.token.split('.')[1], 'base64url').toString());
    await query('DELETE FROM sesiones WHERE jti = ?', [jti]);
  }
}

async function ponerAlias(id, alias) {
  await query('UPDATE usuarios SET alias = ? WHERE id = ?', [alias, id]);
}

async function hashDe(id) {
  const [fila] = await query('SELECT password_hash FROM usuarios WHERE id = ?', [id]);
  return fila.password_hash;
}

describe('login único', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('se entra con el alias, sin importar mayúsculas ni espacios', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const alias = `zz_alias_${crypto.randomBytes(3).toString('hex')}`;
    await ponerAlias(cuenta.id, alias);
    const respuesta = await entrar(`  ${alias.toUpperCase()} `, cuenta.password);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.strictEqual(respuesta.body.id, cuenta.id);
    await cerrarSesionDe(respuesta);
  });

  test('el correo sigue funcionando y un alias que no existe da 401 genérico', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const conCorreo = await entrar(cuenta.correo, cuenta.password);
    assert.strictEqual(conCorreo.statusCode, 200);
    await cerrarSesionDe(conCorreo);
    const sinCuenta = await entrar('zz_alias_que_no_existe', cuenta.password);
    assert.strictEqual(sinCuenta.statusCode, 401);
  });

  test('una contraseña de documentos (scrypt) entra y queda guardada en Argon2id', async () => {
    const cuenta = await crearUsuarioDePrueba('auxiliar');
    await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hashScrypt('ClaveDeDocumentos1'), cuenta.id]);

    const primera = await entrar(cuenta.correo, 'ClaveDeDocumentos1');
    assert.strictEqual(primera.statusCode, 200);
    await cerrarSesionDe(primera);

    const nuevo = await hashDe(cuenta.id);
    assert.ok(nuevo.startsWith('$argon2id$'), 'se volvió a guardar en Argon2id');
    assert.strictEqual(await verifyPassword('ClaveDeDocumentos1', nuevo), true);

    const segunda = await entrar(cuenta.correo, 'ClaveDeDocumentos1');
    assert.strictEqual(segunda.statusCode, 200, 'sigue entrando con la misma contraseña');
    await cerrarSesionDe(segunda);
  });

  test('con scrypt, la contraseña incorrecta da 401 y no cambia el hash', async () => {
    const cuenta = await crearUsuarioDePrueba('auxiliar');
    const original = hashScrypt('ClaveDeDocumentos1');
    await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [original, cuenta.id]);
    const respuesta = await entrar(cuenta.correo, 'OtraClave');
    assert.strictEqual(respuesta.statusCode, 401);
    assert.strictEqual(await hashDe(cuenta.id), original);
  });

  test('un hash roto da 401, no un error del servidor', async () => {
    const cuenta = await crearUsuarioDePrueba('auxiliar');
    for (const roto of ['scrypt$abc', 'scrypt$16384$zz$zz', 'texto-cualquiera']) {
      await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [roto, cuenta.id]);
      const respuesta = await entrar(cuenta.correo, 'ClaveDeDocumentos1');
      assert.strictEqual(respuesta.statusCode, 401, `hash ${roto}`);
    }
  });

  test('necesitaRehash solo pide rehacer lo que no es Argon2id', () => {
    assert.strictEqual(necesitaRehash(hashScrypt('x', { N: 1024 })), true);
    assert.strictEqual(necesitaRehash('$argon2id$v=19$m=65536,t=3,p=4$abc$def'), false);
  });

  test('el login y el perfil dicen qué módulos ve la cuenta', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    const admin = await crearUsuarioDePrueba('administrador');

    const deContador = await entrar(contador.correo, contador.password);
    assert.deepStrictEqual(deContador.body.modulos, [{ modulo: 'seguimiento', rol: null }]);
    await cerrarSesionDe(deContador);

    const deAdmin = await entrar(admin.correo, admin.password);
    assert.deepStrictEqual(deAdmin.body.modulos, [
      { modulo: 'documentos', rol: 'administrador' },
      { modulo: 'seguimiento', rol: null },
    ]);
    const perfil = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, deAdmin.body.token);
    assert.strictEqual(perfil.statusCode, 200);
    assert.deepStrictEqual(perfil.body.modulos, deAdmin.body.modulos);
    await cerrarSesionDe(deAdmin);
  });

  test('una cuenta nueva nace con el módulo de seguimiento', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const filas = await query('SELECT modulo, rol FROM usuario_modulos WHERE usuario_id = ?', [cuenta.id]);
    assert.deepStrictEqual(filas.map((f) => [f.modulo, f.rol]), [['seguimiento', null]]);
  });
});
