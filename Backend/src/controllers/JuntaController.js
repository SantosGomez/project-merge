const JuntaModel = require('../models/JuntaModel');
const NotificacionModel = require('../models/NotificacionModel');
const UserModel = require('../models/UserModel');
const { buildError } = require('../utils/errorUtils');
const { eventos } = require('../utils/eventos');
const { parseCounterId } = require('../utils/validationUtils');
const { validarJunta, validarRango, validarRespuesta } = require('../utils/validacionJuntas');
const {
  calcularEstado,
  mensajeDeInvitacion,
  mensajeDeCambio,
  mensajeDeBorrado,
  mensajeDeRespuesta,
  mensajeDeEstado,
} = require('../utils/estadoJunta');

/**
 * Controladores de /juntas: cada cuenta del calendario ve las juntas que organiza o a las que la invitaron.
 */

const ERROR_NO_ENCONTRADA = buildError(
  'No se encontró la junta',
  'junta solicitada',
  'Actualiza el calendario y elige una de tus juntas'
);
const ERROR_ID_INVALIDO = buildError(
  'El identificador no es válido',
  'junta solicitada',
  'Actualiza el calendario y elige una de tus juntas'
);
const ERROR_NO_ORGANIZADOR = buildError(
  'Solo quien organiza la junta puede cambiarla o borrarla',
  'junta solicitada',
  'Pide a la persona que la organiza que haga el cambio'
);
const ERROR_ORGANIZADOR_NO_RESPONDE = buildError(
  'Quien organiza la junta no responde su propia invitación',
  'junta solicitada',
  'Solo los invitados aceptan o rechazan; para cambiar la junta usa «Editar»'
);
const ERROR_INVITADOS_NO_VALIDOS = buildError(
  'Algún invitado no existe o no usa el calendario',
  'participantes',
  'Actualiza la lista de invitados y elígelos de nuevo'
);

/**
 * Arma el registro de avisos de una operación: `avisar` los crea dentro de la transacción
 * y `enviar` avisa a la campana en tiempo real, solo después de que se guardó todo.
 * Nadie recibe aviso de su propia acción.
 * @param {number} autorId - Cuenta que hace la acción.
 * @returns {{ avisar: Function, enviar: Function }}
 */
function crearAvisos(autorId) {
  const destinatarios = new Set();
  return {
    async avisar(ejecutar, usuarioIds, mensaje, juntaId = null) {
      for (const usuarioId of usuarioIds.filter((id) => id !== autorId)) {
        await NotificacionModel.crear({ usuarioId, casoId: null, juntaId, mensaje }, ejecutar);
        destinatarios.add(usuarioId);
      }
    },
    enviar() {
      for (const usuarioId of destinatarios) eventos.enviarAUsuario(usuarioId, 'aviso-nuevo', {});
    },
  };
}

/**
 * GET /juntas/participantes-disponibles — Cuentas que se pueden invitar, sin quien pide.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarParticipantesDisponibles(req, res) {
  const usuarios = await JuntaModel.participantesDisponibles(Number(req.user.id));
  return res.status(200).json({ usuarios });
}

/**
 * GET /juntas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD — Juntas propias que se cruzan con el rango.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarJuntas(req, res) {
  const rango = validarRango(req.query.desde, req.query.hasta);
  if (rango.error) return res.status(400).json(rango.error);
  const juntas = await JuntaModel.listarEnRango(Number(req.user.id), rango.valor.desde, rango.valor.hastaExclusivo);
  return res.status(200).json({ juntas });
}

/**
 * Busca la junta y comprueba el acceso: quien no la organiza ni está invitado no la ve (404).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @returns {Promise<Object|null>} La junta, o null si ya se respondió el error.
 */
async function buscarConAcceso(req, res) {
  const id = parseCounterId(req.params.id);
  if (id === null) {
    res.status(400).json(ERROR_ID_INVALIDO);
    return null;
  }
  const usuarioId = Number(req.user.id);
  const junta = await JuntaModel.buscarPorId(id, usuarioId);
  const tieneAcceso = junta && (junta.soy_organizador || junta.participantes.some((p) => p.id === usuarioId));
  if (!tieneAcceso) {
    res.status(404).json(ERROR_NO_ENCONTRADA);
    return null;
  }
  return junta;
}

/**
 * Como `buscarConAcceso`, pero solo deja pasar a quien organiza (a un invitado le responde 403).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @returns {Promise<Object|null>} La junta, o null si ya se respondió el error.
 */
async function buscarComoOrganizador(req, res) {
  const junta = await buscarConAcceso(req, res);
  if (junta && !junta.soy_organizador) {
    res.status(403).json(ERROR_NO_ORGANIZADOR);
    return null;
  }
  return junta;
}

/**
 * Valida el cuerpo y que todos los invitados existan y usen el calendario.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @returns {Promise<Object|null>} Los datos limpios, o null si ya se respondió el error.
 */
