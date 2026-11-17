const { hashPassword } = require('./passwordUtils');
const { esCorreoValido } = require('./validationUtils');
const UserModel = require('../models/UserModel');

const ROLES_VALIDOS = ['administrador', 'contador', 'usuarios_de_sistema', 'auxiliar'];
const MIN_PASSWORD = 8;

/**
 * Motivo por el que una fila no se puede importar, o null si es válida.
 * @param {{ nombre: string, correo: string, rol: string, password: string }} cuenta
 * @returns {string|null} motivo en español.
 */
function motivoDeError({ nombre, correo, rol, password }) {
  if (!correo) return 'falta el correo';
  if (!esCorreoValido(correo)) return 'el correo no es válido';
  if (!nombre) return 'falta el nombre';
  if (!ROLES_VALIDOS.includes(rol)) return 'el rol no es administrador, contador, auxiliar ni usuarios_de_sistema';
  if (password.length < MIN_PASSWORD) return 'la contraseña tiene menos de 8 caracteres';
  return null;
}

/**
 * Importa cuentas desde la lista revisada del Excel de DelGrow.
 * Cada cuenta trae { nombre, correo, rol, password }; la contraseña se guarda con Argon2id.
 * Se puede correr varias veces: una cuenta cuyo correo ya existe no se toca (ni su contraseña).
 * Una fila inválida se reporta y no detiene las demás.
 * @param {Array<{ nombre: string, correo: string, rol: string, password: string }>} cuentas
 * @returns {Promise<{ creadas: string[], yaExistian: string[], conError: Array<{ fila: number, correo: string, motivo: string }> }>}
 */
async function importarCuentas(cuentas) {
  const creadas = [];
  const yaExistian = [];
  const conError = [];

  for (const [indice, cuenta] of cuentas.entries()) {
    const datos = {
      nombre: String(cuenta.nombre ?? '').trim(),
      correo: String(cuenta.correo ?? '').trim().toLowerCase(),
      rol: cuenta.rol,
      password: String(cuenta.password ?? '').trim(),
    };

    const motivo = motivoDeError(datos);
    if (motivo) {
      conError.push({ fila: indice + 1, correo: datos.correo, motivo });
      continue;
    }

    if (await UserModel.findByCorreo(datos.correo)) {
      yaExistian.push(datos.correo);
      continue;
    }

    await UserModel.create({
      nombre: datos.nombre,
      correo: datos.correo,
      passwordHash: await hashPassword(datos.password),
      rol: datos.rol,
    });
    creadas.push(datos.correo);
  }

  return { creadas, yaExistian, conError };
}

/**
 * Modo consola: `node src/utils/importarCuentas.js cuentas.local.json`.
 * Crea primero las tablas y columnas que falten y muestra un resumen sin contraseñas.
 * @param {string} ruta - archivo JSON con la lista de cuentas.
 */
async function ejecutarDesdeConsola(ruta) {
  require('dotenv').config();
  const fs = require('fs');
  const { pool } = require('../config/db');
  const { seedDatabase } = require('./seed');

  try {
    const cuentas = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    await seedDatabase();
    const { creadas, yaExistian, conError } = await importarCuentas(cuentas);

    console.log(`Cuentas creadas: ${creadas.length}`);
    console.log(`Ya existían (sin cambios): ${yaExistian.length}`);
    console.log(`Con error: ${conError.length}`);
    for (const { fila, correo, motivo } of conError) {
      console.log(`  fila ${fila} (${correo || 'sin correo'}): ${motivo}`);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const ruta = process.argv[2];
  if (!ruta) {
    console.error('Uso: node src/utils/importarCuentas.js <archivo.json>');
    process.exit(1);
  }
  ejecutarDesdeConsola(ruta).catch((error) => {
    console.error(`No se pudo importar: ${require('./bitacoraSeguridad').limpiarMensaje(error.message)}`);
    process.exit(1);
  });
}

module.exports = { importarCuentas };
