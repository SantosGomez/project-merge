/**
 * Verificador objetivo del criterio 25 (plan 9.5).
 *
 * Ejecuta los archivos de `backend/test/` con la API `run()` de `node:test` y
 * cuenta las pruebas REALES que cada archivo registra, comparándolas con los
 * mínimos acordados. Un archivo que solo exporta funciones produce una única
 * entrada sintética (su nombre es la ruta del archivo) y, por tanto, 0 pruebas.
 *
 * Solo usa módulos nativos (`node:test`, `node:path`, `node:fs`); no abre
 * conexiones ni necesita la base de datos para esta comprobación.
 *
 * Código de salida: 0 si todo cumple, 1 si hay cualquier incumplimiento.
 */

const fs = require('node:fs');
const path = require('node:path');
const { run } = require('node:test');

// Mínimos de pruebas por archivo (los del plan 9.5 y los que se fueron sumando con cada rebanada).
const MINIMOS = {
  'actividadesMes.test.js': 14,
  'adminVeEquiposYCampana.test.js': 4,
  'appCors.test.js': 4,
  'asignarCaso.test.js': 2,
  'auditoriaEventos.test.js': 10,
  'auditoriaMensajes.test.js': 5,
  'auditoriaRoutes.test.js': 19,
  'auditoriaSeguimiento.test.js': 6,
  'authMiddleware.test.js': 13,
  'authRoutes.test.js': 9,
  'auxiliarCreaCaso.test.js': 4,
  'auxiliarEditaCaso.test.js': 2,
  'auxiliarModel.test.js': 9,
  'auxiliarRoutes.test.js': 14,
  'auxiliarSoloEstado.test.js': 5,
  'cambioContrasena.test.js': 8,
  'cambioContrasenaPropia.test.js': 12,
  'carteraActividad.test.js': 8,
  'casosImportantesCalendario.test.js': 4,
  'caseModel.test.js': 8,
  'caseModelConAuxiliares.test.js': 5,
  'caseRoutes.test.js': 9,
  'clientes.test.js': 13,
  'contadoresDeAuxiliar.test.js': 10,
  'counterRoutes.test.js': 6,
  'dateUtils.test.js': 4,
  'dbParametros.test.js': 20,
  'errorHandlerGlobal.test.js': 12,
  'editarUsuario.test.js': 13,
  'errorUtils.test.js': 2,
  'entregasAuditoriaCalendario.test.js': 3,
  'escalarCasosDeAuxiliar.test.js': 8,
  'eventosRoutes.test.js': 12,
  'fallosPersistencia.test.js': 7,
  'idsContador.test.js': 6,
  'importarCuentas.test.js': 3,
  'informesTiempo.test.js': 14,
  'inyeccionSql.test.js': 9,
  'jornadaUtils.test.js': 7,
  'jornadas.test.js': 14,
  'miPerfil.test.js': 3,
  'misCasosEnEquipo.test.js': 7,
  'originMiddleware.test.js': 3,
  'limiteIntentosCuenta.test.js': 4,
  'limitesEntrada.test.js': 10,
  'originUtils.test.js': 7,
  'ownershipMiddleware.test.js': 4,
  'ownershipMiddlewareAuxiliar.test.js': 3,
  'passwordUtils.test.js': 4,
  'politicaContrasena.test.js': 4,
  'prioridadAdmin.test.js': 6,
  'registrosTiempo.test.js': 13,
  'respuestasApi.test.js': 3,
  'rolAuxiliar.test.js': 10,
  'roleMiddleware.test.js': 8,
  'rotarSecretos.test.js': 5,
  'seed.test.js': 5,
  'seguridadApp.test.js': 8,
  'sesionesContrasena.test.js': 4,
  'tiposActividad.test.js': 13,
  'tokenUtils.test.js': 9,
  'userModel.test.js': 5,
  'userRoutes.test.js': 10,
  'validationUtils.test.js': 22,
  'vencimientoActividad.test.js': 24,
};

const TESTS_DIR = path.join(__dirname, '..', 'test');
const SAFETY_TIMEOUT_MS = 120000;
const AJENO_REASON = 'archivo que no termina en .test.js dentro de test/';

/**
 * Imprime el texto y termina con el código indicado. Se espera a que stdout
 * vacíe el búfer para no perder líneas cuando la salida va por una tubería.
 * @param {string} text - texto a imprimir.
 * @param {number} code - código de salida.
 */
function finish(text, code) {
  process.stdout.write(`${text}\n`, () => process.exit(code));
}

/**
 * Lista todos los archivos de una carpeta de forma recursiva.
 * @param {string} dir - carpeta a recorrer.
 * @returns {string[]} rutas absolutas de los archivos.
 */
function listFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Devuelve el nombre a mostrar de un archivo (relativo a test/, con `/`).
 * @param {string} fullPath - ruta absoluta del archivo.
 * @returns {string} ruta relativa normalizada.
 */
function relativeName(fullPath) {
  return path.relative(TESTS_DIR, fullPath).split(path.sep).join('/');
}

/**
 * Devuelve la ruta de un archivo ajeno relativa a `backend/` (por ejemplo
 * `test/ajeno.js`), que es la forma que espera el informe del plan 9.5.
 * @param {string} fullPath - ruta absoluta del archivo.
 * @returns {string} ruta relativa normalizada.
 */
function relativeToBackend(fullPath) {
  return path.relative(path.join(__dirname, '..'), fullPath).split(path.sep).join('/');
}

/**
 * Contadores de un archivo de prueba.
 * @returns {{passed: number, failed: number, skipped: number, todo: number, cancelled: number, real: number}}
 */
function emptyStats() {
  return { passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0, real: 0 };
}

/**
 * Obtiene (o crea) los contadores del archivo de un evento.
 * @param {Map<string, object>} stats - contadores por archivo.
 * @param {string} file - ruta absoluta del archivo.
 * @returns {object} contadores del archivo.
 */
function getStats(stats, file) {
  if (!stats.has(file)) {
    stats.set(file, emptyStats());
  }
  return stats.get(file);
}

/**
 * Entrada sintética: nombre del evento igual a la ruta del archivo. La crea el
 * ejecutor por cada archivo que no registra pruebas y no cuenta como prueba.
 * @param {object} data - evento de node:test.
 * @param {string} file - ruta absoluta del archivo del evento.
 * @returns {boolean} true si es la entrada sintética del archivo.
 */
function isSyntheticEntry(data, file) {
  if (typeof data.name !== 'string') {
    return false;
  }
  return path.resolve(data.name) === file;
}

/**
 * Indica si el error de un evento es un fallo de conexión con MariaDB.
 * @param {object} error - error del evento (puede faltar).
 * @returns {boolean} true si el error contiene ECONNREFUSED.
 */
function isConnectionError(error) {
  if (!error) {
    return false;
  }
  if (typeof error.message === 'string' && error.message.includes('ECONNREFUSED')) {
    return true;
  }
  const cause = error.cause;
  if (!cause) {
    return false;
  }
  if (cause.code === 'ECONNREFUSED') {
    return true;
  }
  return typeof cause.message === 'string' && cause.message.includes('ECONNREFUSED');
}

/**
 * Registra un evento `test:pass`. Solo cuenta como prueba real un evento de
 * tipo `test` cuyo nombre no sea la ruta del archivo. Las suites no cuentan.
 * @param {Map<string, object>} stats - contadores por archivo.
 * @param {object} data - evento de node:test.
 */
function recordPass(stats, data) {
  if (!data.file) {
    return;
  }
  const file = path.resolve(data.file);
  const type = data.details && data.details.type;
  if (type !== 'test') {
    return;
  }
  if (isSyntheticEntry(data, file)) {
    return;
  }
  const current = getStats(stats, file);
  current.real += 1;
  if (data.skip) {
    current.skipped += 1;
  } else if (data.todo) {
    current.todo += 1;
  } else {
    current.passed += 1;
  }
}

/**
 * Registra un evento `test:fail`. Cualquier fallo cuenta; los cancelados por
 * el padre se cuentan aparte. Devuelve si el fallo es de conexión.
 * @param {Map<string, object>} stats - contadores por archivo.
 * @param {object} data - evento de node:test.
 * @returns {boolean} true si el error es un fallo de conexión con MariaDB.
 */
function recordFail(stats, data) {
  if (!data.file) {
    return false;
  }
  const file = path.resolve(data.file);
  const current = getStats(stats, file);
  current.real += 1;
  const error = data.details && data.details.error;
  if (error && error.failureType === 'cancelledByParent') {
    current.cancelled += 1;
    return false;
  }
  current.failed += 1;
  return isConnectionError(error);
}

/**
 * Ejecuta los archivos de prueba con `run()` de node:test y guarda los contadores.
 * @param {string[]} files - rutas absolutas de los `.test.js`.
 * @returns {Promise<{stats: Map<string, object>, mariadbDown: boolean}>}
 */
