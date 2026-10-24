const assert = require('node:assert');
const http = require('node:http');
const { describe, test, before, after, afterEach } = require('node:test');
const { pool } = require('../src/config/db');
const { buildError } = require('../src/utils/errorUtils');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Pruebas del manejo global de errores (área B de la spec 004).
 * RNF-8, RF-47, RF-37, criterios 32 y 41.
 *
 * Levanta la aplicación real en un puerto libre. Requiere MariaDB en marcha
 * (XAMPP, puerto 3306): la prueba de fallo interno hace un login con un usuario
 * `zz_test_` propio, que el `after` borra.
 *
 * Mientras el defecto exista, un rechazo dentro de un controlador `async` deja la
 * petición sin respuesta: cada petición compite con un temporizador de 2 s para
 * que la prueba falle por el aserto y no por tiempo agotado, y el archivo escucha
 * `unhandledRejection` para que ese rechazo no detenga el proceso.
 */

const LIMITE_RESPUESTA_MS = 2000;
const MENSAJE_CUERPO_INVALIDO = buildError(
  'Cuerpo de la petición no válido',
  'cuerpo JSON',
  'Envíe un cuerpo bien formado como JSON'
).mensaje;
const MENSAJE_FALLO_INTERNO = buildError(
  'Fallo interno del servidor',
  'operación solicitada',
  'Inténtelo nuevamente en unos momentos'
).mensaje;

const queryOriginal = pool.query.bind(pool);
const rechazosSinManejar = [];
const registrarRechazo = (motivo) => rechazosSinManejar.push(motivo);

let servidor;
let contador;

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
 * Envía un cuerpo tal cual (sin JSON.stringify), para probar JSON mal formado.
 * @param {number} puerto - Puerto del servidor.
 * @param {string} ruta - Ruta solicitada.
 * @param {string} cuerpoCrudo - Texto que se envía como cuerpo.
 * @param {string} [metodo='POST'] - Método HTTP.
 * @returns {Promise<{statusCode: number, body: any}>} Respuesta con el cuerpo interpretado.
 */
function peticionCruda(puerto, ruta, cuerpoCrudo, metodo = 'POST') {
  return new Promise((resolve, reject) => {
    const solicitud = http.request(
      {
        host: '127.0.0.1',
        port: puerto,
        path: ruta,
        method: metodo,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(cuerpoCrudo) },
        agent: false,
      },
      (respuesta) => {
        const trozos = [];
        respuesta.on('data', (trozo) => trozos.push(trozo));
        respuesta.on('end', () => {
          const texto = Buffer.concat(trozos).toString('utf8');
          let body = texto;
          try {
            body = texto ? JSON.parse(texto) : null;
          } catch (error) {
            body = texto;
          }
          resolve({ statusCode: respuesta.statusCode, body });
        });
      }
    );
    solicitud.on('error', reject);
    solicitud.write(cuerpoCrudo);
    solicitud.end();
  });
}

/**
 * Sustituye `pool.query` para que falle solo la sentencia que cumple la condición.
 * @param {(sql: string) => boolean} condicion - Decide qué sentencia falla.
 * @param {Error} error - Error que se devuelve como rechazo.
 */
function simularFalloDeBd(condicion, error) {
  pool.query = (sql, ...resto) => {
    const texto = typeof sql === 'string' ? sql : sql && sql.sql;
    if (typeof texto === 'string' && condicion(texto)) {
      return Promise.reject(error);
    }
    return queryOriginal(sql, ...resto);
  };
}

function restaurarPool() {
  pool.query = queryOriginal;
}

// ---------- RF-37: JSON mal formado en el login → 400 de tres partes ----------
async function testLoginJsonMalFormado() {
  const respuesta = await conLimite(peticionCruda(servidor.puerto, '/auth/login', '{"usuario": "ana",'));

  assert.strictEqual(respuesta.statusCode, 400, 'un cuerpo mal formado es una entrada inválida, no un fallo interno');
  assert.strictEqual(respuesta.body.mensaje, MENSAJE_CUERPO_INVALIDO, 'el mensaje debe tener las tres partes');
  assert.strictEqual(respuesta.body.token, undefined, 'no debe devolver token');
}

