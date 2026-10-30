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
 * Pruebas de integración de la bitácora de auditorías (rebanada 2): cada oficio,
 * requerimiento o acta es un evento de `auditoria_dtl`. Levanta la app real y usa la
 * base de MariaDB local; al final borra solo lo que registró este proceso.
 */

let servidor;
let contador;
let otroContador;
let administrador;
let tokenContador;
let tokenOtroContador;
let tokenAdmin;
let auditoria;

async function registrarAuditoria(token, cambios = {}) {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/auditorias',
    {
      cliente: 'Cliente Ejemplo A, S.A. de C.V.',
      no_expediente: 'VDM-EJEMPLO-001/2026',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Visita Domiciliaria',
      periodo_inicio: '01-01-2023',
      periodo_final: '31-12-2023',
      fecha_inicio: '15-02-2026',
      fecha_vencimiento: '15-02-2027',
      ...cambios,
    },
    token
  );
  return respuesta.body.auditoria;
}

// Evento mínimo válido, en el formato del formulario (DD-MM-AAAA).
function eventoValido(cambios = {}) {
  return {
    evento: 'Requerimiento adicional de información',
    fase_id: 2,
    fecha: '20-02-2026',
    fecha_limite: '02-03-2026',
    folio: 'SOL-EJEMPLO-02',
    descripcion: 'Contratos y evidencia de materialidad de proveedores.',
    ...cambios,
  };
}

async function registrarEvento(cuerpo, token, auditoriaId = auditoria.id) {
  return peticion(servidor.puerto, 'POST', `/auditorias/${auditoriaId}/eventos`, cuerpo, token);
}

async function testContadorAsignadoRegistraEvento() {
  const respuesta = await registrarEvento(eventoValido(), tokenContador);

  assert.strictEqual(respuesta.statusCode, 201);
  const { evento } = respuesta.body;
  assert.ok(Number.isInteger(evento.id) && evento.id > 0);
  assert.strictEqual(evento.auditoria_id, auditoria.id);
  assert.strictEqual(evento.evento, 'Requerimiento adicional de información');
  assert.deepStrictEqual(evento.fase, { id: 2, nombre: 'Fase 2 · Requerimientos y desarrollo' });
  assert.strictEqual(evento.fecha, '2026-02-20');
  assert.strictEqual(evento.fecha_limite, '2026-03-02');
  assert.strictEqual(evento.fecha_entrega, null, 'sin entrega todavía');
  assert.strictEqual(evento.folio, 'SOL-EJEMPLO-02');
  assert.strictEqual(evento.estado, 'Pendiente', 'todo evento nuevo empieza Pendiente');
  assert.strictEqual(evento.observaciones, null);
  assert.deepStrictEqual(evento.registrado_por, { id: contador.id, nombre: contador.nombre });
}

async function testPermisosAlRegistrar() {
  const ajeno = await registrarEvento(eventoValido(), tokenOtroContador);
  assert.strictEqual(ajeno.statusCode, 403, 'un contador no asignado no registra eventos');

  const inexistente = await registrarEvento(eventoValido(), tokenAdmin, 999999999);
  assert.strictEqual(inexistente.statusCode, 404);

  const delAdmin = await registrarEvento(eventoValido(), tokenAdmin);
  assert.strictEqual(delAdmin.statusCode, 201, 'el administrador registra en cualquier auditoría');
  assert.strictEqual(delAdmin.body.evento.registrado_por.id, administrador.id);
}

async function testValidacionesAlRegistrar() {
  const casos = [
    [{ evento: '' }, /evento/],
    [{ evento: 'x'.repeat(201) }, /evento.*200/],
    [{ fase_id: 99 }, /fase/],
    [{ fase_id: 'dos' }, /fase/],
    [{ fecha: '' }, /fecha del evento/],
    [{ fecha: '31-02-2026' }, /fecha del evento/],
    [{ fecha_limite: '19-02-2026' }, /fecha límite/],
    [{ fecha_entrega: '19-02-2026' }, /fecha de entrega/],
    [{ estado: 'Terminado' }, /estado/],
    [{ folio: 'x'.repeat(201) }, /folio.*200/],
  ];
  for (const [cambios, mensaje] of casos) {
    const respuesta = await registrarEvento(eventoValido(cambios), tokenContador);
    assert.strictEqual(respuesta.statusCode, 400, `debe rechazar ${JSON.stringify(cambios).slice(0, 60)}`);
    assert.match(respuesta.body.mensaje, mensaje);
  }
}

async function testCamposOpcionales() {
  const minimo = await registrarEvento(
    { evento: 'Orden de visita domiciliaria (inicio)', fase_id: 1, fecha: '15-02-2026' },
    tokenContador
  );
  assert.strictEqual(minimo.statusCode, 201);
  assert.strictEqual(minimo.body.evento.fecha_limite, null);
  assert.strictEqual(minimo.body.evento.folio, null);
  assert.strictEqual(minimo.body.evento.descripcion, null);

  const completo = await registrarEvento(
    eventoValido({ fecha_entrega: '28-02-2026', estado: 'Completado', observaciones: '  Entregado completo  ' }),
    tokenContador
  );
  assert.strictEqual(completo.body.evento.fecha_entrega, '2026-02-28');
  assert.strictEqual(completo.body.evento.estado, 'Completado');
  assert.strictEqual(completo.body.evento.observaciones, 'Entregado completo');
}

async function listarEventos(auditoriaId, token) {
  return peticion(servidor.puerto, 'GET', `/auditorias/${auditoriaId}/eventos`, null, token);
}

