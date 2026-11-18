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
 * Pruebas de integración de las respuestas a invitaciones y los avisos de juntas (rebanada 22).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa cuentas `zz_test_`.
 */

const ID_INEXISTENTE = 99999999;

let servidor;
const cuentas = {};
const tokens = {};
let contador = 0;

function api(quien, metodo, ruta, cuerpo) {
  return peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[quien]);
}

/** Crea una junta con título único y devuelve la junta de la API. */
async function crear(quien, invitados, extra = {}) {
  contador += 1;
  const r = await api(quien, 'POST', '/juntas', {
    titulo: `Junta resp ${contador}`,
    inicio: '2031-05-12 09:00',
    fin: '2031-05-12 10:00',
    participantes: invitados.map((nombre) => cuentas[nombre].id),
    ...extra,
  });
  assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
  return r.body.junta;
}

function cuerpoDe(junta, extra = {}) {
  return {
    titulo: junta.titulo,
    inicio: junta.inicio.slice(0, 16),
    fin: junta.fin.slice(0, 16),
    participantes: junta.participantes.map((p) => p.id),
    ...extra,
  };
}

async function responder(quien, junta, respuesta) {
  return api(quien, 'PATCH', `/juntas/${junta.id}/respuesta`, { respuesta });
}

/** Avisos de una cuenta que mencionan el título, del más antiguo al más reciente. */
async function avisosDe(quien, titulo) {
  return query(
    "SELECT mensaje, junta_id FROM notificaciones WHERE usuario_id = ? AND mensaje LIKE CONCAT('%', ?, '%') ORDER BY id ASC",
    [cuentas[quien].id, titulo]
  );
}

async function mensajesDe(quien, titulo) {
  return (await avisosDe(quien, titulo)).map((f) => f.mensaje);
}

