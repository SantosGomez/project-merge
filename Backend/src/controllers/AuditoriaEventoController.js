const AuditoriaModel = require('../models/AuditoriaModel');
const AuditoriaEventoModel = require('../models/AuditoriaEventoModel');
const { formatLocalDate, formatearFechaISO, parseFechaInicio } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');

const ESTADOS_EVENTO = ['Pendiente', 'Revision', 'En Proceso', 'Rechazado', 'Completado'];

// Textos opcionales: [campo de la API, nombre para el usuario, máximo de la columna].
const TEXTOS_OPCIONALES = [
  ['folio', 'folio', 200],
  ['descripcion', 'descripción', 2000],
  ['observaciones', 'observaciones', 2000],
];
// Fechas opcionales que no pueden ser anteriores a la fecha del evento.
const FECHAS_OPCIONALES = [
  ['fecha_limite', 'fecha límite'],
  ['fecha_entrega', 'fecha de entrega'],
];

const errorFecha = (nombre) => buildError('Fecha no válida', nombre, 'Use una fecha real con formato DD-MM-AAAA');

/**
 * Valida el cuerpo de un evento. Con `actual` (edición) solo se validan los campos
 * enviados y el resto se toma del evento guardado.
 * @param {Object} cuerpo - Cuerpo de la petición.
 * @param {Object|null} [actual] - Evento guardado, en formato de la API.
 * @returns {Promise<{ error?: Object, datos?: Object }>} Error en formato de la API o datos limpios.
 */
async function validarEvento(cuerpo, actual = null) {
  const datos = {};
  const enviado = (campo) => !actual || Object.hasOwn(cuerpo, campo);

  if (enviado('evento')) {
    const texto = typeof cuerpo.evento === 'string' ? cuerpo.evento.trim() : '';
    if (texto === '') return { error: buildError('Falta un dato obligatorio', 'evento', 'Ingrese el evento') };
    if (texto.length > 200) return { error: buildError('Texto demasiado largo', 'evento', 'Use máximo 200 caracteres') };
    datos.evento = texto;
  } else {
    datos.evento = actual.evento;
  }

  if (enviado('fase_id')) {
    const faseId = cuerpo.fase_id;
    if (!Number.isInteger(faseId) || !(await AuditoriaEventoModel.faseExiste(faseId))) {
      return { error: buildError('Fase no válida', 'fase', 'Seleccione una de las fases de la lista') };
    }
    datos.fase_id = faseId;
  } else {
    datos.fase_id = actual.fase.id;
  }

  if (enviado('fecha')) {
    const fecha = parseFechaInicio(cuerpo.fecha);
    if (!fecha) return { error: errorFecha('fecha del evento') };
    datos.fecha = formatearFechaISO(fecha);
  } else {
    datos.fecha = actual.fecha;
  }

  for (const [campo, nombre] of FECHAS_OPCIONALES) {
    if (!enviado(campo)) {
      datos[campo] = actual ? actual[campo] : null;
      continue;
    }
    const valor = cuerpo[campo];
    if (valor === null || valor === undefined || valor === '') {
      datos[campo] = null;
      continue;
    }
    const fecha = parseFechaInicio(valor);
    if (!fecha) return { error: errorFecha(nombre) };
    datos[campo] = formatearFechaISO(fecha);
  }

  for (const [campo, nombre, maximo] of TEXTOS_OPCIONALES) {
    if (!enviado(campo)) {
      datos[campo] = actual ? actual[campo] : null;
      continue;
    }
    const valor = cuerpo[campo];
    if (valor !== null && valor !== undefined && typeof valor !== 'string') {
      return { error: buildError('Dato inválido', nombre, `Envíe ${nombre} como texto`) };
    }
    const texto = (valor ?? '').trim();
    if (texto.length > maximo) {
      return { error: buildError('Texto demasiado largo', nombre, `Use máximo ${maximo} caracteres`) };
    }
    datos[campo] = texto === '' ? null : texto;
  }

  if (enviado('estado') && cuerpo.estado !== undefined) {
    if (!ESTADOS_EVENTO.includes(cuerpo.estado)) {
      return {
        error: buildError('Estado no válido', 'estado', 'Seleccione Pendiente, Revision, En Proceso, Rechazado o Completado'),
      };
    }
    datos.estado = cuerpo.estado;
  } else {
    datos.estado = actual ? actual.estado : 'Pendiente';
  }

  // Las fechas AAAA-MM-DD se comparan bien como texto.
  for (const [campo, nombre] of FECHAS_OPCIONALES) {
    if (datos[campo] && datos[campo] < datos.fecha) {
      return { error: buildError('Fecha no válida', nombre, 'Debe ser igual o posterior a la fecha del evento') };
    }
  }

  return { datos };
}

/**
 * Convierte la fila de `auditoria_dtl` al formato de la API.
 * @param {Object} fila - Evento con FaseNombre y RegistradoPorNombre.
 * @returns {Object}
 */
