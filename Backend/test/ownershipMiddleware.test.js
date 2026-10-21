const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { checkCaseOwnership } = require('../src/middlewares/ownershipMiddleware');
const { query } = require('../src/config/db');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');

/**
 * Pruebas del middleware de propiedad de caso checkCaseOwnership (RF-10, RF-11, RF-16).
 *
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 * Aislamiento (plan 9.2): se usan dos contadores propios `zz_test_*` y sus casos
 * propios; el caso inexistente se obtiene creando un caso y borrándolo, en lugar
 * de depender de ids fijos. El `after` borra solo lo registrado por este proceso.
 *
 * El middleware:
 * - Verifica que el caso exista (CaseModel.findById)
 * - Verifica que el caso pertenezca al contador autenticado (req.user.id)
 * - Rechaza con 404 si el caso no existe (RF-16)
 * - Rechaza con 403 si el caso es de otro contador (RF-10, RF-11)
 */

let contadorPropietario;
let contadorAjeno;
let casoPropio;
let casoAjeno;
let casoEliminado;

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

// ---------- RF-10, RF-11: caso existente y del contador autenticado ----------
async function testCheckCaseOwnershipPermiteCasoPropio() {
  const req = reqConUsuarioYParam(contadorPropietario.id, casoPropio);
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(next.llamado(), true, 'debe llamar a next cuando el caso pertenece al contador');
  assert.strictEqual(res.statusCode, 200, 'no debe establecer código de error');
}

// ---------- RF-16: caso inexistente ----------
async function testCheckCaseOwnershipRechazaCasoInexistente() {
  const req = reqConUsuarioYParam(contadorPropietario.id, casoEliminado);
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

// ---------- RF-10, RF-11: caso existente pero de otro contador ----------
async function testCheckCaseOwnershipRechazaCasoAjeno() {
  const req = reqConUsuarioYParam(contadorPropietario.id, casoAjeno);
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

// ---------- RF-10, RF-11: sin req.user ----------
async function testCheckCaseOwnershipRechazaSinUsuario() {
  const req = { params: { id: casoPropio } };
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.ok(
    res.statusCode === 403 || res.statusCode === 401,
    'debe responder 403 o 401 cuando no hay usuario autenticado'
  );
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next sin usuario autenticado');
}

describe('middleware de propiedad del caso', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contadorPropietario = await crearUsuarioDePrueba('contador');
    contadorAjeno = await crearUsuarioDePrueba('contador');

    casoPropio = await crearCasoDePrueba(contadorPropietario.id, { cliente: 'zz_test_caso_propio' });
    casoAjeno = await crearCasoDePrueba(contadorAjeno.id, { cliente: 'zz_test_caso_ajeno' });

    // Caso inexistente: se crea uno y se borra, así el id existió y ya no existe.
    casoEliminado = await crearCasoDePrueba(contadorPropietario.id, { cliente: 'zz_test_caso_eliminado' });
    await query('DELETE FROM casos WHERE id = ?', [casoEliminado]);
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('permite un caso propio del contador autenticado', testCheckCaseOwnershipPermiteCasoPropio);
  test('rechaza con 404 un caso inexistente', testCheckCaseOwnershipRechazaCasoInexistente);
  test('rechaza con 403 un caso de otro contador', testCheckCaseOwnershipRechazaCasoAjeno);
  test('rechaza sin usuario autenticado', testCheckCaseOwnershipRechazaSinUsuario);
});
