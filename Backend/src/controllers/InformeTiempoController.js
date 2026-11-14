const InformeTiempoModel = require('../models/InformeTiempoModel');
const JornadaModel = require('../models/JornadaModel');
const { formatearFechaISO, nowLocal, parseFechaInicio } = require('../utils/dateUtils');
const { buildError } = require('../utils/errorUtils');
const { minutosTrabajados } = require('../utils/jornada');
const { parseCounterId } = require('../utils/validationUtils');

/**
 * Controlador de /informes (rebanada 16): horas por cliente y por tipo, jornadas del periodo y detalle.
 * Cada usuario solo ve lo suyo: el usuario sale siempre de la sesión.
 */

const DIAS_MAX_DEL_PERIODO = 366;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const ERROR_FECHA = buildError(
  'Las fechas del periodo no son válidas',
  'desde y hasta',
  'Envía dos fechas reales con la forma AAAA-MM-DD, por ejemplo 2026-11-01'
);
const ERROR_RANGO_INVERTIDO = buildError(
  'La fecha «Desde» es posterior a «Hasta»',
  'el periodo del informe',
  'Elige una fecha de inicio igual o anterior a la de fin'
);
const ERROR_RANGO_LARGO = buildError(
  `El periodo supera los ${DIAS_MAX_DEL_PERIODO} días`,
  'el periodo del informe',
  `Elige un periodo de ${DIAS_MAX_DEL_PERIODO} días o menos`
);
const ERROR_CLIENTE = buildError('El cliente no es válido', 'cliente_id', 'Elige uno de tus clientes o quita el filtro');
const ERROR_TIPO = buildError(
  'El tipo de actividad no es válido',
  'tipo_id',
  'Elige uno de tus tipos de actividad o quita el filtro'
);

/**
 * Valida una fecha AAAA-MM-DD real.
 * @param {*} texto - Valor recibido.
 * @returns {string|null} La misma fecha, o null si no existe.
 */
function fechaReal(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = parseFechaInicio(texto);
  return fecha && formatearFechaISO(fecha) === texto ? texto : null;
}

/**
 * Días del periodo contando el primero y el último.
 * @param {string} desde - AAAA-MM-DD.
 * @param {string} hasta - AAAA-MM-DD.
 * @returns {number}
 */
function diasDelPeriodo(desde, hasta) {
  const aUtc = (texto) => Date.UTC(Number(texto.slice(0, 4)), Number(texto.slice(5, 7)) - 1, Number(texto.slice(8, 10)));
  return Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA) + 1;
}

/**
 * Reparte 100 puntos entre las cantidades con el método del mayor residuo: enteros que suman 100 exacto.
 * Con un empate de residuos gana el que va primero en la lista.
 * @param {number[]} cantidades - Minutos de cada fila.
 * @returns {number[]} Porcentajes enteros (todo 0 si el total es 0).
 */
function repartirPorcentajes(cantidades) {
  const total = cantidades.reduce((suma, cantidad) => suma + cantidad, 0);
  if (total === 0) return cantidades.map(() => 0);
  const exactos = cantidades.map((cantidad) => (cantidad * 100) / total);
  const porcentajes = exactos.map(Math.floor);
  let faltan = 100 - porcentajes.reduce((suma, valor) => suma + valor, 0);
  const porResiduo = exactos
    .map((exacto, indice) => ({ indice, residuo: exacto - Math.floor(exacto) }))
    .sort((a, b) => b.residuo - a.residuo || a.indice - b.indice);
  for (const { indice } of porResiduo) {
    if (faltan === 0) break;
    porcentajes[indice] += 1;
    faltan -= 1;
  }
  return porcentajes;
}

/**
 * Agrupa los bloques por cliente o por tipo y entrega las filas de mayor a menor tiempo (empate: por nombre),
 * con su porcentaje.
 * @param {Array<Object>} bloques - Bloques del periodo.
 * @param {'cliente'|'tipo'} campo - Por cuál agrupar.
 * @returns {Array<Object>} `{ <campo>_id, <campo>, minutos, porcentaje }`.
 */
function agruparPor(bloques, campo) {
  const filas = new Map();
  for (const bloque of bloques) {
    const id = bloque[`${campo}_id`];
    const fila = filas.get(id) || { [`${campo}_id`]: id, [campo]: bloque[campo], minutos: 0 };
    fila.minutos += bloque.minutos;
    filas.set(id, fila);
  }
  const ordenadas = [...filas.values()].sort(
    (a, b) => b.minutos - a.minutos || a[campo].localeCompare(b[campo], 'es')
  );
  const porcentajes = repartirPorcentajes(ordenadas.map((fila) => fila.minutos));
  return ordenadas.map((fila, indice) => ({ ...fila, porcentaje: porcentajes[indice] }));
}

