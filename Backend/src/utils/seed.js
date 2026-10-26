const { query } = require('../config/db');
const { hashPassword } = require('../utils/passwordUtils');
const UserModel = require('../models/UserModel');

// Credenciales placeholder del seed (cargadas desde otra base de datos posteriormente, RF-27).
// Las cuentas del seed se reconocen por su correo (rebanada 5c); el nombre es el mismo de siempre.
const ADMIN_NOMBRE = 'admin_seed';
const ADMIN_CORREO = 'admin_seed@prueba.local';
const ADMIN_PASSWORD = 'Admin1234';
const CONTADOR_NOMBRE = 'contador_seed';
const CONTADOR_CORREO = 'contador_seed@prueba.local';
const CONTADOR_PASSWORD = 'Contador1234';

/**
 * Crea las tablas de la base de datos si no existen: usuarios, casos y sesiones.
 * RF-27.
 */
async function crearTablasSiNoExisten() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      correo VARCHAR(150) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol ENUM('administrador', 'contador', 'usuarios_de_sistema') NOT NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NULL,
      ultimo_acceso_en DATETIME NULL,
      UNIQUE KEY uq_usuarios_correo (correo)
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS casos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contador_id INT NOT NULL,
      cliente VARCHAR(200) NOT NULL,
      estado ENUM('Pendiente', 'En proceso', 'Finalizado') NOT NULL DEFAULT 'Pendiente',
      prioridad ENUM('Alta', 'Media', 'Baja') NOT NULL,
      creado_en DATETIME NOT NULL,
      actualizado_en DATETIME NOT NULL,
      FOREIGN KEY (contador_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sesiones (
      jti VARCHAR(255) PRIMARY KEY,
      usuario_id INT NOT NULL,
      ultima_actividad DATETIME NOT NULL,
      revocado TINYINT(1) NOT NULL DEFAULT 0,
      creado_en DATETIME NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    ) ENGINE=InnoDB
  `);
}

/** Indica si la tabla usuarios todavía tiene la columna `usuario` (bases anteriores a la 5c). */
async function columnaUsuarioExiste() {
  return (await query("SHOW COLUMNS FROM usuarios LIKE 'usuario'")).length > 0;
}

/**
 * Migración de la tabla usuarios al formato con nombre y correo (login por correo).
 * Se puede correr varias veces: solo agrega lo que falta y conserva los datos.
 * En una base anterior, las cuentas sin correo reciben uno de prueba (`usuario@prueba.local`)
 * y después se borra la columna `usuario`, no sin antes copiar la tabla a `usuarios_respaldo_5c`.
 */
async function migrarUsuarios() {
  await query(`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS nombre VARCHAR(150) NULL AFTER id,
      ADD COLUMN IF NOT EXISTS correo VARCHAR(150) NULL AFTER nombre,
      ADD COLUMN IF NOT EXISTS actualizado_en DATETIME NULL AFTER creado_en,
      ADD COLUMN IF NOT EXISTS ultimo_acceso_en DATETIME NULL AFTER actualizado_en
  `);

  if (await columnaUsuarioExiste()) {
    await query(`
      UPDATE usuarios
      SET correo = IF(usuario LIKE '%@%', LOWER(usuario), CONCAT(LOWER(usuario), '@prueba.local'))
      WHERE correo IS NULL
    `);
    await query('UPDATE usuarios SET nombre = usuario WHERE nombre IS NULL');

    // El respaldo se toma una sola vez y antes de borrar: si ya existe, se conserva el primero.
    await query('CREATE TABLE IF NOT EXISTS usuarios_respaldo_5c AS SELECT * FROM usuarios');
    await query('ALTER TABLE usuarios DROP COLUMN usuario');
  }

  await query('UPDATE usuarios SET actualizado_en = creado_en WHERE actualizado_en IS NULL');

  await query('CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_correo ON usuarios (correo)');
}

/**
 * Verifica si ya existe una cuenta con el correo dado.
 * @param {string} correo - Correo de acceso.
 * @returns {Promise<boolean>} true si existe.
 */
async function cuentaExiste(correo) {
  return (await UserModel.findByCorreo(correo)) !== null;
}

/**
 * Inserta una cuenta con contraseña hasheada usando Argon2id (RNF-1).
 * @param {string} nombre - Nombre visible de la cuenta.
 * @param {string} correo - Correo de acceso.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} rol - Rol de la cuenta.
 */
async function insertarCuenta(nombre, correo, password, rol) {
  // Mismo alta que la API: la cuenta nace con nombre, correo y actualizado_en.
  await UserModel.create({ nombre, correo, passwordHash: await hashPassword(password), rol });
}

/**
 * Seed de datos maestros: crea tablas e inserta al menos un administrador y
 * al menos un contador con contraseñas hasheadas. Si los usuarios ya existen,
 * no hace nada (idempotente, no sobrescribe ni falla). RF-27.
 */
async function seedDatabase() {
  await crearTablasSiNoExisten();
  await migrarUsuarios();

  if (!(await cuentaExiste(ADMIN_CORREO))) {
    await insertarCuenta(ADMIN_NOMBRE, ADMIN_CORREO, ADMIN_PASSWORD, 'administrador');
  }

  if (!(await cuentaExiste(CONTADOR_CORREO))) {
    await insertarCuenta(CONTADOR_NOMBRE, CONTADOR_CORREO, CONTADOR_PASSWORD, 'contador');
  }
}

module.exports = { seedDatabase };