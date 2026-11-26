const { query, conTransaccion } = require('../config/db');
const { agregarContador, reemplazarContadores, contadoresDe, SQL_PRINCIPAL_DE_C } = require('./ClienteContadorModel');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Clientes propios de cada contador o auxiliar («Mi trabajo > Mis actividades»).
 * El nombre es único por usuario sin distinguir mayúsculas ni acentos (colación de la tabla).
 */

const COLUMNAS = 'id, nombre, rfc, activo, creado_en';

// El cliente es del usuario si figura entre sus contadores en cliente_contador (puede tener varios).
const ES_CONTADOR_DEL_CLIENTE =
  'EXISTS (SELECT 1 FROM cliente_contador cc WHERE cc.cliente_id = clientes.id AND cc.usuario_id = ?)';

/**
 * Convierte una fila de la tabla en el cliente que entrega la API.
 * @param {Object} fila - Fila de `clientes`.
 * @returns {{ id: number, nombre: string, rfc: string|null, activo: boolean, creado_en: string }}
 */
function aCliente(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rfc: fila.rfc,
    activo: Boolean(fila.activo),
    creado_en: formatLocalDate(fila.creado_en),
  };
}

/**
 * Convierte el rechazo de la clave única en un error con código NOMBRE_REPETIDO.
 * @param {Error} error - Error de la base de datos.
 * @throws {Error} NOMBRE_REPETIDO si el nombre ya existe; si no, el error original.
 */
function traducirDuplicado(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    const repetido = new Error('ya existe un cliente con ese nombre');
    repetido.codigo = 'NOMBRE_REPETIDO';
    throw repetido;
  }
  throw error;
}

/**
 * Clientes de un usuario: primero los activos y luego los desactivados, cada grupo por nombre.
 * @param {number} usuarioId - Dueño de los clientes.
 * @returns {Promise<Array<Object>>}
 */
async function listarDeUsuario(usuarioId) {
  const filas = await query(
    `SELECT ${COLUMNAS} FROM clientes WHERE ${ES_CONTADOR_DEL_CLIENTE} ORDER BY activo DESC, nombre ASC, id ASC`,
    [usuarioId]
  );
  return filas.map(aCliente);
}

/**
 * Todos los clientes del catálogo, con sus contadores (si tiene): activos primero, cada grupo por nombre.
 * `contador_id` y `contador_nombre` son los del principal; `contadores` lista a todos, el principal primero.
 * Solo lectura, para Ajustes; no filtra por dueño.
 * @returns {Promise<Array<Object>>}
 */
async function listarTodos() {
  const filas = await query(
    `SELECT c.id, c.clave, c.nombre, c.rfc, c.activo, ${SQL_PRINCIPAL_DE_C} AS contador_id, u.nombre AS contador_nombre
     FROM clientes c LEFT JOIN usuarios u ON u.id = ${SQL_PRINCIPAL_DE_C}
     ORDER BY c.activo DESC, c.nombre ASC, c.id ASC`
  );
  const asignaciones = await query(
    `SELECT cc.cliente_id, u.id, u.nombre FROM cliente_contador cc JOIN usuarios u ON u.id = cc.usuario_id
     ORDER BY cc.cliente_id ASC, cc.asignado_en ASC, cc.usuario_id ASC`
  );
  const contadoresPorCliente = new Map();
  for (const asignacion of asignaciones) {
    if (!contadoresPorCliente.has(asignacion.cliente_id)) contadoresPorCliente.set(asignacion.cliente_id, []);
    contadoresPorCliente.get(asignacion.cliente_id).push({ id: asignacion.id, nombre: asignacion.nombre });
  }
  return filas.map((fila) => ({
    id: fila.id,
    clave: fila.clave,
    nombre: fila.nombre,
    rfc: fila.rfc,
    activo: Boolean(fila.activo),
    contador_id: fila.contador_id,
    contador_nombre: fila.contador_nombre,
    contadores: contadoresPorCliente.get(fila.id) || [],
  }));
}

/**
 * Busca un cliente que pertenezca al usuario; los de otros usuarios no existen para él.
 * @param {number} id - Id del cliente.
 * @param {number} usuarioId - Dueño esperado.
 * @returns {Promise<Object|null>}
 */
