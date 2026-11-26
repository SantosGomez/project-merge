const mysql = require('mysql2/promise');
const { pool } = require('../config/db');
const { agregarContador } = require('../models/ClienteContadorModel');

/**
 * Unión con Proyecto-documentos, fase 1: trae a esta base los usuarios y clientes de la base de
 * documentos (DOCS_DB_*). El esquema lo crea el seed (`migrarUnificacion`); aquí solo van datos.
 *
 * - Usuarios: se unen por correo. Si ya existe, recibe su alias y el módulo «documentos» con el rol
 *   que tenía allá (su rol de seguimiento no cambia). Si no existe, entra como auxiliar, con su
 *   contraseña de documentos y solo con ese módulo.
 * - Clientes: se unen por clave o por razón social normalizada. Si ya existe, se completan clave,
 *   correo y teléfono sin pisar lo que tenga; si no, entra sin contador.
 * - Las cuentas y los clientes de prueba no se traen. Los documentos tampoco: todos los de la base
 *   de desarrollo son de prueba.
 * - Cada fila queda en `unificacion_mapa`, así que se puede correr varias veces y deshacer.
 *
 * Uso:  node src/utils/importarDocumentos.js            (importa)
 *       node src/utils/importarDocumentos.js --deshacer (revierte lo importado)
 */

const DOMINIOS_DE_PRUEBA = ['test.com', 'ejemplo.com', 'example.com'];
const SOCIEDADES = /(sapidecv|sprderldecv|sderldecv|sadecv|sc|ac)$/;
const ROLES_DOCUMENTOS = {
  administrador: 'administrador',
  contador: 'contador',
  recepcionista: 'recepcionista',
  practicante: 'practicante',
  sistemas: 'sistemas',
  cliente: 'cliente',
};

function esCuentaDePrueba(correo) {
  const dominio = String(correo || '').toLowerCase().trim().split('@')[1] || '';
  return DOMINIOS_DE_PRUEBA.includes(dominio);
}

function esClienteDePrueba({ razon_social: razonSocial, rfc }) {
  return /^test/i.test(rfc || '') || normalizarRazonSocial(razonSocial) === 'clientetest';
}

/** Razón social sin acentos, mayúsculas, puntuación, espacios ni tipo de sociedad al final. */
function normalizarRazonSocial(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9&]/g, '')
    .replace(SOCIEDADES, '');
}

function rolDeDocumentos(nombre) {
  const rol = ROLES_DOCUMENTOS[String(nombre || '').toLowerCase().trim()];
  if (!rol) throw new Error(`Rol de documentos desconocido: ${nombre}`);
  return rol;
}

async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  const q = async (sql, params = []) => (await conexion.query(sql, params))[0];
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(q);
    await conexion.commit();
    return resultado;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function yaImportado(q, tabla, idOrigen) {
  const filas = await q('SELECT id_destino FROM unificacion_mapa WHERE tabla = ? AND id_origen = ?', [tabla, idOrigen]);
  return filas.length > 0;
}

async function registrarEnMapa(q, tabla, idOrigen, idDestino, accion) {
  await q('INSERT INTO unificacion_mapa (tabla, id_origen, id_destino, accion, creado_en) VALUES (?, ?, ?, ?, NOW())', [
    tabla,
    idOrigen,
    idDestino,
    accion,
  ]);
}

