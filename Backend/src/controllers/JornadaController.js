const JornadaModel = require('../models/JornadaModel');
const { formatLocalDate, formatearFechaISO, nowLocal, parseFechaInicio } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const { PASOS, minutosTrabajados, validarHoras, jornadaBaseEsValida } = require('../utils/jornada');
const { esMesValido } = require('../utils/validationUtils');

/**
 * Controladores de /jornadas (rebanada 15): entrada, descanso y salida de cada día.
 * Cada usuario solo ve y cambia su propia jornada: el usuario sale siempre de la sesión.
 */

const ERROR_PASO_INVALIDO = buildError(
  'El paso de la jornada no es válido',
  'paso',
  `Envía uno de estos: ${PASOS.join(', ')}`
);
const ERROR_PASO_REPETIDO = buildError(
  'Ya registraste ese paso hoy',
  'tu jornada de hoy',
  'Actualiza la pantalla; si la hora está mal, corrígela con «Corregir horas»'
);
const ERROR_PASO_FUERA_DE_ORDEN = buildError(
  'Ese paso no es el que sigue en tu jornada',
  'tu jornada de hoy',
  'Actualiza la pantalla para ver el paso que sigue, o usa «Corregir horas»'
);
const ERROR_MES = buildError('El mes no es válido', 'mes', 'Envía el mes con la forma AAAA-MM, por ejemplo 2026-11');
const ERROR_FECHA = buildError(
  'La fecha no es válida',
  'día de la jornada',
  'Envía una fecha real con la forma AAAA-MM-DD, por ejemplo 2026-11-13'
);
const ERROR_FECHA_FUTURA = buildError(
  'La fecha es futura y todavía no hay jornada que corregir',
  'día de la jornada',
  'Elige hoy o un día anterior'
);
const ERROR_JORNADA_BASE = buildError(
  'La jornada base no es válida',
  'horas por día',
  'Elige de 1 a 16 horas, en pasos de media hora'
);

const ETIQUETA_DE_CAMPO = {
  entrada: 'la hora de entrada',
  salida_descanso: 'la hora de salida a descanso',
  regreso_descanso: 'la hora de regreso del descanso',
  salida: 'la hora de salida',
};

/**
 * Hora local `HH:MM:SS` de una fecha.
 * @param {Date} ahora - Instante del servidor.
 * @returns {string}
 */
const horaDelServidor = (ahora) => formatLocalDate(ahora).slice(11);

/**
 * GET /jornadas/hoy — Jornada de hoy con lo trabajado, lo asignado a actividades y la jornada base.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function obtenerHoy(req, res) {
  const usuarioId = Number(req.user.id);
  const ahora = nowLocal();
  const hoy = formatearFechaISO(ahora);
  const [jornada, minutosActividades, jornadaBase] = await Promise.all([
    JornadaModel.buscarDeFecha(usuarioId, hoy),
    JornadaModel.minutosDeActividades(usuarioId, hoy),
    JornadaModel.buscarJornadaBase(usuarioId),
  ]);
  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes();
  return res.status(200).json({
    jornada,
    minutos_trabajados: jornada ? minutosTrabajados(jornada, ahoraMinutos) : 0,
    minutos_actividades: minutosActividades,
    jornada_base_minutos: jornadaBase,
    ahora: formatLocalDate(ahora),
  });
}

/**
 * POST /jornadas/hoy/marcar — Registra el paso que sigue con la hora del servidor (la del equipo se ignora).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function marcarPaso(req, res) {
  const paso = (req.body || {}).paso;
  if (!PASOS.includes(paso)) return res.status(400).json(ERROR_PASO_INVALIDO);
  const ahora = nowLocal();
  const { resultado, jornada } = await JornadaModel.marcarPaso(
    Number(req.user.id),
    formatearFechaISO(ahora),
    paso,
    horaDelServidor(ahora)
  );
  if (resultado === 'repetido') return res.status(409).json(ERROR_PASO_REPETIDO);
  if (resultado === 'fuera_de_orden') return res.status(409).json(ERROR_PASO_FUERA_DE_ORDEN);
  return res.status(200).json({ jornada });
}

/**
 * GET /jornadas?mes=AAAA-MM — Jornadas propias de un mes.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function listarDeMes(req, res) {
  if (!esMesValido(req.query.mes)) return res.status(400).json(ERROR_MES);
  const jornadas = await JornadaModel.listarDeMes(Number(req.user.id), req.query.mes);
  return res.status(200).json({ jornadas });
}

/**
 * PUT /jornadas/:fecha — Corrige las cuatro horas de un día (hoy o anterior). Todo vacío borra la jornada.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function corregirDia(req, res) {
  const { fecha } = req.params;
  const real = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? parseFechaInicio(fecha) : null;
  if (!real || formatearFechaISO(real) !== fecha) return res.status(400).json(ERROR_FECHA);
  if (fecha > formatearFechaISO(nowLocal())) return res.status(400).json(ERROR_FECHA_FUTURA);

  const validacion = validarHoras(req.body || {});
  if (!validacion.valido) {
    return res
      .status(400)
      .json(buildError(validacion.motivo, ETIQUETA_DE_CAMPO[validacion.campo], 'Corrígela y vuelve a guardar'));
  }
  const jornada = await JornadaModel.guardar(Number(req.user.id), fecha, validacion.horas);
  if (!jornada) return res.status(204).end();
  return res.status(200).json({ jornada });
}

/**
 * PUT /jornadas/ajustes — Cambia la jornada base propia (de 1 a 16 horas, en medias horas).
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function guardarAjustes(req, res) {
  const minutos = (req.body || {}).jornada_base_minutos;
  if (!jornadaBaseEsValida(minutos)) return res.status(400).json(ERROR_JORNADA_BASE);
  await JornadaModel.guardarJornadaBase(Number(req.user.id), minutos);
  return res.status(200).json({ jornada_base_minutos: minutos });
}

module.exports = { obtenerHoy, marcarPaso, listarDeMes, corregirDia, guardarAjustes };
