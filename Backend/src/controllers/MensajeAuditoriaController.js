const MensajeAuditoriaModel = require('../models/MensajeAuditoriaModel');
const NotificacionModel = require('../models/NotificacionModel');
const { auditoriaPermitida } = require('./AuditoriaEventoController');
const { formatLocalDate } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const { avisarMensajeAuditoria } = require('../utils/avisosAuditoria');
const { eventos } = require('../utils/eventos');

const MAXIMO_CARACTERES = 1000;
// Caracteres del mensaje que se citan en el aviso de la campana.
const RECORTE_AVISO = 100;

/**
 * Texto del aviso de la campana: quién escribió, en qué auditoría y el inicio del mensaje.
 * @param {string} autor - nombre de quien escribió.
 * @param {string} cliente - cliente de la auditoría.
 * @param {string} texto - mensaje completo.
 * @returns {string}
 */
function textoDelAviso(autor, cliente, texto) {
  const enUnaLinea = texto.replace(/\s+/g, ' ');
  const cita = enUnaLinea.length > RECORTE_AVISO ? `${enUnaLinea.slice(0, RECORTE_AVISO).trimEnd()}…` : enUnaLinea;
  return `${autor} escribió en la auditoría de ${cliente}: «${cita}»`;
}

/**
 * Deja el aviso en la campana de los contadores asignados, menos quien escribió, y la
 * actualiza en vivo. El administrador no tiene campana del chat (decisión del usuario).
 * @param {Object} auditoria - auditoría con `contadores`.
 * @param {Object} mensaje - mensaje en formato de la API.
 */
async function avisarEnCampana(auditoria, mensaje) {
  const destinatarios = auditoria.contadores.filter((contador) => contador.id !== mensaje.autor.id);
  const texto = textoDelAviso(mensaje.autor.nombre, auditoria.Cliente, mensaje.texto);
  for (const { id } of destinatarios) {
    await NotificacionModel.crear({ usuarioId: id, casoId: null, mensaje: texto });
    eventos.enviarAUsuario(id, 'aviso-nuevo', { auditoriaId: auditoria.IdAuditoria });
  }
}

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
    return res.status(400).json(buildError('Falta un dato obligatorio', 'mensaje', 'Escribe el mensaje antes de enviarlo'));
  }
  if (texto.length > MAXIMO_CARACTERES) {
    return res
      .status(400)
      .json(buildError('Texto demasiado largo', 'mensaje', `Usa máximo ${MAXIMO_CARACTERES} caracteres`));
  }

  const mensajeId = await MensajeAuditoriaModel.create(auditoria.IdAuditoria, texto, req.user.id);
  const mensaje = mensajeParaApi(await MensajeAuditoriaModel.findById(mensajeId));
  avisarMensajeAuditoria(auditoria.IdAuditoria, auditoria.contadores, mensaje, auditoria.Cliente);
  await avisarEnCampana(auditoria, mensaje);
  return res.status(201).json({ mensaje: 'Mensaje enviado correctamente', nuevo_mensaje: mensaje });
}

module.exports = { listMensajes, createMensaje };
