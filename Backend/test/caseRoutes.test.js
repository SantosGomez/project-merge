const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const { formatLocalDate } = require('../src/utils/dateUtils');

// Formato de hora local de RNF-2: sin `T`, sin `Z` y sin milisegundos.
const FORMATO_FECHA_LOCAL = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * Pruebas de integración de las rutas de casos (caseRoutes).
 * RF-10, RF-15, RF-16, RF-17 a RF-22, RF-23, RF-48, RNF-2, RNF-5, RNF-6.
 *
 * Levanta la aplicación real en un puerto libre y hace peticiones HTTP reales.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea sus propios contadores y su
 * propio administrador con prefijo `zz_test_` en vez de depender de
 * `contador_seed`/`admin_seed`; el `after` cierra el servidor, borra solo los
 * datos que este proceso registró (casos por contador_id y sesiones por
 * usuario_id) y cierra el pool.
 */

let servidor;
let contador;
let contadorAjeno;
let administrador;
let tokenContador;
let tokenAjeno;
let tokenAdmin;

async function iniciarSesionDe(usuario) {
  return iniciarSesion(servidor.puerto, usuario.usuario, usuario.password);
}

/**
 * Calcula un id de caso que no existe: el máximo actual más un margen amplio.
 * Evita depender de un número fijo (aislamiento, plan 9.3).
 * @returns {Promise<number>} Id de caso inexistente.
 */
async function idDeCasoInexistente() {
  const filas = await query('SELECT COALESCE(MAX(id), 0) + 1000 AS id FROM casos');
  return Number(filas[0].id);
}

// ---------- RF-17, RF-18: registrar caso con cliente y prioridad válidos ----------
async function testRegistrarCasoValido() {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: 'Cliente de prueba', prioridad: 'Alta' },
    tokenContador
  );

  assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al crear caso');
  assert.ok(respuesta.body.mensaje.includes('Caso registrado correctamente'), 'debe incluir mensaje de éxito');
  assert.ok(respuesta.body.caso, 'debe incluir el caso creado');
  assert.strictEqual(respuesta.body.caso.cliente, 'Cliente de prueba', 'cliente debe coincidir');
  assert.strictEqual(respuesta.body.caso.prioridad, 'Alta', 'prioridad debe coincidir');
  assert.strictEqual(respuesta.body.caso.estado, 'Pendiente', 'estado debe ser Pendiente automático (RF-18)');

  // El id devuelto es un número y el caso queda asignado al contador autenticado (RF-17).
  const casoId = respuesta.body.caso.id;
  assert.ok(Number.isInteger(casoId) && casoId > 0, 'el id del caso creado debe ser un número entero');
  assert.strictEqual(
    respuesta.body.caso.contador_id,
    contador.id,
    'el caso debe quedar asignado al contador que inició sesión'
  );

  // El registro deja exactamente un caso para ese contador, sin duplicados (plan 9.9).
  const misCasos = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, tokenContador);
  assert.strictEqual(misCasos.statusCode, 200, 'debe responder 200 al consultar los casos propios');
  assert.ok(Array.isArray(misCasos.body.casos), 'debe devolver un array de casos propios');
  assert.strictEqual(misCasos.body.casos.length, 1, 'el contador debe tener exactamente un caso, sin duplicados');
  assert.strictEqual(misCasos.body.casos[0].id, casoId, 'los casos propios deben incluir el caso recién creado');
}

// ---------- RF-19: cliente faltante ----------
async function testRegistroSinClienteRechaza() {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { prioridad: 'Alta' },
    tokenContador
  );

  assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 sin cliente');
  assert.ok(respuesta.body.mensaje.includes('cliente'), 'mensaje debe mencionar cliente');
}

// ---------- RF-20: prioridad inválida ----------
async function testRegistroConPrioridadInvalidaRechaza() {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: 'Cliente X', prioridad: 'Urgente' },
    tokenContador
  );

  assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 con prioridad inválida');
  assert.ok(respuesta.body.mensaje.includes('prioridad'), 'mensaje debe mencionar prioridad');
}

// ---------- RF-21: cliente demasiado largo (> 80 caracteres) ----------
async function testRegistroClienteDemasiadoLargoRechaza() {
  const clienteLargo = 'A'.repeat(81);
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: clienteLargo, prioridad: 'Media' },
    tokenContador
  );

  assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 con cliente demasiado largo');
  assert.ok(respuesta.body.mensaje.includes('80'), 'mensaje debe indicar el máximo de 80 caracteres');
}

// ---------- RF-22: cambiar estado y prioridad de caso propio ----------
async function testCambiarEstadoYPrioridadCasoPropio() {
  // Crear un caso primero
  const crearResp = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: 'Cliente para editar', prioridad: 'Media' },
    tokenContador
  );
  assert.strictEqual(crearResp.statusCode, 201, 'caso debe crearse');
  const casoId = crearResp.body.caso.id;
  assert.ok(Number.isInteger(casoId) && casoId > 0, 'el caso creado debe tener un id numérico');

  // Cambiar estado a "En proceso"
  const estadoResp = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoId}`,
    { estado: 'En proceso' },
    tokenContador
  );
  assert.strictEqual(estadoResp.statusCode, 200, 'debe responder 200 al cambiar estado');
  assert.strictEqual(estadoResp.body.caso.estado, 'En proceso', 'estado debe ser En proceso');

  // Cambiar prioridad a "Alta"
  const prioridadResp = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoId}`,
    { prioridad: 'Alta' },
    tokenContador
  );
  assert.strictEqual(prioridadResp.statusCode, 200, 'debe responder 200 al cambiar prioridad');
  assert.strictEqual(prioridadResp.body.caso.prioridad, 'Alta', 'prioridad debe ser Alta');

  // Cliente no editable: seguir siendo el mismo
  assert.strictEqual(prioridadResp.body.caso.cliente, 'Cliente para editar', 'cliente no debe cambiar');
}

