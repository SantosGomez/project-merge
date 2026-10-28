const assert = require('node:assert');
const { describe, test, before, after, afterEach } = require('node:test');
const jwt = require('jsonwebtoken');
const { pool } = require('../src/config/db');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Pruebas de persistencia de sesiones y fallos de base de datos (área C de la spec 004).
 * RF-38, RF-39, RF-40, RF-47, RF-05, RNF-4, RNF-8, criterios 33, 34, 35 y 41.
 *
 * Levanta la aplicación real en un puerto libre. Requiere MariaDB en marcha
 * (XAMPP, puerto 3306). Cada prueba usa su propio contador `zz_test_` para que
 * los tokens no coincidan entre pruebas; el `after` borra solo lo que creó este proceso.
 *
 * Los fallos se simulan sustituyendo `pool.query` solo en este archivo (plan 10.3.3):
 * falla únicamente la sentencia que cumple la condición y el resto sigue funcionando.
 * La sustitución se restaura en `finally` y en `afterEach`. Ninguna lógica de prueba va a `src/`.
 */

const LIMITE_RESPUESTA_MS = 2000;
const queryOriginal = pool.query.bind(pool);
const rechazosSinManejar = [];
const registrarRechazo = (motivo) => rechazosSinManejar.push(motivo);

let servidor;

/**
 * Hace que la promesa falle si el servidor no responde dentro del límite.
 * @param {Promise<any>} promesa - Petición en curso.
 * @returns {Promise<any>} La respuesta o un error «el servidor no respondió».
 */
function conLimite(promesa) {
  let temporizador;
  const limite = new Promise((resolve, reject) => {
    temporizador = setTimeout(
      () => reject(new Error(`el servidor no respondió en ${LIMITE_RESPUESTA_MS} ms`)),
      LIMITE_RESPUESTA_MS
    );
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

/**
 * Sustituye `pool.query` para que falle solo la sentencia que cumple la condición.
 * @param {(sql: string) => boolean} condicion - Decide qué sentencia falla.
 */
function simularFalloDeBd(condicion) {
  pool.query = (sql, ...resto) => {
    const texto = typeof sql === 'string' ? sql : sql && sql.sql;
    if (typeof texto === 'string' && condicion(texto)) {
      return Promise.reject(new Error('fallo de BD simulado'));
    }
    return queryOriginal(sql, ...resto);
  };
}

function restaurarPool() {
  pool.query = queryOriginal;
}

/**
 * Ejecuta una petición con la base de datos fallando según la condición y
 * restaura el pool pase lo que pase.
 * @param {(sql: string) => boolean} condicion - Sentencia que debe fallar.
 * @param {() => Promise<any>} hacerPeticion - Petición que se envía durante el fallo.
 * @returns {Promise<any>} La respuesta obtenida.
 */
async function conFalloDeBd(condicion, hacerPeticion) {
  simularFalloDeBd(condicion);
  try {
    return await conLimite(hacerPeticion());
  } finally {
    restaurarPool();
  }
}

/**
 * Comprueba que un mensaje tenga las tres partes del formato de `buildError`.
 * @param {string} mensaje - Mensaje recibido.
 * @param {string} contexto - Descripción para el aviso de la aserción.
 */
function afirmarTresPartes(mensaje, contexto) {
  assert.match(
    String(mensaje),
    /^.+ sobre .+: .+$/,
    `${contexto}: el mensaje debe tener las tres partes (qué ocurrió, sobre qué y qué hacer)`
  );
}

// La fila de `sesiones` se identifica por el jti propio del token (RF-41).
async function revocadoEnBd(token) {
  const [filas] = await queryOriginal('SELECT revocado FROM sesiones WHERE jti = ?', [jwt.decode(token).jti]);
  return filas.length > 0 ? Number(filas[0].revocado) : null;
}

// ---------- RF-38, criterio 33: si no se registra la sesión, el login no entrega token ----------
async function testLoginSinRegistrarSesion() {
  const contador = await crearUsuarioDePrueba('contador');

  const respuesta = await conFalloDeBd(
    (sql) => sql.startsWith('INSERT INTO sesiones'),
    () => peticion(servidor.puerto, 'POST', '/auth/login', { correo: contador.correo, password: contador.password })
  );

  assert.strictEqual(respuesta.statusCode, 503, 'sin sesión registrada el login debe responder 503');
  assert.strictEqual(respuesta.body.token, undefined, 'no debe entregar un token sin sesión registrada');
  afirmarTresPartes(respuesta.body.mensaje, 'login sin sesión registrada');

  const siguiente = await conLimite(
    peticion(servidor.puerto, 'POST', '/auth/login', { correo: contador.correo, password: contador.password })
  );
  assert.strictEqual(siguiente.statusCode, 200, 'restaurada la base de datos, la petición siguiente se atiende');
}

// ---------- RF-39, criterio 34: si no se revoca, el cierre de sesión no se confirma ----------
async function testLogoutSinRevocar() {
  const contador = await crearUsuarioDePrueba('contador');
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  const respuesta = await conFalloDeBd(
    (sql) => sql.startsWith('UPDATE sesiones SET revocado = 1 WHERE jti'),
    () => peticion(servidor.puerto, 'POST', '/auth/logout', undefined, token)
  );

  assert.strictEqual(respuesta.statusCode, 503, 'si no se pudo revocar, el cierre de sesión debe responder 503');
  afirmarTresPartes(respuesta.body.mensaje, 'cierre de sesión sin revocar');

  const reintento = await conLimite(peticion(servidor.puerto, 'POST', '/auth/logout', undefined, token));
  assert.strictEqual(reintento.statusCode, 200, 'restaurada la base de datos, el reintento confirma el cierre');

  const despues = await conLimite(peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token));
  assert.strictEqual(despues.statusCode, 401, 'tras cerrar la sesión el mismo token debe rechazarse');
}

// ---------- RF-40, criterio 35: un fallo al consultar la sesión no es «sesión caducada» ----------
async function testConsultaDeSesionFalla() {
  const contador = await crearUsuarioDePrueba('contador');
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  const respuesta = await conFalloDeBd(
    (sql) => /^SELECT s\.\*[\s\S]*FROM sesiones s/.test(sql),
    () => peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token)
  );

  assert.strictEqual(respuesta.statusCode, 503, 'un fallo al consultar la sesión debe responder 503, no 401');
  afirmarTresPartes(respuesta.body.mensaje, 'consulta de sesión fallida');
  assert.strictEqual(await revocadoEnBd(token), 0, 'la sesión no debe invalidarse por un fallo de la base de datos');

  const siguiente = await conLimite(peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token));
  assert.strictEqual(siguiente.statusCode, 200, 'restaurada la base de datos, el mismo token debe servir');
}

