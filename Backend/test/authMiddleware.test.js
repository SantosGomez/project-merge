const assert = require('node:assert');
const { authenticateToken } = require('../src/middlewares/authMiddleware');

/**
 * Pruebas del middleware de autenticación authenticateToken (RF-04, RF-05, RF-06, RF-07, RF-25).
 *
 * Requieren que exista `src/middlewares/authMiddleware.js` (tarea T8).
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T7.
 *
 * El middleware:
 * - Extrae el token de la cabecera Authorization: Bearer <token>
 * - Verifica el JWT, su caducidad (exp), revocación e inactividad (30 min)
 * - Actualiza la última actividad en cada petición válida (RF-25)
 * - Adjunta req.user con { id, usuario, rol }
 */

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

// RF-04, RF-07: sin cabecera Authorization se rechaza con 401 y no se llama a next
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

// RF-04: cabecera Authorization que no empieza con "Bearer " se rechaza
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
}

// RF-05: token revocado en la base de datos se rechaza con 401
async function testRechazaTokenRevocado() {
  const req = { headers: { authorization: 'Bearer token_revocado_xyz' } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(
    res.statusCode,
    401,
    'debe responder 401 cuando el token está revocado'
  );
  assert.ok(
    res.body && res.body.mensaje,
    'debe incluir mensaje de sesión caducada'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next con token revocado');
}

// RF-05: token con expiración propia (campo exp) vencida se rechaza con 401
async function testRechazaTokenExpirado() {
  const req = { headers: { authorization: 'Bearer token_expirado_xyz' } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(
    res.statusCode,
    401,
    'debe responder 401 cuando el token expiró por su campo exp'
  );
  assert.ok(
    res.body && res.body.mensaje,
    'debe incluir mensaje de sesión caducada'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next con token expirado');
}

// RF-04: token con firma inválida se rechaza con 401
async function testRechazaTokenInvalido() {
  const req = { headers: { authorization: 'Bearer token.invalido.xyz' } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(
    res.statusCode,
    401,
    'debe responder 401 cuando el token no es válido'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next con token inválido');
}

// RF-05: sesión inactiva por más de 30 minutos se rechaza con 401
async function testRechazaSesionInactiva() {
  const req = { headers: { authorization: 'Bearer token_inactivo_xyz' } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(
    res.statusCode,
    401,
    'debe responder 401 cuando la sesión está inactiva por más de 30 minutos'
  );
  assert.ok(
    res.body && res.body.mensaje,
    'debe incluir mensaje de caducidad por inactividad'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next con sesión inactiva');
}

// RF-06, RF-25: token válido -> next() llamado, req.user seteado, actividad actualizada
async function testTokenValidoAdjuntaReqUserYLlamaNext() {
  const req = { headers: { authorization: 'Bearer token_valido_xyz' } };
  const res = crearRes();
  const next = crearNext();
  await authenticateToken(req, res, next);
  assert.strictEqual(next.llamado(), true, 'debe llamar a next con token válido');
  assert.ok(req.user, 'debe adjuntar req.user con los datos del usuario');
  assert.strictEqual(
    req.user.id,
    1,
    'req.user.id debe contener el id del usuario'
  );
  assert.strictEqual(
    req.user.usuario,
    'contador1',
    'req.user.usuario debe contener el nombre de usuario'
  );
  assert.strictEqual(
    req.user.rol,
    'contador',
    'req.user.rol debe contener el rol del usuario'
  );
}

module.exports = {
  testRechazaSinCabeceraAuthorization,
  testRechazaCabeceraSinBearer,
  testRechazaTokenRevocado,
  testRechazaTokenExpirado,
  testRechazaTokenInvalido,
  testRechazaSesionInactiva,
  testTokenValidoAdjuntaReqUserYLlamaNext,
};
