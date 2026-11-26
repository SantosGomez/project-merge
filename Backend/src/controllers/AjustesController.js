const ClienteModel = require('../models/ClienteModel');

/**
 * Controladores de /ajustes: pantallas de consulta del despacho.
 */

/**
 * GET /ajustes/clientes — Catálogo completo de clientes, con su contador y su estado.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarClientes(req, res) {
  const clientes = await ClienteModel.listarTodos();
  return res.status(200).json({ clientes });
}

module.exports = { listarClientes };
