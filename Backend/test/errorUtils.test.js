const assert = require('node:assert');
const { describe, test } = require('node:test');
const { buildError } = require('../src/utils/errorUtils');

/**
 * Pruebas de utilidad de errores (RF-23, RNF-5, RNF-6).
 * Función síncrona; construye mensajes de error con tres partes en español.
 */

// buildError devuelve mensaje con las tres partes: qué ocurrió, sobre qué, qué hacer
function testBuildErrorTresPartes() {
  const resultado = buildError('ocurrió algo', 'el campo X', 'haz esto');
  assert.strictEqual(typeof resultado, 'object', 'buildError debe devolver un objeto');
  assert.ok(resultado.mensaje, 'el objeto debe tener la propiedad mensaje');
  assert.strictEqual(
    resultado.mensaje,
    'ocurrió algo sobre el campo X: haz esto',
    'el mensaje debe combinar las tres partes'
  );
  assert.ok(resultado.mensaje.includes('ocurrió algo'), 'el mensaje debe incluir qué ocurrió');
  assert.ok(resultado.mensaje.includes('el campo X'), 'el mensaje debe incluir sobre qué dato o acción');
  assert.ok(resultado.mensaje.includes('haz esto'), 'el mensaje debe incluir qué hacer');
}

// El mensaje está en español y no es ambiguo
function testBuildErrorMensajeEnEspanolNoAmbiguo() {
  const resultado = buildError('Credenciales no válidas', 'usuario o contraseña', 'Verifique sus datos e intente nuevamente');
  assert.ok(resultado.mensaje.includes('Credenciales no válidas'), 'mensaje en español: qué ocurrió');
  assert.ok(resultado.mensaje.includes('usuario o contraseña'), 'mensaje en español: sobre qué');
  assert.ok(resultado.mensaje.includes('Verifique sus datos e intente nuevamente'), 'mensaje en español: qué hacer');
  // No debe contener texto en inglés ambiguo
  assert.ok(!/error|invalid|failed|unauthorized/i.test(resultado.mensaje), 'el mensaje no debe contener términos ambiguos en inglés');
}

describe('errorUtils', () => {
  test('testBuildErrorTresPartes', testBuildErrorTresPartes);
  test('testBuildErrorMensajeEnEspanolNoAmbiguo', testBuildErrorMensajeEnEspanolNoAmbiguo);
});
