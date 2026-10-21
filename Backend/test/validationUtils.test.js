const assert = require('node:assert');
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

module.exports = {
  testLoginInputCamposVacios,
  testLoginInputSoloEspacios,
  testLoginInputFaltaUsuario,
  testLoginInputFaltaContrasena,
  testLoginInputValido,
  testNuevoCasoClienteVacio,
  testNuevoCasoClienteSoloEspacios,
  testNuevoCasoClienteDemasiadoLargo,
  testNuevoCasoClienteExactamente80,
  testNuevoCasoPrioridadVacia,
  testNuevoCasoPrioridadInvalida,
  testNuevoCasoValido,
  testStatusValidos,
  testStatusInvalidos,
  testPrioridadesValidas,
  testPrioridadesInvalidas,
};
