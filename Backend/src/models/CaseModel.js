const { query } = require('../config/db');
const { formatLocalDate, nowLocal, formatearFechaISO } = require('../utils/dateUtils');

/**
 * Busca un caso por su ID.
 * RF-14, RF-16.
 * @param {number} id - ID del caso.
 * @returns {Promise<Object|null>} El caso encontrado o null.
 */
async function findById(id) {
  const rows = await query('SELECT * FROM casos WHERE id = ?', [id]);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Devuelve los casos asignados a un contador.
 * RF-14, RF-15.
 * @param {number} contadorId - ID del contador.
 * @param {{ soloImportantes?: boolean }} [opciones] - solo los casos marcados como importantes.
 * @returns {Promise<Array>} Lista de casos del contador.
 */
async function findByCounter(contadorId, { soloImportantes = false } = {}) {
  const rows = await query(
    `SELECT * FROM casos WHERE contador_id = ?${soloImportantes ? ' AND importante = 1' : ''} ORDER BY id DESC`,
    [contadorId]
  );
  return rows;
}

/**
 * Devuelve el conteo de casos por estado para un contador, incluyendo ceros.
 * RF-13.
 * @param {number} contadorId - ID del contador.
 * @param {{ soloImportantes?: boolean }} [opciones] - contar solo los casos marcados como importantes.
 * @returns {Promise<{pendiente: number, en_proceso: number, finalizado: number}>} Conteos por estado.
 */
async function countByStatus(contadorId, { soloImportantes = false } = {}) {
  const rows = await query(
    `SELECT estado, COUNT(*) AS cantidad
     FROM casos
     WHERE contador_id = ?${soloImportantes ? ' AND importante = 1' : ''}
     GROUP BY estado`,
    [contadorId]
  );

  const conteos = { pendiente: 0, en_proceso: 0, finalizado: 0 };
  rows.forEach((row) => {
    if (row.estado === 'Pendiente') {
      conteos.pendiente = row.cantidad;
    } else if (row.estado === 'En proceso') {
      conteos.en_proceso = row.cantidad;
    } else if (row.estado === 'Finalizado') {
      conteos.finalizado = row.cantidad;
    }
  });
  return conteos;
}

/** Campos del resumen de casos de un contador (dashboard del administrador). */
const CAMPOS_RESUMEN = ['pendiente', 'en_proceso', 'finalizado', 'abiertos', 'vencidos', 'alta_abiertos'];

/**
 * Resumen de casos de cada contador en una sola consulta, con ceros para quien no tiene casos.
 * Vencido = vencimiento anterior a `hoy` y no finalizado; alta abierta = prioridad Alta no finalizada.
 * Solo cuentan las cuentas con rol contador.
 * @param {string} hoy - Fecha AAAA-MM-DD de hoy en hora local.
 * @param {{ soloImportantes?: boolean }} [opciones] - contar solo los casos marcados como importantes.
 * @returns {Promise<Array<{contador_id: number, pendiente: number, en_proceso: number, finalizado: number, abiertos: number, vencidos: number, alta_abiertos: number}>>}
 */
async function resumenPorContador(hoy, { soloImportantes = false } = {}) {
  const filtroImportante = soloImportantes ? ' AND c.importante = 1' : '';
  const rows = await query(
    `SELECT u.id AS contador_id,
            SUM(c.estado = 'Pendiente') AS pendiente,
            SUM(c.estado = 'En proceso') AS en_proceso,
            SUM(c.estado = 'Finalizado') AS finalizado,
            SUM(c.estado <> 'Finalizado') AS abiertos,
            SUM(c.estado <> 'Finalizado' AND c.fecha_vencimiento < ?) AS vencidos,
            SUM(c.estado <> 'Finalizado' AND c.prioridad = 'Alta') AS alta_abiertos
     FROM usuarios u
     LEFT JOIN casos c ON c.contador_id = u.id${filtroImportante}
     WHERE u.rol = 'contador'
     GROUP BY u.id
     ORDER BY u.id`,
    [hoy]
  );

  // SUM llega como texto (DECIMAL) o null sin casos: se normaliza a número.
  return rows.map((row) => {
    const fila = { contador_id: row.contador_id };
    for (const campo of CAMPOS_RESUMEN) fila[campo] = Number(row[campo]) || 0;
    return fila;
  });
}

/**
 * Crea un nuevo caso y devuelve el ID insertado.
 * RF-17, RF-18.
 * @param {Object} datos - Datos del caso: contador_id, cliente, estado, prioridad, creado_en, actualizado_en.
 * @returns {Promise<number>} ID del caso insertado.
 */
async function create({ contador_id, cliente, estado, prioridad, importante = false, creado_en, actualizado_en, fecha_inicio, fecha_vencimiento, descripcion, observaciones }) {
  const ahora = formatLocalDate(nowLocal());
  // Las columnas son DATE: se envía solo la fecha, nunca una fecha con hora.
  const hoy = formatearFechaISO(nowLocal());
  const result = await query(
    `INSERT INTO casos (contador_id, cliente, estado, prioridad, importante, descripcion, observaciones, fecha_inicio, fecha_vencimiento, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contador_id,
      cliente,
      estado,
      prioridad,
      importante,
      descripcion,
      observaciones,
      fecha_inicio || hoy,
      fecha_vencimiento || hoy,
      creado_en || ahora,
      actualizado_en || ahora,
    ]
  );
  return result.insertId;
}

/**
 * Actualiza el estado de un caso.
 * RF-22.
 * @param {number} id - ID del caso.
 * @param {string} estado - Nuevo estado (Pendiente, En proceso, Finalizado).
 */
async function updateStatus(id, estado) {
  const ahora = formatLocalDate(nowLocal());
  await query(
    'UPDATE casos SET estado = ?, actualizado_en = ? WHERE id = ?',
    [estado, ahora, id]
  );
}

/**
 * Actualiza la prioridad de un caso.
 * RF-22.
 * @param {number} id - ID del caso.
 * @param {string} prioridad - Nueva prioridad (Alta, Media, Baja).
 */
async function updatePriority(id, prioridad) {
  const ahora = formatLocalDate(nowLocal());
  await query(
    'UPDATE casos SET prioridad = ?, actualizado_en = ? WHERE id = ?',
    [prioridad, ahora, id]
  );
}

// Columnas que updatePatch puede cambiar; cualquier otra clave se ignora.
const COLUMNAS_EDITABLES = [
  'cliente',
  'estado',
  'prioridad',
  'fecha_inicio',
  'fecha_vencimiento',
  'descripcion',
  'observaciones',
  'importante',
];

/**
 * Actualiza los campos editables de un caso en un solo UPDATE,
 * que es atómico: o se guardan todos los campos o ninguno.
 * Solo toca los campos definidos; si no viene ninguno, no hace nada.
 * @param {number} id - ID del caso.
 * @param {Object} campos - { cliente, estado, prioridad, fecha_inicio, fecha_vencimiento (AAAA-MM-DD),
 *   descripcion, observaciones }, todos opcionales; null guarda NULL.
 * @returns {Promise<void>}
 */
async function updatePatch(id, campos = {}) {
  const asignaciones = [];
  const valores = [];
  for (const columna of COLUMNAS_EDITABLES) {
    const valor = campos[columna];
    if (valor !== undefined) {
      asignaciones.push(`${columna} = ?`);
      valores.push(valor);
    }
  }

  if (asignaciones.length === 0) {
    return;
  }

  const ahora = formatLocalDate(nowLocal());
  // Solo la primera vez que pasa a «En proceso»: si ya tiene fecha, se conserva
  if (campos.estado === 'En proceso') {
    asignaciones.push('en_proceso_en = COALESCE(en_proceso_en, ?)');
    valores.push(ahora);
  }

  await query(`UPDATE casos SET ${asignaciones.join(', ')}, actualizado_en = ? WHERE id = ?`, [...valores, ahora, id]);
}

module.exports = { findById, findByCounter, countByStatus, resumenPorContador, create, updateStatus, updatePriority, updatePatch };