async function importarUsuarios(q, usuarios) {
  const resumen = { ligados: 0, insertados: 0, omitidosDePrueba: 0, yaImportados: 0 };
  for (const u of usuarios) {
    if (esCuentaDePrueba(u.email)) {
      resumen.omitidosDePrueba += 1;
      continue;
    }
    if (await yaImportado(q, 'usuarios', u.id)) {
      resumen.yaImportados += 1;
      continue;
    }
    const correo = String(u.email).toLowerCase().trim();
    const rol = rolDeDocumentos(u.rol);
    const aliasLibre = (await q('SELECT id FROM usuarios WHERE alias = ?', [u.usuario])).length === 0;
    const alias = aliasLibre ? u.usuario : null;
    const [existente] = await q('SELECT id, alias FROM usuarios WHERE LOWER(correo) = ?', [correo]);

    let idDestino;
    if (existente) {
      idDestino = existente.id;
      if (existente.alias === null && alias) {
        await q('UPDATE usuarios SET alias = ? WHERE id = ?', [alias, idDestino]);
      }
      await registrarEnMapa(q, 'usuarios', u.id, idDestino, 'ligado');
      resumen.ligados += 1;
    } else {
      const creado = u.created_at || new Date();
      const resultado = await q(
        `INSERT INTO usuarios (nombre, correo, alias, password_hash, rol, creado_en, actualizado_en, debe_cambiar_contrasena)
         VALUES (?, ?, ?, ?, 'auxiliar', ?, ?, ?)`,
        [u.nombre, correo, alias, u.password, creado, creado, Number(u.debe_cambiar_contrasena) ? 1 : 0]
      );
      idDestino = resultado.insertId;
      await registrarEnMapa(q, 'usuarios', u.id, idDestino, 'insertado');
      resumen.insertados += 1;
    }
    await q("INSERT IGNORE INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', ?)", [idDestino, rol]);
  }
  return resumen;
}

