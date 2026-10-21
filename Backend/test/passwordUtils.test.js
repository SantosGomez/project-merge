const assert = require('node:assert');
const { describe, test } = require('node:test');
const { hashPassword, verifyPassword } = require('../src/utils/passwordUtils');

/**
 * Pruebas de utilidades de contraseña con Argon2id (RNF-1, RF-03).
 * Todas las funciones son async, por eso se usa async/await.
 */

// hashPassword debe devolver un string (hash) no vacío
async function testHashPasswordDevuelveString() {
  const hash = await hashPassword('miPassword123');
  assert.strictEqual(typeof hash, 'string', 'hashPassword debe devolver un string');
  assert.ok(hash.length > 0, 'el hash no debe estar vacío');
}

// verifyPassword debe devolver true con la contraseña correcta
async function testVerifyPasswordContrasenaCorrecta() {
  const hash = await hashPassword('miPassword123');
  const resultado = await verifyPassword('miPassword123', hash);
  assert.strictEqual(resultado, true, 'verifyPassword debe devolver true para la contraseña correcta');
}

// verifyPassword debe devolver false con contraseña incorrecta
async function testVerifyPasswordContrasenaIncorrecta() {
  const hash = await hashPassword('miPassword123');
  const resultado = await verifyPassword('otraPassword', hash);
  assert.strictEqual(resultado, false, 'verifyPassword debe devolver false para contraseña incorrecta');
}

// Diferentes contraseñas generan hashes diferentes
async function testHashesDiferentesParaContrasenasDiferentes() {
  const hash1 = await hashPassword('contrasenaA');
  const hash2 = await hashPassword('contrasenaB');
  assert.notStrictEqual(hash1, hash2, 'hashes de contraseñas distintas no deben ser iguales');
}

describe('passwordUtils', () => {
  test('testHashPasswordDevuelveString', testHashPasswordDevuelveString);
  test('testVerifyPasswordContrasenaCorrecta', testVerifyPasswordContrasenaCorrecta);
  test('testVerifyPasswordContrasenaIncorrecta', testVerifyPasswordContrasenaIncorrecta);
  test('testHashesDiferentesParaContrasenasDiferentes', testHashesDiferentesParaContrasenasDiferentes);
});