// ---------- RF-37: JSON mal formado en el alta → 400 de tres partes (antes del token) ----------
async function testAltaJsonMalFormado() {
  const respuesta = await conLimite(peticionCruda(servidor.puerto, '/usuarios', '{"usuario": '));

  assert.strictEqual(respuesta.statusCode, 400, 'un cuerpo mal formado es una entrada inválida, no un fallo interno');
  assert.strictEqual(respuesta.body.mensaje, MENSAJE_CUERPO_INVALIDO, 'el mensaje debe tener las tres partes');
}

// ---------- RNF-8: tras esas respuestas el servidor sigue atendiendo ----------
async function testServidorSigueAtendiendo() {
  const respuesta = await conLimite(peticion(servidor.puerto, 'GET', '/contadores'));

  assert.strictEqual(respuesta.statusCode, 401, 'una petición válida sin token debe recibir 401');
}

// ---------- RF-37, criterio 32: correo numérico con JSON bien formado → 400 ----------
async function testLoginUsuarioNumerico() {
  const respuesta = await conLimite(
    peticion(servidor.puerto, 'POST', '/auth/login', { correo: 12345, password: 'Secreta123' })
  );

  assert.strictEqual(respuesta.statusCode, 400, 'un dato que no es texto debe responder 400');
  assert.ok(
    respuesta.body.mensaje.includes('Dato inválido') &&
      respuesta.body.mensaje.includes('correo') &&
      respuesta.body.mensaje.includes('debe enviarse como texto'),
    'el mensaje debe tener las tres partes, indicar el dato y que debe enviarse como texto'
  );
  assert.strictEqual(respuesta.body.token, undefined, 'no debe devolver token');
}

// ---------- RF-37, criterio 32: el 400 del login nombra exactamente el dato no textual ----------
async function testLoginNombraElDatoNoTextual() {
  const noTextuales = [{ clave: 'valor' }, ['Secreta123'], true];
  const casos = [
    { dato: 'correo', cuerpo: (valor) => ({ correo: valor, password: 'Secreta123' }) },
    { dato: 'contraseña', cuerpo: (valor) => ({ correo: 'zz_test_login@prueba.local', password: valor }) },
    { dato: 'correo y contraseña', cuerpo: (valor) => ({ correo: valor, password: valor }) },
  ];

  for (const { dato, cuerpo } of casos) {
    const esperado = buildError('Dato inválido', dato, 'debe enviarse como texto').mensaje;
    for (const valor of noTextuales) {
      const respuesta = await conLimite(peticion(servidor.puerto, 'POST', '/auth/login', cuerpo(valor)));

      assert.strictEqual(respuesta.statusCode, 400, `un ${dato} que no es texto debe responder 400`);
      assert.strictEqual(respuesta.body.mensaje, esperado, `el mensaje debe nombrar exactamente «${dato}»`);
      assert.strictEqual(respuesta.body.token, undefined, 'no debe devolver token');
    }
  }
}

// ---------- RF-47, criterio 41: fallo interno en el login → 503 y el servidor sigue ----------
async function testFalloInternoEnLogin() {
  const errorSimulado = new Error('fallo simulado de la base de datos al buscar el usuario');
  let respuesta;
  let sinRespuesta = null;

  simularFalloDeBd((sql) => sql.startsWith('SELECT * FROM usuarios'), errorSimulado);
  try {
    respuesta = await conLimite(
      peticion(servidor.puerto, 'POST', '/auth/login', { correo: contador.correo, password: contador.password })
    );
  } catch (error) {
    sinRespuesta = error;
  } finally {
    restaurarPool();
  }

  // Deja que se emita un posible `unhandledRejection` antes de revisarlos.
  await new Promise((resolve) => setImmediate(resolve));
  for (const motivo of rechazosSinManejar) {
    assert.strictEqual(motivo, errorSimulado, 'el único rechazo sin manejar permitido es el del fallo simulado');
  }

  if (sinRespuesta) {
    assert.fail(`la petición con fallo interno quedó sin respuesta: ${sinRespuesta.message}`);
  }
  assert.strictEqual(respuesta.statusCode, 503, 'un fallo interno debe responder 503');
  assert.strictEqual(respuesta.body.mensaje, MENSAJE_FALLO_INTERNO, 'el mensaje debe tener las tres partes');
  assert.strictEqual(respuesta.body.token, undefined, 'no debe confirmar el acceso con un token');
  assert.strictEqual(rechazosSinManejar.length, 0, 'con el arreglo no debe quedar ningún rechazo sin manejar');

  const siguiente = await conLimite(
    peticion(servidor.puerto, 'POST', '/auth/login', { correo: contador.correo, password: contador.password })
  );
  assert.strictEqual(siguiente.statusCode, 200, 'restaurada la base de datos, la petición siguiente se atiende');
}

