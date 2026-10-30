const AuditoriaModel = require('../models/AuditoriaModel');
const { formatLocalDate, formatearFechaISO, parseFechaInicio } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');

const ERROR_CONTADORES_FALTANTES = buildError(
  'Faltan los contadores asignados',
  'contadores',
  'Seleccione al menos un contador para la auditoría'
);
const ERROR_CONTADOR_INVALIDO = buildError(
  'Contador no válido',
  'contadores',
  'Seleccione solo cuentas con rol de contador'
);

const ESTADOS = ['Pendiente', 'En Proceso', 'Completado', 'Aplazado por acta'];
const ERROR_ESTADO = buildError(
  'Estado no válido',
  'estado',
  'Seleccione Pendiente, En Proceso, Completado o Aplazado por acta'
);
const ERROR_NO_ASIGNADO = buildError(
  'Acceso denegado',
  'auditoría',
  'Solo los contadores asignados pueden editarla'
);
const ERROR_SOLO_ADMIN_ASIGNA = buildError(
  'Acceso denegado',
  'contadores',
  'Solo el administrador puede cambiar los contadores asignados'
);

/**
 * Lista de IDs enteros positivos sin repetir, o null si no es una lista de IDs.
 * @param {unknown} valor - Lo que llegó en el cuerpo.
 * @returns {number[]|null}
 */
function idsUnicos(valor) {
  if (!Array.isArray(valor)) return valor === undefined ? [] : null;
  if (!valor.every((id) => Number.isInteger(id) && id > 0)) return null;
  return [...new Set(valor)];
}

// Textos obligatorios: [campo de la API, nombre para el usuario, máximo de la columna].
const TEXTOS_OBLIGATORIOS = [
  ['cliente', 'cliente', 100],
  ['no_expediente', 'no. de expediente', 100],
  ['dependencia', 'dependencia', 200],
  ['tipo_auditoria', 'tipo de auditoría', 200],
];
const TEXTOS_OPCIONALES = [
  ['descripcion', 'descripción', 2000],
  ['observacion', 'observación', 2000],
];
const FECHAS_OBLIGATORIAS = [
  ['periodo_inicio', 'inicio del periodo'],
  ['periodo_final', 'fin del periodo'],
  ['fecha_inicio', 'fecha de inicio'],
  ['fecha_vencimiento', 'fecha de vencimiento'],
];

/**
 * Valida el cuerpo de una auditoría. Con `actual` (edición) solo se validan los campos
 * enviados y el resto se toma de la auditoría guardada.
 * @param {Object} cuerpo - Cuerpo de la petición.
 * @param {Object|null} [actual] - Auditoría guardada, en formato de la API.
 * @returns {{ error?: Object, datos?: Object }} Error en formato de la API o datos limpios (fechas AAAA-MM-DD).
 */