async function testBitacoraEnOrdenCronologico() {
  const propia = await registrarAuditoria(tokenContador);
  const sinLimite = { fecha_limite: '' };
  await registrarEvento(eventoValido({ ...sinLimite, evento: 'Acta parcial', fecha: '10-04-2026' }), tokenContador, propia.id);
  await registrarEvento(eventoValido({ ...sinLimite, evento: 'Orden de visita', fecha: '15-02-2026', fase_id: 1 }), tokenContador, propia.id);
  await registrarEvento(eventoValido({ ...sinLimite, evento: 'Requerimiento', fecha: '10-04-2026' }), tokenContador, propia.id);

  const respuesta = await listarEventos(propia.id, tokenContador);

  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(
    respuesta.body.eventos.map((e) => e.evento),
    ['Orden de visita', 'Acta parcial', 'Requerimiento'],
    'por fecha y, el mismo día, en el orden en que se registraron'
  );
  assert.strictEqual((await listarEventos(propia.id, tokenOtroContador)).statusCode, 403);
  assert.strictEqual((await listarEventos(propia.id, tokenAdmin)).body.eventos.length, 3);
}

async function testCatalogoDeFases() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/auditorias/fases', null, tokenContador);

  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.fases.length, 6);
  assert.deepStrictEqual(respuesta.body.fases[0], {
    id: 1,
    nombre: 'Fase 1 · Notificación / inicio',
    descripcion: 'La autoridad notifica la orden, el oficio de requerimiento o la resolución provisional.',
  });
  assert.strictEqual(respuesta.body.fases[5].nombre, 'Fase 6 · Post-resolución (pago o defensa)');
}

async function editarEvento(eventoId, cuerpo, token, auditoriaId = auditoria.id) {
  return peticion(servidor.puerto, 'PATCH', `/auditorias/${auditoriaId}/eventos/${eventoId}`, cuerpo, token);
}

async function borrarEvento(eventoId, token, auditoriaId = auditoria.id) {
  return peticion(servidor.puerto, 'DELETE', `/auditorias/${auditoriaId}/eventos/${eventoId}`, null, token);
}

async function nuevoEvento() {
  return (await registrarEvento(eventoValido(), tokenContador)).body.evento;
}

async function testRegistrarLaEntrega() {
  const original = await nuevoEvento();

  const respuesta = await editarEvento(original.id, { estado: 'Completado', fecha_entrega: '01-03-2026' }, tokenContador);

  assert.strictEqual(respuesta.statusCode, 200);
  const { evento } = respuesta.body;
  assert.strictEqual(evento.estado, 'Completado');
  assert.strictEqual(evento.fecha_entrega, '2026-03-01');
  assert.strictEqual(evento.evento, original.evento, 'lo que no se envía no cambia');
  assert.strictEqual(evento.fecha_limite, original.fecha_limite);
  assert.deepStrictEqual(evento.registrado_por, original.registrado_por, 'quien lo registró no cambia al editar');
}

async function testEdicionValidaContraLoGuardado() {
  const original = await nuevoEvento();

  const respuesta = await editarEvento(original.id, { fecha_limite: '19-02-2026' }, tokenContador);

  assert.strictEqual(respuesta.statusCode, 400, 'la fecha guardada del evento es el 20-02-2026');
  assert.match(respuesta.body.mensaje, /fecha límite/);
}

async function testPermisosAlEditarYBorrar() {
  const original = await nuevoEvento();
  const otra = await registrarAuditoria(tokenContador);

  assert.strictEqual((await editarEvento(original.id, { estado: 'Revision' }, tokenOtroContador)).statusCode, 403);
  assert.strictEqual((await borrarEvento(original.id, tokenOtroContador)).statusCode, 403);
  assert.strictEqual(
    (await editarEvento(original.id, { estado: 'Revision' }, tokenContador, otra.id)).statusCode,
    404,
    'el evento debe pertenecer a la auditoría de la ruta'
  );
  assert.strictEqual((await borrarEvento(999999999, tokenContador)).statusCode, 404);
}

async function testBorrarEvento() {
  const original = await nuevoEvento();

  const respuesta = await borrarEvento(original.id, tokenContador);

  assert.strictEqual(respuesta.statusCode, 200);
  const ids = (await listarEventos(auditoria.id, tokenContador)).body.eventos.map((e) => e.id);
  assert.ok(!ids.includes(original.id), 'ya no aparece en la bitácora');
}

describe('Bitácora de auditorías', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    administrador = await crearUsuarioDePrueba('administrador');
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenOtroContador = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
    tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
    auditoria = await registrarAuditoria(tokenContador);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('un contador asignado registra un evento en la bitácora', testContadorAsignadoRegistraEvento);
  test('solo el administrador y los contadores asignados registran eventos', testPermisosAlRegistrar);
  test('los datos del evento se validan con mensajes que nombran el campo', testValidacionesAlRegistrar);
  test('fecha límite, entrega, folio, descripción y observaciones son opcionales', testCamposOpcionales);
  test('la bitácora se lista en orden cronológico y solo para quien puede verla', testBitacoraEnOrdenCronologico);
  test('el catálogo de fases trae las 6 fases en orden', testCatalogoDeFases);
  test('al editar un evento se registra la entrega y su estado', testRegistrarLaEntrega);
  test('al editar se valida contra la fecha guardada del evento', testEdicionValidaContraLoGuardado);
  test('solo el administrador y los contadores asignados editan o borran eventos', testPermisosAlEditarYBorrar);
  test('un evento borrado ya no aparece en la bitácora', testBorrarEvento);
});