describe('respuestas a invitaciones y avisos de juntas', () => {
  before(async () => {
    await prepararBaseDeDatos();
    for (const [nombre, rol] of [
      ['admin', 'administrador'],
      ['admin2', 'administrador'],
      ['contador1', 'contador'],
      ['contador2', 'contador'],
      ['auxiliar', 'auxiliar'],
      ['recepcion', 'recepcionista'],
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

  test('el seed agrega notificaciones.junta_id con llave y borrado en cascada, y se puede repetir', async () => {
    await seedDatabase({ cuentasDemo: false });
    await seedDatabase({ cuentasDemo: false });
    const [columna] = await query("SHOW COLUMNS FROM notificaciones LIKE 'junta_id'");
    assert.strictEqual(columna.Null, 'YES');
    assert.match(columna.Type, /^int/);
    const [{ 'Create Table': sql }] = await query('SHOW CREATE TABLE notificaciones');
    assert.match(sql, /FOREIGN KEY \(`junta_id`\) REFERENCES `juntas` \(`id`\) ON DELETE CASCADE/);
    assert.match(sql, /KEY `idx_notificaciones_junta` \(`junta_id`\)/);
  });

  test('toda respuesta de junta trae su estado según los administradores invitados', async () => {
    const sinAdmin = await crear('contador1', ['contador2', 'auxiliar']);
    assert.strictEqual(sinAdmin.estado, 'confirmada');
    const conAdmin = await crear('contador1', ['admin', 'contador2']);
    assert.strictEqual(conAdmin.estado, 'por_confirmar');
    const adminOrganiza = await crear('admin', ['contador2']);
    assert.strictEqual(adminOrganiza.estado, 'confirmada');

    const detalle = await api('contador2', 'GET', `/juntas/${conAdmin.id}`);
    assert.strictEqual(detalle.body.junta.estado, 'por_confirmar');
    const lista = await api('contador1', 'GET', '/juntas?desde=2031-05-01&hasta=2031-05-31');
    assert.strictEqual(lista.body.juntas.find((j) => j.id === conAdmin.id).estado, 'por_confirmar');
    const editada = await api(
      'contador1',
      'PATCH',
      `/juntas/${conAdmin.id}`,
      cuerpoDe(conAdmin, { participantes: [cuentas.contador2.id] })
    );
    assert.strictEqual(editada.body.junta.estado, 'confirmada');
  });

  test('un invitado acepta, rechaza y cambia su respuesta; se guarda respondido_en en hora local', async () => {
    const junta = await crear('contador1', ['contador2']);
    const antes = Date.now();
    const r = await responder('contador2', junta, 'aceptada');
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.deepStrictEqual(Object.keys(r.body), ['junta']);
    assert.strictEqual(r.body.junta.participantes[0].respuesta, 'aceptada');
    const [fila] = await query('SELECT respondido_en FROM junta_participantes WHERE junta_id = ?', [junta.id]);
    assert.ok(Math.abs(new Date(formatLocalDate(fila.respondido_en)).getTime() - antes) < 60 * 1000);
    const cambio = await responder('contador2', junta, 'rechazada');
    assert.strictEqual(cambio.body.junta.participantes[0].respuesta, 'rechazada');
  });

  test('el organizador recibe 403, quien no participa y la junta inexistente 404, y el id inválido 400', async () => {
    const junta = await crear('contador1', ['contador2']);
    assert.strictEqual((await responder('contador1', junta, 'aceptada')).statusCode, 403);
    assert.strictEqual((await responder('auxiliar', junta, 'aceptada')).statusCode, 404);
    const inexistente = await api('contador2', 'PATCH', `/juntas/${ID_INEXISTENTE}/respuesta`, { respuesta: 'aceptada' });
    assert.strictEqual(inexistente.statusCode, 404);
    const invalido = await api('contador2', 'PATCH', '/juntas/abc/respuesta', { respuesta: 'aceptada' });
    assert.strictEqual(invalido.statusCode, 400);
  });

  test('cualquier valor distinto de aceptada o rechazada da 400 sobre respuesta y no cambia nada', async () => {
    const junta = await crear('contador1', ['contador2']);
    for (const valor of ['pendiente', 'ACEPTADA', '', null, undefined, 1, ['aceptada'], { a: 1 }]) {
      const r = await api('contador2', 'PATCH', `/juntas/${junta.id}/respuesta`, { respuesta: valor });
      assert.strictEqual(r.statusCode, 400, JSON.stringify(valor));
      assert.match(r.body.mensaje, / sobre respuesta: /);
    }
    const sinCuerpo = await api('contador2', 'PATCH', `/juntas/${junta.id}/respuesta`);
    assert.strictEqual(sinCuerpo.statusCode, 400);
    const [fila] = await query('SELECT respuesta FROM junta_participantes WHERE junta_id = ?', [junta.id]);
    assert.strictEqual(fila.respuesta, 'pendiente');
  });

  test('con administrador invitado: su rechazo cancela, su aceptación confirma y la de otros no decide', async () => {
    const junta = await crear('contador1', ['admin', 'contador2']);
    assert.strictEqual((await responder('contador2', junta, 'aceptada')).body.junta.estado, 'por_confirmar');
    assert.strictEqual((await responder('admin', junta, 'rechazada')).body.junta.estado, 'cancelada');
    assert.strictEqual((await responder('admin', junta, 'aceptada')).body.junta.estado, 'confirmada');
    const doble = await crear('contador1', ['admin', 'admin2']);
    assert.strictEqual((await responder('admin', doble, 'aceptada')).body.junta.estado, 'por_confirmar');
    assert.strictEqual((await responder('admin2', doble, 'aceptada')).body.junta.estado, 'confirmada');
  });

  test('editar fecha u hora devuelve las respuestas a pendiente; editar lo demás las conserva', async () => {
    const junta = await crear('contador1', ['contador2', 'auxiliar']);
    await responder('contador2', junta, 'aceptada');
    await responder('auxiliar', junta, 'rechazada');

    const soloNota = await api('contador1', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { descripcion: 'nueva nota' }));
    assert.deepStrictEqual(soloNota.body.junta.participantes.map((p) => p.respuesta).sort(), ['aceptada', 'rechazada']);

    const cambioHora = await api('contador1', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { fin: '2031-05-12 10:30' }));
    assert.strictEqual(cambioHora.statusCode, 200, JSON.stringify(cambioHora.body));
    assert.deepStrictEqual(
      cambioHora.body.junta.participantes.map((p) => p.respuesta),
      ['pendiente', 'pendiente']
    );
    const filas = await query('SELECT respondido_en FROM junta_participantes WHERE junta_id = ?', [junta.id]);
    assert.ok(filas.every((f) => f.respondido_en === null));
  });

  test('avisos del alta: cada invitado recibe la invitación y el organizador nada', async () => {
    const junta = await crear('contador1', ['contador2', 'recepcion']);
    const esperado = `${cuentas.contador1.nombre} te invitó a «${junta.titulo}» el 12-05-2031 a las 09:00`;
    assert.deepStrictEqual(await mensajesDe('contador2', junta.titulo), [esperado]);
    assert.deepStrictEqual(await mensajesDe('recepcion', junta.titulo), [esperado]);
    assert.strictEqual((await avisosDe('contador2', junta.titulo))[0].junta_id, junta.id);
    assert.deepStrictEqual(await mensajesDe('contador1', junta.titulo), []);
  });

  test('avisos de la edición: invitación a los nuevos y, si cambia la hora, aviso de cambio a los que siguen', async () => {
    const junta = await crear('contador1', ['contador2']);
    const conNuevo = await api(
      'contador1',
      'PATCH',
      `/juntas/${junta.id}`,
      cuerpoDe(junta, { participantes: [cuentas.contador2.id, cuentas.auxiliar.id] })
    );
    assert.strictEqual(conNuevo.statusCode, 200);
    assert.deepStrictEqual(await mensajesDe('auxiliar', junta.titulo), [
      `${cuentas.contador1.nombre} te invitó a «${junta.titulo}» el 12-05-2031 a las 09:00`,
    ]);
    assert.strictEqual((await mensajesDe('contador2', junta.titulo)).length, 1, 'quien sigue no recibe otra invitación');

    const cambio = await api(
      'contador1',
      'PATCH',
      `/juntas/${junta.id}`,
      cuerpoDe(junta, {
        inicio: '2031-05-13 16:45',
        fin: '2031-05-13 17:30',
        participantes: [cuentas.contador2.id, cuentas.auxiliar.id, cuentas.recepcion.id],
      })
    );
    assert.strictEqual(cambio.statusCode, 200, JSON.stringify(cambio.body));
    const aviso = `${cuentas.contador1.nombre} cambió «${junta.titulo}» al 13-05-2031 a las 16:45. Vuelve a confirmar tu asistencia`;
    assert.strictEqual((await mensajesDe('contador2', junta.titulo)).at(-1), aviso);
    assert.strictEqual((await mensajesDe('auxiliar', junta.titulo)).at(-1), aviso);
    assert.deepStrictEqual(await mensajesDe('recepcion', junta.titulo), [
      `${cuentas.contador1.nombre} te invitó a «${junta.titulo}» el 13-05-2031 a las 16:45`,
    ]);
    assert.deepStrictEqual(await mensajesDe('contador1', junta.titulo), []);
  });

  test('avisos de respuesta: el organizador sabe quién aceptó o rechazó y el invitado no recibe aviso propio', async () => {
    const junta = await crear('contador1', ['contador2']);
    await responder('contador2', junta, 'aceptada');
    await responder('contador2', junta, 'rechazada');
    assert.deepStrictEqual(await mensajesDe('contador1', junta.titulo), [
      `${cuentas.contador2.nombre} aceptó «${junta.titulo}»`,
      `${cuentas.contador2.nombre} rechazó «${junta.titulo}»`,
    ]);
    assert.strictEqual((await mensajesDe('contador2', junta.titulo)).length, 1, 'solo su invitación');
  });

  test('avisos de estado: la respuesta de un administrador que confirma o cancela avisa al organizador y a los demás', async () => {
    const junta = await crear('contador1', ['admin', 'contador2', 'auxiliar']);
    await responder('admin', junta, 'rechazada');
    const cancelada = `La junta «${junta.titulo}» se canceló`;
    for (const quien of ['contador1', 'contador2', 'auxiliar']) {
      assert.strictEqual((await mensajesDe(quien, junta.titulo)).at(-1), cancelada, quien);
    }
    assert.ok(!(await mensajesDe('admin', junta.titulo)).includes(cancelada), 'el administrador no recibe aviso de su acción');
    await responder('admin', junta, 'aceptada');
    const confirmada = `La junta «${junta.titulo}» quedó confirmada`;
    for (const quien of ['contador1', 'contador2', 'auxiliar']) {
      assert.strictEqual((await mensajesDe(quien, junta.titulo)).at(-1), confirmada, quien);
    }
    const antes = (await mensajesDe('contador2', junta.titulo)).length;
    await responder('admin', junta, 'aceptada');
    assert.strictEqual((await mensajesDe('contador2', junta.titulo)).length, antes, 'sin cambio de estado no hay aviso de estado');
  });

  test('una respuesta que no es de administrador no avisa del estado', async () => {
    const junta = await crear('contador1', ['contador2', 'auxiliar']);
    await responder('contador2', junta, 'rechazada');
    assert.strictEqual((await mensajesDe('auxiliar', junta.titulo)).length, 1, 'solo su invitación');
    assert.strictEqual((await mensajesDe('contador1', junta.titulo)).length, 1, 'solo el aviso de respuesta');
  });

  test('avisos del borrado: cada invitado recibe la cancelación, sin junta_id, y sobrevive al borrado', async () => {
    const junta = await crear('contador1', ['contador2', 'auxiliar']);
    const r = await api('contador1', 'DELETE', `/juntas/${junta.id}`);
    assert.strictEqual(r.statusCode, 200);
    const esperado = `${cuentas.contador1.nombre} canceló «${junta.titulo}» del 12-05-2031`;
    for (const quien of ['contador2', 'auxiliar']) {
      const avisos = await avisosDe(quien, junta.titulo);
      assert.deepStrictEqual(
        avisos.map((a) => a.mensaje),
        [esperado],
        `${quien}: la invitación con junta se fue en cascada y queda la cancelación`
      );
      assert.strictEqual(avisos[0].junta_id, null);
    }
    assert.deepStrictEqual(await mensajesDe('contador1', junta.titulo), []);
  });

  test('GET /notificaciones trae junta_id y junta_inicio, o null si el aviso no es de una junta', async () => {
    const junta = await crear('contador1', ['contador2']);
    const r = await api('contador2', 'GET', '/notificaciones');
    assert.strictEqual(r.statusCode, 200);
    const aviso = r.body.notificaciones.find((n) => n.mensaje.includes(junta.titulo));
    assert.strictEqual(aviso.junta_id, junta.id);
    assert.strictEqual(aviso.junta_inicio, '2031-05-12 09:00:00');
    assert.deepStrictEqual(
      Object.keys(aviso).sort(),
      ['caso_id', 'creado_en', 'id', 'junta_id', 'junta_inicio', 'leida', 'mensaje']
    );
    await api('contador1', 'DELETE', `/juntas/${junta.id}`);
    const despues = await api('contador2', 'GET', '/notificaciones');
    const cancelacion = despues.body.notificaciones.find((n) => n.mensaje.includes('canceló') && n.mensaje.includes(junta.titulo));
    assert.strictEqual(cancelacion.junta_id, null);
    assert.strictEqual(cancelacion.junta_inicio, null);
  });

  test('quien sale de la junta al editarla ya no recibe junta_id ni junta_inicio en su aviso', async () => {
    const junta = await crear('contador1', ['contador2', 'auxiliar']);
    const sinAuxiliar = await api(
      'contador1',
      'PATCH',
      `/juntas/${junta.id}`,
      cuerpoDe(junta, { inicio: '2031-05-14 11:00', fin: '2031-05-14 12:00', participantes: [cuentas.contador2.id] })
    );
    assert.strictEqual(sinAuxiliar.statusCode, 200, JSON.stringify(sinAuxiliar.body));
    const fuera = (await api('auxiliar', 'GET', '/notificaciones')).body.notificaciones.find((n) =>
      n.mensaje.includes(junta.titulo)
    );
    assert.strictEqual(fuera.junta_id, null);
    assert.strictEqual(fuera.junta_inicio, null);
    const sigue = (await api('contador2', 'GET', '/notificaciones')).body.notificaciones.find(
      (n) => n.mensaje.includes(junta.titulo) && n.mensaje.includes('invitó')
    );
    assert.strictEqual(sigue.junta_id, junta.id);
    assert.strictEqual(sigue.junta_inicio, '2031-05-14 11:00:00');
    const organizador = (await api('contador1', 'GET', '/notificaciones')).body.notificaciones;
    assert.ok(organizador.every((n) => !n.mensaje.includes(junta.titulo) || n.junta_id === junta.id));
  });

  test('repetir la misma respuesta responde 200 pero no vuelve a avisar', async () => {
    const junta = await crear('contador1', ['admin', 'contador2']);
    await responder('admin', junta, 'rechazada');
    const antesOrganizador = (await mensajesDe('contador1', junta.titulo)).length;
    const antesOtro = (await mensajesDe('contador2', junta.titulo)).length;
    const repetida = await responder('admin', junta, 'rechazada');
    assert.strictEqual(repetida.statusCode, 200);
    assert.strictEqual(repetida.body.junta.estado, 'cancelada');
    assert.strictEqual((await mensajesDe('contador1', junta.titulo)).length, antesOrganizador);
    assert.strictEqual((await mensajesDe('contador2', junta.titulo)).length, antesOtro);
  });
});
