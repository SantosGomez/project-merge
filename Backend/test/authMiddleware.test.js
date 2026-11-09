// Cargar las variables de entorno antes que los módulos del servidor, igual que
// hace `src/config/db.js`, para resolver el secreto JWT de la misma forma que el código.
require('dotenv').config();

const assert = require('node:assert');
const { test, before, after } = require('node:test');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../src/middlewares/authMiddleware');
const { query } = require('../src/config/db');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  envejecerSesion,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, iniciarSesion, peticion } = require('../soporte-pruebas/http');

/**
 * Pruebas del middleware de autenticación authenticateToken (RF-04, RF-05, RF-06,
 * RF-07, RF-25, criterio 30).
 *
 * Todas las credenciales que deben aceptarse se obtienen por el login real
 * (POST /auth/login), nunca con valores fijos de prueba. Las que deben rechazarse
 * se fabrican aquí mismo: un JWT firmado con otro secreto, uno firmado con el
 * secreto real pero sin sesión registrada, uno con expiración negativa y valores
 * inventados o fijos.
 *
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 * Aislamiento: cada ejecución crea su propio contador `zz_test_*`; el `after`
 * cierra el servidor, borra solo lo registrado por este proceso y cierra el pool.
 */

// Mismo origen del secreto que usa el servidor: no se escribe ningún valor literal.
const { JWT_SECRET: SECRETO_SERVIDOR } = require('../src/config/jwt');
// Secreto distinto para comprobar que una firma ajena no autentica.
const SECRETO_AJENO = 'secreto_ajeno_de_prueba_zz_test';

// Valores fijos que el código antiguo aceptaba como credencial (criterio 30).
const VALORES_FIJOS_DE_PRUEBA = [
  'token_valido_xyz',
  'token_revocado_xyz',
  'token_inactivo_xyz',
  'token_expirado_xyz',
];

let servidor;
let contador;

function crearRes() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(datos) {
      this.body = datos;
      return this;
    },
  };
}

function crearNext() {
  let llamado = false;
  const next = function () {
    llamado = true;
  };
  next.llamado = () => llamado;
  return next;
}

/**
 * Ejecuta el middleware con un token y devuelve la petición, la respuesta y next.
 * @param {string} token - Token que se envía en la cabecera Authorization.
 * @returns {Promise<{req: Object, res: Object, next: Function}>} Resultado de la ejecución.
 */
async function ejecutarConToken(token) {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  return { req, res, next };
}

/**
 * Inicia sesión con el contador propio dejando una sesión limpia para la prueba.
 *
 * Cada login emite un token con su propio `jti` (RF-41), que es la clave primaria
 * de `sesiones`. Para que cada prueba parta solo de su propia sesión, se borran
 * antes las sesiones de este usuario (solo las de este proceso) y el login real
 * vuelve a registrar la suya.
 * @returns {Promise<string>} Token emitido por el login.
 */
async function iniciarSesionLimpia() {
  await query('DELETE FROM sesiones WHERE usuario_id = ?', [contador.id]);
  return iniciarSesion(servidor.puerto, contador.correo, contador.password);
}

/**
 * Comprueba que el rechazo es un 401 sin sesión y sin continuar la cadena.
 * @param {Object} resultado - Resultado de ejecutarConToken.
 * @param {string} motivo - Texto del aserto para el informe de fallo.
 */
function assertRechazo401(resultado, motivo) {
  assert.strictEqual(resultado.res.statusCode, 401, `debe responder 401 cuando ${motivo}`);
  assert.strictEqual(resultado.next.llamado(), false, `no debe llamar a next cuando ${motivo}`);
  assert.strictEqual(resultado.req.user, undefined, `no debe adjuntar req.user cuando ${motivo}`);
}

/**
 * Comprueba el aviso de sesión caducada con sus tres partes (RF-05, criterio 5).
 * @param {Object} res - Respuesta simulada.
 */
function assertAvisoSesionCaducada(res) {
  assert.ok(res.body && typeof res.body.mensaje === 'string', 'debe incluir un mensaje de error');
  assert.ok(
    res.body.mensaje.includes('Sesión caducada'),
    'el aviso debe decir que la sesión caducó'
  );
  assert.ok(
    res.body.mensaje.includes('token de acceso'),
    'el aviso debe indicar sobre qué dato ocurrió'
  );
  assert.ok(
    res.body.mensaje.includes('Inicia sesión otra vez'),
    'el aviso debe indicar qué hacer a continuación'
  );
}

