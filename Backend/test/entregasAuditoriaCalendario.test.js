const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/*
 * GET /auditorias/calendario: eventos pendientes de la bitácora de todas las auditorías, en una
 * sola petición, para el calendario del administrador. Solo lectura y solo administrador.
 */

let servidor;
let admin;
let contador;
let tokenAdmin;
let tokenContador;
let auditoriaAbierta;
let auditoriaCompletada;

async function crearAuditoria(estado, cliente) {
  const resultado = await query(
    `INSERT INTO auditorias (Cliente, No_Expediente, Dependencia, TipoAud, Estatal, FechaPeriodo_inicio,
       FechaPeriodo_final, Estado, FechaInicio, FechaVencimiento, CreadoPor, CreadoEn, ActualizadoEn)
     VALUES (?, 'zz_test_EXP/1', 'SAT', 'Revisión de Gabinete', 0, '2023-01-01', '2023-12-31', ?, '2099-01-01',
       '2099-12-31', ?, NOW(), NOW())`,
    [cliente, estado, admin.id]
  );
  const id = Number(resultado.insertId);
  await query('INSERT INTO aud_conta (IdAuditoria, IdContador, AsignadoEn) VALUES (?, ?, NOW())', [id, contador.id]);
  return id;
}

async function crearEvento(auditoriaId, { evento, limite, entrega = null, estado = 'Pendiente', fase = 2 }) {
  await query(
    `INSERT INTO auditoria_dtl (AudHdr_Id, Contador_id, Evento, Fecha, FechaLimite, FechaEntrega, Fase_Id, Estado, CreadoEn)
     VALUES (?, ?, ?, '2099-01-05', ?, ?, ?, ?, NOW())`,
    [auditoriaId, admin.id, evento, limite, entrega, fase, estado]
  );
}

describe('GET /auditorias/calendario', () => {
  before(async () => {
    await prepararBaseDeDatos();
    admin = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    auditoriaAbierta = await crearAuditoria('En Proceso', 'zz_test_ Cliente abierta');
    auditoriaCompletada = await crearAuditoria('Completado', 'zz_test_ Cliente cerrada');
    await crearEvento(auditoriaAbierta, { evento: 'zz_test_ pendiente', limite: '2099-03-10' });
    await crearEvento(auditoriaAbierta, { evento: 'zz_test_ con entrega', limite: '2099-03-11', entrega: '2099-03-09' });
    await crearEvento(auditoriaAbierta, { evento: 'zz_test_ completado', limite: '2099-03-12', estado: 'Completado' });
    await crearEvento(auditoriaAbierta, { evento: 'zz_test_ sin limite', limite: null });
    await crearEvento(auditoriaCompletada, { evento: 'zz_test_ de auditoria cerrada', limite: '2099-03-13' });
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('devuelve solo los eventos pendientes con fecha límite, sin entrega y de auditorías no completadas', async () => {
    const respuesta = await peticion(servidor.puerto, 'GET', '/auditorias/calendario', null, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 200);
    const propios = respuesta.body.eventos.filter((e) => e.evento.startsWith('zz_test_'));
    assert.deepStrictEqual(
      propios.map((e) => e.evento),
      ['zz_test_ pendiente']
    );
  });

  test('cada evento trae su auditoría, su fase, la fecha límite AAAA-MM-DD y los contadores', async () => {
    const { body } = await peticion(servidor.puerto, 'GET', '/auditorias/calendario', null, tokenAdmin);
    const evento = body.eventos.find((e) => e.evento === 'zz_test_ pendiente');
    assert.strictEqual(evento.auditoria_id, auditoriaAbierta);
    assert.strictEqual(evento.cliente, 'zz_test_ Cliente abierta');
    assert.strictEqual(evento.no_expediente, 'zz_test_EXP/1');
    assert.strictEqual(evento.fecha_limite, '2099-03-10');
    assert.strictEqual(evento.estado, 'Pendiente');
    assert.ok(evento.id > 0);
    assert.strictEqual(typeof evento.fase, 'string');
    assert.deepStrictEqual(evento.contadores, [{ id: contador.id, nombre: contador.nombre }]);
  });

  test('sin token da 401 y el contador da 403', async () => {
    const sinToken = await peticion(servidor.puerto, 'GET', '/auditorias/calendario');
    assert.strictEqual(sinToken.statusCode, 401);
    const comoContador = await peticion(servidor.puerto, 'GET', '/auditorias/calendario', null, tokenContador);
    assert.strictEqual(comoContador.statusCode, 403);
  });
});
