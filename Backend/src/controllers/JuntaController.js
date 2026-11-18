const JuntaModel = require('../models/JuntaModel');
const NotificacionModel = require('../models/NotificacionModel');
const UserModel = require('../models/UserModel');
const { buildError } = require('../utils/errorUtils');
const { eventos } = require('../utils/eventos');
const { parseCounterId } = require('../utils/validationUtils');
const { validarJunta, validarOrganizador, validarRango, validarRespuesta } = require('../utils/validacionJuntas');
const { esSecretaria, puedeAgendarANombreDe, puedeVerCompleta, resolverRespuestaEnNombre } = require('../utils/accesoJuntas');
const {
  calcularEstado,
  mensajeDeInvitacion,
  mensajeDeCambio,
  mensajeDeBorrado,
  mensajeDeRespuesta,
  mensajeDeEstado,
  mensajeDeAgendadoPorSecretaria,
  mensajeDeCambioPorSecretaria,
  mensajeDeBorradoPorSecretaria,
  mensajeDeRespuestaPorSecretaria,
} = require('../utils/estadoJunta');

/**
 * Controladores de /juntas: cada cuenta del calendario ve las juntas que organiza o a las que la invitaron.
 * La recepcionista actúa además como secretaria de los administradores (ver `utils/accesoJuntas.js`).
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
const ERROR_USUARIO_INVALIDO = buildError(
  'El identificador de la persona no es válido',
  'persona solicitada',
  'Elige a la persona de la lista «Ver agenda de»'
);
const ERROR_USUARIO_NO_ENCONTRADO = buildError(
  'No se encontró a la persona',
  'persona solicitada',
  'Elige a la persona de la lista «Ver agenda de»'
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
const ERROR_SOLO_SECRETARIA_ORGANIZADOR = buildError(
  'Solo la recepcionista puede agendar a nombre de un administrador',
  'organizador',
  'Quita el organizador: la junta quedará a tu nombre'
);
const ERROR_ORGANIZADOR_NO_ADMINISTRADOR = buildError(
  'La persona elegida no es un administrador que atiendas',
  'organizador',
  'Elige a uno de los administradores que administras'
);
const ERROR_SOLO_SECRETARIA_RESPONDE = buildError(
  'Solo la recepcionista puede responder en nombre de un administrador',
  'respuesta',
  'Quita en_nombre_de: tu respuesta se guardará a tu nombre'
);
const ERROR_EN_NOMBRE_DE_INVALIDO = buildError(
  'El administrador por el que respondes no es válido',
  'administrador',
  'Elige a uno de los administradores invitados a la junta'
);
const ERROR_ADMINISTRADOR_NO_INVITADO = buildError(
  'Ese administrador no está invitado a la junta',
  'administrador',
  'Elige a uno de los administradores invitados a la junta'
);

/**
 * Arma el registro de avisos de una operación: `avisar` los crea dentro de la transacción
 * y `enviar` avisa a la campana en tiempo real, solo después de que se guardó todo.
 * Nadie recibe aviso de su propia acción.
 * @param {number} autorId - Cuenta que hace la acción.
 * @param {number[]} [tambienExcluidos] - Otras cuentas que no deben recibir estos avisos (p. ej. el administrador
 *   por el que responde la secretaria, que recibe su propio aviso aparte).
 * @returns {{ avisar: Function, enviar: Function }}
 */