async function buscarDeUsuario(id, usuarioId) {
  const filas = await query(`SELECT ${COLUMNAS} FROM clientes WHERE id = ? AND ${ES_CONTADOR_DEL_CLIENTE}`, [id, usuarioId]);
  return filas.length > 0 ? aCliente(filas[0]) : null;
}

/**
 * Crea un cliente activo para el usuario.
 * @param {number} usuarioId - Dueño.
 * @param {{ nombre: string, rfc: string|null }} datos - Datos ya validados.
 * @returns {Promise<Object>} El cliente creado.
 * @throws {Error} NOMBRE_REPETIDO si el usuario ya tiene un cliente con ese nombre.
 */
async function crear(usuarioId, { nombre, rfc }) {
  try {
    // El cliente y su fila en cliente_contador se guardan juntos (la unicidad por contador y nombre
    // sigue apoyándose en usuario_id, que el modelo de contadores mantiene como principal).
    const resultado = await conTransaccion(async (ejecutar) => {
      const insertado = await ejecutar(
        'INSERT INTO clientes (usuario_id, nombre, rfc, activo, creado_en) VALUES (?, ?, ?, 1, ?)',
        [usuarioId, nombre, rfc, formatLocalDate(nowLocal())]
      );
      await agregarContador(insertado.insertId, usuarioId, ejecutar);
      return insertado;
    });
    return await buscarDeUsuario(resultado.insertId, usuarioId);
  } catch (error) {
    return traducirDuplicado(error);
  }
}

/**
 * Actualiza solo los campos recibidos de un cliente del usuario.
 * @param {number} id - Id del cliente.
 * @param {number} usuarioId - Dueño.
 * @param {{ nombre?: string, rfc?: string|null, activo?: boolean }} cambios - Campos ya validados.
 * @returns {Promise<Object|null>} El cliente actualizado, o null si no es del usuario.
 * @throws {Error} NOMBRE_REPETIDO si el nuevo nombre lo tiene otro cliente del usuario.
 */
