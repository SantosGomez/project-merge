const { buildError } = require('./errorUtils');
const { formatearFechaISO, parseFechaInicio } = require('./dateUtils');
const { parseCounterId } = require('./validationUtils');

/**
 * Validaciones puras de las juntas del calendario (sin base de datos).
 * Las fechas se interpretan siempre como hora local, nunca con `new Date('AAAA-MM-DD')`.
 */

const LONGITUD_MAX_TITULO = 150;
const LONGITUD_MAX_DESCRIPCION = 1000;
const MAX_PARTICIPANTES = 50;
const MAX_DIAS_RANGO = 400;
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const FORMA_FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const FORMA_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Interpreta `AAAA-MM-DD HH:mm` como fecha y hora locales.
 * @param {*} texto - Valor recibido.
 * @returns {Date|null} La fecha, o null si no es texto con ese formato o el día no existe.
 */
function parseFechaHora(texto) {
  if (typeof texto !== 'string') return null;
  const partes = FORMA_FECHA_HORA.exec(texto);
  if (!partes) return null;
  const [anio, mes, dia, horas, minutos] = partes.slice(1).map(Number);
  if (horas > 23 || minutos > 59) return null;
  const fecha = new Date(anio, mes - 1, dia, horas, minutos);
  const existe = fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
  return existe ? fecha : null;
}

/**
 * Formatea una fecha local como `AAAA-MM-DD HH:mm:00`, tal como se guarda en la columna DATETIME.
 * @param {Date} fecha - Fecha local.
 * @returns {string}
 */
