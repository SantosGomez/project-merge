const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { importarCuentas } = require('../src/utils/importarCuentas');
const UserModel = require('../src/models/UserModel');
const { verifyPassword } = require('../src/utils/passwordUtils');

/**
 * Pruebas de la importación de cuentas desde la lista revisada del Excel.
 * Usan correos `zz_test_…@prueba.local` únicos; la limpieza los borra al final.
 */

// Correo único de prueba; se registra para que la limpieza lo borre.
function correoDePrueba(prefijo) {
  const correo = `zz_test_${prefijo}_${crypto.randomBytes(4).toString('hex')}@prueba.local`;
  registrarUsuarioCreado(correo);
  return correo;
}

async function testImportaCuentasNuevasConNombreCorreoYRol() {
  const correo = correoDePrueba('importa');
  const resultado = await importarCuentas([
    { nombre: 'LUCIA DEL ANGEL HERNANDEZ', correo: `  ${correo.toUpperCase()} `, rol: 'contador', password: 'Lucia1234' },
  ]);

  assert.deepStrictEqual(resultado.creadas, [correo], 'reporta la cuenta creada con su correo normalizado');

  const cuenta = await UserModel.findByCorreo(correo);
  assert.ok(cuenta, 'la cuenta existe y se encuentra por correo');
  assert.strictEqual(cuenta.nombre, 'LUCIA DEL ANGEL HERNANDEZ');
  assert.strictEqual(cuenta.correo, correo, 'el correo se guarda recortado y en minúsculas');
  assert.strictEqual(cuenta.rol, 'contador');
  assert.ok(cuenta.password_hash.startsWith('$argon2id$'), 'la contraseña se guarda con Argon2id');
  assert.ok(await verifyPassword('Lucia1234', cuenta.password_hash), 'la contraseña temporal sirve');
  assert.ok(cuenta.actualizado_en, 'actualizado_en se llena al crear');
}

async function testCorrerDosVecesNoDuplicaNiCambiaContrasenas() {
  const correo = correoDePrueba('dos_veces');
  await importarCuentas([{ nombre: 'FERNANDO TREJO PEREZ', correo, rol: 'contador', password: 'Fernando1234' }]);

  // La persona ya cambió su contraseña; una segunda importación no debe pisarla.
  const resultado = await importarCuentas([
    { nombre: 'FERNANDO TREJO PEREZ', correo: correo.toUpperCase(), rol: 'contador', password: 'OtraClave1234' },
  ]);

  assert.deepStrictEqual(resultado.creadas, [], 'no crea nada la segunda vez');
  assert.deepStrictEqual(resultado.yaExistian, [correo], 'reporta que la cuenta ya existía');

  const filas = await UserModel.findAll();
  assert.strictEqual(filas.filter((fila) => fila.correo === correo).length, 1, 'no duplica la cuenta');
  const cuenta = await UserModel.findByCorreo(correo);
  assert.ok(await verifyPassword('Fernando1234', cuenta.password_hash), 'conserva la contraseña que ya tenía');
}

async function testFilasInvalidasSeReportanSinDetenerLasDemas() {
  const valida = correoDePrueba('valida');
  const auxiliar = correoDePrueba('auxiliar');
  // Si la validación fallara, esta fila se crearía: se registra para que la limpieza la borre.
  registrarUsuarioCreado('sin-arroba.delgrow.mx');
  const resultado = await importarCuentas([
    { nombre: 'SIN CORREO', correo: '   ', rol: 'contador', password: 'Valida1234' },
    { nombre: 'CORREO RARO', correo: 'sin-arroba.delgrow.mx', rol: 'contador', password: 'Valida1234' },
    { nombre: 'ROL RARO', correo: correoDePrueba('rol'), rol: 'Pract_Contador', password: 'Valida1234' },
    { nombre: 'CLAVE CORTA', correo: correoDePrueba('corta'), rol: 'contador', password: 'Ana1234' },
    { nombre: '  ', correo: correoDePrueba('sin_nombre'), rol: 'contador', password: 'Valida1234' },
    { nombre: 'PERLA AURORA TORRES MAZARIEGOS', correo: valida, rol: 'contador', password: 'Perla1234' },
    { nombre: 'AUXILIAR DE PRUEBA', correo: auxiliar, rol: 'auxiliar', password: 'Auxiliar1234' },
  ]);

  assert.deepStrictEqual(
    resultado.creadas,
    [valida, auxiliar],
    'las filas válidas (también la del auxiliar) se crean aunque haya errores antes'
  );
  assert.deepStrictEqual(
    resultado.conError.map((error) => [error.fila, error.motivo]),
    [
      [1, 'falta el correo'],
      [2, 'el correo no es válido'],
      [3, 'el rol no es administrador, contador, auxiliar ni usuarios_de_sistema'],
      [4, 'la contraseña tiene menos de 8 caracteres'],
      [5, 'falta el nombre'],
    ],
    'cada error dice la fila (empezando en 1) y el motivo'
  );
  assert.strictEqual(await UserModel.findByCorreo(resultado.conError[2].correo), null, 'no crea la fila inválida');
}

describe('importación de cuentas', () => {
  before(async () => {
    await prepararBaseDeDatos();
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('crea las cuentas nuevas con nombre, correo, rol y contraseña Argon2id', testImportaCuentasNuevasConNombreCorreoYRol);
  test('correrlo dos veces no duplica ni cambia contraseñas ya puestas', testCorrerDosVecesNoDuplicaNiCambiaContrasenas);
  test('una fila inválida se reporta y no detiene las demás', testFilasInvalidasSeReportanSinDetenerLasDemas);
});
