const CaseModel = require('../models/CaseModel');
const NotificacionModel = require('../models/NotificacionModel');
const UserModel = require('../models/UserModel');
const { conTransaccion } = require('../config/db');
const {
  validarCampoTexto,
  validarTextoOpcional,
  validateNewCaseInput,
  validateStatus,
  validatePriority,
  parseCounterId,
} = require('../utils/validationUtils');
const { buildError } = require('../utils/errorUtils');
const {
  nowLocal,
  formatLocalDate,
  formatearFechaISO,
  parseFechaInicio,
  casoConFechasLocales,
} = require('../utils/dateUtils');

// Devuelve el caso con sus fechas como texto en hora local YYYY-MM-DD HH:mm:ss (RF-48, RNF-2).
// Serializador compartido de dateUtils (mismo que usa CounterController).
const conFechasLocales = casoConFechasLocales;

// Mensajes de error (qué ocurrió, sobre qué, qué hacer) de cliente y prioridad (RF-19 a RF-21).
const MENSAJES_ENTRADA_CASO = {
  cliente_requerido: ['Falta el campo cliente', 'cliente', 'Ingrese el nombre del cliente'],
  cliente_tipo_invalido: ['Dato inválido', 'cliente', 'El cliente debe enviarse como texto'],
  cliente_demasiado_largo: [
    'El cliente supera el máximo de caracteres permitidos',
    'cliente',
    'El cliente debe tener máximo 80 caracteres',
  ],
  prioridad_requerida: ['Falta la prioridad', 'prioridad', 'Seleccione una prioridad: Alta, Media o Baja'],
  prioridad_tipo_invalida: ['Dato inválido', 'prioridad', 'La prioridad debe enviarse como texto: Alta, Media o Baja'],
  prioridad_invalida: ['Prioridad no válida', 'prioridad', 'Seleccione una prioridad válida: Alta, Media o Baja'],
};

// Descripción y observaciones son opcionales: tipo texto y longitud máxima (RF-21).
const TEXTOS_OPCIONALES = {
  descripcion: {
    nombre: 'descripción',
    maximo: 1000,
    tipo: 'La descripción debe enviarse como texto',
    largo: ['La descripción supera el máximo de caracteres permitidos', 'La descripción debe tener máximo 1000 caracteres'],
  },
  observaciones: {
    nombre: 'observaciones',
    maximo: 2000,
    tipo: 'Las observaciones deben enviarse como texto',
    largo: ['Las observaciones superan el máximo de caracteres permitidos', 'Las observaciones deben tener máximo 2000 caracteres'],
  },
};

// Importante es opcional, pero si viene debe ser un booleano real (no "true", 1 ni null)
const ERROR_IMPORTANTE = buildError('Dato inválido', 'importante', 'Envíe importante como true o false');

function importanteInvalido(valor) {
  return valor !== undefined && typeof valor !== 'boolean';
}

const ERROR_FECHA_INICIO = buildError(
  'Fecha de inicio no válida',
  'fecha_inicio',
  'Use una fecha real con formato DD-MM-AAAA o AAAA-MM-DD'
);

const ERROR_VENCIMIENTO_FALTANTE = buildError(
  'Falta la fecha de vencimiento',
  'fecha de vencimiento',
  'Indique cuándo vence el caso con formato DD-MM-AAAA'
);

const ERROR_VENCIMIENTO_INVALIDO = buildError(
  'Fecha de vencimiento no válida',
  'fecha de vencimiento',
  'Use una fecha real con formato DD-MM-AAAA o AAAA-MM-DD'
);

const ERROR_VENCIMIENTO_ANTES_DEL_INICIO = buildError(
  'La fecha de vencimiento es anterior a la fecha de inicio',
  'fecha de vencimiento',
  'Elija una fecha de vencimiento igual o posterior a la fecha de inicio'
);

/**
 * Valida la fecha de vencimiento que captura el contador (ya no depende de la prioridad).
 * @param {*} valor - Fecha recibida (DD-MM-AAAA o AAAA-MM-DD).
 * @returns {{ error?: Object, fecha?: string }} El error listo para responder, o la fecha AAAA-MM-DD.
 */
function validarVencimiento(valor) {
  if (valor === undefined || valor === '') {
    return { error: ERROR_VENCIMIENTO_FALTANTE };
  }
  const fecha = formatearFechaISO(parseFechaInicio(valor));
  return fecha ? { fecha } : { error: ERROR_VENCIMIENTO_INVALIDO };
}

/**
 * Valida descripción u observaciones.
 * @param {'descripcion'|'observaciones'} campo - Campo del caso.
 * @param {*} valor - Valor recibido.
 * @returns {{ error?: Object, valor?: string|null }} El error listo para responder, o el valor (null si viene vacío).
 */
