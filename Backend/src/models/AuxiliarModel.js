const { query, conTransaccion } = require('../config/db');
const UserModel = require('./UserModel');

/**
 * Busca una cuenta por id.
 * Devuelve el objeto { id, nombre, rol } o null si no existe.
 * @param {number} id - Id de usuario.
 * @returns {Promise<Object|null>}
 */
async function findUsuarioPorId(id) {
  const filas = await query('SELECT id, nombre, rol FROM usuarios WHERE id = ?', [id]);
  return filas.length > 0 ? filas[0] : null;
}

/**
 * Valida que el id corresponda a una cuenta existente con el rol esperado.
 * Lanza Error con código CONTADOR_NO_EXISTE / AUXILIAR_NO_EXISTE si no existe, y
 * CONTADOR_NO_ES_CONTADOR / AUXILIAR_NO_ES_AUXILIAR si tiene otro rol.
 * @param {number} id - Id de usuario.
 * @param {'contador'|'auxiliar'} rolEsperado - Rol que debe tener la cuenta.
 * @returns {Promise<Object>} La cuenta { id, nombre }.
 */
async function validarCuentaConRol(id, rolEsperado) {
  const prefijo = rolEsperado.toUpperCase();
  const usuario = await findUsuarioPorId(id);
  if (!usuario) {
    const error = new Error(`${rolEsperado} no encontrado`);
    error.codigo = `${prefijo}_NO_EXISTE`;
    throw error;
  }
  if (usuario.rol !== rolEsperado) {
    const error = new Error(`la cuenta no es un ${rolEsperado}`);
    error.codigo = `${prefijo}_NO_ES_${prefijo}`;
    throw error;
  }
  return { id: usuario.id, nombre: usuario.nombre };
}

/**
 * Asigna un auxiliar a un contador.
 * El dueño debe ser un contador y el auxiliar una cuenta con rol auxiliar (2026-11-10),
 * no pueden ser el mismo usuario y la relación no debe existir ya.
 * @param {number} contadorId - Id del contador que tiene auxiliares.
 * @param {number} auxiliarId - Id de la cuenta auxiliar.
 * @returns {Promise<void>}
 */
async function asignarAuxiliar(contadorId, auxiliarId) {
  if (contadorId === auxiliarId) {
    const error = new Error('no se puede auto-asignar como auxiliar');
    error.codigo = 'AUTO_ASIGNACION';
    throw error;
  }

  await validarCuentaConRol(contadorId, 'contador');
  await validarCuentaConRol(auxiliarId, 'auxiliar');

  const existente = await query(
    'SELECT 1 FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?',
    [contadorId, auxiliarId]
  );
  if (existente.length > 0) {
    const error = new Error('el auxiliar ya está asignado a este contador');
    error.codigo = 'YA_ASIGNADO';
    throw error;
  }

  await query(
    'INSERT INTO contador_auxiliar (contador_id, auxiliar_id, asignado_en) VALUES (?, ?, NOW())',
    [contadorId, auxiliarId]
  );
}

/**
 * Quita un auxiliar de un contador.
 * @param {number} contadorId - Id del contador.
 * @param {number} auxiliarId - Id del auxiliar a quitar.
 * @returns {Promise<boolean>} true si de verdad se borró el vínculo, false si ya no existía.
 */
async function quitarAuxiliar(contadorId, auxiliarId) {
  const resultado = await query(
    'DELETE FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?',
    [contadorId, auxiliarId]
  );
  return resultado.affectedRows > 0;
}

/**
 * Devuelve los auxiliares de un contador.
 * @param {number} contadorId - Id del contador.
 * @returns {Promise<Array<{id: number, nombre: string}>>}
 */
async function listarAuxiliares(contadorId) {
  const filas = await query(
    'SELECT u.id, u.nombre FROM usuarios u ' +
    'JOIN contador_auxiliar ca ON ca.auxiliar_id = u.id ' +
    'WHERE ca.contador_id = ? ORDER BY u.nombre',
    [contadorId]
  );
  return filas;
}

/**
 * Devuelve los contadores que tienen a un usuario como auxiliar.
 * @param {number} auxiliarId - Id del contador auxiliar.
 * @returns {Promise<Array<{id: number, nombre: string}>>}
 */
async function listarContadoresQueMeTienenComoAuxiliar(auxiliarId) {
  const filas = await query(
    'SELECT u.id, u.nombre FROM usuarios u ' +
    'JOIN contador_auxiliar ca ON ca.contador_id = u.id ' +
    'WHERE ca.auxiliar_id = ? ORDER BY u.nombre',
    [auxiliarId]
  );
  return filas;
}

/**
 * Devuelve las cuentas que un contador puede asignar como auxiliares:
 * las de rol auxiliar que todavía no tiene asignadas.
 * @param {number} contadorId - Id del contador que quiere asignar auxiliares.
 * @returns {Promise<Array<{id: number, nombre: string}>>}
 */
async function listarDisponiblesParaAuxiliar(contadorId) {
  const filas = await query(
    "SELECT u.id, u.nombre FROM usuarios u " +
    "WHERE u.rol = 'auxiliar' " +
    'AND NOT EXISTS (SELECT 1 FROM contador_auxiliar ca WHERE ca.contador_id = ? AND ca.auxiliar_id = u.id) ' +
    'ORDER BY u.nombre',
    [contadorId]
  );
  return filas;
}

/**
 * Aplica al equipo de un auxiliar solo los cambios que pide el despacho: agrega unos contadores
 * y quita otros, sin tocar los demás vínculos (los que haya agregado cada contador por su cuenta).
 * Valida todo antes de escribir y escribe en una transacción: o se guarda todo o nada.
 * Repetir un cambio no falla: agregar a quien ya estaba o quitar a quien ya no estaba no hace nada.
 * @param {number} auxiliarId - Id de la cuenta auxiliar.
 * @param {{ agregar: Array<number>, quitar: Array<number> }} cambios - Ids de contadores.
 * @returns {Promise<{ agregados: Array<number>, quitados: Array<number> }>} Lo que de verdad cambió.
 */
async function ajustarContadoresDeAuxiliar(auxiliarId, { agregar, quitar }) {
  if (agregar.some((id) => quitar.includes(id))) {
    const error = new Error('un contador no puede agregarse y quitarse a la vez');
    error.codigo = 'CAMBIO_CONTRADICTORIO';
    throw error;
  }
  await validarCuentaConRol(auxiliarId, 'auxiliar');
  for (const contadorId of agregar) {
    await validarCuentaConRol(contadorId, 'contador');
  }

  return conTransaccion(async (ejecutar) => {
    const agregados = [];
    const quitados = [];
    for (const contadorId of quitar) {
      const resultado = await ejecutar(
        'DELETE FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?',
        [contadorId, auxiliarId]
      );
      if (resultado.affectedRows > 0) quitados.push(contadorId);
    }
    for (const contadorId of agregar) {
      // INSERT IGNORE: si el contador lo agregó por su cuenta un instante antes, no es un error.
      const resultado = await ejecutar(
        'INSERT IGNORE INTO contador_auxiliar (contador_id, auxiliar_id, asignado_en) VALUES (?, ?, NOW())',
        [contadorId, auxiliarId]
      );
      if (resultado.affectedRows > 0) agregados.push(contadorId);
    }
    return { agregados, quitados };
  });
}

module.exports = {
  ajustarContadoresDeAuxiliar,
  asignarAuxiliar,
  quitarAuxiliar,
  listarAuxiliares,
  listarContadoresQueMeTienenComoAuxiliar,
  listarDisponiblesParaAuxiliar,
};
