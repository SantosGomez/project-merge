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
const { seedDatabase } = require('../src/utils/seed');
const { formatLocalDate } = require('../src/utils/dateUtils');

/**
 * Pruebas de integración de /juntas (rebanada 21a). Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo usa cuentas `zz_test_`; las juntas se borran en cascada con la cuenta que las creó.
 */

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const ID_INEXISTENTE = 99999999;

let servidor;
const cuentas = {};
const tokens = {};

function api(quien, metodo, ruta, cuerpo) {
  return peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[quien]);
}

function cuerpoJunta(extra = {}) {
  return {
    titulo: 'Revisión mensual',
    inicio: '2031-03-10 09:00',
    fin: '2031-03-10 10:00',
    participantes: [cuentas.contador2.id],
    ...extra,
  };
}

async function crear(quien, extra) {
  const r = await api(quien, 'POST', '/juntas', cuerpoJunta(extra));
  assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
  return r.body.junta;
}

function titulosEnRango(r) {
  return r.body.juntas.map((j) => j.titulo);
}

describe('/juntas', () => {
  before(async () => {
    await prepararBaseDeDatos();
    for (const [nombre, rol] of [
      ['admin', 'administrador'],
      ['contador1', 'contador'],
      ['contador2', 'contador'],
      ['auxiliar', 'auxiliar'],
      ['recepcion', 'recepcionista'],
      ['sistema', 'usuarios_de_sistema'],
    ]) {
      cuentas[nombre] = await crearUsuarioDePrueba(rol);
    }
    servidor = await iniciarServidor();
    for (const nombre of Object.keys(cuentas)) {
      tokens[nombre] = await iniciarSesion(servidor.puerto, cuentas[nombre].correo, cuentas[nombre].password);
    }
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el seed crea las dos tablas con sus llaves y se puede repetir', async () => {
    await seedDatabase({ cuentasDemo: false });
    await seedDatabase({ cuentasDemo: false });
    const juntas = await query('SHOW COLUMNS FROM juntas');
    assert.deepStrictEqual(
      juntas.map((c) => c.Field),
      ['id', 'titulo', 'descripcion', 'inicio', 'fin', 'creado_por', 'creado_en', 'actualizado_en', 'privada']
    );
    const privada = juntas.find((c) => c.Field === 'privada');
    assert.match(privada.Type, /^tinyint\(1\)/);
    assert.strictEqual(privada.Null, 'NO');
    assert.strictEqual(String(privada.Default), '0');
    const participantes = await query('SHOW COLUMNS FROM junta_participantes');
    assert.deepStrictEqual(
      participantes.map((c) => c.Field),
      ['junta_id', 'usuario_id', 'respuesta', 'respondido_en']
    );
    assert.match(participantes[2].Type, /enum\('pendiente','aceptada','rechazada'\)/);
    const [{ 'Create Table': sqlJuntas }] = await query('SHOW CREATE TABLE juntas');
    const [{ 'Create Table': sqlPart }] = await query('SHOW CREATE TABLE junta_participantes');
    assert.match(sqlJuntas, /FOREIGN KEY \(`creado_por`\) REFERENCES `usuarios` \(`id`\) ON DELETE CASCADE/);
    assert.match(sqlPart, /FOREIGN KEY \(`junta_id`\) REFERENCES `juntas` \(`id`\) ON DELETE CASCADE/);
    assert.match(sqlPart, /FOREIGN KEY \(`usuario_id`\) REFERENCES `usuarios` \(`id`\) ON DELETE CASCADE/);
    assert.match(sqlPart, /PRIMARY KEY \(`junta_id`,`usuario_id`\)/);
  });

  test('solo administrador, contador, auxiliar y recepcionista: usuarios_de_sistema recibe 403 y sin token 401', async () => {
    for (const [metodo, ruta] of [
      ['GET', '/juntas/participantes-disponibles'],
      ['POST', '/juntas'],
      ['GET', '/juntas?desde=2031-03-01&hasta=2031-03-31'],
      ['GET', `/juntas/${ID_INEXISTENTE}`],
      ['PATCH', `/juntas/${ID_INEXISTENTE}`],
      ['DELETE', `/juntas/${ID_INEXISTENTE}`],
    ]) {
      const cuerpo = ['POST', 'PATCH'].includes(metodo) ? cuerpoJunta() : undefined;
      assert.strictEqual((await api('sistema', metodo, ruta, cuerpo)).statusCode, 403, `${metodo} ${ruta}`);
      assert.strictEqual((await peticion(servidor.puerto, metodo, ruta, cuerpo)).statusCode, 401, `${metodo} ${ruta}`);
    }
    for (const quien of ['admin', 'contador1', 'auxiliar', 'recepcion']) {
      assert.strictEqual((await api(quien, 'GET', '/juntas/participantes-disponibles')).statusCode, 200, quien);
    }
  });

  test('participantes-disponibles lista las cuentas del calendario, sin quien pide, sin correo y por nombre', async () => {
    const r = await api('contador1', 'GET', '/juntas/participantes-disponibles');
    assert.strictEqual(r.statusCode, 200);
    for (const u of r.body.usuarios) {
      assert.deepStrictEqual(Object.keys(u).sort(), ['id', 'nombre', 'rol']);
      assert.ok(['administrador', 'contador', 'auxiliar', 'recepcionista'].includes(u.rol), u.rol);
    }
    const ids = r.body.usuarios.map((u) => u.id);
    assert.ok(!ids.includes(cuentas.contador1.id), 'no incluye a quien pide');
    assert.ok(!ids.includes(cuentas.sistema.id), 'no incluye a usuarios_de_sistema');
    for (const nombre of ['admin', 'contador2', 'auxiliar', 'recepcion']) {
      assert.ok(ids.includes(cuentas[nombre].id), `incluye a ${nombre}`);
    }
    const mios = r.body.usuarios.filter((u) => Object.values(cuentas).some((c) => c.id === u.id)).map((u) => u.nombre);
    const esperado = [...mios].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
    assert.deepStrictEqual(mios, esperado);
  });

  test('el alta responde 201 con la junta completa y los invitados en pendiente', async () => {
    const r = await api('contador1', 'POST', '/juntas', {
      titulo: '  Cierre de mes  ',
      descripcion: '  Revisar pólizas  ',
      inicio: '2031-03-10 09:00',
      fin: '2031-03-11 10:30',
      participantes: [cuentas.admin.id, cuentas.recepcion.id],
    });
    assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
    const junta = r.body.junta;
    assert.deepStrictEqual(
      Object.keys(junta).sort(),
      ['creado_por', 'descripcion', 'estado', 'fin', 'id', 'inicio', 'participantes', 'privada', 'soy_organizador', 'titulo']
    );
    assert.strictEqual(junta.privada, false);
    assert.strictEqual(junta.titulo, 'Cierre de mes');
    assert.strictEqual(junta.descripcion, 'Revisar pólizas');
    assert.strictEqual(junta.inicio, '2031-03-10 09:00:00');
    assert.strictEqual(junta.fin, '2031-03-11 10:30:00');
    assert.match(junta.inicio, FORMATO_FECHA);
    assert.deepStrictEqual(junta.creado_por, { id: cuentas.contador1.id, nombre: cuentas.contador1.nombre });
    assert.strictEqual(junta.soy_organizador, true);
    assert.deepStrictEqual(
      junta.participantes.map((p) => [p.id, p.nombre, p.rol, p.respuesta]).sort((a, b) => a[0] - b[0]),
      [
        [cuentas.admin.id, cuentas.admin.nombre, 'administrador', 'pendiente'],
        [cuentas.recepcion.id, cuentas.recepcion.nombre, 'recepcionista', 'pendiente'],
      ].sort((a, b) => a[0] - b[0])
    );
  });

  test('una junta sin invitados (lista vacía o ausente) queda confirmada, sin avisos, y se puede pasar a ninguno al editar', async () => {
    const vacia = await crear('contador1', { titulo: 'zz_test_ bloqueo propio', participantes: [] });
    assert.deepStrictEqual(vacia.participantes, []);
    assert.strictEqual(vacia.estado, 'confirmada');
    const ausente = await crear('contador1', { titulo: 'zz_test_ bloqueo ausente', participantes: undefined });
    assert.deepStrictEqual(ausente.participantes, []);
    const conInvitado = await crear('contador1', { titulo: 'zz_test_ con invitado', participantes: [cuentas.admin.id] });
    assert.strictEqual(conInvitado.estado, 'por_confirmar');
    const r = await api('contador1', 'PATCH', `/juntas/${conInvitado.id}`, cuerpoJunta({ titulo: 'zz_test_ con invitado', participantes: [] }));
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.junta.participantes, []);
    assert.strictEqual(r.body.junta.estado, 'confirmada');
    assert.strictEqual((await api('admin', 'GET', `/juntas/${conInvitado.id}`)).statusCode, 404);
    const avisos = await query("SELECT 1 FROM notificaciones WHERE mensaje LIKE '%zz_test_ bloqueo%'");
    assert.strictEqual(avisos.length, 0);
  });

  test('la descripción es opcional y queda en null', async () => {
    const junta = await crear('contador1', { titulo: 'Sin descripción' });
    assert.strictEqual(junta.descripcion, null);
  });

  test('el alta rechaza datos inválidos con tres partes', async () => {
    const c = cuentas;
    const casos = [
      [{ titulo: '   ' }, 'título vacío'],
      [{ titulo: 'x'.repeat(151) }, 'título largo'],
      [{ descripcion: 'x'.repeat(1001) }, 'descripción larga'],
      [{ inicio: '2031-03-10' }, 'inicio sin hora'],
      [{ inicio: '2031-02-30 09:00' }, 'inicio inexistente'],
      [{ fin: '2031-03-10 09:00' }, 'fin igual al inicio'],
      [{ fin: '2031-03-10 08:00' }, 'fin anterior'],
      [{ participantes: null }, 'invitados nulos'],
      [{ participantes: 'x' }, 'invitados que no son arreglo'],
      [{ participantes: [c.contador1.id] }, 'el propio creador'],
      [{ participantes: [c.contador2.id, c.contador2.id] }, 'repetidos'],
      [{ participantes: [ID_INEXISTENTE] }, 'id inexistente'],
      [{ participantes: [c.sistema.id] }, 'usuarios_de_sistema como invitado'],
      [{ participantes: ['abc'] }, 'id no numérico'],
      [{ privada: 'si' }, 'privada que no es booleano'],
      [{ participantes: Array.from({ length: 51 }, (_, i) => i + 1000000) }, 'más de 50'],
    ];
    for (const [extra, descripcion] of casos) {
      const r = await api('contador1', 'POST', '/juntas', cuerpoJunta(extra));
      assert.strictEqual(r.statusCode, 400, `${descripcion}: ${JSON.stringify(r.body)}`);
      assert.match(r.body.mensaje, / sobre .+: /, descripcion);
    }
  });

  test('privada: el alta la guarda, el PATCH la cambia y las juntas existentes quedan públicas', async () => {
    const privada = await crear('contador1', { titulo: 'reservada', privada: true });
    assert.strictEqual(privada.privada, true);
    assert.strictEqual((await api('contador1', 'GET', `/juntas/${privada.id}`)).body.junta.privada, true);
    const publica = await crear('contador1', { titulo: 'abierta' });
    assert.strictEqual(publica.privada, false);
    const cuerpo = cuerpoJunta({ titulo: 'abierta', privada: true });
    const cambiada = await api('contador1', 'PATCH', `/juntas/${publica.id}`, cuerpo);
    assert.strictEqual(cambiada.statusCode, 200, JSON.stringify(cambiada.body));
    assert.strictEqual(cambiada.body.junta.privada, true);
    const sinMarca = await api('contador1', 'PATCH', `/juntas/${publica.id}`, cuerpoJunta({ titulo: 'abierta' }));
    assert.strictEqual(sinMarca.body.junta.privada, false);
    const mala = await api('contador1', 'PATCH', `/juntas/${publica.id}`, cuerpoJunta({ privada: 'true' }));
    assert.strictEqual(mala.statusCode, 400);
    assert.match(mala.body.mensaje, / sobre privada: /);
  });

  test('GET /juntas respeta los bordes del rango y el orden por inicio', async () => {
    const quien = 'auxiliar';
    const invitar = { participantes: [cuentas.recepcion.id] };
    await crear(quien, { ...invitar, titulo: 'termina justo al empezar', inicio: '2032-05-31 23:00', fin: '2032-06-01 00:00' });
    await crear(quien, { ...invitar, titulo: 'cruza la medianoche', inicio: '2032-05-31 23:00', fin: '2032-06-01 01:00' });
    await crear(quien, { ...invitar, titulo: 'ultimo dia', inicio: '2032-06-30 23:30', fin: '2032-07-01 00:30' });
    await crear(quien, { ...invitar, titulo: 'empieza al terminar el rango', inicio: '2032-07-01 00:00', fin: '2032-07-01 01:00' });
    await crear(quien, { ...invitar, titulo: 'a mitad', inicio: '2032-06-15 09:00', fin: '2032-06-15 10:00' });
    await crear(quien, { ...invitar, titulo: 'al inicio', inicio: '2032-06-02 08:00', fin: '2032-06-02 09:00' });

    const r = await api(quien, 'GET', '/juntas?desde=2032-06-01&hasta=2032-06-30');
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual(titulosEnRango(r), ['cruza la medianoche', 'al inicio', 'a mitad', 'ultimo dia']);
    assert.match(r.body.juntas[0].inicio, FORMATO_FECHA);
  });

  test('GET /juntas solo trae las juntas donde quien pide es creador o invitado', async () => {
    await crear('contador1', { titulo: 'junta de c1 y c2', inicio: '2033-01-10 09:00', fin: '2033-01-10 10:00' });
    const rango = '/juntas?desde=2033-01-01&hasta=2033-01-31';
    assert.deepStrictEqual(titulosEnRango(await api('contador1', 'GET', rango)), ['junta de c1 y c2']);
    const comoInvitado = await api('contador2', 'GET', rango);
    assert.deepStrictEqual(titulosEnRango(comoInvitado), ['junta de c1 y c2']);
    assert.strictEqual(comoInvitado.body.juntas[0].soy_organizador, false);
    assert.deepStrictEqual(titulosEnRango(await api('admin', 'GET', rango)), []);
    assert.deepStrictEqual(titulosEnRango(await api('recepcion', 'GET', rango)), []);
  });

  test('GET /juntas exige un rango válido de máximo 400 días', async () => {
    for (const consulta of [
      '',
      '?desde=2031-03-01',
      '?hasta=2031-03-31',
      '?desde=2031-03-31&hasta=2031-03-01',
      '?desde=2031-13-01&hasta=2031-14-01',
      '?desde=2031-01-01&hasta=2032-02-06',
      '?desde[]=2031-03-01&hasta=2031-03-31',
    ]) {
      const r = await api('contador1', 'GET', `/juntas${consulta}`);
      assert.strictEqual(r.statusCode, 400, consulta);
      assert.match(r.body.mensaje, / sobre rango de fechas: /);
    }
    assert.strictEqual((await api('contador1', 'GET', '/juntas?desde=2031-01-01&hasta=2032-02-05')).statusCode, 200);
  });

  test('GET /juntas/:id devuelve la junta al creador y a los invitados; a los demás les da 404', async () => {
    const junta = await crear('contador1', { titulo: 'consulta por id', participantes: [cuentas.admin.id] });
    const comoCreador = await api('contador1', 'GET', `/juntas/${junta.id}`);
    assert.strictEqual(comoCreador.statusCode, 200);
    assert.strictEqual(comoCreador.body.junta.id, junta.id);
    assert.strictEqual(comoCreador.body.junta.soy_organizador, true);
    const comoInvitado = await api('admin', 'GET', `/juntas/${junta.id}`);
    assert.strictEqual(comoInvitado.statusCode, 200);
    assert.strictEqual(comoInvitado.body.junta.soy_organizador, false);
    assert.strictEqual((await api('contador2', 'GET', `/juntas/${junta.id}`)).statusCode, 404);
    assert.strictEqual((await api('contador1', 'GET', `/juntas/${ID_INEXISTENTE}`)).statusCode, 404);
    assert.strictEqual((await api('contador1', 'GET', '/juntas/abc')).statusCode, 400);
  });

  test('PATCH cambia los datos; quien sigue conserva su respuesta, los nuevos entran en pendiente y los que salen se borran', async () => {
    const junta = await crear('contador1', {
      titulo: 'antes',
      participantes: [cuentas.admin.id, cuentas.contador2.id],
    });
    await query(
      "UPDATE junta_participantes SET respuesta = 'aceptada', respondido_en = '2031-03-01 12:34:56' WHERE junta_id = ? AND usuario_id = ?",
      [junta.id, cuentas.admin.id]
    );
    const r = await api('contador1', 'PATCH', `/juntas/${junta.id}`, {
      titulo: 'después',
      descripcion: 'nueva',
      inicio: '2031-03-10 09:00',
      fin: '2031-03-10 10:00',
      participantes: [cuentas.admin.id, cuentas.auxiliar.id],
    });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const cambiada = r.body.junta;
    assert.strictEqual(cambiada.titulo, 'después');
    assert.strictEqual(cambiada.descripcion, 'nueva');
    assert.strictEqual(cambiada.inicio, '2031-03-10 09:00:00');
    const respuestas = Object.fromEntries(cambiada.participantes.map((p) => [p.id, p.respuesta]));
    assert.deepStrictEqual(respuestas, { [cuentas.admin.id]: 'aceptada', [cuentas.auxiliar.id]: 'pendiente' });
    const filas = await query('SELECT usuario_id, respondido_en FROM junta_participantes WHERE junta_id = ?', [junta.id]);
    assert.strictEqual(filas.length, 2);
    const delQueSigue = filas.find((f) => f.usuario_id === cuentas.admin.id);
    assert.strictEqual(formatLocalDate(delQueSigue.respondido_en), '2031-03-01 12:34:56');
    assert.strictEqual(filas.find((f) => f.usuario_id === cuentas.auxiliar.id).respondido_en, null);
  });

  test('PATCH y DELETE: el invitado recibe 403, quien no participa y la junta inexistente 404, y los datos inválidos 400', async () => {
    const junta = await crear('contador1', { titulo: 'protegida', participantes: [cuentas.admin.id] });
    for (const [metodo, cuerpo] of [
      ['PATCH', cuerpoJunta({ titulo: 'robada', participantes: [cuentas.admin.id] })],
      ['DELETE', undefined],
    ]) {
      assert.strictEqual((await api('admin', metodo, `/juntas/${junta.id}`, cuerpo)).statusCode, 403, `${metodo} invitado`);
      assert.strictEqual((await api('contador2', metodo, `/juntas/${junta.id}`, cuerpo)).statusCode, 404, `${metodo} ajeno`);
      assert.strictEqual(
        (await api('contador1', metodo, `/juntas/${ID_INEXISTENTE}`, cuerpo)).statusCode,
        404,
        `${metodo} inexistente`
      );
    }
    const intacta = await api('contador1', 'GET', `/juntas/${junta.id}`);
    assert.strictEqual(intacta.body.junta.titulo, 'protegida');

    const invalido = await api('contador1', 'PATCH', `/juntas/${junta.id}`, cuerpoJunta({ fin: '2031-03-10 08:00' }));
    assert.strictEqual(invalido.statusCode, 400);
    assert.match(invalido.body.mensaje, / sobre fin: /);
    const aSiMismo = cuerpoJunta({ participantes: [cuentas.contador1.id] });
    assert.strictEqual((await api('contador1', 'PATCH', `/juntas/${junta.id}`, aSiMismo)).statusCode, 400);
  });

  test('DELETE borra la junta y a sus invitados', async () => {
    const junta = await crear('contador1', { titulo: 'a borrar', participantes: [cuentas.admin.id, cuentas.auxiliar.id] });
    const r = await api('contador1', 'DELETE', `/juntas/${junta.id}`);
    assert.strictEqual(r.statusCode, 200);
    assert.deepStrictEqual(r.body, { ok: true });
    assert.strictEqual((await api('contador1', 'GET', `/juntas/${junta.id}`)).statusCode, 404);
    assert.strictEqual((await query('SELECT 1 FROM junta_participantes WHERE junta_id = ?', [junta.id])).length, 0);
  });

  test('al borrar la cuenta del creador se borran sus juntas sin dejar huérfanas', async () => {
    const efimero = await crearUsuarioDePrueba('contador');
    const tokenEfimero = await iniciarSesion(servidor.puerto, efimero.correo, efimero.password);
    const r = await peticion(servidor.puerto, 'POST', '/juntas', cuerpoJunta({ participantes: [cuentas.admin.id] }), tokenEfimero);
    assert.strictEqual(r.statusCode, 201);
    await query('DELETE FROM sesiones WHERE usuario_id = ?', [efimero.id]);
    await query('DELETE FROM usuarios WHERE id = ?', [efimero.id]);
    assert.strictEqual((await query('SELECT 1 FROM juntas WHERE id = ?', [r.body.junta.id])).length, 0);
    assert.strictEqual((await query('SELECT 1 FROM junta_participantes WHERE junta_id = ?', [r.body.junta.id])).length, 0);
  });
});