/**
 * Jornadas del periodo con lo trabajado y las horas extra de cada día, y el resumen de todas.
 * La jornada de hoy aún abierta cuenta hasta la hora actual, como en «Mi jornada de hoy».
 * @param {Array<Object>} filas - Jornadas del periodo.
 * @param {Map<string, number>} asignadoPorDia - Minutos de actividades de cada día.
 * @param {number} base - Jornada base en minutos.
 * @returns {{ jornadas: Array<Object>, resumen: Object|null }} resumen null si no hay jornadas.
 */
function armarJornadas(filas, asignadoPorDia, base) {
  const ahora = nowLocal();
  const hoy = formatearFechaISO(ahora);
  const ahoraMinutos = ahora.getHours() * 60 + ahora.getMinutes();
  const total = { dias: 0, jornada_base_minutos: base, minutos_trabajados: 0, minutos_extra: 0, minutos_sin_asignar: 0 };
  const jornadas = filas.map((fila) => {
    const trabajados = minutosTrabajados(fila, fila.fecha === hoy ? ahoraMinutos : undefined);
    const extra = Math.max(0, trabajados - base);
    total.dias += 1;
    total.minutos_trabajados += trabajados;
    total.minutos_extra += extra;
    total.minutos_sin_asignar += Math.max(0, trabajados - (asignadoPorDia.get(fila.fecha) || 0));
    return {
      fecha: fila.fecha,
      entrada: fila.entrada,
      salida_descanso: fila.salida_descanso,
      regreso_descanso: fila.regreso_descanso,
      salida: fila.salida,
      minutos_trabajados: trabajados,
      minutos_extra: extra,
    };
  });
  return { jornadas, resumen: filas.length > 0 ? total : null };
}

/**
 * GET /informes/tiempo?desde=&hasta=&cliente_id=&tipo_id= — Informe de horas propias del periodo.
 * @param {Object} req - Petición Express.
 * @param {Object} res - Respuesta Express.
 */
async function obtenerTiempo(req, res) {
  const desde = fechaReal(req.query.desde);
  const hasta = fechaReal(req.query.hasta);
  if (!desde || !hasta) return res.status(400).json(ERROR_FECHA);
  if (desde > hasta) return res.status(400).json(ERROR_RANGO_INVERTIDO);
  if (diasDelPeriodo(desde, hasta) > DIAS_MAX_DEL_PERIODO) return res.status(400).json(ERROR_RANGO_LARGO);

  const clienteId = req.query.cliente_id === undefined ? null : parseCounterId(req.query.cliente_id);
  if (req.query.cliente_id !== undefined && clienteId === null) return res.status(400).json(ERROR_CLIENTE);
  const tipoId = req.query.tipo_id === undefined ? null : parseCounterId(req.query.tipo_id);
  if (req.query.tipo_id !== undefined && tipoId === null) return res.status(400).json(ERROR_TIPO);

  const usuarioId = Number(req.user.id);
  const [bloques, asignadoPorDia, filasJornada, base] = await Promise.all([
    InformeTiempoModel.listarBloques(usuarioId, { desde, hasta, clienteId, tipoId }),
    InformeTiempoModel.minutosPorDia(usuarioId, desde, hasta),
    InformeTiempoModel.listarJornadas(usuarioId, desde, hasta),
    JornadaModel.buscarJornadaBase(usuarioId),
  ]);

  const minutosTotal = bloques.reduce((suma, bloque) => suma + bloque.minutos, 0);
  const minutosCobrables = bloques.reduce((suma, bloque) => suma + (bloque.cobrable ? bloque.minutos : 0), 0);
  const { jornadas, resumen: resumenJornada } = armarJornadas(filasJornada, asignadoPorDia, base);

  return res.status(200).json({
    resumen: {
      minutos_total: minutosTotal,
      minutos_cobrables: minutosCobrables,
      minutos_no_cobrables: minutosTotal - minutosCobrables,
      dias_con_tiempo: new Set(bloques.map((bloque) => bloque.fecha)).size,
      jornada: resumenJornada,
    },
    por_cliente: agruparPor(bloques, 'cliente'),
    por_tipo: agruparPor(bloques, 'tipo'),
    bloques,
    jornadas,
  });
}

module.exports = { obtenerTiempo };