async function actualizar(id, usuarioId, cambios) {
  const campos = [];
  const valores = [];
  for (const campo of ['nombre', 'rfc']) {
    if (cambios[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(cambios[campo]);
    }
  }
  if (cambios.activo !== undefined) {
    campos.push('activo = ?');
    valores.push(cambios.activo ? 1 : 0);
  }

  try {
    await query(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ? AND ${ES_CONTADOR_DEL_CLIENTE}`, [...valores, id, usuarioId]);
  } catch (error) {
    return traducirDuplicado(error);
  }
  return buscarDeUsuario(id, usuarioId);
}

/**
 * Convierte el rechazo de una clave única del catálogo en un error con código CLAVE_REPETIDA o
 * NOMBRE_REPETIDO (también cuando lo rechaza `uq_clientes_usuario_nombre`).
 * @param {Error} error - Error de la base de datos.
 * @throws {Error} CLAVE_REPETIDA, NOMBRE_REPETIDO o el error original.
 */
function traducirDuplicadoDelCatalogo(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    const esClave = String(error.message || '').includes('uq_clientes_clave');
    const repetido = new Error(esClave ? 'ya existe un cliente con esa clave' : 'ya existe un cliente con ese nombre');
    repetido.codigo = esClave ? 'CLAVE_REPETIDA' : 'NOMBRE_REPETIDO';
    throw repetido;
  }
  throw error;
}

/**
 * Comprueba que ningún OTRO cliente tenga ese nombre (la colación ignora mayúsculas y acentos). Vale
 * aunque `uq_clientes_nombre` aún no exista porque haya nombres repetidos por consolidar.
 */
async function exigirNombreLibre(ejecutar, nombre, idPropio) {
  const filas = await ejecutar('SELECT id FROM clientes WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, idPropio]);
  if (filas.length > 0) {
    const repetido = new Error('ya existe un cliente con ese nombre');
    repetido.codigo = 'NOMBRE_REPETIDO';
    throw repetido;
  }
}

/**
 * Un cliente del catálogo con todos sus datos y sus contadores (el principal primero), para Ajustes.
 * @param {number} id - Id del cliente.
 * @param {Function} [ejecutar] - Consulta dentro de una transacción ajena (opcional).
 * @returns {Promise<Object|null>} null si no existe.
 */
async function buscarDelCatalogo(id, ejecutar = query) {
  const filas = await ejecutar(
    `SELECT c.id, c.clave, c.nombre, c.rfc, c.email, c.telefono, c.activo, ${SQL_PRINCIPAL_DE_C} AS contador_id,
            u.nombre AS contador_nombre
     FROM clientes c LEFT JOIN usuarios u ON u.id = ${SQL_PRINCIPAL_DE_C}
     WHERE c.id = ?`,
    [id]
  );
  if (filas.length === 0) return null;
  const fila = filas[0];
  return {
    id: fila.id,
    clave: fila.clave,
    nombre: fila.nombre,
    rfc: fila.rfc,
    email: fila.email,
    telefono: fila.telefono,
    activo: Boolean(fila.activo),
    contador_id: fila.contador_id,
    contador_nombre: fila.contador_nombre,
    contadores: await contadoresDe(id, ejecutar),
  };
}

/**
 * Da de alta un cliente en el catálogo con sus contadores, en una sola transacción: el primero de la
 * lista queda como principal. Si algo falla, no se guarda nada.
 * @param {{ clave: string, nombre: string, rfc: string|null, email: string|null, telefono: string|null }} datos - Ya validados.
 * @param {number[]} [contadores] - Ids de las cuentas contador, sin repetir.
 * @returns {Promise<Object>} El cliente creado (forma de `buscarDelCatalogo`).
 * @throws {Error} NOMBRE_REPETIDO o CLAVE_REPETIDA.
 */
async function crearEnCatalogo({ clave, nombre, rfc, email, telefono }, contadores = []) {
  try {
    const id = await conTransaccion(async (ejecutar) => {
      await exigirNombreLibre(ejecutar, nombre, 0);
      const insertado = await ejecutar(
        'INSERT INTO clientes (clave, usuario_id, nombre, rfc, email, telefono, activo, creado_en) VALUES (?, NULL, ?, ?, ?, ?, 1, ?)',
        [clave, nombre, rfc, email, telefono, formatLocalDate(nowLocal())]
      );
      await reemplazarContadores(insertado.insertId, contadores, ejecutar);
      return insertado.insertId;
    });
    return await buscarDelCatalogo(id);
  } catch (error) {
    return traducirDuplicadoDelCatalogo(error);
  }
}

/**
 * Cambia solo los campos recibidos de un cliente del catálogo (no toca a los contadores).
 * @param {number} id - Id del cliente.
 * @param {{ nombre?: string, clave?: string, rfc?: string|null, email?: string|null, telefono?: string|null, activo?: boolean }} cambios - Ya validados.
 * @returns {Promise<Object|null>} El cliente actualizado, o null si no existe.
 * @throws {Error} NOMBRE_REPETIDO o CLAVE_REPETIDA.
 */
async function actualizarEnCatalogo(id, cambios) {
  const campos = [];
  const valores = [];
  for (const campo of ['clave', 'nombre', 'rfc', 'email', 'telefono']) {
    if (cambios[campo] !== undefined) {
      campos.push(`${campo} = ?`);
      valores.push(cambios[campo]);
    }
  }
  if (cambios.activo !== undefined) {
    campos.push('activo = ?');
    valores.push(cambios.activo ? 1 : 0);
  }

  try {
    if (campos.length > 0) {
      await conTransaccion(async (ejecutar) => {
        if (cambios.nombre !== undefined) await exigirNombreLibre(ejecutar, cambios.nombre, id);
        await ejecutar(`UPDATE clientes SET ${campos.join(', ')} WHERE id = ?`, [...valores, id]);
      });
    }
  } catch (error) {
    return traducirDuplicadoDelCatalogo(error);
  }
  return buscarDelCatalogo(id);
}

module.exports = {
  listarDeUsuario,
  listarTodos,
  buscarDeUsuario,
  crear,
  actualizar,
  buscarDelCatalogo,
  crearEnCatalogo,
  actualizarEnCatalogo,
};