function aDatetime(fecha) {
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${formatearFechaISO(fecha)} ${horas}:${minutos}:00`;
}

function errorDeCampo(queOcurrio, campo, queHacer) {
  return { error: buildError(queOcurrio, campo, queHacer) };
}

// Artículos y adjetivo de cada campo de texto, para que los mensajes concuerden en género.
const GENERO_CAMPO = {
  'título': { el: 'El', elMin: 'el', un: 'un', corto: 'corto' },
  'descripción': { el: 'La', elMin: 'la', un: 'una', corto: 'corta' },
};

function validarTexto(valor, campo, maximo, obligatorio) {
  const g = GENERO_CAMPO[campo];
  const falta = () =>
    obligatorio
      ? errorDeCampo(`Falta ${g.elMin} ${campo} de la junta`, campo, `Escribe ${g.elMin} ${campo}`)
      : { valor: null };
  if (valor === null || valor === undefined) return falta();
  if (typeof valor !== 'string') {
    return errorDeCampo(`${g.el} ${campo} no es texto`, campo, `Escribe ${g.elMin} ${campo} como texto`);
  }
  const texto = valor.trim();
  if (texto === '') return falta();
  if (texto.length > maximo) {
    return errorDeCampo(
      `${g.el} ${campo} supera los ${maximo} caracteres`,
      campo,
      `Escribe ${g.un} ${campo} más ${g.corto}`
    );
  }
  return { valor: texto };
}

function validarParticipantes(valor, creadorId) {
  const queHacer = `Elige hasta ${MAX_PARTICIPANTES} invitados (o ninguno), sin repetir y sin incluirte a ti`;
  if (valor === undefined) return { valor: [] };
  if (!Array.isArray(valor)) {
    return errorDeCampo('La lista de invitados no es válida', 'participantes', queHacer);
  }
  if (valor.length > MAX_PARTICIPANTES) {
    return errorDeCampo(`Hay más de ${MAX_PARTICIPANTES} invitados`, 'participantes', queHacer);
  }
  const ids = valor.map((id) => (typeof id === 'string' || typeof id === 'number' ? parseCounterId(id) : null));
  if (ids.includes(null)) {
    return errorDeCampo('Algún invitado no es válido', 'participantes', queHacer);
  }
  if (new Set(ids).size !== ids.length) {
    return errorDeCampo('Hay invitados repetidos', 'participantes', queHacer);
  }
  if (ids.includes(Number(creadorId))) {
    return errorDeCampo('No te puedes invitar a ti mismo', 'participantes', queHacer);
  }
  return { valor: ids };
}

/**
 * Valida el cuerpo para crear o reemplazar una junta.
 * @param {*} cuerpo - Cuerpo recibido: `{ titulo, descripcion?, inicio, fin, participantes, privada? }`.
 * @param {number} creadorId - Cuenta que organiza la junta (no puede invitarse).
 * @returns {{ valor?: { titulo: string, descripcion: string|null, inicio: string, fin: string, participantes: number[], privada: boolean }, error?: { mensaje: string } }}
 */
function validarJunta(cuerpo, creadorId) {
  const datos = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo : {};
  const titulo = validarTexto(datos.titulo, 'título', LONGITUD_MAX_TITULO, true);
  if (titulo.error) return titulo;
  const descripcion = validarTexto(datos.descripcion, 'descripción', LONGITUD_MAX_DESCRIPCION, false);
  if (descripcion.error) return descripcion;

  const formato = 'Escribe la fecha y la hora así: AAAA-MM-DD HH:mm, por ejemplo 2026-12-01 09:00';
  const inicio = parseFechaHora(datos.inicio);
  if (!inicio) return errorDeCampo('La fecha y hora de inicio no son válidas', 'inicio', formato);
  const fin = parseFechaHora(datos.fin);
  if (!fin) return errorDeCampo('La fecha y hora de fin no son válidas', 'fin', formato);
  if (fin.getTime() <= inicio.getTime()) {
    return errorDeCampo('El fin no es posterior al inicio', 'fin', 'Elige una hora de fin posterior a la de inicio');
  }

  const participantes = validarParticipantes(datos.participantes, creadorId);
  if (participantes.error) return participantes;

  if (datos.privada !== undefined && typeof datos.privada !== 'boolean') {
    return errorDeCampo('La marca de junta privada no es válida', 'privada', 'Envía privada como true o false');
  }

  return {
    valor: {
      titulo: titulo.valor,
      descripcion: descripcion.valor,
      inicio: aDatetime(inicio),
      fin: aDatetime(fin),
      participantes: participantes.valor,
      privada: datos.privada === true,
    },
  };
}

/**
 * Valida el rango `desde`/`hasta` (AAAA-MM-DD, ambos días incluidos) de la consulta de juntas.
 * @param {*} desde - Primer día.
 * @param {*} hasta - Último día.
 * @returns {{ valor?: { desde: string, hastaExclusivo: string }, error?: { mensaje: string } }}
 *   `desde` es la medianoche del primer día y `hastaExclusivo`, la del día siguiente al último.
 */
function validarRango(desde, hasta) {
  const queHacer = `Envía desde y hasta como AAAA-MM-DD, con hasta igual o posterior a desde y como máximo ${MAX_DIAS_RANGO} días`;
  const fechaDesde = typeof desde === 'string' && FORMA_FECHA.test(desde) ? parseFechaInicio(desde) : null;
  const fechaHasta = typeof hasta === 'string' && FORMA_FECHA.test(hasta) ? parseFechaInicio(hasta) : null;
  if (!fechaDesde || !fechaHasta) {
    return errorDeCampo('El rango de fechas falta o no es válido', 'rango de fechas', queHacer);
  }
  const dias = Math.round((fechaHasta.getTime() - fechaDesde.getTime()) / MS_POR_DIA);
  if (dias < 0 || dias > MAX_DIAS_RANGO) {
    return errorDeCampo('El rango de fechas es incorrecto', 'rango de fechas', queHacer);
  }
  const siguiente = new Date(fechaHasta.getFullYear(), fechaHasta.getMonth(), fechaHasta.getDate() + 1);
  return { valor: { desde: `${formatearFechaISO(fechaDesde)} 00:00:00`, hastaExclusivo: `${formatearFechaISO(siguiente)} 00:00:00` } };
}

/**
 * Valida el cuerpo de la respuesta de un invitado.
 * @param {*} cuerpo - Cuerpo recibido: `{ respuesta: 'aceptada' | 'rechazada' }`.
 * @returns {{ valor?: 'aceptada'|'rechazada', error?: { mensaje: string } }}
 */
function validarRespuesta(cuerpo) {
  const respuesta = cuerpo !== null && typeof cuerpo === 'object' ? cuerpo.respuesta : undefined;
  if (respuesta === 'aceptada' || respuesta === 'rechazada') return { valor: respuesta };
  return errorDeCampo(
    'La respuesta no es válida',
    'respuesta',
    'Envía "aceptada" para aceptar la invitación o "rechazada" para rechazarla'
  );
}

module.exports = { parseFechaHora, validarJunta, validarRango, validarRespuesta, MAX_PARTICIPANTES };
