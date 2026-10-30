const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Pruebas de integración de las rutas de auditorías (rebanada 1 del módulo de auditorías).
 * Levanta la app real y usa la base de MariaDB local. Cada ejecución crea sus propios
 * contadores y administrador (`zz_test_`) y al final borra solo lo que registró.
 */

let servidor;
let contador;
let otroContador;
let administrador;
let tokenContador;
let tokenOtroContador;
let tokenAdmin;

// Datos mínimos de una auditoría válida, en el formato del formulario (DD-MM-AAAA).
function auditoriaValida(cambios = {}) {
  return {
    cliente: 'Cliente Ejemplo A, S.A. de C.V.',
    no_expediente: 'VDM-EJEMPLO-001/2026',
    dependencia: 'SAT – ADAF',
    tipo_auditoria: 'Visita Domiciliaria',
    estatal: false,
    periodo_inicio: '01-01-2023',
    periodo_final: '31-12-2023',
    fecha_inicio: '15-02-2026',
    fecha_vencimiento: '15-02-2027',
    ...cambios,
  };
}

async function registrar(cuerpo, token) {
  return peticion(servidor.puerto, 'POST', '/auditorias', cuerpo, token);
}

async function testContadorRegistraYQuedaAsignado() {
  const respuesta = await registrar(auditoriaValida(), tokenContador);

  assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al registrar');
  const { auditoria } = respuesta.body;
  assert.ok(Number.isInteger(auditoria.id) && auditoria.id > 0, 'debe devolver el id');
  assert.strictEqual(auditoria.cliente, 'Cliente Ejemplo A, S.A. de C.V.');
  assert.strictEqual(auditoria.no_expediente, 'VDM-EJEMPLO-001/2026');
  assert.strictEqual(auditoria.tipo_auditoria, 'Visita Domiciliaria');
  assert.strictEqual(auditoria.estatal, false);
  assert.strictEqual(auditoria.estado, 'Pendiente', 'toda auditoría nueva empieza Pendiente');
  // La API entrega las fechas DATE como AAAA-MM-DD aunque se capturen DD-MM-AAAA.
  assert.strictEqual(auditoria.periodo_inicio, '2023-01-01');
  assert.strictEqual(auditoria.periodo_final, '2023-12-31');
  assert.strictEqual(auditoria.fecha_inicio, '2026-02-15');
  assert.strictEqual(auditoria.fecha_vencimiento, '2027-02-15');
  assert.deepStrictEqual(
    auditoria.contadores,
    [{ id: contador.id, nombre: contador.nombre }],
    'el contador que la registra queda asignado'
  );
}

async function testAdminRegistraConLosContadoresQueElige() {
  const respuesta = await registrar(auditoriaValida({ contadores: [contador.id, otroContador.id] }), tokenAdmin);

  assert.strictEqual(respuesta.statusCode, 201);
  const ids = respuesta.body.auditoria.contadores.map((c) => c.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, [contador.id, otroContador.id].sort((a, b) => a - b), 'el administrador no queda asignado');
}

async function testAdminDebeElegirContadores() {
  const respuesta = await registrar(auditoriaValida(), tokenAdmin);

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /contadores/);
}

async function testSoloSeAsignanCuentasDeContador() {
  const respuesta = await registrar(auditoriaValida({ contadores: [administrador.id] }), tokenAdmin);

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /contador/);
}

async function testCamposObligatorios() {
  const obligatorios = {
    cliente: /cliente/,
    no_expediente: /expediente/,
    dependencia: /dependencia/,
    tipo_auditoria: /tipo de auditoría/,
    periodo_inicio: /inicio del periodo/,
    periodo_final: /fin del periodo/,
    fecha_inicio: /fecha de inicio/,
    fecha_vencimiento: /fecha de vencimiento/,
  };
  for (const [campo, mensaje] of Object.entries(obligatorios)) {
    const respuesta = await registrar(auditoriaValida({ [campo]: '' }), tokenContador);
    assert.strictEqual(respuesta.statusCode, 400, `sin ${campo} debe responder 400`);
    assert.match(respuesta.body.mensaje, mensaje, `el mensaje debe nombrar ${campo}`);
  }
}