// ---------- RF-40, RNF-4, criterio 35: un fallo al renovar la actividad no invalida la sesión ----------
async function testRenovarActividadFalla() {
  const contador = await crearUsuarioDePrueba('contador');
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  const respuesta = await conFalloDeBd(
    (sql) => sql.startsWith('UPDATE sesiones SET ultima_actividad'),
    () => peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token)
  );

  assert.strictEqual(respuesta.statusCode, 503, 'un fallo al renovar la actividad debe responder 503');
  afirmarTresPartes(respuesta.body.mensaje, 'renovación de actividad fallida');
  assert.strictEqual(await revocadoEnBd(token), 0, 'la sesión no debe invalidarse por un fallo de la base de datos');

  const siguiente = await conLimite(peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token));
  assert.strictEqual(siguiente.statusCode, 200, 'restaurada la base de datos, el mismo token debe servir');
}

// ---------- RF-47, criterio 41: fallo al buscar el usuario en el login ----------
async function testLoginNoEncuentraUsuario() {
  const contador = await crearUsuarioDePrueba('contador');

  const respuesta = await conFalloDeBd(
    (sql) => sql.startsWith('SELECT * FROM usuarios'),
    () => peticion(servidor.puerto, 'POST', '/auth/login', { correo: contador.correo, password: contador.password })
  );

  assert.strictEqual(respuesta.statusCode, 503, 'un fallo interno en el login debe responder 503');
  assert.strictEqual(respuesta.body.token, undefined, 'no debe confirmar el acceso con un token');
  afirmarTresPartes(respuesta.body.mensaje, 'login con fallo interno');

  const siguiente = await conLimite(peticion(servidor.puerto, 'GET', '/contadores'));
  assert.strictEqual(siguiente.statusCode, 401, 'el servidor sigue atendiendo la petición siguiente');
}

