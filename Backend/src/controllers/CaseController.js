const CaseModel = require('../models/CaseModel');
const {
  validarCampoTexto,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
} = require('../utils/validationUtils');
const { buildError } = require('../utils/errorUtils');
const { nowLocal, formatLocalDate } = require('../utils/dateUtils');

// Devuelve el caso con sus fechas como texto en hora local YYYY-MM-DD HH:mm:ss (RF-48, RNF-2).
function conFechasLocales(caso) {
  return {
    ...caso,
    creado_en: formatLocalDate(caso.creado_en),
    actualizado_en: formatLocalDate(caso.actualizado_en),
  };
}

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

  const ahora = formatLocalDate(nowLocal());
  const casoId = await CaseModel.create({
    contador_id: req.user.id, // Asigna al contador autenticado (RF-17)
    cliente: cliente.trim(),
    estado: 'Pendiente', // Siempre Pendiente, no se elige (RF-18)
    prioridad,
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
 * @param {Object} req - Petición Express con params.id del caso y cuerpo { estado, prioridad } opcionales.
 * @param {Object} res - Respuesta Express.
 */
async function updateCase(req, res) {
  const { id } = req.params;
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

  // Si se envía estado, validar y actualizar (RF-22)
  if (estado !== undefined) {
    if (!validateStatus(estado)) {
      return res.status(400).json(
        buildError('Estado no válido', 'estado', 'Use uno de los siguientes: Pendiente, En proceso, Finalizado')
      );
    }
    await CaseModel.updateStatus(id, estado);
  }

  // Si se envía prioridad, validar y actualizar (RF-22)
  if (prioridad !== undefined) {
    if (!validatePriority(prioridad)) {
      return res.status(400).json(
        buildError('Prioridad no válida', 'prioridad', 'Use una de las siguientes: Alta, Media, Baja')
      );
    }
    await CaseModel.updatePriority(id, prioridad);
  }

  // Obtener el caso actualizado para devolverlo
  const caso = await CaseModel.findById(id);

  return res.status(200).json({
    mensaje: 'Caso actualizado correctamente',
    caso: conFechasLocales(caso),
  });
}

module.exports = { createCase, updateCase };