async function testTextoDemasiadoLargo() {
  const respuesta = await registrar(auditoriaValida({ cliente: 'x'.repeat(101) }), tokenContador);

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /cliente.*100/);
}

async function testFechaInexistente() {
  const respuesta = await registrar(auditoriaValida({ fecha_inicio: '31-02-2026' }), tokenContador);

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /fecha de inicio/);
}

async function testPeriodoFinalAntesDelInicio() {
  const respuesta = await registrar(
    auditoriaValida({ periodo_inicio: '01-01-2024', periodo_final: '31-12-2023' }),
    tokenContador
  );

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /fin del periodo/);
}

async function testVencimientoAntesDelInicio() {
  const respuesta = await registrar(
    auditoriaValida({ fecha_inicio: '15-02-2026', fecha_vencimiento: '14-02-2026' }),
    tokenContador
  );

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /fecha de vencimiento/);
}

async function testDescripcionYObservacionOpcionales() {
  const sinTextos = await registrar(auditoriaValida(), tokenContador);
  assert.strictEqual(sinTextos.body.auditoria.descripcion, null);
  assert.strictEqual(sinTextos.body.auditoria.observacion, null);

  const conTextos = await registrar(
    auditoriaValida({ descripcion: '  ISR e IVA 2023  ', observacion: 'Preparar contabilidad' }),
    tokenContador
  );
  assert.strictEqual(conTextos.body.auditoria.descripcion, 'ISR e IVA 2023');
  assert.strictEqual(conTextos.body.auditoria.observacion, 'Preparar contabilidad');
}

async function listar(token) {
  return peticion(servidor.puerto, 'GET', '/auditorias', null, token);
}

async function testCadaQuienVeLoQueLeToca() {
  const propia = (await registrar(auditoriaValida({ cliente: 'Propia' }), tokenContador)).body.auditoria;
  const ajena = (await registrar(auditoriaValida({ cliente: 'Ajena' }), tokenOtroContador)).body.auditoria;

  const delContador = await listar(tokenContador);
  assert.strictEqual(delContador.statusCode, 200);
  const idsContador = delContador.body.auditorias.map((a) => a.id);
  assert.ok(idsContador.includes(propia.id), 'el contador ve la auditoría donde está asignado');
  assert.ok(!idsContador.includes(ajena.id), 'el contador no ve auditorías de otros');

  const delAdmin = await listar(tokenAdmin);
  const idsAdmin = delAdmin.body.auditorias.map((a) => a.id);
  assert.ok(idsAdmin.includes(propia.id) && idsAdmin.includes(ajena.id), 'el administrador ve todas');
  const listada = delAdmin.body.auditorias.find((a) => a.id === propia.id);
  assert.deepStrictEqual(listada.contadores, [{ id: contador.id, nombre: contador.nombre }], 'cada una trae sus contadores');
}

async function editar(id, cuerpo, token) {
  return peticion(servidor.puerto, 'PATCH', `/auditorias/${id}`, cuerpo, token);
}

async function registrarDelContador(cambios = {}) {
  return (await registrar(auditoriaValida(cambios), tokenContador)).body.auditoria;
}

async function testContadorAsignadoEdita() {
  const original = await registrarDelContador();

  const respuesta = await editar(original.id, { estado: 'En Proceso', observacion: 'Se entregó contabilidad' }, tokenContador);

  assert.strictEqual(respuesta.statusCode, 200);
  const { auditoria } = respuesta.body;
  assert.strictEqual(auditoria.estado, 'En Proceso');
  assert.strictEqual(auditoria.observacion, 'Se entregó contabilidad');
  assert.strictEqual(auditoria.cliente, original.cliente, 'lo que no se envía no cambia');
  assert.strictEqual(auditoria.fecha_vencimiento, original.fecha_vencimiento);
}

async function testContadorNoAsignadoNoEdita() {
  const original = await registrarDelContador();

  const respuesta = await editar(original.id, { estado: 'Completado' }, tokenOtroContador);

  assert.strictEqual(respuesta.statusCode, 403);
}

async function testAuditoriaInexistente() {
  const respuesta = await editar(999999999, { estado: 'Completado' }, tokenAdmin);

  assert.strictEqual(respuesta.statusCode, 404);
}

