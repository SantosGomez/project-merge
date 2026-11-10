const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const { checkCaseOwnership } = require('../src/middlewares/ownershipMiddleware');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { query } = require('../src/config/db');

/**
 * Pruebas del middleware de propiedad con auxiliares (RF-AX-10 a RF-AX-12).
 * Un auxiliar puede editar casos de cualquier contador del que sea auxiliar.
 *
 * Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Aislamiento: contadores y casos propios zz_test_*; el `after` los borra.
 */

let contadorDueño;
let contadorAuxiliar;
let contadorAjeno;
let casoDelDueño;

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

async function testAuxiliarPuedeEditarCasoDeSuContador() {
  // El auxiliar está asignado al dueño
  await asignarAuxiliar(contadorDueño.id, contadorAuxiliar.id);

  const req = reqConUsuarioYParam(contadorAuxiliar.id, casoDelDueño);
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(next.llamado(), true, 'el auxiliar debe poder editar el caso de su contador');
  assert.strictEqual(res.statusCode, 200, 'no debe establecer código de error');
  assert.ok(req.caso, 'debe dejar el caso en req.caso');
}

async function testContadorNoAuxiliarNoPuedeEditarCasoAjeno() {
  // contadorAjeno no es auxiliar de contadorDueño ni dueño del caso
  const req = reqConUsuarioYParam(contadorAjeno.id, casoDelDueño);
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(res.statusCode, 403, 'un contador no auxiliar debe recibir 403');
  assert.strictEqual(next.llamado(), false, 'no debe llamar a next');
}

async function testAuxiliarPuedeEditarCasoDeCualquierContadorDelQueSeaAuxiliar() {
  const otroContador = await crearUsuarioDePrueba('contador');
  const casoOtro = await crearCasoDePrueba(otroContador.id, {
    cliente: 'zz_test_caso_otro_contador',
  });

  // El auxiliar ya es auxiliar de contadorDueño (de la prueba anterior);
  // ahora lo es también de otroContador.
  await asignarAuxiliar(otroContador.id, contadorAuxiliar.id);

  const req = reqConUsuarioYParam(contadorAuxiliar.id, casoOtro);
  const res = crearRes();
  const next = crearNext();
  await checkCaseOwnership(req, res, next);
  assert.strictEqual(next.llamado(), true, 'el auxiliar debe poder editar casos de cualquier contador del que sea auxiliar');
}

describe('middleware de propiedad con auxiliares', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contadorDueño = await crearUsuarioDePrueba('contador');
    contadorAuxiliar = await crearUsuarioDePrueba('contador');
    contadorAjeno = await crearUsuarioDePrueba('contador');

    casoDelDueño = await crearCasoDePrueba(contadorDueño.id, { cliente: 'zz_test_caso_del_dueño' });
  });

  after(async () => {
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el auxiliar puede editar un caso de su contador', testAuxiliarPuedeEditarCasoDeSuContador);
  test('un contador no auxiliar no puede editar un caso ajeno', testContadorNoAuxiliarNoPuedeEditarCasoAjeno);
  test('el auxiliar puede editar casos de cualquier contador del que sea auxiliar', testAuxiliarPuedeEditarCasoDeCualquierContadorDelQueSeaAuxiliar);
});
