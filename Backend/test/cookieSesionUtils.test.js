const assert = require('node:assert');
const { describe, test } = require('node:test');
const {
  NOMBRE_COOKIE_SESION,
  leerCookie,
  construirCookieSesion,
  construirCookieBorrada,
} = require('../src/utils/cookieSesion');

/**
 * Pruebas puras de la cookie de sesión (rebanada S8): lectura de la cabecera Cookie
 * y construcción de Set-Cookie. No tocan la base de datos.
 */

describe('cookie de sesión (utilidades)', () => {
  test('leerCookie encuentra la cookie entre varias', () => {
    assert.strictEqual(leerCookie(`a=1; ${NOMBRE_COOKIE_SESION}=abc.def.ghi; b=2`, NOMBRE_COOKIE_SESION), 'abc.def.ghi');
  });

  test('leerCookie devuelve null sin cabecera, sin la cookie o con valor vacío', () => {
    assert.strictEqual(leerCookie(undefined, NOMBRE_COOKIE_SESION), null);
    assert.strictEqual(leerCookie('a=1', NOMBRE_COOKIE_SESION), null);
    assert.strictEqual(leerCookie(`${NOMBRE_COOKIE_SESION}=`, NOMBRE_COOKIE_SESION), null);
    assert.strictEqual(leerCookie(`x${NOMBRE_COOKIE_SESION}=otra`, NOMBRE_COOKIE_SESION), null);
  });

  test('construirCookieSesion de sesión: HttpOnly, SameSite=Strict, Path=/, sin Max-Age ni Secure', () => {
    const c = construirCookieSesion('tok', { persistente: false, seguro: false });
    assert.ok(c.startsWith(`${NOMBRE_COOKIE_SESION}=tok;`));
    assert.match(c, /; HttpOnly/);
    assert.match(c, /; SameSite=Strict/);
    assert.match(c, /; Path=\//);
    assert.doesNotMatch(c, /Max-Age/i);
    assert.doesNotMatch(c, /Secure/);
  });

  test('construirCookieSesion persistente lleva Max-Age de 30 días y con HTTPS, Secure', () => {
    const c = construirCookieSesion('tok', { persistente: true, seguro: true });
    assert.match(c, /; Max-Age=2592000/);
    assert.match(c, /; Secure/);
  });

  test('construirCookieBorrada caduca la cookie al instante', () => {
    const c = construirCookieBorrada(true);
    assert.match(c, new RegExp(`^${NOMBRE_COOKIE_SESION}=;`));
    assert.match(c, /; Max-Age=0/);
    assert.match(c, /; HttpOnly/);
    assert.match(c, /; Secure/);
  });
});