async function importarClientes(q, clientes) {
  const resumen = { ligados: 0, insertados: 0, omitidosDePrueba: 0, yaImportados: 0 };
  const destino = await q('SELECT id, clave, nombre, usuario_id FROM clientes ORDER BY id');
  const ligadosAhora = new Set(
    (await q("SELECT id_destino FROM unificacion_mapa WHERE tabla = 'clientes'")).map((f) => f.id_destino)
  );

  for (const c of clientes) {
    if (esClienteDePrueba(c)) {
      resumen.omitidosDePrueba += 1;
      continue;
    }
    if (await yaImportado(q, 'clientes', c.id)) {
      resumen.yaImportados += 1;
      continue;
    }
    const nombre = normalizarRazonSocial(c.razon_social);
    const pareja =
      (c.clave && destino.find((d) => d.clave === c.clave)) ||
      destino.find((d) => !ligadosAhora.has(d.id) && normalizarRazonSocial(d.nombre) === nombre);

    if (pareja) {
      await q(
        'UPDATE clientes SET clave = COALESCE(clave, ?), email = COALESCE(email, ?), telefono = COALESCE(telefono, ?) WHERE id = ?',
        [c.clave || null, c.email || null, c.telefono || null, pareja.id]
      );
      // Si el cliente ya tenía contador, su fila en cliente_contador debe existir (no se quita al deshacer).
      if (pareja.usuario_id) await agregarContador(pareja.id, pareja.usuario_id, q);
      ligadosAhora.add(pareja.id);
      await registrarEnMapa(q, 'clientes', c.id, pareja.id, 'ligado');
      resumen.ligados += 1;
    } else {
      const resultado = await q(
        `INSERT INTO clientes (usuario_id, clave, nombre, rfc, email, telefono, activo, creado_en)
         VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.clave || null,
          c.razon_social,
          c.rfc || null,
          c.email || null,
          c.telefono || null,
          c.estado === 'ACTIVO' ? 1 : 0,
          c.created_at || new Date(),
        ]
      );
      ligadosAhora.add(resultado.insertId);
      await registrarEnMapa(q, 'clientes', c.id, resultado.insertId, 'insertado');
      resumen.insertados += 1;
    }
  }
  return resumen;
}

/**
 * Importa usuarios y clientes ya leídos de la base de documentos, en una sola transacción.
 * @param {{usuarios: Array, clientes: Array}} origen - Filas de documentos (usuarios con `rol` = nombre del rol).
 * @returns {Promise<{usuarios: Object, clientes: Object}>} Cuántos se ligaron, insertaron u omitieron.
 */
async function importarDocumentos({ usuarios, clientes }) {
  return enTransaccion(async (q) => ({
    usuarios: await importarUsuarios(q, usuarios),
    clientes: await importarClientes(q, clientes),
  }));
}

/**
 * Revierte lo importado: borra lo insertado y limpia lo que se completó en filas que ya existían.
 * @param {{soloOrigen?: number[]}} [opciones] - Limitar a estos ids de origen (las pruebas lo usan).
 * @returns {Promise<{usuarios: number, clientes: number}>} Filas del mapa revertidas.
 */
async function deshacerImportacion({ soloOrigen } = {}) {
  return enTransaccion(async (q) => {
    let filtro = '';
    let params = [];
    if (soloOrigen) {
      if (soloOrigen.length === 0) return { usuarios: 0, clientes: 0 };
      filtro = ` AND id_origen IN (${soloOrigen.map(() => '?').join(', ')})`;
      params = soloOrigen.map(Number);
    }
    const mapa = await q(`SELECT tabla, id_origen, id_destino, accion FROM unificacion_mapa WHERE 1 = 1${filtro}`, params);
    const cuenta = { usuarios: 0, clientes: 0 };

    for (const fila of mapa.filter((f) => f.tabla === 'clientes')) {
      if (fila.accion === 'insertado') {
        await q('DELETE FROM clientes WHERE id = ?', [fila.id_destino]);
      } else {
        await q('UPDATE clientes SET clave = NULL, email = NULL, telefono = NULL WHERE id = ?', [fila.id_destino]);
      }
      cuenta.clientes += 1;
    }
    for (const fila of mapa.filter((f) => f.tabla === 'usuarios')) {
      if (fila.accion === 'insertado') {
        await q('DELETE FROM usuarios WHERE id = ?', [fila.id_destino]);
      } else {
        await q('UPDATE usuarios SET alias = NULL WHERE id = ?', [fila.id_destino]);
        await q("DELETE FROM usuario_modulos WHERE usuario_id = ? AND modulo = 'documentos'", [fila.id_destino]);
      }
      cuenta.usuarios += 1;
    }
    await q(`DELETE FROM unificacion_mapa WHERE 1 = 1${filtro}`, params);
    return cuenta;
  });
}

/** Lee usuarios (con el nombre de su rol) y clientes de la base de documentos. */
async function leerBaseDocumentos(env = process.env) {
  for (const nombre of ['DOCS_DB_HOST', 'DOCS_DB_USER', 'DOCS_DB_NAME']) {
    if (!env[nombre]) throw new Error(`Falta ${nombre} en el .env`);
  }
  const conexion = await mysql.createConnection({
    host: env.DOCS_DB_HOST,
    port: parseInt(env.DOCS_DB_PORT || '3306', 10),
    user: env.DOCS_DB_USER,
    password: env.DOCS_DB_PASSWORD || '',
    database: env.DOCS_DB_NAME,
  });
  try {
    const [usuarios] = await conexion.query(
      `SELECT u.id, u.nombre, u.usuario, u.email, u.password, r.nombre AS rol, u.debe_cambiar_contrasena, u.created_at
       FROM usuarios u JOIN roles r ON r.id = u.rol_id ORDER BY u.id`
    );
    const [clientes] = await conexion.query(
      'SELECT id, clave, rfc, razon_social, email, telefono, estado, created_at FROM clientes ORDER BY id'
    );
    return { usuarios, clientes };
  } finally {
    await conexion.end();
  }
}

async function main() {
  const { seedDatabase } = require('./seed');
  await seedDatabase({ cuentasDemo: false });
  const resultado = process.argv.includes('--deshacer')
    ? await deshacerImportacion()
    : await importarDocumentos(await leerBaseDocumentos());
  console.log(JSON.stringify(resultado, null, 2));
}

if (require.main === module) {
  require('dotenv').config();
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = {
  importarDocumentos,
  deshacerImportacion,
  leerBaseDocumentos,
  esCuentaDePrueba,
  esClienteDePrueba,
  normalizarRazonSocial,
};
