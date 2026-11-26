const { query, conTransaccion } = require('../config/db');
const { agregarContador } = require('./ClienteContadorModel');
const { formatLocalDate, nowLocal } = require('../utils/dateUtils');

/**
 * Clientes propios de cada contador o auxiliar («Mi trabajo > Mis actividades»).
 * El nombre es único por usuario sin distinguir mayúsculas ni acentos (colación de la tabla).
 */

const COLUMNAS = 'id, nombre, rfc, activo, creado_en';

// El cliente es del usuario si figura entre sus contadores en cliente_contador (puede tener varios).
const ES_CONTADOR_DEL_CLIENTE =
  'EXISTS (SELECT 1 FROM cliente_contador cc WHERE cc.cliente_id = clientes.id AND cc.usuario_id = ?)';

// Id del contador principal del cliente `c`: el de menor asignado_en y, a igualdad, el de menor usuario_id.
const PRINCIPAL_DE_C =
  '(SELECT x.usuario_id FROM cliente_contador x WHERE x.cliente_id = c.id ORDER BY x.asignado_en ASC, x.usuario_id ASC LIMIT 1)';

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
    `SELECT c.id, c.clave, c.nombre, c.rfc, c.activo, ${PRINCIPAL_DE_C} AS contador_id, u.nombre AS contador_nombre
     FROM clientes c LEFT JOIN usuarios u ON u.id = ${PRINCIPAL_DE_C}
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

module.exports = { listarDeUsuario, listarTodos, buscarDeUsuario, crear, actualizar };
