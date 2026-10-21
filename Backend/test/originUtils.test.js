const assert = require('node:assert');
const { describe, test } = require('node:test');
const { parseAllowedOrigins, isOriginAllowed } = require('../src/utils/originUtils');

/**
 * Pruebas de las funciones puras de orígenes permitidos (RF-34, criterios 24 y 28).
 *
 * Requieren que exista `src/utils/originUtils.js` (tarea T22).
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T21.
 *
 * No usan Express, ni el entorno, ni la base de datos.
 */

// Orígenes locales de desarrollo del frontend web (plan 8.4).
const ORIGENES_POR_DEFECTO = ['http://localhost:9000', 'http://127.0.0.1:9000'];

// RF-34: texto separado por comas con espacios alrededor -> lista recortada
function testParseListaConComasYEspacios() {
  const resultado = parseAllowedOrigins('http://localhost:9000, http://127.0.0.1:9000');
  assert.deepStrictEqual(resultado, ORIGENES_POR_DEFECTO);
}

// RF-34: la barra final de cada origen se quita para comparar de forma exacta
function testParseQuitaBarraFinal() {
  assert.deepStrictEqual(parseAllowedOrigins('http://localhost:9000/'), ['http://localhost:9000']);
  assert.deepStrictEqual(
    parseAllowedOrigins('http://localhost:9000/, http://127.0.0.1:9000/'),
    ORIGENES_POR_DEFECTO
  );
}

// RF-34: variable vacía -> orígenes locales de desarrollo por defecto
function testParseVacioDevuelveOrigenesPorDefecto() {
  assert.deepStrictEqual(parseAllowedOrigins(''), ORIGENES_POR_DEFECTO);
}

// RF-34: variable ausente -> orígenes locales de desarrollo por defecto
function testParseUndefinedDevuelveOrigenesPorDefecto() {
  assert.deepStrictEqual(parseAllowedOrigins(undefined), ORIGENES_POR_DEFECTO);
}

// RF-34: un origen de la lista se acepta tal cual
function testIsOriginAllowedOrigenExacto() {
  const permitidos = ['http://localhost:9000'];
  assert.strictEqual(isOriginAllowed('http://localhost:9000', permitidos), true);
  assert.strictEqual(isOriginAllowed('http://127.0.0.1:9000', ORIGENES_POR_DEFECTO), true);
}

// RF-34: otro puerto local y otro host se rechazan (comparación exacta)
function testIsOriginAllowedRechazaOtroPuertoYOtroHost() {
  const permitidos = ['http://localhost:9000'];
  assert.strictEqual(isOriginAllowed('http://localhost:9001', permitidos), false);
  assert.strictEqual(isOriginAllowed('http://localhost:3000', permitidos), false);
  assert.strictEqual(isOriginAllowed('http://otro-sitio.example:9000', permitidos), false);
}

// RF-34: sin origen, vacío o con otras mayúsculas no se acepta
function testIsOriginAllowedRechazaVacioNuloYMayusculas() {
  const permitidos = ['http://localhost:9000'];
  assert.strictEqual(isOriginAllowed(null, permitidos), false);
  assert.strictEqual(isOriginAllowed('', permitidos), false);
  assert.strictEqual(isOriginAllowed('http://LOCALHOST:9000', permitidos), false);
}

describe('originUtils', () => {
  test('testParseListaConComasYEspacios', testParseListaConComasYEspacios);
  test('testParseQuitaBarraFinal', testParseQuitaBarraFinal);
  test('testParseVacioDevuelveOrigenesPorDefecto', testParseVacioDevuelveOrigenesPorDefecto);
  test('testParseUndefinedDevuelveOrigenesPorDefecto', testParseUndefinedDevuelveOrigenesPorDefecto);
  test('testIsOriginAllowedOrigenExacto', testIsOriginAllowedOrigenExacto);
  test('testIsOriginAllowedRechazaOtroPuertoYOtroHost', testIsOriginAllowedRechazaOtroPuertoYOtroHost);
  test('testIsOriginAllowedRechazaVacioNuloYMayusculas', testIsOriginAllowedRechazaVacioNuloYMayusculas);
});
