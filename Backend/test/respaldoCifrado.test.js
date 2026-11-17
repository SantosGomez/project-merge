const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { cifrar, descifrar, carpetaDeRespaldos, nombreDeRespaldo } = require('../soporte-pruebas/respaldarBd');

const FRASE = 'frase-de-prueba-larga-123';
const SQL = Buffer.from('CREATE TABLE zz_test_x (id INT);\nINSERT INTO zz_test_x VALUES (1);\n');

test('cifrar y descifrar devuelven el contenido original', () => {
  const paquete = cifrar(SQL, FRASE);
  assert.ok(!paquete.includes(SQL.subarray(0, 12)), 'el texto en claro no debe verse en el paquete');
  assert.deepEqual(descifrar(paquete, FRASE), SQL);
});

test('dos cifrados del mismo contenido difieren (sal e IV aleatorios)', () => {
  assert.notDeepEqual(cifrar(SQL, FRASE), cifrar(SQL, FRASE));
});

test('un byte alterado hace fallar el descifrado', () => {
  const paquete = cifrar(SQL, FRASE);
  for (const posicion of [2, 10, 30, 50, paquete.length - 1]) {
    const alterado = Buffer.from(paquete);
    alterado[posicion] ^= 0x01;
    assert.throws(() => descifrar(alterado, FRASE), /respaldo|descifrar/i, `posición ${posicion}`);
  }
});

test('una frase incorrecta falla', () => {
  assert.throws(() => descifrar(cifrar(SQL, FRASE), 'otra-frase-larga-456'), /frase es incorrecta/);
});

test('rechaza frase ausente o corta y archivos que no son respaldos', () => {
  assert.throws(() => cifrar(SQL, undefined), /RESPALDO_FRASE/);
  assert.throws(() => cifrar(SQL, 'corta'), /RESPALDO_FRASE/);
  assert.throws(() => descifrar(Buffer.from('hola'), FRASE), /no es un respaldo/);
});

test('la carpeta por omisión está en el directorio del usuario y se puede configurar', () => {
  assert.equal(carpetaDeRespaldos({}), path.join(os.homedir(), 'respaldos-seguimiento-proyectos'));
  assert.equal(carpetaDeRespaldos({ RESPALDO_CARPETA: 'D:\\otra' }), 'D:\\otra');
  assert.match(nombreDeRespaldo(new Date(2026, 10, 17, 9, 5)), /^respaldo-2026-11-17-0905\.sql\.cifrado$/);
});
