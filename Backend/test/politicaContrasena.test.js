const assert = require('node:assert');
const { describe, test } = require('node:test');
const { validarPasswordNueva } = require('../src/utils/validationUtils');

/**
 * Política de contraseñas (S2): mínimo 12 caracteres y sin contraseñas comunes o triviales.
 * Una sola función para alta, restablecimiento, cambio asignado y cambio propio.
 */

describe('validarPasswordNueva', () => {
  test('acepta una contraseña de 12 caracteres o más que no es común', () => {
    assert.deepStrictEqual(validarPasswordNueva('Rio-Azul-4821'), { valida: true });
    assert.deepStrictEqual(validarPasswordNueva('AsignadaAdmin1'), { valida: true });
  });

  test('rechaza menos de 12 caracteres con mensaje en tres partes', () => {
    const resultado = validarPasswordNueva('Corta12345X');
    assert.strictEqual(resultado.valida, false);
    assert.match(resultado.error.mensaje, /^Contraseña inválida sobre contraseña: .*al menos 12 caracteres/);
  });

  test('rechaza contraseñas comunes aunque midan 12 o más', () => {
    for (const comun of ['password1234', 'Contraseña1234', 'qwertyuiop12', '123456789012', 'aaaaaaaaaaaa', 'DelGrow123456']) {
      const resultado = validarPasswordNueva(comun);
      assert.strictEqual(resultado.valida, false, `${comun} debe rechazarse`);
      assert.match(resultado.error.mensaje, /demasiado común/);
    }
  });

  test('rechaza lo que no es texto o está vacío', () => {
    for (const malo of [undefined, null, '', '            ', 12345678901234, ['ClaveLarga1234']]) {
      const resultado = validarPasswordNueva(malo);
      assert.strictEqual(resultado.valida, false);
      assert.match(resultado.error.mensaje, /^Contraseña inválida sobre contraseña: /);
    }
  });
});
