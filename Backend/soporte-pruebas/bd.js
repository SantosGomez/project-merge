const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { pool, query } = require('../src/config/db');
const { seedDatabase } = require('../src/utils/seed');
const UserModel = require('../src/models/UserModel');
const CaseModel = require('../src/models/CaseModel');
const { hashPassword } = require('../src/utils/passwordUtils');

/**
 * Apoyos de base de datos para las pruebas de integración.
 * Cada archivo de prueba corre en su propio proceso, con su propia copia de este
 * módulo y su propio pool: la limpieza borra solo lo que este proceso registró.
 */

// Nombre del cerrojo que serializa el seed entre archivos que corren en paralelo.
const LOCK_SEED = 'delgrow_pruebas_seed';
// Contraseña fija de los usuarios de prueba (no es un dato sensible real).
const PASSWORD_PRUEBA = 'PruebaClave123';

// Memoria del proceso: ids de usuarios creados, nombres de usuarios dados de alta
// por la API y ids de casos creados. Nunca se borra por prefijo.
const usuariosCreados = [];
const nombresRegistrados = [];
const casosCreados = [];

/**
 * Ejecuta el seed de datos maestros serializado con un cerrojo de MariaDB, para
 * que dos archivos en paralelo no inserten a la vez las cuentas del seed (RF-27).
 * @returns {Promise<void>}
 */
async function prepararBaseDeDatos() {
  const conexion = await pool.getConnection();
  try {
    await conexion.query('SELECT GET_LOCK(?, 30)', [LOCK_SEED]);
    try {
      await seedDatabase();
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [LOCK_SEED]);
    }
  } finally {
    conexion.release();
  }
}

/**
 * Crea un usuario de prueba con nombre único y contraseña hasheada con Argon2id.
 * @param {string} rol - Rol del usuario (contador, administrador, usuarios_de_sistema).
 * @returns {Promise<{id: number, usuario: string, password: string}>} Datos del usuario creado.
 */
async function crearUsuarioDePrueba(rol) {
  const sufijo = crypto.randomBytes(4).toString('hex');
  const usuario = `zz_test_${rol}_${sufijo}`;
  const passwordHash = await hashPassword(PASSWORD_PRUEBA);
  const id = await UserModel.create(usuario, passwordHash, rol);
  usuariosCreados.push({ id, usuario });
  return { id, usuario, password: PASSWORD_PRUEBA };
}

/**
 * Registra un usuario creado por la API dentro de una prueba para que la limpieza
 * lo borre. La limpieza resuelve el nombre a id cuando llega el momento.
 * @param {string} nombreUsuario - Nombre exacto del usuario creado.
 */
function registrarUsuarioCreado(nombreUsuario) {
  nombresRegistrados.push(nombreUsuario);
}

/**
 * Crea un caso de prueba asignado a un contador propio y lo registra para la limpieza.
 * @param {number} contadorId - Id del contador propietario.
 * @param {Object} [datos] - Valores opcionales del caso.
 * @returns {Promise<number>} Id del caso creado.
 */
async function crearCasoDePrueba(
  contadorId,
  { cliente = 'Cliente de prueba', estado = 'Pendiente', prioridad = 'Media' } = {}
) {
  const id = await CaseModel.create({
    contador_id: contadorId,
    cliente,
    estado,
    prioridad,
  });
  casosCreados.push(id);
  return id;
}

/**
 * Envejece la última actividad de una sesión para probar la inactividad (RF-25).
 * La sesión se identifica por el jti propio del token (RF-41).
 * @param {string} token - Token de acceso emitido por el login.
 * @param {number} minutos - Minutos a restar.
 * @returns {Promise<void>}
 */
async function envejecerSesion(token, minutos) {
  await query(
    'UPDATE sesiones SET ultima_actividad = DATE_SUB(ultima_actividad, INTERVAL ? MINUTE) WHERE jti = ?',
    [minutos, jwt.decode(token).jti]
  );
}

/**
 * Resuelve los ids de todos los usuarios registrados en este proceso.
 * @returns {Promise<Array<number>>} Ids únicos.
 */
async function idsDeUsuariosRegistrados() {
  const ids = usuariosCreados.map((usuario) => usuario.id);
  for (const nombre of nombresRegistrados) {
    const fila = await UserModel.findByUsername(nombre);
    if (fila) {
      ids.push(fila.id);
    }
  }
  return [...new Set(ids)];
}

/**
 * Borra solo los datos creados por este proceso, respetando las claves foráneas:
 * primero casos, después sesiones y por último usuarios.
 * @returns {Promise<void>}
 */
async function limpiarDatosDePrueba() {
  const idsUsuarios = await idsDeUsuariosRegistrados();
  const idsCasos = [...casosCreados];

  if (idsCasos.length > 0) {
    const marcas = idsCasos.map(() => '?').join(', ');
    await query(`DELETE FROM casos WHERE id IN (${marcas})`, idsCasos);
  }

  if (idsUsuarios.length > 0) {
    const marcas = idsUsuarios.map(() => '?').join(', ');
    // Casos creados por la API en nombre de los usuarios registrados.
    await query(`DELETE FROM casos WHERE contador_id IN (${marcas})`, idsUsuarios);
    await query(`DELETE FROM sesiones WHERE usuario_id IN (${marcas})`, idsUsuarios);
    await query(`DELETE FROM usuarios WHERE id IN (${marcas})`, idsUsuarios);
  }

  usuariosCreados.length = 0;
  nombresRegistrados.length = 0;
  casosCreados.length = 0;
}

/**
 * Cierra el pool de conexiones de este proceso para que `node --test` termine.
 * @returns {Promise<void>}
 */
async function cerrarBaseDeDatos() {
  await pool.end();
}

module.exports = {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  crearCasoDePrueba,
  envejecerSesion,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
};