function validarAuditoria(cuerpo, actual = null) {
  const datos = {};
  const enviado = (campo) => !actual || Object.hasOwn(cuerpo, campo);

  for (const [campo, nombre, maximo] of TEXTOS_OBLIGATORIOS) {
    if (!enviado(campo)) {
      datos[campo] = actual[campo];
      continue;
    }
    const texto = typeof cuerpo[campo] === 'string' ? cuerpo[campo].trim() : '';
    if (texto === '') return { error: buildError('Falta un dato obligatorio', nombre, `Ingrese ${nombre}`) };
    if (texto.length > maximo) {
      return { error: buildError('Texto demasiado largo', nombre, `Use máximo ${maximo} caracteres`) };
    }
    datos[campo] = texto;
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

  for (const [campo, nombre] of FECHAS_OBLIGATORIAS) {
    if (!enviado(campo)) {
      datos[campo] = actual[campo];
      continue;
    }
    const fecha = parseFechaInicio(cuerpo[campo]);
    if (!fecha) {
      return { error: buildError('Fecha no válida', nombre, 'Use una fecha real con formato DD-MM-AAAA') };
    }
    datos[campo] = formatearFechaISO(fecha);
  }

  if (enviado('estatal') && cuerpo.estatal !== undefined && typeof cuerpo.estatal !== 'boolean') {
    return { error: buildError('Dato inválido', 'estatal', 'Envíe estatal como true o false') };
  }
  datos.estatal = enviado('estatal') ? cuerpo.estatal === true : actual.estatal;

  // Las fechas AAAA-MM-DD se comparan bien como texto.
  if (datos.periodo_final < datos.periodo_inicio) {
    return { error: buildError('Periodo no válido', 'fin del periodo', 'Debe ser igual o posterior al inicio del periodo') };
  }
  if (datos.fecha_vencimiento < datos.fecha_inicio) {
    return {
      error: buildError('Fecha no válida', 'fecha de vencimiento', 'Debe ser igual o posterior a la fecha de inicio'),
    };
  }

  return { datos };
}

/**
 * Convierte la fila de la base (nombres de columna del módulo) al formato de la API:
 * snake_case, fechas DATE como AAAA-MM-DD y DATETIME en hora local YYYY-MM-DD HH:mm:ss.
 * @param {Object} fila - Fila de auditorias con `contadores`.
 * @returns {Object} Auditoría para la respuesta.
 */
function auditoriaParaApi(fila) {
  return {
    id: fila.IdAuditoria,
    cliente: fila.Cliente,
    no_expediente: fila.No_Expediente,
    dependencia: fila.Dependencia,
    tipo_auditoria: fila.TipoAud,
    estatal: Boolean(fila.Estatal),
    periodo_inicio: formatearFechaISO(fila.FechaPeriodo_inicio),
    periodo_final: formatearFechaISO(fila.FechaPeriodo_final),
    estado: fila.Estado,
    fecha_inicio: formatearFechaISO(fila.FechaInicio),
    fecha_vencimiento: formatearFechaISO(fila.FechaVencimiento),
    descripcion: fila.Descripcion,
    observacion: fila.Observacion,
    contadores: fila.contadores,
    creado_por: fila.CreadoPor,
    creado_en: formatLocalDate(fila.CreadoEn),
    actualizado_en: formatLocalDate(fila.ActualizadoEn),
  };
}

/**
 * POST /auditorias — Registra una auditoría. El contador que la registra queda asignado.
 */
async function createAuditoria(req, res) {
  const cuerpo = req.body ?? {};
  const { error, datos } = validarAuditoria(cuerpo);
  if (error) return res.status(400).json(error);

  let contadores = [req.user.id];
  if (req.user.rol === 'administrador') {
    const elegidos = idsUnicos(cuerpo.contadores);
    if (elegidos === null || elegidos.length === 0) {
      return res.status(400).json(ERROR_CONTADORES_FALTANTES);
    }
    const validos = await AuditoriaModel.filtrarContadores(elegidos);
    if (validos.length !== elegidos.length) {
      return res.status(400).json(ERROR_CONTADOR_INVALIDO);
    }
    contadores = elegidos;
  }

  const id = await AuditoriaModel.create(datos, contadores, req.user.id);
  const auditoria = await AuditoriaModel.findById(id);
  return res.status(201).json({ mensaje: 'Auditoría registrada correctamente', auditoria: auditoriaParaApi(auditoria) });
}

/**
 * GET /auditorias — El administrador ve todas; el contador, solo donde está asignado.
 */
async function listAuditorias(req, res) {
  const filtro = req.user.rol === 'contador' ? { contadorId: req.user.id } : {};
  const filas = await AuditoriaModel.findAll(filtro);
  return res.status(200).json({ auditorias: filas.map(auditoriaParaApi) });
}

/**
 * PATCH /auditorias/:id — Edita una auditoría. Solo se cambian los campos enviados.
 * El contador solo edita aquellas donde está asignado; solo el administrador cambia los contadores.
 */
async function updateAuditoria(req, res) {
  const id = Number(req.params.id);
  const fila = Number.isInteger(id) && id > 0 ? await AuditoriaModel.findById(id) : null;
  if (!fila) {
    return res.status(404).json(buildError('Auditoría no encontrada', 'auditoría', 'Actualice la lista e intente de nuevo'));
  }

  const esAdmin = req.user.rol === 'administrador';
  if (!esAdmin && !(await AuditoriaModel.estaAsignado(id, req.user.id))) {
    return res.status(403).json(ERROR_NO_ASIGNADO);
  }

  const cuerpo = req.body ?? {};
  const actual = auditoriaParaApi(fila);
  const { error, datos } = validarAuditoria(cuerpo, actual);
  if (error) return res.status(400).json(error);

  if (Object.hasOwn(cuerpo, 'estado') && !ESTADOS.includes(cuerpo.estado)) {
    return res.status(400).json(ERROR_ESTADO);
  }
  datos.estado = Object.hasOwn(cuerpo, 'estado') ? cuerpo.estado : actual.estado;

  let contadores = null;
  if (Object.hasOwn(cuerpo, 'contadores')) {
    if (!esAdmin) return res.status(403).json(ERROR_SOLO_ADMIN_ASIGNA);
    contadores = idsUnicos(cuerpo.contadores);
    if (contadores === null || contadores.length === 0) return res.status(400).json(ERROR_CONTADORES_FALTANTES);
    if ((await AuditoriaModel.filtrarContadores(contadores)).length !== contadores.length) {
      return res.status(400).json(ERROR_CONTADOR_INVALIDO);
    }
  }

  await AuditoriaModel.update(id, datos, contadores);
  const guardada = await AuditoriaModel.findById(id);
  return res.status(200).json({ mensaje: 'Auditoría actualizada correctamente', auditoria: auditoriaParaApi(guardada) });
}

module.exports = { createAuditoria, listAuditorias, updateAuditoria };
