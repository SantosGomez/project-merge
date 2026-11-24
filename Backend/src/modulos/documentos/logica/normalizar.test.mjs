import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarParaBuscar, normalizarRfc } from './normalizar.mjs';

describe('normalizarParaBuscar (RF-7.4)', () => {
  test('convierte a minúsculas', () => {
    assert.strictEqual(normalizarParaBuscar('EMPRESA'), 'empresa');
    assert.strictEqual(normalizarParaBuscar('Grupo DCA'), 'grupo dca');
  });

  test('elimina acentos y tildes', () => {
    assert.strictEqual(normalizarParaBuscar('Pérez'), 'perez');
    assert.strictEqual(normalizarParaBuscar('Ángel Martín'), 'angel martin');
    assert.strictEqual(normalizarParaBuscar('Último Órgano'), 'ultimo organo');
  });

  test('maneja valores no string de forma segura', () => {
    assert.strictEqual(normalizarParaBuscar(null), '');
    assert.strictEqual(normalizarParaBuscar(undefined), '');
    assert.strictEqual(normalizarParaBuscar(123), '');
  });

  test('recorta espacios en los bordes', () => {
    assert.strictEqual(normalizarParaBuscar('   Pérez   '), 'perez');
  });
});

describe('normalizarRfc (RF-7.4)', () => {
  test('elimina guiones y espacios', () => {
    assert.strictEqual(normalizarRfc('CNO-120415-AB3'), 'CNO120415AB3');
    assert.strictEqual(normalizarRfc('CNO 120415 AB3'), 'CNO120415AB3');
    assert.strictEqual(normalizarRfc('  cno-120415-ab3  '), 'CNO120415AB3');
  });

  test('maneja valores no string de forma segura', () => {
    assert.strictEqual(normalizarRfc(null), '');
    assert.strictEqual(normalizarRfc(undefined), '');
    assert.strictEqual(normalizarRfc(123), '');
  });
});
