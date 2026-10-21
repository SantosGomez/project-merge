const { query } = require('../config/db');
const { hashPassword } = require('../utils/passwordUtils');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

// Credenciales placeholder del seed (cargadas desde otra base de datos posteriormente, RF-27).
const ADMIN_USUARIO = 'admin_seed';
const ADMIN_PASSWORD = 'Admin1234';
const CONTADOR_USUARIO = 'contador_seed';
const CONTADOR_PASSWORD = 'Contador1234';

/**
 * Crea las tablas de la base de datos si no existen: usuarios, casos y sesiones.
 * RF-27.
 */
async function crearTablasSiNoExisten() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      rol ENUM('administrador', 'contador', 'usuarios_de_sistema') NOT NULL,
      creado_en DATETIME NOT NULL
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

/**
 * Verifica si ya existe un usuario con el nombre dado.
 * @param {string} usuario - Nombre de usuario.
 * @returns {Promise<boolean>} true si existe.
 */
async function usuarioExiste(usuario) {
  const rows = await query('SELECT id FROM usuarios WHERE usuario = ?', [usuario]);
  return rows.length > 0;
}

/**
 * Inserta un usuario con contraseña hasheada usando Argon2id (RNF-1).
 * @param {string} usuario - Nombre de usuario.
 * @param {string} password - Contraseña en texto plano.
 * @param {string} rol - Rol del usuario.
 */
async function insertarUsuario(usuario, password, rol) {
  const hash = await hashPassword(password);
  const ahora = formatLocalDate(nowLocal());
  await query(
    'INSERT INTO usuarios (usuario, password_hash, rol, creado_en) VALUES (?, ?, ?, ?)',
    [usuario, hash, rol, ahora]
  );
}

/**
 * Seed de datos maestros: crea tablas e inserta al menos un administrador y
 * al menos un contador con contraseñas hasheadas. Si los usuarios ya existen,
 * no hace nada (idempotente, no sobrescribe ni falla). RF-27.
 */
async function seedDatabase() {
  await crearTablasSiNoExisten();

  const existeAdmin = await usuarioExiste(ADMIN_USUARIO);
  if (!existeAdmin) {
    await insertarUsuario(ADMIN_USUARIO, ADMIN_PASSWORD, 'administrador');
  }

  const existeContador = await usuarioExiste(CONTADOR_USUARIO);
  if (!existeContador) {
    await insertarUsuario(CONTADOR_USUARIO, CONTADOR_PASSWORD, 'contador');
  }
}

module.exports = { seedDatabase };