async function testEstadoNoValido() {
  const original = await registrarDelContador();

  const respuesta = await editar(original.id, { estado: 'Terminada' }, tokenContador);

  assert.strictEqual(respuesta.statusCode, 400);
  assert.match(respuesta.body.mensaje, /estado/);
}

async function testEdicionRespetaElOrdenDeFechas() {
  const original = await registrarDelContador({ fecha_inicio: '15-02-2026', fecha_vencimiento: '15-02-2027' });

  const respuesta = await editar(original.id, { fecha_vencimiento: '01-01-2026' }, tokenContador);

  assert.strictEqual(respuesta.statusCode, 400, 'se compara contra la fecha de inicio guardada');
  assert.match(respuesta.body.mensaje, /fecha de vencimiento/);
}

async function testAdminReasignaContadores() {
  const original = await registrarDelContador();

  const respuesta = await editar(original.id, { contadores: [otroContador.id] }, tokenAdmin);

  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(respuesta.body.auditoria.contadores, [{ id: otroContador.id, nombre: otroContador.nombre }]);
}

async function testContadorNoReasigna() {
  const original = await registrarDelContador();

  const respuesta = await editar(original.id, { contadores: [otroContador.id] }, tokenContador);

  assert.strictEqual(respuesta.statusCode, 403);
  assert.match(respuesta.body.mensaje, /contadores/);
}

async function testObtenerUnaAuditoria() {
  const original = await registrarDelContador({ cliente: 'Ficha' });
  const obtener = (id, token) => peticion(servidor.puerto, 'GET', `/auditorias/${id}`, null, token);

  const propia = await obtener(original.id, tokenContador);
  assert.strictEqual(propia.statusCode, 200);
  assert.strictEqual(propia.body.auditoria.cliente, 'Ficha');
  assert.ok(propia.body.auditoria.fase_actual, 'trae el seguimiento calculado');
  assert.strictEqual(propia.body.auditoria.semaforo, 'En tiempo');

  assert.strictEqual((await obtener(original.id, tokenAdmin)).statusCode, 200, 'el administrador ve cualquiera');
  assert.strictEqual((await obtener(original.id, tokenOtroContador)).statusCode, 403);
  assert.strictEqual((await obtener(999999999, tokenAdmin)).statusCode, 404);
}

describe('Rutas de auditorías', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    administrador = await crearUsuarioDePrueba('administrador');
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenOtroContador = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
    tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('un contador registra una auditoría y queda asignado', testContadorRegistraYQuedaAsignado);
  test('el administrador registra con los contadores que elige', testAdminRegistraConLosContadoresQueElige);
  test('el administrador debe elegir al menos un contador', testAdminDebeElegirContadores);
  test('solo se pueden asignar cuentas con rol de contador', testSoloSeAsignanCuentasDeContador);
  test('cada campo obligatorio vacío se rechaza con un mensaje que lo nombra', testCamposObligatorios);
  test('un texto más largo de lo que admite la tabla se rechaza', testTextoDemasiadoLargo);
  test('una fecha que no existe se rechaza', testFechaInexistente);
  test('el fin del periodo no puede ser anterior a su inicio', testPeriodoFinalAntesDelInicio);
  test('el vencimiento no puede ser anterior a la fecha de inicio', testVencimientoAntesDelInicio);
  test('descripción y observación son opcionales', testDescripcionYObservacionOpcionales);
  test('el administrador ve todas y cada contador solo las suyas', testCadaQuienVeLoQueLeToca);
  test('un contador asignado edita su auditoría', testContadorAsignadoEdita);
  test('un contador no asignado no puede editarla', testContadorNoAsignadoNoEdita);
  test('editar una auditoría que no existe responde 404', testAuditoriaInexistente);
  test('un estado fuera de la lista se rechaza', testEstadoNoValido);
  test('al editar se respeta el orden de las fechas guardadas', testEdicionRespetaElOrdenDeFechas);
  test('el administrador reasigna los contadores', testAdminReasignaContadores);
  test('un contador no puede cambiar los contadores asignados', testContadorNoReasigna);
  test('una auditoría se consulta sola, solo por quien puede verla', testObtenerUnaAuditoria);
});
