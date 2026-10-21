const assert = require('node:assert');
const { requireAdmin, requireAdminOrSistema } = require('../src/middlewares/roleMiddleware');

/**
 * Pruebas de los middlewares de rol requireAdmin y requireAdminOrSistema (RF-08, RF-09, RF-28, RF-29).
 *
 * Requieren que exista `src/middlewares/roleMiddleware.js` (tarea T8).
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T7.
 *
 * requireAdmin: solo permite al rol 'administrador'.
 * requireAdminOrSistema: permite a 'administrador' y 'usuarios_de_sistema'.
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

function reqConRol(rol) {
  return { user: { id: 1, usuario: 'usuario_prueba', rol } };
}

// RF-08: requireAdmin con rol administrador permite el paso
async function testRequireAdminPermiteADministrador() {
  const req = reqConRol('administrador');
  const res = crearRes();
  const next = crearNext();
  await requireAdmin(req, res, next);
  assert.strictEqual(next.llamado(), true, 'requireAdmin debe llamar a next para administrador');
  assert.strictEqual(res.statusCode, 200, 'no debe establecer código de error para administrador');
}

// RF-08: requireAdmin con rol contador rechaza con 403
async function testRequireAdminRechazaAContador() {
  const req = reqConRol('contador');
  const res = crearRes();
  const next = crearNext();
  await requireAdmin(req, res, next);
  assert.strictEqual(
    res.statusCode,
    403,
    'requireAdmin debe responder 403 a un contador'
  );
  assert.ok(res.body && res.body.mensaje, 'debe incluir mensaje de acceso denegado');
  assert.strictEqual(
    next.llamado(),
    false,
    'requireAdmin no debe llamar a next para un contador'
  );
}

// RF-08, RF-09: requireAdmin con rol usuarios_de_sistema rechaza con 403
async function testRequireAdminRechazaAUsuariosDeSistema() {
  const req = reqConRol('usuarios_de_sistema');
  const res = crearRes();
  const next = crearNext();
  await requireAdmin(req, res, next);
  assert.strictEqual(
    res.statusCode,
    403,
    'requireAdmin debe responder 403 a usuarios_de_sistema'
  );
  assert.strictEqual(next.llamado(), false, 'requireAdmin no debe llamar a next para usuarios_de_sistema');
}

// RF-08: requireAdmin sin req.user rechaza con 403
async function testRequireAdminRechazaSinUsuario() {
  const req = {};
  const res = crearRes();
  const next = crearNext();
  await requireAdmin(req, res, next);
  assert.strictEqual(
    res.statusCode,
    403,
    'requireAdmin debe responder 403 cuando no hay req.user'
  );
  assert.strictEqual(next.llamado(), false, 'requireAdmin no debe llamar a next sin usuario');
}

// RF-28, RF-29: requireAdminOrSistema permite a administrador
async function testRequireAdminOrSistemaPermiteAAdministrador() {
  const req = reqConRol('administrador');
  const res = crearRes();
  const next = crearNext();
  await requireAdminOrSistema(req, res, next);
  assert.strictEqual(
    next.llamado(),
    true,
    'requireAdminOrSistema debe llamar a next para administrador'
  );
}

// RF-28, RF-29: requireAdminOrSistema permite a usuarios_de_sistema
async function testRequireAdminOrSistemaPermiteAUsuariosDeSistema() {
  const req = reqConRol('usuarios_de_sistema');
  const res = crearRes();
  const next = crearNext();
  await requireAdminOrSistema(req, res, next);
  assert.strictEqual(
    next.llamado(),
    true,
    'requireAdminOrSistema debe llamar a next para usuarios_de_sistema'
  );
}

// RF-29: requireAdminOrSistema rechaza a contador con 403
async function testRequireAdminOrSistemaRechazaAContador() {
  const req = reqConRol('contador');
  const res = crearRes();
  const next = crearNext();
  await requireAdminOrSistema(req, res, next);
  assert.strictEqual(
    res.statusCode,
    403,
    'requireAdminOrSistema debe responder 403 a un contador'
  );
  assert.ok(res.body && res.body.mensaje, 'debe incluir mensaje de acceso denegado');
  assert.strictEqual(
    next.llamado(),
    false,
    'requireAdminOrSistema no debe llamar a next para un contador'
  );
}

// RF-29: requireAdminOrSistema sin req.user rechaza con 403
async function testRequireAdminOrSistemaRechazaSinUsuario() {
  const req = {};
  const res = crearRes();
  const next = crearNext();
  await requireAdminOrSistema(req, res, next);
  assert.strictEqual(
    res.statusCode,
    403,
    'requireAdminOrSistema debe responder 403 cuando no hay req.user'
  );
  assert.strictEqual(next.llamado(), false, 'requireAdminOrSistema no debe llamar a next sin usuario');
}

module.exports = {
  testRequireAdminPermiteADministrador,
  testRequireAdminRechazaAContador,
  testRequireAdminRechazaAUsuariosDeSistema,
  testRequireAdminRechazaSinUsuario,
  testRequireAdminOrSistemaPermiteAAdministrador,
  testRequireAdminOrSistemaPermiteAUsuariosDeSistema,
  testRequireAdminOrSistemaRechazaAContador,
  testRequireAdminOrSistemaRechazaSinUsuario,
};