// ---------- RF-04, RF-07: sin cabecera Authorization ----------
async function testRechazaSinCabeceraAuthorization() {
  const req = { headers: {} };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(res.statusCode, 401, 'debe responder 401 cuando no hay cabecera Authorization');
  assert.ok(res.body && res.body.mensaje, 'debe incluir un mensaje de error');
  assert.strictEqual(
    next.llamado(),
    false,
    'no debe llamar a next cuando no hay sesión activa'
  );
  assert.strictEqual(
    req.user,
    undefined,
    'no debe adjuntar req.user cuando no hay sesión'
  );
}

// ---------- RF-04: cabecera Authorization que no empieza con "Bearer " ----------
async function testRechazaCabeceraSinBearer() {
  const req = { headers: { authorization: 'Token abc123' } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(
    res.statusCode,
    401,
    'debe responder 401 cuando la cabecera no usa Bearer'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next con token mal formado');
  assert.strictEqual(req.user, undefined, 'no debe adjuntar req.user con token mal formado');
}

// ---------- RF-05: token emitido por el login y revocado al cerrar sesión ----------
async function testRechazaTokenRevocado() {
  const token = await iniciarSesionLimpia();

  const cierre = await peticion(servidor.puerto, 'POST', '/auth/logout', null, token);
  assert.strictEqual(cierre.statusCode, 200, 'el logout del token propio debe responder 200');

  const resultado = await ejecutarConToken(token);
  assertRechazo401(resultado, 'el token se revocó al cerrar sesión');
  assertAvisoSesionCaducada(resultado.res);
}

// ---------- RF-05: token con el campo exp vencido ----------
async function testRechazaTokenExpirado() {
  const tokenExpirado = jwt.sign(
    { id: contador.id, rol: contador.rol },
    SECRETO_SERVIDOR,
    { expiresIn: -60 }
  );

  const resultado = await ejecutarConToken(tokenExpirado);
  assertRechazo401(resultado, 'el token expiró por su campo exp');
  assertAvisoSesionCaducada(resultado.res);
}

// ---------- RF-04: valor con forma de JWT pero mal formado ----------
async function testRechazaTokenInvalido() {
  const resultado = await ejecutarConToken('token.invalido.xyz');
  assertRechazo401(resultado, 'el token no tiene una firma válida');
  assert.ok(resultado.res.body.mensaje.includes('Token no válido'), 'debe indicar que el token no es válido');
}

// ---------- RF-05: sesión inactiva durante más de 30 minutos ----------
async function testRechazaSesionInactiva() {
  const token = await iniciarSesionLimpia();
  await envejecerSesion(token, 40);

  const resultado = await ejecutarConToken(token);
  assertRechazo401(resultado, 'la sesión está inactiva por más de 30 minutos');
  assert.ok(
    resultado.res.body.mensaje.includes('Sesión caducada por inactividad'),
    'debe indicar que la caducidad es por inactividad'
  );
}

// ---------- RF-06, RF-25: token emitido por el login ----------
async function testTokenValidoAdjuntaReqUserYLlamaNext() {
  const token = await iniciarSesionLimpia();

  const resultado = await ejecutarConToken(token);
  assert.strictEqual(resultado.next.llamado(), true, 'debe llamar a next con un token emitido por el login');
  assert.ok(resultado.req.user, 'debe adjuntar req.user con los datos del usuario');
  assert.deepStrictEqual(
    resultado.req.user,
    { id: contador.id, rol: 'contador' },
    'req.user debe tener solo el id y el rol de la cuenta que inició sesión (rebanada 5b)'
  );
}

// ---------- criterio 30: los valores fijos de prueba no son credenciales ----------
async function testRechazaValoresFijosDePrueba() {
  for (const valorFijo of VALORES_FIJOS_DE_PRUEBA) {
    const resultado = await ejecutarConToken(valorFijo);
    assertRechazo401(resultado, `se usa el valor fijo ${valorFijo}`);
    assert.ok(resultado.res.body.mensaje, `debe incluir un mensaje de error para ${valorFijo}`);
  }
}

// ---------- criterio 30: un valor inventado no es una credencial ----------
async function testRechazaValorInventado() {
  const valorInventado = `zz_test_token_inventado_${Date.now()}`;
  const resultado = await ejecutarConToken(valorInventado);
  assertRechazo401(resultado, 'se usa un valor de token inventado');
}

// ---------- criterio 30: un JWT firmado con otro secreto no autentica ----------
async function testRechazaJwtFirmadoConOtroSecreto() {
  const tokenAjeno = jwt.sign(
    { id: contador.id, rol: 'administrador' },
    SECRETO_AJENO,
    { expiresIn: '2h' }
  );

  const resultado = await ejecutarConToken(tokenAjeno);
  assertRechazo401(resultado, 'el token está firmado con otro secreto');
}

// ---------- criterio 30, RF-04: JWT válido sin sesión registrada ----------
async function testRechazaJwtSinSesionRegistrada() {
  // Firmado con el secreto real, pero nunca emitido por el login: no hay fila en `sesiones`.
  const tokenSinSesion = jwt.sign(
    { id: contador.id, rol: contador.rol },
    SECRETO_SERVIDOR,
    { expiresIn: '2h' }
  );

  const resultado = await ejecutarConToken(tokenSinSesion);
  assertRechazo401(resultado, 'el token no tiene sesión registrada');
  assertAvisoSesionCaducada(resultado.res);
}

// ---------- RF-25: una sesión de 29 minutos sigue viva y renueva su actividad ----------
async function testSesionDe29MinutosSigueValidaYRenuevaActividad() {
  const token = await iniciarSesionLimpia();
  await envejecerSesion(token, 29);

  const antes = await query('SELECT ultima_actividad FROM sesiones WHERE jti = ?', [jwt.decode(token).jti]);
  assert.strictEqual(antes.length, 1, 'la sesión del login debe existir en la tabla');

  const resultado = await ejecutarConToken(token);
  assert.strictEqual(
    resultado.next.llamado(),
    true,
    'debe llamar a next con una sesión de 29 minutos (aún no hay inactividad)'
  );
  assert.strictEqual(resultado.req.user.id, contador.id, 'debe adjuntar el usuario de la sesión');

  const despues = await query('SELECT ultima_actividad FROM sesiones WHERE jti = ?', [jwt.decode(token).jti]);
  const minutosRenovados =
    (despues[0].ultima_actividad.getTime() - antes[0].ultima_actividad.getTime()) / 60000;
  assert.ok(
    minutosRenovados >= 20,
    `cada petición válida debe reiniciar el temporizador de inactividad (se renovaron ${minutosRenovados.toFixed(1)} minutos)`
  );
}

// ---------- criterio 30, RF-07: petición HTTP real con un valor fijo de prueba ----------
async function testPeticionHttpConValorFijoEsRechazada() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/contadores', undefined, 'token_valido_xyz');

  assert.strictEqual(
    respuesta.statusCode,
    401,
    'debe responder 401 cuando el token no fue emitido por el login'
  );
  assert.ok(respuesta.body && respuesta.body.mensaje, 'el rechazo debe incluir un mensaje de error');
  assert.ok(
    !respuesta.body.contadores && !Array.isArray(respuesta.body),
    'no debe devolver datos de contadores sin una sesión iniciada'
  );
}

// Registro en el nivel raíz del archivo (sin `describe`): el verificador del
// criterio 25 cuenta como fallida cualquier evento `test:fail`, incluido el de
// una suite que contiene pruebas fallidas, y T17 debe informar exactamente las
// 4 pruebas en rojo esperadas. Los antes/después siguen siendo del archivo.
before(async () => {
  assert.ok(
    SECRETO_SERVIDOR,
    'backend/.env debe definir JWT_SECRET: las pruebas firman tokens con el mismo secreto que el servidor'
  );
  await prepararBaseDeDatos();
  contador = await crearUsuarioDePrueba('contador');
  servidor = await iniciarServidor();
});

after(async () => {
  await servidor.cerrar();
  await limpiarDatosDePrueba();
  await cerrarBaseDeDatos();
});

test('rechaza sin cabecera Authorization con 401 y sin sesión', testRechazaSinCabeceraAuthorization);
test('rechaza una cabecera que no usa el formato Bearer', testRechazaCabeceraSinBearer);
test(
  'rechaza con aviso de sesión caducada un token revocado al cerrar sesión',
  testRechazaTokenRevocado
);
test('rechaza con aviso de sesión caducada un token expirado', testRechazaTokenExpirado);
test('rechaza un valor con forma de JWT pero mal formado', testRechazaTokenInvalido);
test('rechaza con 401 una sesión inactiva más de 30 minutos', testRechazaSesionInactiva);
test(
  'acepta un token emitido por el login y adjunta req.user real',
  testTokenValidoAdjuntaReqUserYLlamaNext
);
test('rechaza los valores fijos de prueba como credencial', testRechazaValoresFijosDePrueba);
test('rechaza un valor de token inventado', testRechazaValorInventado);
test('rechaza un JWT firmado con otro secreto', testRechazaJwtFirmadoConOtroSecreto);
test(
  'rechaza con aviso de sesión caducada un JWT sin sesión registrada',
  testRechazaJwtSinSesionRegistrada
);
test(
  'mantiene válida una sesión de 29 minutos y renueva su actividad',
  testSesionDe29MinutosSigueValidaYRenuevaActividad
);
test(
  'rechaza con 401 y sin datos una petición real con un valor fijo de prueba',
  testPeticionHttpConValorFijoEsRechazada
);


