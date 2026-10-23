const assert = require('node:assert');
const { describe, test } = require('node:test');
const {
  validateLoginInput,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
} = require('../src/utils/validationUtils');

/**
 * Pruebas de validación de entrada (RF-02, RF-19, RF-20, RF-21).
 * Funciones síncronas, sin dependencias externas.
 */

// RF-02: usuario y contraseña vacíos -> faltantes ambos
function testLoginInputCamposVacios() {
  const resultado = validateLoginInput('', '');
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.faltantes, ['usuario', 'contraseña']);
}

// RF-02: solo espacios -> se tratan como vacíos
function testLoginInputSoloEspacios() {
  const resultado = validateLoginInput('   ', '   ');
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.faltantes, ['usuario', 'contraseña']);
}

// RF-02: solo usuario faltante
function testLoginInputFaltaUsuario() {
  const resultado = validateLoginInput('', 'password123');
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.faltantes, ['usuario']);
}

// RF-02: solo contraseña faltante
function testLoginInputFaltaContrasena() {
  const resultado = validateLoginInput('usuario1', '');
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.faltantes, ['contraseña']);
}

// RF-02: ambos válidos
function testLoginInputValido() {
  const resultado = validateLoginInput('usuario1', 'password123');
  assert.strictEqual(resultado.valido, true);
  assert.deepStrictEqual(resultado.faltantes, []);
}

// RF-19: cliente vacío
function testNuevoCasoClienteVacio() {
  const resultado = validateNewCaseInput('', 'Alta');
  assert.strictEqual(resultado.valido, false);
  assert.strictEqual(resultado.error, 'cliente_requerido');
}

// RF-19: cliente solo espacios
function testNuevoCasoClienteSoloEspacios() {
  const resultado = validateNewCaseInput('   ', 'Media');
  assert.strictEqual(resultado.valido, false);
  assert.strictEqual(resultado.error, 'cliente_requerido');
}

// RF-21: cliente más de 80 caracteres (después de trim)
function testNuevoCasoClienteDemasiadoLargo() {
  const clienteLargo = 'cliente '.repeat(12); // 95 caracteres tras trim
  const resultado = validateNewCaseInput(clienteLargo, 'Baja');
  assert.strictEqual(resultado.valido, false);
  assert.strictEqual(resultado.error, 'cliente_demasiado_largo');
}

// RF-21: cliente exactamente 80 caracteres es válido
function testNuevoCasoClienteExactamente80() {
  const cliente80 = 'a'.repeat(80);
  const resultado = validateNewCaseInput(cliente80, 'Alta');
  assert.strictEqual(resultado.valido, true);
  assert.strictEqual(resultado.error, null);
}

// RF-20: prioridad vacía
function testNuevoCasoPrioridadVacia() {
  const resultado = validateNewCaseInput('Cliente X', '');
  assert.strictEqual(resultado.valido, false);
  assert.strictEqual(resultado.error, 'prioridad_requerida');
}

// RF-20: prioridad inválida
function testNuevoCasoPrioridadInvalida() {
  const resultado = validateNewCaseInput('Cliente X', 'Urgente');
  assert.strictEqual(resultado.valido, false);
  assert.strictEqual(resultado.error, 'prioridad_invalida');
}

// RF-19, RF-20, RF-21: cliente y prioridad válidos
function testNuevoCasoValido() {
  const resultado = validateNewCaseInput('Cliente X', 'Alta');
  assert.strictEqual(resultado.valido, true);
  assert.strictEqual(resultado.error, null);
}

// validateStatus: estados válidos
function testStatusValidos() {
  assert.strictEqual(validateStatus('Pendiente'), true);
  assert.strictEqual(validateStatus('En proceso'), true);
  assert.strictEqual(validateStatus('Finalizado'), true);
}

// validateStatus: estados inválidos
function testStatusInvalidos() {
  assert.strictEqual(validateStatus('Cancelado'), false);
  assert.strictEqual(validateStatus(''), false);
  assert.strictEqual(validateStatus(null), false);
  assert.strictEqual(validateStatus('pendiente'), false); // distingue mayúsculas
}

// validatePriority: prioridades válidas
function testPrioridadesValidas() {
  assert.strictEqual(validatePriority('Alta'), true);
  assert.strictEqual(validatePriority('Media'), true);
  assert.strictEqual(validatePriority('Baja'), true);
}

