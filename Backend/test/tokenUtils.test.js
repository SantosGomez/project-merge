const assert = require('node:assert');
const { describe, test } = require('node:test');
const {
  generateAccessToken,
  verifyAccessToken,
  isTokenExpired,
} = require('../src/utils/tokenUtils');

/**
 * Pruebas de utilidades de tokens JWT (RF-01, RF-04, RF-05, RF-25, RF-26).
 * Funciones síncronas; isTokenExpired recibe `hoy` inyectado para ser determinista.
 */

// generateAccessToken devuelve un string JWT válido
function testGenerateAccessTokenDevuelveStringJWT() {
  const token = generateAccessToken(
    { id: 1, usuario: 'admin', rol: 'administrador' },
    'secreto',
    '1h'
  );
  assert.strictEqual(typeof token, 'string', 'generateAccessToken debe devolver un string');
  assert.ok(token.length > 0, 'el token no debe estar vacío');
  const partes = token.split('.');
  assert.strictEqual(partes.length, 3, 'un JWT válido tiene 3 partes separadas por puntos');
}

// verifyAccessToken con token válido -> { valido: true, payload, error: null }
function testVerifyAccessTokenValido() {
  const token = generateAccessToken(
    { id: 1, usuario: 'admin', rol: 'administrador' },
    'secreto',
    '1h'
  );
  const resultado = verifyAccessToken(token, 'secreto');
  assert.strictEqual(resultado.valido, true, 'verifyAccessToken debe devolver valido: true para un token válido');
  assert.deepStrictEqual(resultado.payload, { id: 1, usuario: 'admin', rol: 'administrador' });
  assert.strictEqual(resultado.error, null, 'el error debe ser null para un token válido');
}

// verifyAccessToken con token inválido -> { valido: false, payload: null, error: 'token_invalido' }
function testVerifyAccessTokenInvalido() {
  const resultado = verifyAccessToken('token.invalido.xyz', 'secreto');
  assert.strictEqual(resultado.valido, false, 'verifyAccessToken debe devolver valido: false para un token inválido');
  assert.strictEqual(resultado.payload, null, 'el payload debe ser null para un token inválido');
  assert.strictEqual(resultado.error, 'token_invalido', 'el error debe ser token_invalido para un token inválido');
}

// isTokenExpired con token vencido -> true (hoy inyectado)
function testIsTokenExpiredTokenVencido() {
  const tokenVencido = generateAccessToken(
    { id: 1, usuario: 'admin', rol: 'administrador' },
    'secreto',
    '1s'
  );
  const hoyEnElFuturo = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas después
  assert.strictEqual(
    isTokenExpired(tokenVencido, hoyEnElFuturo),
    true,
    'isTokenExpired debe devolver true cuando el token ya expiró respecto a hoy'
  );
}

// isTokenExpired con token válido -> false (hoy inyectado)
function testIsTokenExpiredTokenValido() {
  const tokenValido = generateAccessToken(
    { id: 1, usuario: 'admin', rol: 'administrador' },
    'secreto',
    '1h'
  );
  const hoy = new Date();
  assert.strictEqual(
    isTokenExpired(tokenValido, hoy),
    false,
    'isTokenExpired debe devolver false cuando el token aún no ha expirado respecto a hoy'
  );
}

describe('tokenUtils', () => {
  test('testGenerateAccessTokenDevuelveStringJWT', testGenerateAccessTokenDevuelveStringJWT);
  test('testVerifyAccessTokenValido', testVerifyAccessTokenValido);
  test('testVerifyAccessTokenInvalido', testVerifyAccessTokenInvalido);
  test('testIsTokenExpiredTokenVencido', testIsTokenExpiredTokenVencido);
  test('testIsTokenExpiredTokenValido', testIsTokenExpiredTokenValido);
});
