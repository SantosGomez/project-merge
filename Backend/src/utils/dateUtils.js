// Utilidades de fecha y hora local (RNF-2, RF-25, RF-26, RF-48).

/**
 * Devuelve la fecha y hora actuales en la zona local del servidor.
 * @returns {Date} fecha local actual.
 */
function nowLocal() {
  return new Date();
}

// Rellena con un cero a la izquierda los números de un solo dígito.
function rellenarCero(valor) {
  return String(valor).padStart(2, '0');
}

/**
 * Formatea una fecha en hora local con formato YYYY-MM-DD HH:mm:ss (RNF-2).
 * @param {Date} fecha - fecha a formatear.
 * @returns {string} fecha en formato YYYY-MM-DD HH:mm:ss sin zona horaria.
 */
function formatLocalDate(fecha) {
  const anio = fecha.getFullYear();
  const mes = rellenarCero(fecha.getMonth() + 1);
  const dia = rellenarCero(fecha.getDate());
  const horas = rellenarCero(fecha.getHours());
  const minutos = rellenarCero(fecha.getMinutes());
  const segundos = rellenarCero(fecha.getSeconds());
  return `${anio}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
}

/**
 * Formatea solo la fecha (sin hora) en hora local, como la guarda una columna DATE.
 * @param {Date} fecha - fecha a formatear.
 * @returns {string|null} YYYY-MM-DD, o null si la fecha no es válida.
 */
function formatearFechaISO(fecha) {
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) {
    return null;
  }
  return `${fecha.getFullYear()}-${rellenarCero(fecha.getMonth() + 1)}-${rellenarCero(fecha.getDate())}`;
}

// Construye una fecha local solo si el día existe en ese mes (rechaza 31-02, 32-01...).
function fechaLocalValida(anio, mes, dia) {
  const fecha = new Date(anio, mes - 1, dia);
  const existe =
    fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
  return existe ? fecha : null;
}

// Formatos aceptados: el del formulario (DD-MM-AAAA) y el que usa la base (AAAA-MM-DD).
const FORMATO_DDMMYYYY = /^(\d{2})-(\d{2})-(\d{4})$/;
const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/;

/**
 * Interpreta un texto DD-MM-AAAA como fecha en hora local.
 * @param {*} texto - valor recibido.
 * @returns {Date|null} fecha local, o null si el texto no es una fecha real.
 */
function parseFechaDDMMYYYY(texto) {
  if (typeof texto !== 'string') {
    return null;
  }
  const partes = FORMATO_DDMMYYYY.exec(texto.trim());
  if (!partes) {
    return null;
  }
  return fechaLocalValida(Number(partes[3]), Number(partes[2]), Number(partes[1]));
}

/**
 * Interpreta una fecha de un caso sin desplazarla por la zona horaria.
 * Acepta Date, DD-MM-AAAA, AAAA-MM-DD y AAAA-MM-DD HH:mm:ss; nunca usa `new Date(texto)`
 * con una fecha sin hora, porque JavaScript la lee como UTC y en zonas negativas resta un día.
 * @param {*} valor - valor recibido.
 * @returns {Date|null} fecha local a medianoche, o null si no es válida.
 */
function parseFechaInicio(valor) {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? null
      : new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
  }
  if (typeof valor !== 'string') {
    return null;
  }

  const texto = valor.trim();
  if (texto === '') {
    return null;
  }

  const ddmm = FORMATO_DDMMYYYY.exec(texto);
  if (ddmm) {
    return fechaLocalValida(Number(ddmm[3]), Number(ddmm[2]), Number(ddmm[1]));
  }

  const iso = FORMATO_ISO.exec(texto);
  if (iso) {
    return fechaLocalValida(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  return null;
}

/**
 * Indica si una sesión está inactiva: pasó más de `limiteMinutos`
 * desde la última actividad (RF-25).
 * @param {Date} ultimaActividad - última petición válida de la sesión.
 * @param {Date} hoy - instante actual, inyectado para tests deterministas.
 * @param {number} limiteMinutos - minutos de inactividad permitidos.
 * @returns {boolean} true si la sesión está inactiva.
 */
function isSessionInactive(ultimaActividad, hoy, limiteMinutos) {
  const diferenciaMs = hoy.getTime() - ultimaActividad.getTime();
  return diferenciaMs > limiteMinutos * 60 * 1000;
}

/** Días hábiles de vencimiento según la prioridad (Alta=5, Media=10, Baja=15). */
const DIAS_VENCIMIENTO = { Alta: 5, Media: 10, Baja: 15 };

/** Tope de vueltas del cálculo: 400 días cubre cualquier suma razonable sin poder colgarse. */
const MAX_VUELTAS_VENCIMIENTO = 400;

/**
 * Suma `dias` días hábiles (lun‑vie, sin festivos) a `fechaInicio`.
 * @param {Date|string} fechaInicio - Date, DD-MM-AAAA o AAAA-MM-DD.
 * @param {string} prioridad - 'Alta' | 'Media' | 'Baja'.
 * @param {number} [dias] - días a sumar; si no se indica, se usa la tabla por prioridad.
 * @returns {string|null} fecha de vencimiento en YYYY-MM-DD, o null si la entrada no es válida.
 */
function calcularFechaVencimiento(fechaInicio, prioridad, dias = 0) {
  const inicio = parseFechaInicio(fechaInicio);
  if (!inicio) {
    return null;
  }

  const totalDias = Number.isInteger(dias) && dias > 0 ? dias : DIAS_VENCIMIENTO[prioridad] ?? 10;
  const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  let sumados = 0;
  let vueltas = 0;

  while (sumados < totalDias && vueltas < MAX_VUELTAS_VENCIMIENTO) {
    fecha.setDate(fecha.getDate() + 1);
    vueltas += 1;
    const diaSemana = fecha.getDay();
    if (diaSemana >= 1 && diaSemana <= 5) {
      sumados += 1;
    }
  }

  return formatearFechaISO(fecha);
}

/**
 * Devuelve el caso con sus fechas de creación, actualización, inicio y vencimiento
 * como texto en hora local YYYY-MM-DD HH:mm:ss (RF-48, RNF-2).
 * Serializador compartido: lo usan CaseController y CounterController para que
 * todas las respuestas de casos devuelvan las fechas en el mismo formato local.
 * @param {Object} caso - caso con campos de fecha (creado_en, actualizado_en, fecha_inicio, fecha_vencimiento).
 * @returns {Object} caso con las fechas formateadas en hora local.
 */
function casoConFechasLocales(caso) {
  return {
    ...caso,
    creado_en: formatLocalDate(caso.creado_en),
    actualizado_en: formatLocalDate(caso.actualizado_en),
    fecha_inicio: caso.fecha_inicio ? formatLocalDate(caso.fecha_inicio) : null,
    fecha_vencimiento: caso.fecha_vencimiento ? formatLocalDate(caso.fecha_vencimiento) : null,
  };
}

module.exports = {
  nowLocal,
  formatLocalDate,
  formatearFechaISO,
  parseFechaDDMMYYYY,
  parseFechaInicio,
  isSessionInactive,
  calcularFechaVencimiento,
  casoConFechasLocales,
};
