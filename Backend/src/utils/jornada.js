// Reglas de la jornada (rebanada 15): minutos trabajados, orden de las cuatro horas, secuencia de pasos
// y jornada base. Funciones puras: no tocan la base de datos ni el reloj.

/** Los cuatro pasos del día, en orden; cada uno es una columna de `jornadas`. */
const PASOS = ['entrada', 'salida_descanso', 'regreso_descanso', 'salida'];

/** Jornada base por defecto: 8 horas. */
const JORNADA_BASE_DEFECTO = 480;
const JORNADA_BASE_MIN = 60;
const JORNADA_BASE_MAX = 960;

const FORMA_HORA = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * Convierte una hora `HH:MM` o `HH:MM:SS` en minutos desde la medianoche (los segundos se ignoran).
 * @param {*} texto - Hora recibida.
 * @returns {number|null} null si no es una hora de 24 h válida.
 */
function horaAMinutos(texto) {
  const partes = typeof texto === 'string' ? FORMA_HORA.exec(texto) : null;
  return partes ? Number(partes[1]) * 60 + Number(partes[2]) : null;
}

/**
 * Minutos trabajados del día: tramo antes del descanso + tramo después, sin contar el descanso.
 * Un tramo que sigue abierto cuenta hasta `ahoraMinutos`; sin esa hora no se cuenta el tramo abierto.
 * @param {{ entrada, salida_descanso, regreso_descanso, salida }} jornada - Las cuatro horas (o null).
 * @param {number} [ahoraMinutos] - Hora actual en minutos desde la medianoche, solo para la jornada de hoy.
 * @returns {number} Nunca negativo.
 */
function minutosTrabajados(jornada, ahoraMinutos) {
  const entrada = horaAMinutos(jornada.entrada);
  if (entrada === null) return 0;
  const salidaDescanso = horaAMinutos(jornada.salida_descanso);
  const regreso = horaAMinutos(jornada.regreso_descanso);
  const salida = horaAMinutos(jornada.salida);
  const finDelDia = salida ?? (Number.isInteger(ahoraMinutos) ? ahoraMinutos : null);

  // Un tramo sin hora de fin todavía no cuenta (jornada abierta sin «ahora»).
  const tramo = (desde, hasta) => (hasta === null ? 0 : Math.max(0, hasta - desde));

  if (salidaDescanso === null) return tramo(entrada, finDelDia);
  const antes = tramo(entrada, salidaDescanso);
  if (regreso === null) return antes;
  return antes + tramo(regreso, finDelDia);
}

/**
 * Valida las cuatro horas de una corrección: formato `HH:MM`, nada sin entrada, no hay regreso sin salida
 * a descanso y entrada ≤ salida a descanso ≤ regreso ≤ salida. Lo vacío es lo que no ocurrió.
 * @param {Object} horas - Valores recibidos (texto, vacío, null o ausente).
 * @returns {{ valido: true, horas: Object } | { valido: false, campo: string, motivo: string }}
 */
function validarHoras(horas) {
  const limpias = {};
  for (const paso of PASOS) {
    const valor = horas ? horas[paso] : null;
    const texto = typeof valor === 'string' ? valor.trim() : valor;
    if (texto === undefined || texto === null || texto === '') {
      limpias[paso] = null;
    } else if (typeof texto === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(texto)) {
      limpias[paso] = texto;
    } else {
      return { valido: false, campo: paso, motivo: 'La hora no tiene el formato HH:MM de 24 horas, por ejemplo 09:30' };
    }
  }

  if (limpias.entrada === null && PASOS.some((paso) => limpias[paso] !== null)) {
    return { valido: false, campo: 'entrada', motivo: 'Falta la hora de entrada: no puede haber otras horas sin ella' };
  }
  if (limpias.regreso_descanso !== null && limpias.salida_descanso === null) {
    return {
      valido: false,
      campo: 'regreso_descanso',
      motivo: 'Hay hora de regreso del descanso pero no de salida a descanso',
    };
  }

  let anterior = null;
  for (const paso of PASOS) {
    if (limpias[paso] === null) continue;
    const minutos = horaAMinutos(limpias[paso]);
    if (anterior !== null && minutos < anterior) {
      return { valido: false, campo: paso, motivo: 'Esta hora es anterior a la del paso previo del día' };
    }
    anterior = minutos;
  }
  return { valido: true, horas: limpias };
}

/**
 * Dice si un paso se puede registrar con el botón en el estado actual de la jornada.
 * Desde la entrada se puede salir a descanso o directamente salir; durante el descanso solo se regresa.
 * @param {Object|null} jornada - Las cuatro horas del día, o null si no hay jornada.
 * @param {string} paso - Uno de `PASOS`.
 * @returns {'ok'|'repetido'|'fuera_de_orden'|'desconocido'}
 */
function evaluarPaso(jornada, paso) {
  if (!PASOS.includes(paso)) return 'desconocido';
  const dia = jornada || {};
  if (dia[paso]) return 'repetido';

  let permitidos;
  if (!dia.entrada) permitidos = ['entrada'];
  else if (dia.salida) permitidos = [];
  else if (!dia.salida_descanso) permitidos = ['salida_descanso', 'salida'];
  else if (!dia.regreso_descanso) permitidos = ['regreso_descanso'];
  else permitidos = ['salida'];
  return permitidos.includes(paso) ? 'ok' : 'fuera_de_orden';
}

/**
 * Indica si los minutos son una jornada base válida: de 1 a 16 horas, en medias horas.
 * @param {*} minutos - Valor recibido.
 * @returns {boolean}
 */
function jornadaBaseEsValida(minutos) {
  return (
    Number.isInteger(minutos) &&
    minutos >= JORNADA_BASE_MIN &&
    minutos <= JORNADA_BASE_MAX &&
    minutos % 30 === 0
  );
}

module.exports = {
  PASOS,
  JORNADA_BASE_DEFECTO,
  horaAMinutos,
  minutosTrabajados,
  validarHoras,
  evaluarPaso,
  jornadaBaseEsValida,
};