function eventoParaApi(fila) {
  return {
    id: fila.Id_AudDtl,
    auditoria_id: fila.AudHdr_Id,
    evento: fila.Evento,
    fase: { id: fila.Fase_Id, nombre: fila.FaseNombre },
    fecha: formatearFechaISO(fila.Fecha),
    fecha_limite: fila.FechaLimite ? formatearFechaISO(fila.FechaLimite) : null,
    fecha_entrega: fila.FechaEntrega ? formatearFechaISO(fila.FechaEntrega) : null,
    folio: fila.Folio_Actas,
    descripcion: fila.Descripcion,
    estado: fila.Estado,
    observaciones: fila.Observaciones,
    registrado_por: { id: fila.Contador_id, nombre: fila.RegistradoPorNombre },
    creado_en: formatLocalDate(fila.CreadoEn),
  };
}

/**
 * Carga la auditoría de la ruta y comprueba que quien pide pueda trabajar en ella:
 * el administrador siempre; el contador, solo si está asignado.
 * @returns {Promise<Object|null>} La auditoría, o null si ya se respondió con 404/403.
 */
async function auditoriaPermitida(req, res) {
  const id = Number(req.params.id);
  const auditoria = Number.isInteger(id) && id > 0 ? await AuditoriaModel.findById(id) : null;
  if (!auditoria) {
    res.status(404).json(buildError('Auditoría no encontrada', 'auditoría', 'Actualice la lista e intente de nuevo'));
    return null;
  }
  if (req.user.rol !== 'administrador' && !(await AuditoriaModel.estaAsignado(id, req.user.id))) {
    res.status(403).json(buildError('Acceso denegado', 'auditoría', 'Solo los contadores asignados pueden trabajar en ella'));
    return null;
  }
  return auditoria;
}

/**
 * POST /auditorias/:id/eventos — Registra un evento en la bitácora.
 */
async function createEvento(req, res) {
  const auditoria = await auditoriaPermitida(req, res);
  if (!auditoria) return;

  const { error, datos } = await validarEvento(req.body ?? {});
  if (error) return res.status(400).json(error);

  const eventoId = await AuditoriaEventoModel.create(auditoria.IdAuditoria, datos, req.user.id);
  const evento = await AuditoriaEventoModel.findById(auditoria.IdAuditoria, eventoId);
  return res.status(201).json({ mensaje: 'Evento registrado correctamente', evento: eventoParaApi(evento) });
}

/**
 * GET /auditorias/:id/eventos — Bitácora de la auditoría en orden cronológico.
 */
async function listEventos(req, res) {
  const auditoria = await auditoriaPermitida(req, res);
  if (!auditoria) return;

  const eventos = await AuditoriaEventoModel.findByAuditoria(auditoria.IdAuditoria);
  return res.status(200).json({ eventos: eventos.map(eventoParaApi) });
}

/**
 * GET /auditorias/fases — Catálogo de fases para el formulario de la bitácora.
 */
async function listFases(req, res) {
  const fases = await AuditoriaEventoModel.listFases();
  return res.status(200).json({
    fases: fases.map((fase) => ({ id: fase.IdFase, nombre: fase.Fase, descripcion: fase.Descripcion })),
  });
}

/**
 * Carga el evento de la ruta, que debe pertenecer a la auditoría de la ruta.
 * @returns {Promise<Object|null>} El evento, o null si ya se respondió con 404.
 */
async function eventoDeLaRuta(req, res, auditoria) {
  const eventoId = Number(req.params.eventoId);
  const evento =
    Number.isInteger(eventoId) && eventoId > 0
      ? await AuditoriaEventoModel.findById(auditoria.IdAuditoria, eventoId)
      : null;
  if (!evento) {
    res.status(404).json(buildError('Evento no encontrado', 'bitácora', 'Actualice la bitácora e intente de nuevo'));
    return null;
  }
  return evento;
}

/**
 * PATCH /auditorias/:id/eventos/:eventoId — Edita un evento (solo los campos enviados).
 */
async function updateEvento(req, res) {
  const auditoria = await auditoriaPermitida(req, res);
  if (!auditoria) return;
  const evento = await eventoDeLaRuta(req, res, auditoria);
  if (!evento) return;

  const { error, datos } = await validarEvento(req.body ?? {}, eventoParaApi(evento));
  if (error) return res.status(400).json(error);

  await AuditoriaEventoModel.update(evento.Id_AudDtl, datos);
  const guardado = await AuditoriaEventoModel.findById(auditoria.IdAuditoria, evento.Id_AudDtl);
  return res.status(200).json({ mensaje: 'Evento actualizado correctamente', evento: eventoParaApi(guardado) });
}

/**
 * DELETE /auditorias/:id/eventos/:eventoId — Borra un evento capturado por error.
 */
async function deleteEvento(req, res) {
  const auditoria = await auditoriaPermitida(req, res);
  if (!auditoria) return;
  const evento = await eventoDeLaRuta(req, res, auditoria);
  if (!evento) return;

  await AuditoriaEventoModel.remove(evento.Id_AudDtl);
  return res.status(200).json({ mensaje: 'Evento borrado correctamente' });
}

module.exports = { createEvento, listEventos, listFases, updateEvento, deleteEvento };