function validarTextoDelCaso(campo, valor) {
  const regla = TEXTOS_OPCIONALES[campo];
  const validacion = validarTextoOpcional(valor, regla.nombre, regla.maximo);
  if (validacion.estado === 'tipo_invalido') {
    return { error: buildError('Dato inválido', regla.nombre, regla.tipo) };
  }
  if (validacion.estado === 'demasiado_largo') {
    return { error: buildError(regla.largo[0], regla.nombre, regla.largo[1]) };
  }
  return { valor: validacion.estado === 'valido' ? validacion.valor : null };
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
    return res.status(400).json(buildError(...MENSAJES_ENTRADA_CASO[validacion.error]));
  }

  if (importanteInvalido(req.body.importante)) {
    return res.status(400).json(ERROR_IMPORTANTE);
  }

  // Descripción y observaciones son opcionales: ausente o vacío se guarda como null.
  const textos = {};
  for (const campo of Object.keys(TEXTOS_OPCIONALES)) {
    const resultado = validarTextoDelCaso(campo, req.body[campo]);
    if (resultado.error) {
      return res.status(400).json(resultado.error);
    }
    textos[campo] = resultado.valor;
  }

  const ahora = formatLocalDate(nowLocal());

  // Fecha de inicio: si el frontend la envía, se interpreta sin desplazar el día;
  // si no viene (o viene vacía), hoy. Una fecha inválida se rechaza antes de tocar la BD:
  // el cálculo de días hábiles no puede recibir un Invalid Date (antes colgaba el servidor).
  const fechaRecibida = req.body.fecha_inicio;
  const sinFecha = fechaRecibida === undefined || fechaRecibida === null || fechaRecibida === '';
  const fechaInicioFecha = sinFecha ? nowLocal() : parseFechaInicio(fechaRecibida);
  if (!fechaInicioFecha) {
    return res.status(400).json(ERROR_FECHA_INICIO);
  }

  const fechaInicio = formatearFechaISO(fechaInicioFecha);
  // El vencimiento lo decide el contador según cómo avance el caso
  const vencimiento = validarVencimiento(req.body.fecha_vencimiento);
  if (vencimiento.error) {
    return res.status(400).json(vencimiento.error);
  }
  if (vencimiento.fecha < fechaInicio) {
    return res.status(400).json(ERROR_VENCIMIENTO_ANTES_DEL_INICIO);
  }
  const fechaVencimiento = vencimiento.fecha;

  const casoId = await CaseModel.create({
    contador_id: req.user.id, // Asigna al contador autenticado (RF-17)
    cliente: cliente.trim(),
    estado: 'Pendiente', // Siempre Pendiente, no se elige (RF-18)
    prioridad,
    importante: req.body.importante === true,
    descripcion: textos.descripcion,
    observaciones: textos.observaciones,
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
 * Edita un caso propio (solo contador autenticado, checkCaseOwnership ya verificado).
 * Campos editables: cliente, estado, prioridad, fecha de inicio, fecha de vencimiento, descripción y observaciones.
 * Todo se valida antes de guardar: con un solo dato inválido no se guarda nada.
 * El vencimiento solo cambia cuando el contador lo envía; nunca puede quedar antes del inicio.
 * @param {Object} req - Petición Express con req.caso (puesto por checkCaseOwnership) y cuerpo con los campos a cambiar.
 * @param {Object} res - Respuesta Express.
 */
async function updateCase(req, res) {
  const { cliente, estado, prioridad, fecha_inicio: fechaRecibida, fecha_vencimiento: vencimientoRecibido } = req.body;
  const casoActual = req.caso;

  const { importante } = req.body;
  const editables = [
    cliente,
    estado,
    prioridad,
    fechaRecibida,
    vencimientoRecibido,
    req.body.descripcion,
    req.body.observaciones,
    importante,
  ];
  if (editables.every((valor) => valor === undefined)) {
    return res.status(400).json(
      buildError(
        'Nada que actualizar',
        'caso',
        'Envíe al menos uno de: cliente, estado, prioridad, fecha de inicio, fecha de vencimiento, descripción, observaciones o importante'
      )
    );
  }

  if (importanteInvalido(importante)) {
    return res.status(400).json(ERROR_IMPORTANTE);
  }

  // RF-37: un dato no textual se rechaza antes de guardar nada, para no dejar cambios a medias
  for (const [campo, valor, queHacer] of [
    ['estado', estado, 'El estado debe enviarse como texto: Pendiente, En proceso o Finalizado'],
    ['prioridad', prioridad, 'La prioridad debe enviarse como texto: Alta, Media o Baja'],
  ]) {
    if (valor !== undefined && validarCampoTexto(valor, campo).estado === 'tipo_invalido') {
      return res.status(400).json(buildError('Dato inválido', campo, queHacer));
    }
  }

  if (estado !== undefined && !validateStatus(estado)) {
    return res.status(400).json(
      buildError('Estado no válido', 'estado', 'Use uno de los siguientes: Pendiente, En proceso, Finalizado')
    );
  }

  if (prioridad !== undefined && !validatePriority(prioridad)) {
    return res.status(400).json(
      buildError('Prioridad no válida', 'prioridad', 'Use una de las siguientes: Alta, Media, Baja')
    );
  }

  // El cliente editado cumple las mismas reglas que al registrar (obligatorio, máximo 80)
  if (cliente !== undefined) {
    const validacion = validateNewCaseInput(cliente, prioridad ?? casoActual.prioridad);
    if (!validacion.valido) {
      return res.status(400).json(buildError(...MENSAJES_ENTRADA_CASO[validacion.error]));
    }
  }

  // Descripción y observaciones: vacías se borran (null); no enviadas, no cambian
  const textos = {};
  for (const campo of Object.keys(TEXTOS_OPCIONALES)) {
    if (req.body[campo] !== undefined) {
      const resultado = validarTextoDelCaso(campo, req.body[campo]);
      if (resultado.error) {
        return res.status(400).json(resultado.error);
      }
      textos[campo] = resultado.valor;
    }
  }

  // Al editar, la fecha de inicio no puede quedar vacía: el caso siempre tiene una
  const fechaInicioNueva = fechaRecibida === undefined ? null : parseFechaInicio(fechaRecibida);
  if (fechaRecibida !== undefined && !fechaInicioNueva) {
    return res.status(400).json(ERROR_FECHA_INICIO);
  }

  // Al editar, el vencimiento tampoco puede quedar vacío
  let fechaVencimiento;
  if (vencimientoRecibido !== undefined) {
    const vencimiento = validarVencimiento(vencimientoRecibido ?? '');
    if (vencimiento.error) {
      return res.status(400).json(vencimiento.error);
    }
    fechaVencimiento = vencimiento.fecha;
  }

  const cambiaFecha =
    fechaInicioNueva !== null && formatearFechaISO(fechaInicioNueva) !== formatearFechaISO(casoActual.fecha_inicio);

  // Inicio y vencimiento como quedarían guardados: el vencimiento nunca antes del inicio
  const inicioFinal = formatearFechaISO(fechaInicioNueva ?? casoActual.fecha_inicio);
  const vencimientoFinal = fechaVencimiento ?? formatearFechaISO(casoActual.fecha_vencimiento);
  if (inicioFinal && vencimientoFinal && vencimientoFinal < inicioFinal) {
    return res.status(400).json(ERROR_VENCIMIENTO_ANTES_DEL_INICIO);
  }

  // Un solo UPDATE: todos los cambios se guardan juntos o no se guarda nada
  await CaseModel.updatePatch(casoActual.id, {
    cliente: cliente === undefined ? undefined : cliente.trim(),
    estado,
    prioridad,
    fecha_inicio: cambiaFecha ? formatearFechaISO(fechaInicioNueva) : undefined,
    fecha_vencimiento: fechaVencimiento,
    descripcion: textos.descripcion,
    observaciones: textos.observaciones,
    importante,
  });

  const caso = await CaseModel.findById(casoActual.id);

  return res.status(200).json({
    mensaje: 'Caso actualizado correctamente',
    caso: conFechasLocales(caso),
  });
}

/**
 * El administrador cambia la prioridad del caso de cualquier contador y avisa al dueño;
 * el cambio y el aviso se guardan juntos. El vencimiento no se toca (lo decide el contador).
 * Con la misma prioridad no hace nada.
 * @param {Object} req - Petición Express con params.id y cuerpo { prioridad }.
 * @param {Object} res - Respuesta Express.
 */
async function cambiarPrioridadComoAdmin(req, res) {
  const { prioridad } = req.body;

  if (prioridad === undefined) {
    return res.status(400).json(buildError(...MENSAJES_ENTRADA_CASO.prioridad_requerida));
  }
  if (validarCampoTexto(prioridad, 'prioridad').estado === 'tipo_invalido') {
    return res.status(400).json(buildError(...MENSAJES_ENTRADA_CASO.prioridad_tipo_invalida));
  }
  if (!validatePriority(prioridad)) {
    return res.status(400).json(buildError(...MENSAJES_ENTRADA_CASO.prioridad_invalida));
  }

  // Solo ids de dígitos: MariaDB convertiría '12abc' en 12 y cambiaría otro caso (RF-35)
  const casoId = parseCounterId(req.params.id);
  const casoActual = casoId ? await CaseModel.findById(casoId) : null;
  if (!casoActual) {
    return res.status(404).json(
      buildError('No se encontró el caso', 'ID del caso', 'Verifique que el ID del caso sea correcto')
    );
  }

  if (prioridad !== casoActual.prioridad) {
    const administrador = await UserModel.findById(req.user.id);
    const mensaje = `${administrador.nombre} cambió la prioridad de «${casoActual.cliente}» de ${casoActual.prioridad} a ${prioridad}.`;

    await conTransaccion(async (ejecutar) => {
      await CaseModel.updatePatch(casoActual.id, { prioridad }, ejecutar);
      await NotificacionModel.crear({ usuarioId: casoActual.contador_id, casoId: casoActual.id, mensaje }, ejecutar);
    });
  }

  const caso = await CaseModel.findById(casoActual.id);
  return res.status(200).json({
    mensaje: 'Prioridad actualizada correctamente',
    caso: conFechasLocales(caso),
  });
}

module.exports = { createCase, updateCase, cambiarPrioridadComoAdmin };
