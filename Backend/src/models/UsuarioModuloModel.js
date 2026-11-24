const { query } = require('../config/db');

/**
 * Módulos que ve cada cuenta (unión con Proyecto-documentos).
 * Salen de `usuario_modulos`, más una regla por rol: el administrador tiene siempre el módulo
 * de documentos como administrador, salvo que la tabla le dé ahí otro rol.
 */

const MODULOS_POR_ROL = {
  administrador: [{ modulo: 'documentos', rol: 'administrador' }],
};

/**
 * @param {{id: number, rol: string}} cuenta - Cuenta con su rol general.
 * @returns {Promise<Array<{modulo: string, rol: string|null}>>} Módulos ordenados por nombre.
 */
async function modulosDeUsuario({ id, rol }) {
  const filas = await query('SELECT modulo, rol FROM usuario_modulos WHERE usuario_id = ?', [id]);
  const modulos = filas.map((f) => ({ modulo: f.modulo, rol: f.rol }));
  for (const extra of MODULOS_POR_ROL[rol] || []) {
    if (!modulos.some((m) => m.modulo === extra.modulo)) {
      modulos.push({ ...extra });
    }
  }
  return modulos.sort((a, b) => a.modulo.localeCompare(b.modulo));
}

module.exports = { modulosDeUsuario, MODULOS_POR_ROL };