// ---------- RF-47, criterio 41: fallos al leer y al guardar casos ----------
async function testLeerYGuardarCasosFallan() {
  const contador = await crearUsuarioDePrueba('contador');
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  const lectura = await conFalloDeBd(
    (sql) => sql.startsWith('SELECT * FROM casos'),
    () => peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token)
  );
  assert.strictEqual(lectura.statusCode, 503, 'un fallo al leer los casos debe responder 503');
  afirmarTresPartes(lectura.body.mensaje, 'lectura de casos fallida');

  const cliente = `zz_test_cliente_${contador.id}`;
  const registro = await conFalloDeBd(
    (sql) => sql.startsWith('INSERT INTO casos'),
    () => peticion(servidor.puerto, 'POST', '/casos', { cliente, prioridad: 'Alta', fecha_vencimiento: '2099-12-31' }, token)
  );
  assert.strictEqual(registro.statusCode, 503, 'un fallo al guardar el caso debe responder 503');
  afirmarTresPartes(registro.body.mensaje, 'registro de caso fallido');
  assert.strictEqual(registro.body.caso, undefined, 'no debe confirmar un caso que no se guardó');

  const [filas] = await queryOriginal('SELECT COUNT(*) AS total FROM casos WHERE cliente = ?', [cliente]);
  assert.strictEqual(Number(filas[0].total), 0, 'el caso no debe quedar guardado');

  const siguiente = await conLimite(peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token));
  assert.strictEqual(siguiente.statusCode, 200, 'restaurada la base de datos, la petición siguiente se atiende');
}

// ---------- RNF-8, RF-47, criterio 41: fallo al buscar el caso en el middleware de propiedad ----------
async function testCambioDeCasoConFalloAlBuscarlo() {
  const contador = await crearUsuarioDePrueba('contador');
  const casoId = await crearCasoDePrueba(contador.id, { cliente: `zz_test_cliente_${contador.id}` });
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  let respuesta;
  try {
    respuesta = await conFalloDeBd(
      (sql) => sql.startsWith('SELECT * FROM casos WHERE id'),
      () => peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { estado: 'En proceso' }, token)
    );
  } catch (error) {
    assert.fail(`el cambio de caso con fallo de la base de datos quedó sin respuesta: ${error.message}`);
  }

  assert.strictEqual(respuesta.statusCode, 503, 'un fallo al buscar el caso debe responder 503');
  afirmarTresPartes(respuesta.body.mensaje, 'cambio de caso con fallo al buscarlo');

  const siguiente = await conLimite(peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token));
  assert.strictEqual(siguiente.statusCode, 200, 'restaurada la base de datos, la petición siguiente se atiende');
}

describe('persistencia de sesiones y fallos de base de datos', () => {
  before(async () => {
    process.on('unhandledRejection', registrarRechazo);
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
  });

  afterEach(() => {
    restaurarPool();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
    process.off('unhandledRejection', registrarRechazo);
    assert.deepStrictEqual(rechazosSinManejar, [], 'ningún fallo simulado debe quedar como rechazo sin manejar');
  });

  test('si no se registra la sesión, el login responde 503 sin token', { timeout: 5000 }, testLoginSinRegistrarSesion);
  test('si no se revoca la sesión, el cierre responde 503 y el reintento la cierra', { timeout: 5000 }, testLogoutSinRevocar);
  test('un fallo al consultar la sesión responde 503 y no la invalida', { timeout: 5000 }, testConsultaDeSesionFalla);
  test('un fallo al renovar la actividad responde 503 y no invalida la sesión', { timeout: 5000 }, testRenovarActividadFalla);
  test('un fallo al buscar el usuario en el login responde 503', { timeout: 5000 }, testLoginNoEncuentraUsuario);
  test('los fallos al leer y al guardar casos responden 503 sin guardar nada', { timeout: 5000 }, testLeerYGuardarCasosFallan);
  test('un fallo al buscar el caso en un cambio de caso responde 503', { timeout: 5000 }, testCambioDeCasoConFalloAlBuscarlo);
});