// ---------- RF-10 y RF-09: cambiar caso ajeno es acceso denegado ----------
async function testCambiarCasoAjenoEsDenegado() {
  // Crear un caso como el contador dueño
  const crearResp = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: 'Cliente caso ajeno', prioridad: 'Baja' },
    tokenContador
  );
  assert.strictEqual(crearResp.statusCode, 201, 'el caso ajeno debe crearse');
  const casoId = crearResp.body.caso.id;

  // Comprobación 1 (RF-10): otro contador intenta cambiar el caso y recibe acceso denegado.
  const patchAjeno = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoId}`,
    { estado: 'Finalizado' },
    tokenAjeno
  );
  assert.strictEqual(patchAjeno.statusCode, 403, 'otro contador debe recibir 403 al intentar cambiar caso ajeno');
  assert.ok(patchAjeno.body.mensaje.includes('Acceso denegado'), 'mensaje debe ser de acceso denegado');

  // Comprobación 2 (RF-09): el administrador es de solo consulta y tampoco puede cambiar el caso.
  const patchAdmin = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoId}`,
    { estado: 'Finalizado' },
    tokenAdmin
  );
  assert.strictEqual(patchAdmin.statusCode, 403, 'el administrador debe recibir 403 al intentar cambiar un caso');
  assert.ok(patchAdmin.body.mensaje.includes('Acceso denegado'), 'mensaje debe ser de acceso denegado');

  // Ninguno de los dos intentos modificó el caso: sigue Pendiente para su dueño.
  const misCasos = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, tokenContador);
  const caso = misCasos.body.casos.find((fila) => fila.id === casoId);
  assert.ok(caso, 'el caso ajeno debe seguir existiendo para su dueño');
  assert.strictEqual(caso.estado, 'Pendiente', 'los intentos denegados no deben modificar el caso');
}

// ---------- RF-16: caso inexistente devuelve 404 ----------
async function testCasoInexistenteDevuelve404() {
  const casoInexistente = await idDeCasoInexistente();

  const respuesta = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoInexistente}`,
    { estado: 'Finalizado' },
    tokenContador
  );
  assert.strictEqual(respuesta.statusCode, 404, 'debe responder 404 para caso inexistente');
  assert.ok(respuesta.body.mensaje.includes('No se encontró el caso'), 'mensaje debe indicar no encontrado');
}

/**
 * Comprueba que las fechas del caso devuelto son texto en hora local y que
 * coinciden con la fila guardada (RF-48, RNF-2, criterio 23).
 * @param {Object} caso - Caso devuelto por la API.
 * @param {string} origen - Petición que lo devolvió, para el mensaje del aserto.
 */
async function comprobarFechasEnHoraLocal(caso, origen) {
  const filas = await query('SELECT creado_en, actualizado_en FROM casos WHERE id = ?', [caso.id]);
  for (const campo of ['creado_en', 'actualizado_en']) {
    assert.strictEqual(typeof caso[campo], 'string', `${origen}: ${campo} debe llegar como texto`);
    assert.match(caso[campo], FORMATO_FECHA_LOCAL, `${origen}: ${campo} debe tener el formato YYYY-MM-DD HH:mm:ss`);
    assert.strictEqual(
      caso[campo],
      formatLocalDate(filas[0][campo]),
      `${origen}: ${campo} debe coincidir con la hora local guardada en la base de datos`
    );
  }
}

// ---------- RF-48, RNF-2, criterio 23: fechas del caso en hora local ----------
async function testFechasDelCasoEnHoraLocal() {
  const crearResp = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: 'Cliente con fechas', prioridad: 'Baja' },
    tokenContador
  );
  assert.strictEqual(crearResp.statusCode, 201, 'el caso debe crearse');
  await comprobarFechasEnHoraLocal(crearResp.body.caso, 'POST /casos');

  const patchResp = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${crearResp.body.caso.id}`,
    { estado: 'En proceso' },
    tokenContador
  );
  assert.strictEqual(patchResp.statusCode, 200, 'el caso debe actualizarse');
  await comprobarFechasEnHoraLocal(patchResp.body.caso, 'PATCH /casos/:id');
}

describe('rutas de casos', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    contadorAjeno = await crearUsuarioDePrueba('contador');
    administrador = await crearUsuarioDePrueba('administrador');
    servidor = await iniciarServidor();
    tokenContador = await iniciarSesionDe(contador);
    tokenAjeno = await iniciarSesionDe(contadorAjeno);
    tokenAdmin = await iniciarSesionDe(administrador);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('registrar un caso válido crea un solo caso Pendiente del contador', testRegistrarCasoValido);
  test('registrar sin cliente responde 400', testRegistroSinClienteRechaza);
  test('registrar con prioridad inválida responde 400', testRegistroConPrioridadInvalidaRechaza);
  test('registrar con cliente de más de 80 caracteres responde 400', testRegistroClienteDemasiadoLargoRechaza);
  test('cambiar estado y prioridad de un caso propio actualiza el caso', testCambiarEstadoYPrioridadCasoPropio);
  test('cambiar un caso ajeno es acceso denegado para otro contador y para el administrador', testCambiarCasoAjenoEsDenegado);
  test('un caso inexistente responde 404', testCasoInexistenteDevuelve404);
  test('crear y cambiar un caso devuelve las fechas en hora local YYYY-MM-DD HH:mm:ss', testFechasDelCasoEnHoraLocal);
});
