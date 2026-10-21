const assert = require('node:assert');
const { checkCaseOwnership } = require('../src/middlewares/ownershipMiddleware');

/**
 * Pruebas del middleware de propiedad de caso checkCaseOwnership (RF-10, RF-11, RF-16).
 *
 * Requieren que exista `src/middlewares/ownershipMiddleware.js` (tarea T8).
 * Mientras el módulo no exista, las pruebas fallan al importarlo (en rojo),
 * que es el estado esperado de la tarea T7.
 *
 * El middleware:
 * - Verifica que el caso exista (CaseModel.findById)
 * - Verifica que el caso pertenezca al contador autenticado (req.user.id)
 * - Rechaza con 404 si el caso no existe (RF-16)
 * - Rechaza con 403 si el caso es de otro contador (RF-10, RF-11)
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

function reqConUsuarioYParam(idUsuario, idCaso) {
  return { user: { id: idUsuario }, params: { id: idCaso } };
}

// RF-10, RF-11: caso existente y del contador autenticado -> next llamado
async function testCheckCaseOwnershipPermiteCasoPropio() {
  const req = reqConUsuarioYParam(1, 10);
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(next.llamado(), true, 'debe llamar a next cuando el caso pertenece al contador');
  assert.strictEqual(res.statusCode, 200, 'no debe establecer código de error');
}

// RF-16: caso inexistente -> 404, next no llamado
async function testCheckCaseOwnershipRechazaCasoInexistente() {
  const req = reqConUsuarioYParam(1, 99999999);
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(
    res.statusCode,
    404,
    'debe responder 404 cuando el caso no existe'
  );
  assert.ok(res.body && res.body.mensaje, 'debe incluir mensaje de no encontrado');
  assert.strictEqual(
    next.llamado(),
    false,
    'no debe llamar a next cuando el caso no existe'
  );
}

// RF-10, RF-11: caso existente pero de otro contador -> 403, next no llamado
async function testCheckCaseOwnershipRechazaCasoAjeno() {
  const req = reqConUsuarioYParam(1, 20); // caso 20 pertenece al contador 2
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(
    res.statusCode,
    403,
    'debe responder 403 cuando el caso no pertenece al contador autenticado'
  );
  assert.ok(res.body && res.body.mensaje, 'debe incluir mensaje de acceso denegado');
  assert.strictEqual(
    next.llamado(),
    false,
    'no debe llamar a next cuando el caso es ajeno'
  );
}

// RF-10, RF-11: sin req.user -> rechaza con 403 (o 401), next no llamado
async function testCheckCaseOwnershipRechazaSinUsuario() {
  const req = { params: { id: 10 } };
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.ok(
    res.statusCode === 403 || res.statusCode === 401,
    'debe responder 403 o 401 cuando no hay usuario autenticado'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next sin usuario autenticado');
}

module.exports = {
  testCheckCaseOwnershipPermiteCasoPropio,
  testCheckCaseOwnershipRechazaCasoInexistente,
  testCheckCaseOwnershipRechazaCasoAjeno,
  testCheckCaseOwnershipRechazaSinUsuario,
};
