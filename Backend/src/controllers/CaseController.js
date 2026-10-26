const CaseModel = require('../models/CaseModel');
const {
  validarCampoTexto,
  validarTextoOpcional,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
} = require('../utils/validationUtils');
const { buildError } = require('../utils/errorUtils');
const {
  nowLocal,
  formatLocalDate,
  formatearFechaISO,
  parseFechaInicio,
  calcularFechaVencimiento,
  casoConFechasLocales,
} = require('../utils/dateUtils');

// Devuelve el caso con sus fechas como texto en hora local YYYY-MM-DD HH:mm:ss (RF-48, RNF-2).
// Serializador compartido de dateUtils (mismo que usa CounterController).
const conFechasLocales = casoConFechasLocales;

/**
 * Registra un nuevo caso (solo contador autenticado).
 * RF-17, RF-18, RF-19, RF-20, RF-21.
 * @param {Object} req - Petición Express con cuerpo { cliente, prioridad } y req.user.id.
 * @param {Object} res - Respuesta Express.
 */
async function createCase(req, res) {
  const { cliente, prioridad } = req.body;

  // Validar entrada del caso (RF-19, RF-20, RF-21)
  const validacion = validateNewCaseInput(cliente, prioridad);
  if (!validacion.valido) {
    let queOcurrio = '';
    let sobreQue = '';
    let queHacer = '';
    if (validacion.error === 'cliente_requerido') {
      queOcurrio = 'Falta el campo cliente';
      sobreQue = 'cliente';
      queHacer = 'Ingrese el nombre del cliente';
    } else if (validacion.error === 'cliente_tipo_invalido') {
      queOcurrio = 'Dato inválido';
      sobreQue = 'cliente';
      queHacer = 'El cliente debe enviarse como texto';
    } else if (validacion.error === 'cliente_demasiado_largo') {
      queOcurrio = 'El cliente supera el máximo de caracteres permitidos';
      sobreQue = 'cliente';
      queHacer = 'El cliente debe tener máximo 80 caracteres';
    } else if (validacion.error === 'prioridad_requerida') {
      queOcurrio = 'Falta la prioridad';
      sobreQue = 'prioridad';
      queHacer = 'Seleccione una prioridad: Alta, Media o Baja';
    } else if (validacion.error === 'prioridad_tipo_invalida') {
      queOcurrio = 'Dato inválido';
      sobreQue = 'prioridad';
      queHacer = 'La prioridad debe enviarse como texto: Alta, Media o Baja';
    } else if (validacion.error === 'prioridad_invalida') {
      queOcurrio = 'Prioridad no válida';
      sobreQue = 'prioridad';
      queHacer = 'Seleccione una prioridad válida: Alta, Media o Baja';
    }
    return res.status(400).json(buildError(queOcurrio, sobreQue, queHacer));
  }

  // Descripción y observaciones son opcionales: ausente se guarda como null.
  // Si vienen, validan tipo y longitud máxima (RF-21).
  const descripcionValidacion = validarTextoOpcional(req.body.descripcion, 'descripción', 1000);
  if (descripcionValidacion.estado === 'tipo_invalido') {
    return res.status(400).json(buildError('Dato inválido', 'descripción', 'La descripción debe enviarse como texto'));
  }
  if (descripcionValidacion.estado === 'demasiado_largo') {
    return res.status(400).json(
      buildError('La descripción supera el máximo de caracteres permitidos', 'descripción', 'La descripción debe tener máximo 1000 caracteres')
    );
  }
  const descripcion = descripcionValidacion.estado === 'valido' ? descripcionValidacion.valor : null;

  const observacionesValidacion = validarTextoOpcional(req.body.observaciones, 'observaciones', 2000);
  if (observacionesValidacion.estado === 'tipo_invalido') {
    return res.status(400).json(buildError('Dato inválido', 'observaciones', 'Las observaciones deben enviarse como texto'));
  }
  if (observacionesValidacion.estado === 'demasiado_largo') {
    return res.status(400).json(
      buildError('Las observaciones superan el máximo de caracteres permitidos', 'observaciones', 'Las observaciones deben tener máximo 2000 caracteres')
    );
  }
  const observaciones = observacionesValidacion.estado === 'valido' ? observacionesValidacion.valor : null;

  const ahora = formatLocalDate(nowLocal());

  // Fecha de inicio: si el frontend la envía, se interpreta sin desplazar el día;
  // si no viene (o viene vacía), hoy. Una fecha inválida se rechaza antes de tocar la BD:
  // el cálculo de días hábiles no puede recibir un Invalid Date (antes colgaba el servidor).
  const fechaRecibida = req.body.fecha_inicio;
  const sinFecha = fechaRecibida === undefined || fechaRecibida === null || fechaRecibida === '';
  const fechaInicioFecha = sinFecha ? nowLocal() : parseFechaInicio(fechaRecibida);
  if (!fechaInicioFecha) {
    return res.status(400).json(
      buildError(
        'Fecha de inicio no válida',
        'fecha_inicio',
        'Use una fecha real con formato DD-MM-AAAA o AAAA-MM-DD'
      )
    );
  }

  const fechaInicio = formatearFechaISO(fechaInicioFecha);
  // Vencimiento automático según prioridad (días hábiles: Alta=5, Media=10, Baja=15)
  const fechaVencimiento = calcularFechaVencimiento(fechaInicioFecha, prioridad);

  const casoId = await CaseModel.create({
    contador_id: req.user.id, // Asigna al contador autenticado (RF-17)
    cliente: cliente.trim(),
    estado: 'Pendiente', // Siempre Pendiente, no se elige (RF-18)
    prioridad,
    descripcion,
    observaciones,
    fecha_inicio: fechaInicio,
    fecha_vencimiento: fechaVencimiento,
    creado_en: ahora,
    actualizado_en: ahora,
  });

  const caso = await CaseModel.findById(casoId);

  return res.status(201).json({
    mensaje: 'Caso registrado correctamente',
    caso: conFechasLocales(caso),
  });
}