async function leerDatosDeJunta(req, res) {
  const datos = validarJunta(req.body, Number(req.user.id));
  if (datos.error) {
    res.status(400).json(datos.error);
    return null;
  }
  const validos = await JuntaModel.idsConRolDeCalendario(datos.valor.participantes);
  if (validos.length !== datos.valor.participantes.length) {
    res.status(400).json(ERROR_INVITADOS_NO_VALIDOS);
    return null;
  }
  return datos.valor;
}

/**
 * POST /juntas — Crea una junta con sus invitados en pendiente.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function crearJunta(req, res) {
  const datos = await leerDatosDeJunta(req, res);
  if (!datos) return undefined;
  const usuarioId = Number(req.user.id);
  const { avisar, enviar } = crearAvisos(usuarioId);
  const organizador = (await UserModel.findById(usuarioId)).nombre;
  const junta = await JuntaModel.crear(usuarioId, datos, async (ejecutar, juntaId) => {
    await avisar(ejecutar, datos.participantes, mensajeDeInvitacion(organizador, datos.titulo, datos.inicio), juntaId);
  });
  enviar();
  return res.status(201).json({ junta });
}

/**
 * GET /juntas/:id — Una junta de la cuenta (como organizadora o invitada).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function obtenerJunta(req, res) {
  const junta = await buscarConAcceso(req, res);
  if (!junta) return undefined;
  return res.status(200).json({ junta });
}

/**
 * PATCH /juntas/:id — El organizador reemplaza los datos y la lista de invitados.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function actualizarJunta(req, res) {
  const existente = await buscarComoOrganizador(req, res);
  if (!existente) return undefined;
  const datos = await leerDatosDeJunta(req, res);
  if (!datos) return undefined;
  const usuarioId = Number(req.user.id);
  const cambioElHorario = datos.inicio !== existente.inicio || datos.fin !== existente.fin;
  const siguen = existente.participantes.map((p) => p.id).filter((id) => datos.participantes.includes(id));
  const nuevos = datos.participantes.filter((id) => !siguen.includes(id));
  const organizador = existente.creado_por.nombre;
  const { avisar, enviar } = crearAvisos(usuarioId);
  const junta = await JuntaModel.actualizar(existente.id, usuarioId, datos, {
    reiniciarRespuestas: cambioElHorario,
    avisos: async (ejecutar) => {
      await avisar(ejecutar, nuevos, mensajeDeInvitacion(organizador, datos.titulo, datos.inicio), existente.id);
      if (cambioElHorario) {
        await avisar(ejecutar, siguen, mensajeDeCambio(organizador, datos.titulo, datos.inicio), existente.id);
      }
    },
  });
  enviar();
  return res.status(200).json({ junta });
}

/**
 * DELETE /juntas/:id — El organizador borra la junta y a sus invitados.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function eliminarJunta(req, res) {
  const existente = await buscarComoOrganizador(req, res);
  if (!existente) return undefined;
  const { avisar, enviar } = crearAvisos(Number(req.user.id));
  const mensaje = mensajeDeBorrado(existente.creado_por.nombre, existente.titulo, existente.inicio);
  await JuntaModel.eliminar(existente.id, (ejecutar) =>
    avisar(ejecutar, existente.participantes.map((p) => p.id), mensaje)
  );
  enviar();
  return res.status(200).json({ ok: true });
}

/**
 * PATCH /juntas/:id/respuesta — Un invitado acepta o rechaza (y puede cambiarlo después).
 * Avisa al organizador y, si la respuesta de un administrador confirma o cancela la junta, a todos los demás.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function responderJunta(req, res) {
  const existente = await buscarConAcceso(req, res);
  if (!existente) return undefined;
  if (existente.soy_organizador) return res.status(403).json(ERROR_ORGANIZADOR_NO_RESPONDE);
  const datos = validarRespuesta(req.body);
  if (datos.error) return res.status(400).json(datos.error);

  const usuarioId = Number(req.user.id);
  const yo = existente.participantes.find((p) => p.id === usuarioId);
  const despues = existente.participantes.map((p) => (p.id === usuarioId ? { ...p, respuesta: datos.valor } : p));
  const estado = calcularEstado(despues);
  const cambioElEstado = yo.rol === 'administrador' && estado !== existente.estado && estado !== 'por_confirmar';
  const { avisar, enviar } = crearAvisos(usuarioId);
  const repetida = yo.respuesta === datos.valor;
  const junta = await JuntaModel.responder(existente.id, usuarioId, datos.valor, async (ejecutar) => {
    if (repetida) return;
    const organizadorId = existente.creado_por.id;
    await avisar(ejecutar, [organizadorId], mensajeDeRespuesta(yo.nombre, existente.titulo, datos.valor), existente.id);
    if (cambioElEstado) {
      const todos = [organizadorId, ...existente.participantes.map((p) => p.id)];
      await avisar(ejecutar, todos, mensajeDeEstado(existente.titulo, estado), existente.id);
    }
  });
  enviar();
  return res.status(200).json({ junta });
}

module.exports = {
  listarParticipantesDisponibles,
  listarJuntas,
  crearJunta,
  obtenerJunta,
  actualizarJunta,
  responderJunta,
  eliminarJunta,
};