function crearAvisos(autorId, tambienExcluidos = []) {
  const excluidos = [autorId, ...tambienExcluidos];
  const destinatarios = new Set();
  return {
    async avisar(ejecutar, usuarioIds, mensaje, juntaId = null) {
      for (const usuarioId of usuarioIds.filter((id) => !excluidos.includes(id))) {
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
 * La cuenta que hace la petición, con lo que necesitan el modelo y las reglas de acceso.
 * @param {Object} req - Petición Express.
 * @returns {{ id: number, rol: string }}
 */
function consultanteDe(req) {
  return { id: Number(req.user.id), rol: req.user.rol };
}

/**
 * Nombre de una cuenta (para los avisos que dicen quién hizo algo).
 * @param {number} id - Id de la cuenta.
 * @returns {Promise<string>}
 */
async function nombreDe(id) {
  return (await UserModel.findById(id)).nombre;
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
  const juntas = await JuntaModel.listarEnRango(consultanteDe(req), rango.valor.desde, rango.valor.hastaExclusivo);
  return res.status(200).json({ juntas });
}

/**
 * GET /juntas/agenda/:usuarioId?desde&hasta — Agenda de otra cuenta del calendario: sus juntas completas si
 * quien consulta participa (o es secretaria y la agenda es de un administrador) y, si no, solo «Ocupado»
 * o el título, el horario y el organizador.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function obtenerAgenda(req, res) {
  const usuarioId = parseCounterId(req.params.usuarioId);
  if (usuarioId === null) return res.status(400).json(ERROR_USUARIO_INVALIDO);
  const rango = validarRango(req.query.desde, req.query.hasta);
  if (rango.error) return res.status(400).json(rango.error);
  const usuario = await JuntaModel.buscarUsuarioDelCalendario(usuarioId);
  if (!usuario) return res.status(404).json(ERROR_USUARIO_NO_ENCONTRADO);
  const juntas = await JuntaModel.agendaDe(usuario, consultanteDe(req), rango.valor.desde, rango.valor.hastaExclusivo);
  return res.status(200).json({ usuario, juntas });
}

/**
 * Busca la junta y comprueba el acceso: quien no la organiza, no está invitado y no es secretaria de
 * una junta de un administrador no la ve (404).
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
  const consultante = consultanteDe(req);
  const junta = await JuntaModel.buscarPorId(id, consultante);
  if (!junta || !puedeVerCompleta(consultante, junta)) {
    res.status(404).json(ERROR_NO_ENCONTRADA);
    return null;
  }
  return junta;
}

/**
 * Como `buscarConAcceso`, pero solo deja pasar a quien puede editar: quien organiza o la secretaria
 * de una junta de administrador (a quien solo la ve le responde 403).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @returns {Promise<Object|null>} La junta, o null si ya se respondió el error.
 */
async function buscarComoOrganizador(req, res) {
  const junta = await buscarConAcceso(req, res);
  if (junta && !junta.puede_editar) {
    res.status(403).json(ERROR_NO_ORGANIZADOR);
    return null;
  }
  return junta;
}

/**
 * Valida el cuerpo y que todos los invitados existan y usen el calendario.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @param {number} organizadorId - Quien organiza la junta (no puede invitarse a sí mismo).
 * @returns {Promise<Object|null>} Los datos limpios, o null si ya se respondió el error.
 */
async function leerDatosDeJunta(req, res, organizadorId) {
  const datos = validarJunta(req.body, organizadorId);
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
 * Decide quién organiza la junta que se crea: quien llama o, si es secretaria y envía `organizador_id`,
 * el administrador elegido.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @returns {Promise<number|null>} El id del organizador, o null si ya se respondió el error.
 */
async function resolverOrganizador(req, res) {
  const consultante = consultanteDe(req);
  const enviado = req.body !== null && typeof req.body === 'object' ? req.body.organizador_id : undefined;
  if (enviado === undefined) return consultante.id;
  if (!esSecretaria(consultante)) {
    res.status(403).json(ERROR_SOLO_SECRETARIA_ORGANIZADOR);
    return null;
  }
  const organizador = validarOrganizador(enviado);
  if (organizador.error) {
    res.status(400).json(organizador.error);
    return null;
  }
  const cuenta = await JuntaModel.buscarUsuarioDelCalendario(organizador.valor);
  if (!cuenta || !puedeAgendarANombreDe(cuenta)) {
    res.status(400).json(ERROR_ORGANIZADOR_NO_ADMINISTRADOR);
    return null;
  }
  return cuenta.id;
}

/**
 * POST /juntas — Crea una junta con sus invitados en pendiente. Una recepcionista puede enviar `organizador_id`
 * para agendarla a nombre de un administrador: él queda como organizador y recibe un aviso con enlace.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function crearJunta(req, res) {
  const consultante = consultanteDe(req);
  const organizadorId = await resolverOrganizador(req, res);
  if (organizadorId === null) return undefined;
  const datos = await leerDatosDeJunta(req, res, organizadorId);
  if (!datos) return undefined;
  const { avisar, enviar } = crearAvisos(consultante.id);
  const organizador = await nombreDe(organizadorId);
  const junta = await JuntaModel.crear(organizadorId, consultante, datos, async (ejecutar, juntaId) => {
    await avisar(ejecutar, datos.participantes, mensajeDeInvitacion(organizador, datos.titulo, datos.inicio), juntaId);
    if (organizadorId !== consultante.id) {
      const secretaria = await nombreDe(consultante.id);
      await avisar(ejecutar, [organizadorId], mensajeDeAgendadoPorSecretaria(secretaria, datos.titulo, datos.inicio), juntaId);
    }
  });
  enviar();
  return res.status(201).json({ junta });
}

/**
 * GET /juntas/:id — Una junta de la cuenta (como organizadora, invitada o secretaria de un administrador).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function obtenerJunta(req, res) {
  const junta = await buscarConAcceso(req, res);
  if (!junta) return undefined;
  return res.status(200).json({ junta });
}

/**
 * PATCH /juntas/:id — El organizador (o la secretaria, si lo es un administrador) reemplaza los datos y la lista
 * de invitados. Los invitados ven los avisos a nombre del organizador; si edita la secretaria, el administrador
 * recibe además un aviso suyo.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function actualizarJunta(req, res) {
  const existente = await buscarComoOrganizador(req, res);
  if (!existente) return undefined;
  const consultante = consultanteDe(req);
  const organizadorId = existente.creado_por.id;
  const datos = await leerDatosDeJunta(req, res, organizadorId);
  if (!datos) return undefined;
  const cambioElHorario = datos.inicio !== existente.inicio || datos.fin !== existente.fin;
  const siguen = existente.participantes.map((p) => p.id).filter((id) => datos.participantes.includes(id));
  const nuevos = datos.participantes.filter((id) => !siguen.includes(id));
  const organizador = existente.creado_por.nombre;
  const { avisar, enviar } = crearAvisos(consultante.id);
  const junta = await JuntaModel.actualizar(existente.id, consultante, datos, {
    reiniciarRespuestas: cambioElHorario,
    avisos: async (ejecutar) => {
      await avisar(ejecutar, nuevos, mensajeDeInvitacion(organizador, datos.titulo, datos.inicio), existente.id);
      if (cambioElHorario) {
        await avisar(ejecutar, siguen, mensajeDeCambio(organizador, datos.titulo, datos.inicio), existente.id);
      }
      if (organizadorId !== consultante.id) {
        const secretaria = await nombreDe(consultante.id);
        await avisar(ejecutar, [organizadorId], mensajeDeCambioPorSecretaria(secretaria, datos.titulo), existente.id);
      }
    },
  });
  enviar();
  return res.status(200).json({ junta });
}

/**
 * DELETE /juntas/:id — El organizador (o la secretaria, si lo es un administrador) borra la junta y a sus invitados.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function eliminarJunta(req, res) {
  const existente = await buscarComoOrganizador(req, res);
  if (!existente) return undefined;
  const consultante = consultanteDe(req);
  const organizadorId = existente.creado_por.id;
  const { avisar, enviar } = crearAvisos(consultante.id);
  const mensaje = mensajeDeBorrado(existente.creado_por.nombre, existente.titulo, existente.inicio);
  await JuntaModel.eliminar(existente.id, async (ejecutar) => {
    await avisar(ejecutar, existente.participantes.map((p) => p.id), mensaje);
    if (organizadorId !== consultante.id) {
      const secretaria = await nombreDe(consultante.id);
      await avisar(ejecutar, [organizadorId], mensajeDeBorradoPorSecretaria(secretaria, existente.titulo, existente.inicio));
    }
  });
  enviar();
  return res.status(200).json({ ok: true });
}

/**
 * Decide quién responde: quien llama o, con `en_nombre_de` (solo la recepcionista), un administrador invitado.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 * @param {Object} existente - La junta, ya con el acceso comprobado.
 * @returns {Object|null} El invitado cuya fila se actualiza, o null si ya se respondió el error.
 */
function resolverQuienResponde(req, res, existente) {
  const consultante = consultanteDe(req);
  const enNombreDe = req.body !== null && typeof req.body === 'object' ? req.body.en_nombre_de : undefined;
  if (enNombreDe === undefined) {
    if (existente.soy_organizador) {
      res.status(403).json(ERROR_ORGANIZADOR_NO_RESPONDE);
      return null;
    }
    const propio = existente.participantes.find((p) => p.id === consultante.id);
    // La secretaria puede ver juntas de administradores a las que no la invitaron: sin en_nombre_de no responde nada.
    if (!propio) res.status(404).json(ERROR_NO_ENCONTRADA);
    return propio || null;
  }
  const decision = resolverRespuestaEnNombre(consultante, existente.participantes, enNombreDe);
  if (decision.error === 'prohibido') res.status(403).json(ERROR_SOLO_SECRETARIA_RESPONDE);
  else if (decision.error === 'invalido') res.status(400).json(ERROR_EN_NOMBRE_DE_INVALIDO);
  else if (decision.error === 'no_invitado') res.status(404).json(ERROR_ADMINISTRADOR_NO_INVITADO);
  return decision.participante || null;
}

/**
 * PATCH /juntas/:id/respuesta — Un invitado acepta o rechaza (y puede cambiarlo después). La recepcionista puede
 * responder por un administrador invitado con `en_nombre_de`: queda en la fila del administrador y él recibe un aviso.
 * Avisa al organizador y, si la respuesta de un administrador confirma o cancela la junta, a todos los demás.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function responderJunta(req, res) {
  const existente = await buscarConAcceso(req, res);
  if (!existente) return undefined;
  const quien = resolverQuienResponde(req, res, existente);
  if (!quien) return undefined;
  const datos = validarRespuesta(req.body);
  if (datos.error) return res.status(400).json(datos.error);

  const consultante = consultanteDe(req);
  const porOtro = quien.id !== consultante.id;
  const despues = existente.participantes.map((p) => (p.id === quien.id ? { ...p, respuesta: datos.valor } : p));
  const estado = calcularEstado(despues);
  const cambioElEstado = quien.rol === 'administrador' && estado !== existente.estado && estado !== 'por_confirmar';
  const generales = crearAvisos(consultante.id, [quien.id]);
  const propio = crearAvisos(consultante.id);
  const repetida = quien.respuesta === datos.valor;
  const junta = await JuntaModel.responder(existente.id, quien.id, consultante, datos.valor, async (ejecutar) => {
    if (repetida) return;
    const organizadorId = existente.creado_por.id;
    await generales.avisar(ejecutar, [organizadorId], mensajeDeRespuesta(quien.nombre, existente.titulo, datos.valor), existente.id);
    if (cambioElEstado) {
      const todos = [organizadorId, ...existente.participantes.map((p) => p.id)];
      await generales.avisar(ejecutar, todos, mensajeDeEstado(existente.titulo, estado), existente.id);
    }
    if (porOtro) {
      const secretaria = await nombreDe(consultante.id);
      const mensaje = mensajeDeRespuestaPorSecretaria(secretaria, existente.titulo, datos.valor);
      await propio.avisar(ejecutar, [quien.id], mensaje, existente.id);
    }
  });
  generales.enviar();
  propio.enviar();
  return res.status(200).json({ junta });
}

module.exports = {
  listarParticipantesDisponibles,
  listarJuntas,
  obtenerAgenda,
  crearJunta,
  obtenerJunta,
  actualizarJunta,
  responderJunta,
  eliminarJunta,
};