/**
 * Cambia el estado y/o la prioridad de un caso propio (solo contador autenticado, checkCaseOwnership ya verificado).
 * RF-22. El campo cliente no es editable.
 * @param {Object} req - Petición Express con req.caso (puesto por checkCaseOwnership) y cuerpo { estado, prioridad } opcionales.
 * @param {Object} res - Respuesta Express.
 */
async function updateCase(req, res) {
  const { estado, prioridad } = req.body;

  // RF-37: un dato no textual se rechaza antes de guardar nada, para no dejar cambios a medias
  for (const [campo, valor, queHacer] of [
    ['estado', estado, 'El estado debe enviarse como texto: Pendiente, En proceso o Finalizado'],
    ['prioridad', prioridad, 'La prioridad debe enviarse como texto: Alta, Media o Baja'],
  ]) {
    if (valor !== undefined && validarCampoTexto(valor, campo).estado === 'tipo_invalido') {
      return res.status(400).json(buildError('Dato inválido', campo, queHacer));
    }
  }

  // Si se envía estado, validarlo (RF-22)
  if (estado !== undefined) {
    if (!validateStatus(estado)) {
      return res.status(400).json(
        buildError('Estado no válido', 'estado', 'Use uno de los siguientes: Pendiente, En proceso, Finalizado')
      );
    }
  }

  // Si se envía prioridad, validarla (RF-22)
  if (prioridad !== undefined) {
    if (!validatePriority(prioridad)) {
      return res.status(400).json(
        buildError('Prioridad no válida', 'prioridad', 'Use una de las siguientes: Alta, Media, Baja')
      );
    }
  }

  // El vencimiento solo se recalcula si la prioridad cambia, contando desde la fecha de
  // inicio guardada (que no se modifica); cambiar solo el estado no lo toca.
  const casoActual = req.caso;
  const cambiaPrioridad = prioridad !== undefined && prioridad !== casoActual.prioridad;
  const fechaVencimiento = cambiaPrioridad
    ? calcularFechaVencimiento(casoActual.fecha_inicio || nowLocal(), prioridad)
    : undefined;

  // Un solo UPDATE: estado, prioridad y vencimiento se guardan juntos o no se guarda nada.
  await CaseModel.updatePatch(casoActual.id, { estado, prioridad, fecha_vencimiento: fechaVencimiento });

  const caso = await CaseModel.findById(casoActual.id);

  return res.status(200).json({
    mensaje: 'Caso actualizado correctamente',
    caso: conFechasLocales(caso),
  });
}

module.exports = { createCase, updateCase };