/**
 * Comprueba el 400 de RF-37: indica el dato y que debe enviarse como texto.
 * @param {{statusCode: number, body: any}} respuesta - Respuesta recibida.
 * @param {string} dato - Nombre del dato inválido.
 */
function afirmarDatoNoTextual(respuesta, dato) {
  assert.strictEqual(respuesta.statusCode, 400, `un ${dato} que no es texto debe responder 400`);
  assert.ok(
    respuesta.body.mensaje.includes('Dato inválido') &&
      respuesta.body.mensaje.includes(dato) &&
      respuesta.body.mensaje.includes('debe enviarse como texto'),
    `el mensaje debe tener las tres partes, indicar «${dato}» y que debe enviarse como texto (RF-37)`
  );
}

// ---------- RF-37, criterio 32: estado y prioridad no textuales en el cambio de caso ----------
async function testCambioDeCasoConDatosNoTextuales() {
  const casoId = await crearCasoDePrueba(contador.id, { cliente: `zz_test_cliente_${contador.id}` });
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  const conEstado = await conLimite(peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { estado: 1 }, token));
  afirmarDatoNoTextual(conEstado, 'estado');

  const conPrioridad = await conLimite(
    peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { prioridad: ['Alta'] }, token)
  );
  afirmarDatoNoTextual(conPrioridad, 'prioridad');
}

// ---------- RF-37: un dato no textual no ejecuta la operación, aunque el otro sea válido ----------
async function testCambioDeCasoNoGuardaAMedias() {
  const casoId = await crearCasoDePrueba(contador.id, { cliente: `zz_test_cliente_${contador.id}` });
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);

  const respuesta = await conLimite(
    peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { estado: 'Finalizado', prioridad: true }, token)
  );
  afirmarDatoNoTextual(respuesta, 'prioridad');

  const [filas] = await queryOriginal('SELECT estado FROM casos WHERE id = ?', [casoId]);
  assert.strictEqual(filas[0].estado, 'Pendiente', 'con un dato inválido no debe guardarse ningún cambio');
}

// ---------- RF-37: rol no textual en el alta de usuario ----------
async function testAltaConRolNoTextual() {
  const administrador = await crearUsuarioDePrueba('administrador');
  const token = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
  const correo = `zz_test_rol_${administrador.id}@prueba.local`;

  const respuesta = await conLimite(
    peticion(servidor.puerto, 'POST', '/usuarios', { nombre: 'Rol no textual', correo, password: 'Secreta123', rol: 5 }, token)
  );
  afirmarDatoNoTextual(respuesta, 'rol');

  const [filas] = await queryOriginal('SELECT COUNT(*) AS total FROM usuarios WHERE correo = ?', [correo]);
  assert.strictEqual(Number(filas[0].total), 0, 'con un rol inválido no debe crearse la cuenta');
}

const NO_TEXTUALES = [{ clave: 'valor' }, ['valor'], true];

// ---------- RF-37, criterio 32: nombre, correo o contraseña no textuales en el alta ----------
async function testAltaConUsuarioOContrasenaNoTextuales() {
  const administrador = await crearUsuarioDePrueba('administrador');
  const token = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
  const correo = `zz_test_alta_${administrador.id}@prueba.local`;
  const base = { nombre: 'Dato no textual', correo, password: 'Secreta123', rol: 'contador' };

  for (const valor of NO_TEXTUALES) {
    const conNombre = await conLimite(peticion(servidor.puerto, 'POST', '/usuarios', { ...base, nombre: valor }, token));
    afirmarDatoNoTextual(conNombre, 'nombre');

    const conCorreo = await conLimite(peticion(servidor.puerto, 'POST', '/usuarios', { ...base, correo: valor }, token));
    afirmarDatoNoTextual(conCorreo, 'correo');

    const conContrasena = await conLimite(
      peticion(servidor.puerto, 'POST', '/usuarios', { ...base, password: valor }, token)
    );
    afirmarDatoNoTextual(conContrasena, 'contraseña');
  }

  const [filas] = await queryOriginal('SELECT COUNT(*) AS total FROM usuarios WHERE correo = ?', [correo]);
  assert.strictEqual(Number(filas[0].total), 0, 'con una contraseña no textual no debe crearse la cuenta');
}

