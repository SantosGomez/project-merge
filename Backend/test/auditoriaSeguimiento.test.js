const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { formatearFechaISO } = require('../src/utils/dateUtils');

/**
 * Pruebas de integración del seguimiento calculado de cada auditoría (rebanada 3):
 * fase actual, próximo vencimiento a nuestro cargo y semáforo, que `GET /auditorias`
 * calcula desde la bitácora. Las fechas son relativas a hoy para que no caduquen.
 */

let servidor;
let contador;
let token;

// Fecha local de hoy más `dias`, en AAAA-MM-DD.
function enDias(dias) {
  const hoy = new Date();
  return formatearFechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias));
}

async function registrarAuditoria(cambios = {}) {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/auditorias',
    {
      cliente: 'Cliente Semáforo',
      no_expediente: 'VDM-SEMAFORO/2026',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Revisión de Gabinete',
      periodo_inicio: '2023-01-01',
      periodo_final: '2023-12-31',
      fecha_inicio: enDias(-30),
      fecha_vencimiento: enDias(300),
      ...cambios,
    },
    token
  );
  return respuesta.body.auditoria;
}

async function registrarEvento(auditoriaId, cambios = {}) {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    `/auditorias/${auditoriaId}/eventos`,
    { evento: 'Requerimiento', fase_id: 2, fecha: enDias(-10), ...cambios },
    token
  );
  assert.strictEqual(respuesta.statusCode, 201, `no se registró el evento: ${respuesta.body.mensaje}`);
  return respuesta.body.evento;
}

// Seguimiento de una auditoría tal como lo entrega la lista.
async function seguimientoDe(auditoriaId) {
  const respuesta = await peticion(servidor.puerto, 'GET', '/auditorias', null, token);
  const auditoria = respuesta.body.auditorias.find((a) => a.id === auditoriaId);
  const { fase_actual, proximo_vencimiento, que_vence, dias_para_vencer, semaforo } = auditoria;
  return { fase_actual, proximo_vencimiento, que_vence, dias_para_vencer, semaforo };
}

async function testSinBitacora() {
  const auditoria = await registrarAuditoria();

  assert.deepStrictEqual(await seguimientoDe(auditoria.id), {
    fase_actual: { id: 1, nombre: 'Fase 1 · Notificación / inicio' },
    proximo_vencimiento: null,
    que_vence: null,
    dias_para_vencer: null,
    semaforo: 'En tiempo',
  });
}

async function testProximoVencimientoPendiente() {
  const auditoria = await registrarAuditoria();
  await registrarEvento(auditoria.id, { evento: 'Ya entregado', fecha_limite: enDias(1), fecha_entrega: enDias(-1) });
  await registrarEvento(auditoria.id, { evento: 'Ya completado', fecha_limite: enDias(2), estado: 'Completado' });
  await registrarEvento(auditoria.id, { evento: 'Rechazado', fecha_limite: enDias(2), estado: 'Rechazado' });
  await registrarEvento(auditoria.id, { evento: 'Segundo requerimiento', fecha_limite: enDias(12) });
  await registrarEvento(auditoria.id, { evento: 'Primer requerimiento', fecha_limite: enDias(5) });

  const seguimiento = await seguimientoDe(auditoria.id);

  assert.strictEqual(seguimiento.proximo_vencimiento, enDias(5), 'el plazo pendiente más cercano');
  assert.strictEqual(seguimiento.que_vence, 'Primer requerimiento');
  assert.strictEqual(seguimiento.dias_para_vencer, 5);
  assert.strictEqual(seguimiento.semaforo, 'Crítico', '7 días o menos');
}

async function testUmbralesDelSemaforo() {
  const casos = [
    [-2, 'Vencido'],
    [0, 'Crítico'],
    [7, 'Crítico'],
    [8, 'Atención'],
    [20, 'Atención'],
    [21, 'En tiempo'],
  ];
  for (const [dias, esperado] of casos) {
    const auditoria = await registrarAuditoria();
    await registrarEvento(auditoria.id, { fecha_limite: enDias(dias) });
    const seguimiento = await seguimientoDe(auditoria.id);
    assert.strictEqual(seguimiento.semaforo, esperado, `con el plazo a ${dias} días`);
    assert.strictEqual(seguimiento.dias_para_vencer, dias);
  }
}

async function testPlazoDeLaAutoridad() {
  const cerca = await registrarAuditoria({ fecha_vencimiento: enDias(60) });
  assert.strictEqual((await seguimientoDe(cerca.id)).semaforo, 'Atención', 'a la autoridad le quedan 60 días');

  const lejos = await registrarAuditoria({ fecha_vencimiento: enDias(61) });
  assert.strictEqual((await seguimientoDe(lejos.id)).semaforo, 'En tiempo');
}

async function testConcluida() {
  const auditoria = await registrarAuditoria();
  await registrarEvento(auditoria.id, { fecha_limite: enDias(-5) });
  await peticion(servidor.puerto, 'PATCH', `/auditorias/${auditoria.id}`, { estado: 'Completado' }, token);

  assert.strictEqual((await seguimientoDe(auditoria.id)).semaforo, 'Concluida', 'una auditoría terminada no está vencida');
}

async function testFaseActual() {
  const auditoria = await registrarAuditoria();
  await registrarEvento(auditoria.id, { fase_id: 1, fecha: enDias(-20) });
  await registrarEvento(auditoria.id, { fase_id: 3, fecha: enDias(-15) });
  await registrarEvento(auditoria.id, { fase_id: 2, fecha: enDias(-5) });

  assert.deepStrictEqual(
    (await seguimientoDe(auditoria.id)).fase_actual,
    { id: 3, nombre: 'Fase 3 · Observaciones' },
    'la fase más alta alcanzada en la bitácora'
  );
}

describe('Seguimiento calculado de auditorías', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    contador = await crearUsuarioDePrueba('contador');
    token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('sin bitácora: fase 1, sin vencimientos y en tiempo', testSinBitacora);
  test('el próximo vencimiento es el plazo pendiente más cercano', testProximoVencimientoPendiente);
  test('el semáforo usa 7 y 20 días naturales', testUmbralesDelSemaforo);
  test('quedan 60 días o menos del plazo de la autoridad: atención', testPlazoDeLaAutoridad);
  test('una auditoría completada se muestra como concluida', testConcluida);
  test('la fase actual es la más alta alcanzada en la bitácora', testFaseActual);
});