// validatePriority: prioridades inválidas
function testPrioridadesInvalidas() {
  assert.strictEqual(validatePriority('Urgente'), false);
  assert.strictEqual(validatePriority(''), false);
  assert.strictEqual(validatePriority(null), false);
  assert.strictEqual(validatePriority('alta'), false); // distingue mayúsculas
}

// RF-37: ejecuta la validación y hace fallar la prueba si la función lanza
function ejecutarSinLanzar(validar) {
  let resultado;
  assert.doesNotThrow(() => {
    resultado = validar();
  }, 'la validación no debe lanzar con un dato que no es texto');
  return resultado;
}

// RF-37: usuario numérico -> tipo inválido en usuario
function testLoginInputUsuarioNoTexto() {
  const resultado = ejecutarSinLanzar(() => validateLoginInput(123, 'Secreta123'));
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.tipoInvalido, ['usuario']);
}

// RF-37: contraseña numérica -> tipo inválido en contraseña
function testLoginInputContrasenaNoTexto() {
  const resultado = ejecutarSinLanzar(() => validateLoginInput('ana', 12345));
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.tipoInvalido, ['contraseña']);
}

// RF-37: usuario y contraseña como objetos -> tipo inválido en ambos
function testLoginInputAmbosObjetos() {
  const resultado = ejecutarSinLanzar(() => validateLoginInput({}, {}));
  assert.strictEqual(resultado.valido, false);
  assert.deepStrictEqual(resultado.tipoInvalido, ['usuario', 'contraseña']);
}

// RF-37: cliente como lista -> cliente_tipo_invalido
function testNuevoCasoClienteLista() {
  const resultado = ejecutarSinLanzar(() => validateNewCaseInput(['Cliente'], 'Alta'));
  assert.deepStrictEqual(resultado, { valido: false, error: 'cliente_tipo_invalido' });
}

// RF-37: prioridad booleana -> prioridad_tipo_invalida
function testNuevoCasoPrioridadBooleana() {
  const resultado = ejecutarSinLanzar(() => validateNewCaseInput('Cliente', true));
  assert.deepStrictEqual(resultado, { valido: false, error: 'prioridad_tipo_invalida' });
}

// RF-37: cliente como objeto -> cliente_tipo_invalido
function testNuevoCasoClienteObjeto() {
  const resultado = ejecutarSinLanzar(() => validateNewCaseInput({}, 'Alta'));
  assert.deepStrictEqual(resultado, { valido: false, error: 'cliente_tipo_invalido' });
}

describe('validationUtils', () => {
  test('testLoginInputCamposVacios', testLoginInputCamposVacios);
  test('testLoginInputSoloEspacios', testLoginInputSoloEspacios);
  test('testLoginInputFaltaUsuario', testLoginInputFaltaUsuario);
  test('testLoginInputFaltaContrasena', testLoginInputFaltaContrasena);
  test('testLoginInputValido', testLoginInputValido);
  test('testNuevoCasoClienteVacio', testNuevoCasoClienteVacio);
  test('testNuevoCasoClienteSoloEspacios', testNuevoCasoClienteSoloEspacios);
  test('testNuevoCasoClienteDemasiadoLargo', testNuevoCasoClienteDemasiadoLargo);
  test('testNuevoCasoClienteExactamente80', testNuevoCasoClienteExactamente80);
  test('testNuevoCasoPrioridadVacia', testNuevoCasoPrioridadVacia);
  test('testNuevoCasoPrioridadInvalida', testNuevoCasoPrioridadInvalida);
  test('testNuevoCasoValido', testNuevoCasoValido);
  test('testStatusValidos', testStatusValidos);
  test('testStatusInvalidos', testStatusInvalidos);
  test('testPrioridadesValidas', testPrioridadesValidas);
  test('testPrioridadesInvalidas', testPrioridadesInvalidas);
  test('testLoginInputUsuarioNoTexto', testLoginInputUsuarioNoTexto);
  test('testLoginInputContrasenaNoTexto', testLoginInputContrasenaNoTexto);
  test('testLoginInputAmbosObjetos', testLoginInputAmbosObjetos);
  test('testNuevoCasoClienteLista', testNuevoCasoClienteLista);
  test('testNuevoCasoPrioridadBooleana', testNuevoCasoPrioridadBooleana);
  test('testNuevoCasoClienteObjeto', testNuevoCasoClienteObjeto);
});
