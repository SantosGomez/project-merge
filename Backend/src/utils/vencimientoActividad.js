/**
 * Vencimiento de las actividades del mes (rebanada 12). Única fuente del cálculo: dada la regla del tipo,
 * el mes y el RFC del cliente devuelve la fecha AAAA-MM-DD o null. Solo usa aritmética de año, mes y día
 * (nunca `new Date('AAAA-MM-DD')`, que se lee como UTC y desplaza un día).
 */

const REGLAS = ['ninguna', 'dia_del_mes', 'fin_de_mes', 'dia_17_rfc'];

// RFC de persona moral (12) o física (13): 3-4 letras, fecha AAMMDD y homoclave de 3 caracteres.
const FORMA_RFC = /^[A-ZÑ&]{3,4}(\d{6})[A-Z0-9]{3}$/;

// Días hábiles extra sobre el día 17 según el sexto dígito numérico del RFC (el último de la fecha AAMMDD).
const DIAS_EXTRA_POR_DIGITO = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 0: 5 };

// Festivos fijos de la LFT como [mes, día]. Para ampliar la lista agrega aquí o en las dos funciones siguientes.
const FESTIVOS_FIJOS = [
  [1, 1], // Año Nuevo
  [5, 1], // Día del Trabajo
  [9, 16], // Independencia
  [12, 25], // Navidad
];

// Festivos que caen en el enésimo lunes del mes: [mes, número de lunes].
const FESTIVOS_EN_LUNES = [
  [2, 1], // Constitución: primer lunes de febrero
  [3, 3], // Natalicio de Benito Juárez: tercer lunes de marzo
  [11, 3], // Revolución: tercer lunes de noviembre
];

// El 1 de octubre se descansa cada seis años por el cambio de Poder Ejecutivo (2024, 2030…).
const PRIMER_ANIO_CAMBIO_DE_PODER = 2024;
const ANIOS_ENTRE_CAMBIOS_DE_PODER = 6;

/**
 * Día de la semana de una fecha local (0 = domingo … 6 = sábado).
 * @param {number} anio
 * @param {number} mes - 1 a 12.
 * @param {number} dia
 * @returns {number}
 */
function diaDeLaSemana(anio, mes, dia) {
  return new Date(anio, mes - 1, dia).getDay();
}

/**
 * Número de lunes que lleva el mes hasta ese día (1 si es el primer lunes del mes, 3 si es el tercero…).
 * @param {number} dia
 * @returns {number}
 */
function numeroDeLunes(dia) {
  return Math.ceil(dia / 7);
}

/**
 * Indica si un día es inhábil: sábado, domingo o festivo de la LFT.
 * @param {number} anio
 * @param {number} mes - 1 a 12.
 * @param {number} dia
 * @returns {boolean}
 */
function esDiaInhabil(anio, mes, dia) {
  const semana = diaDeLaSemana(anio, mes, dia);
  if (semana === 0 || semana === 6) return true;
  if (FESTIVOS_FIJOS.some(([m, d]) => m === mes && d === dia)) return true;
  if (semana === 1 && FESTIVOS_EN_LUNES.some(([m, n]) => m === mes && n === numeroDeLunes(dia))) return true;
  const esCambioDePoder =
    anio >= PRIMER_ANIO_CAMBIO_DE_PODER && (anio - PRIMER_ANIO_CAMBIO_DE_PODER) % ANIOS_ENTRE_CAMBIOS_DE_PODER === 0;
  return esCambioDePoder && mes === 10 && dia === 1;
}

/**
 * Suma un día natural a una fecha {anio, mes, dia}.
 * @param {{ anio: number, mes: number, dia: number }} fecha
 * @returns {{ anio: number, mes: number, dia: number }}
 */
function sumarUnDia({ anio, mes, dia }) {
  const siguiente = new Date(anio, mes - 1, dia + 1);
  return { anio: siguiente.getFullYear(), mes: siguiente.getMonth() + 1, dia: siguiente.getDate() };
}

/**
 * Devuelve la misma fecha si es hábil o el siguiente día hábil.
 * @param {{ anio: number, mes: number, dia: number }} fecha
 * @returns {{ anio: number, mes: number, dia: number }}
 */
function siguienteHabil(fecha) {
  let actual = fecha;
  while (esDiaInhabil(actual.anio, actual.mes, actual.dia)) actual = sumarUnDia(actual);
  return actual;
}

/**
 * Avanza `cantidad` días hábiles a partir de una fecha.
 * @param {{ anio: number, mes: number, dia: number }} fecha
 * @param {number} cantidad
 * @returns {{ anio: number, mes: number, dia: number }}
 */
function sumarDiasHabiles(fecha, cantidad) {
  let actual = fecha;
  for (let i = 0; i < cantidad; i += 1) actual = siguienteHabil(sumarUnDia(actual));
  return actual;
}

/**
 * Formatea una fecha como AAAA-MM-DD.
 * @param {{ anio: number, mes: number, dia: number }} fecha
 * @returns {string}
 */
function formatear({ anio, mes, dia }) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Sexto dígito numérico de un RFC con forma válida, o null.
 * @param {*} rfc
 * @returns {number|null}
 */
function sextoDigito(rfc) {
  if (typeof rfc !== 'string') return null;
  const partes = FORMA_RFC.exec(rfc.trim().toUpperCase());
  return partes ? Number(partes[1][5]) : null;
}

/**
 * Calcula el vencimiento de una actividad dentro del mes de trabajo.
 * @param {{ regla: string, dia?: number|null, mes: string, rfc?: string|null }} datos
 *   `mes` con la forma AAAA-MM; `dia` solo se usa con `dia_del_mes`; `rfc` solo con `dia_17_rfc`.
 * @returns {string|null} Fecha AAAA-MM-DD, o null si la regla no da fecha (sin regla, sin día o sin RFC válido).
 */
function calcularVencimiento({ regla, dia, mes, rfc } = {}) {
  const partesMes = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes);
  if (!partesMes) return null;
  const anio = Number(partesMes[1]);
  const numeroMes = Number(partesMes[2]);

  if (regla === 'dia_del_mes') {
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null;
    return formatear(siguienteHabil({ anio, mes: numeroMes, dia }));
  }
  if (regla === 'fin_de_mes') {
    const ultimoDia = new Date(anio, numeroMes, 0).getDate();
    return formatear(siguienteHabil({ anio, mes: numeroMes, dia: ultimoDia }));
  }
  if (regla === 'dia_17_rfc') {
    const digito = sextoDigito(rfc);
    if (digito === null) return null;
    const diecisiete = siguienteHabil({ anio, mes: numeroMes, dia: 17 });
    return formatear(sumarDiasHabiles(diecisiete, DIAS_EXTRA_POR_DIGITO[digito]));
  }
  return null;
}

module.exports = { REGLAS, calcularVencimiento, esDiaInhabil };