async function runTests(files) {
  const stats = new Map();
  let mariadbDown = false;

  if (files.length === 0) {
    return { stats, mariadbDown };
  }

  const stream = run({ files });

  stream.on('test:pass', (data) => recordPass(stats, data));
  stream.on('test:fail', (data) => {
    if (recordFail(stats, data)) {
      mariadbDown = true;
    }
  });

  await new Promise((resolve) => {
    stream.on('end', resolve);
    stream.resume();
  });

  return { stats, mariadbDown };
}

/**
 * Construye las líneas del informe y el resultado global.
 * @param {Map<string, object>} stats - contadores por archivo.
 * @param {string[]} foreignFiles - archivos de test/ que no terminan en .test.js.
 * @param {string[]} testFiles - rutas absolutas de los `.test.js`.
 * @param {boolean} mariadbDown - true si algún fallo fue ECONNREFUSED.
 * @returns {{lines: string[], failed: boolean}}
 */
function buildReport(stats, foreignFiles, testFiles, mariadbDown) {
  const found = new Set(testFiles.map((file) => relativeName(file)));
  const names = Array.from(new Set([...found, ...Object.keys(MINIMOS)])).sort();

  const lines = [];
  const totals = { passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0, withReal: 0 };
  let failed = foreignFiles.length > 0 || mariadbDown;

  for (const name of names) {
    const file = path.resolve(TESTS_DIR, name);
    const current = stats.get(file) || emptyStats();
    const hasMinimo = Object.prototype.hasOwnProperty.call(MINIMOS, name);
    const minimo = hasMinimo ? MINIMOS[name] : null;
    const reasons = [];

    if (current.real === 0) {
      reasons.push('sin pruebas reales');
    } else if (minimo !== null && current.passed < minimo) {
      reasons.push('menos pruebas que el mínimo');
    }
    if (current.failed > 0) {
      reasons.push(`${current.failed} fallidas`);
    }
    if (current.skipped > 0) {
      reasons.push(`${current.skipped} omitidas`);
    }
    if (current.todo > 0) {
      reasons.push(`${current.todo} pendientes`);
    }
    if (current.cancelled > 0) {
      reasons.push(`${current.cancelled} canceladas`);
    }
    if (minimo === null) {
      reasons.push('no está en la tabla de mínimos');
    }
    if (!found.has(name)) {
      reasons.push('el archivo no existe');
    }

    if (reasons.length > 0) {
      failed = true;
    }
    const result = reasons.length === 0 ? 'OK' : `FALLA: ${reasons.join('; ')}`;
    lines.push([name, current.passed, minimo === null ? '-' : minimo, result].join(' | '));

    totals.passed += current.passed;
    totals.failed += current.failed;
    totals.skipped += current.skipped;
    totals.todo += current.todo;
    totals.cancelled += current.cancelled;
    if (current.real > 0) {
      totals.withReal += 1;
    }
  }

  for (const file of foreignFiles) {
    lines.push(`AJENO | ${relativeToBackend(file)} | - | FALLA: ${AJENO_REASON}`);
  }

  if (mariadbDown) {
    lines.push('AVISO: MariaDB no responde (ECONNREFUSED); arranque MariaDB (XAMPP, puerto 3306) y repita; no se da nada por verificado.');
  }

  const totalMinimo = Object.values(MINIMOS).reduce((total, value) => total + value, 0);
  lines.push(
    `RESUMEN: archivos ${names.length} | con pruebas reales ${totals.withReal} | pruebas ${totals.passed} de ${totalMinimo} mínimas | fallidas ${totals.failed} | omitidas ${totals.skipped} | pendientes ${totals.todo} | canceladas ${totals.cancelled} | .js ajenos ${foreignFiles.length} | RESULTADO: ${failed ? 'FALLA' : 'OK'}`
  );

  return { lines, failed };
}

/**
 * Recorre test/, ejecuta los `.test.js` y publica el informe.
 */
async function main() {
  const timer = setTimeout(() => {
    finish('FALLA: un archivo de prueba no termina en 120 s (¿servidor HTTP o pool de la base de datos sin cerrar?)', 1);
  }, SAFETY_TIMEOUT_MS);

  const allFiles = fs.existsSync(TESTS_DIR) ? listFiles(TESTS_DIR) : [];
  const testFiles = allFiles.filter((file) => file.endsWith('.test.js'));
  const foreignFiles = allFiles.filter((file) => !file.endsWith('.test.js')).sort();

  const { stats, mariadbDown } = await runTests(testFiles);
  clearTimeout(timer);

  const { lines, failed } = buildReport(stats, foreignFiles, testFiles, mariadbDown);
  finish(lines.join('\n'), failed ? 1 : 0);
}

main().catch((error) => {
  finish(`FALLA: el verificador no pudo completarse: ${error.message}`, 1);
});
