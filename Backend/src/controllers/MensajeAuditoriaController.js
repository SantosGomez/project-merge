const MensajeAuditoriaModel = require('../models/MensajeAuditoriaModel');
const { auditoriaPermitida } = require('./AuditoriaEventoController');
const { formatLocalDate } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const { avisarMensajeAuditoria } = require('../utils/avisosAuditoria');

const MAXIMO_CARACTERES = 1000;

/**
 * Convierte la fila de `auditoria_mensajes` al formato de la API.
 * @param {Object} fila - Mensaje con AutorNombre y AutorRol.
 * @returns {Object}
 */
function mensajeParaApi(fila) {
  return {
    id: fila.IdMensaje,
    auditoria_id: fila.IdAuditoria,
    texto: fila.Mensaje,
    autor: { id: fila.IdUsuario, nombre: fila.AutorNombre, rol: fila.AutorRol },
    creado_en: formatLocalDate(fila.CreadoEn),
  };
}

/**
 * GET /auditorias/:id/mensajes — Chat de la auditoría en orden de envío.
 */
async function listMensajes(req, res) {
  const auditoria = await auditoriaPermitida(req, res);
  if (!auditoria) return;

  const mensajes = await MensajeAuditoriaModel.findByAuditoria(auditoria.IdAuditoria);
  return res.status(200).json({ mensajes: mensajes.map(mensajeParaApi) });
}

/**
 * POST /auditorias/:id/mensajes — Envía un mensaje al chat de la auditoría.
 */
async function createMensaje(req, res) {
  const auditoria = await auditoriaPermitida(req, res);
  if (!auditoria) return;

  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (texto === '') {
    return res.status(400).json(buildError('Falta un dato obligatorio', 'mensaje', 'Escriba el mensaje antes de enviarlo'));
  }
  if (texto.length > MAXIMO_CARACTERES) {
    return res
      .status(400)
      .json(buildError('Texto demasiado largo', 'mensaje', `Use máximo ${MAXIMO_CARACTERES} caracteres`));
  }

  const mensajeId = await MensajeAuditoriaModel.create(auditoria.IdAuditoria, texto, req.user.id);
  const mensaje = mensajeParaApi(await MensajeAuditoriaModel.findById(mensajeId));
  avisarMensajeAuditoria(auditoria.IdAuditoria, auditoria.contadores, mensaje);
  return res.status(201).json({ mensaje: 'Mensaje enviado correctamente', nuevo_mensaje: mensaje });
}

module.exports = { listMensajes, createMensaje };