// ---------- RF-37, criterio 32: cliente o prioridad no textuales al registrar un caso ----------
async function testRegistroDeCasoConDatosNoTextuales() {
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  const contarCasos = async () => {
    const [filas] = await queryOriginal('SELECT COUNT(*) AS total FROM casos WHERE contador_id = ?', [contador.id]);
    return Number(filas[0].total);
  };
  const antes = await contarCasos();

  for (const valor of NO_TEXTUALES) {
    const conCliente = await conLimite(
      peticion(servidor.puerto, 'POST', '/casos', { cliente: valor, prioridad: 'Alta' }, token)
    );
    afirmarDatoNoTextual(conCliente, 'cliente');

    const conPrioridad = await conLimite(
      peticion(servidor.puerto, 'POST', '/casos', { cliente: `zz_test_cliente_${contador.id}`, prioridad: valor }, token)
    );
    afirmarDatoNoTextual(conPrioridad, 'prioridad');
  }

  assert.strictEqual(await contarCasos(), antes, 'con un dato no textual no debe registrarse ningún caso');
}

// ---------- RF-37, RNF-8: JSON mal formado en casos y en el restablecimiento ----------
async function testCasosYRestablecimientoJsonMalFormado() {
  const peticiones = [
    ['POST', '/casos'],
    ['PATCH', '/casos/1'],
    ['PATCH', `/usuarios/${contador.usuario}/restablecer-contrasena`],
  ];

  for (const [metodo, ruta] of peticiones) {
    const respuesta = await conLimite(peticionCruda(servidor.puerto, ruta, '{"cliente": ', metodo));

    assert.strictEqual(respuesta.statusCode, 400, `${metodo} ${ruta} con JSON mal formado debe responder 400`);
    assert.strictEqual(respuesta.body.mensaje, MENSAJE_CUERPO_INVALIDO, 'el mensaje debe tener las tres partes');
  }

  const siguiente = await conLimite(peticion(servidor.puerto, 'GET', '/contadores'));
  assert.strictEqual(siguiente.statusCode, 401, 'el servidor sigue atendiendo');
}

describe('manejo global de errores', () => {
  before(async () => {
    process.on('unhandledRejection', registrarRechazo);
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
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
  });

  test('el login con JSON mal formado responde 400 de tres partes', { timeout: 5000 }, testLoginJsonMalFormado);
  test('el alta con JSON mal formado responde 400 de tres partes', { timeout: 5000 }, testAltaJsonMalFormado);
  test('tras esas respuestas el servidor sigue atendiendo', testServidorSigueAtendiendo);
  test('el login con usuario numérico responde 400 que indica el dato', testLoginUsuarioNumerico);
  test('el login con usuario o contraseña no textuales nombra exactamente el dato', testLoginNombraElDatoNoTextual);
  test('un fallo interno en el login responde 503 sin token', { timeout: 5000 }, testFalloInternoEnLogin);
  test('el cambio de caso con estado o prioridad no textuales responde 400 que indica el dato', testCambioDeCasoConDatosNoTextuales);
  test('el cambio de caso con un dato no textual no guarda nada', testCambioDeCasoNoGuardaAMedias);
  test('el alta con un rol no textual responde 400 que indica el dato', testAltaConRolNoTextual);
  test('el alta con nombre, correo o contraseña no textuales responde 400 y no crea la cuenta', testAltaConUsuarioOContrasenaNoTextuales);
  test('registrar un caso con cliente o prioridad no textuales responde 400 y no lo crea', testRegistroDeCasoConDatosNoTextuales);
  test('el JSON mal formado en casos y en el restablecimiento responde 400 de tres partes', { timeout: 5000 }, testCasosYRestablecimientoJsonMalFormado);
});
