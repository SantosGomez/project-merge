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

/**
 * Pruebas de integración de la recepcionista como secretaria de los administradores (rebanada 27).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa cuentas `zz_test_`.
 */

const ID_INEXISTENTE = 99999999;
const RANGO = '?desde=2035-03-01&hasta=2035-03-31';
const LLAVES_OCUPADO = ['fin', 'id', 'inicio', 'ocupado', 'privada', 'titulo'];

let servidor;
let listaOriginal;
const cuentas = {};
const tokens = {};
let contador = 0;

function api(quien, metodo, ruta, cuerpo) {
  return peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[quien]);
}

/** Crea una junta con título único y devuelve la junta de la API (la respuesta debe ser 201). */
async function crear(quien, extra = {}) {
  contador += 1;
  const r = await api(quien, 'POST', '/juntas', {
    titulo: `Junta secretaria ${contador}`,
    inicio: '2035-03-12 09:00',
    fin: '2035-03-12 10:00',
    ...extra,
  });
  assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
  return r.body.junta;
}

/** Crea una junta de la recepcionista a nombre del administrador. */
function crearANombre(extra = {}) {
  return crear('recepcion', { organizador_id: cuentas.admin.id, ...extra });
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

async function avisosDe(quien, titulo) {
  return query(
    "SELECT mensaje, junta_id FROM notificaciones WHERE usuario_id = ? AND mensaje LIKE CONCAT('%', ?, '%') ORDER BY id ASC",
    [cuentas[quien].id, titulo]
  );
}

async function mensajesDe(quien, titulo) {
  return (await avisosDe(quien, titulo)).map((f) => f.mensaje);
}

describe('la recepcionista como secretaria del administrador', () => {
  before(async () => {
    // Estas pruebas usan varios administradores: se deja sin definir para que la recepcionista atienda a todos.
    listaOriginal = process.env.ADMINISTRADORES_DE_RECEPCION;
    delete process.env.ADMINISTRADORES_DE_RECEPCION;
    await prepararBaseDeDatos();
    for (const [nombre, rol] of [
      ['admin', 'administrador'],
      ['admin2', 'administrador'],
      ['contador', 'contador'],
      ['contador2', 'contador'],
      ['auxiliar', 'auxiliar'],
      ['recepcion', 'recepcionista'],
      ['recepcion2', 'recepcionista'],
    ]) {
      cuentas[nombre] = await crearUsuarioDePrueba(rol);
    }
    servidor = await iniciarServidor();
    for (const nombre of Object.keys(cuentas)) {
      tokens[nombre] = await iniciarSesion(servidor.puerto, cuentas[nombre].correo, cuentas[nombre].password);
    }
  });

  after(async () => {
    if (listaOriginal === undefined) delete process.env.ADMINISTRADORES_DE_RECEPCION;
    else process.env.ADMINISTRADORES_DE_RECEPCION = listaOriginal;
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  describe('alta a nombre de un administrador', () => {
    test('queda con el administrador como organizador y la recepcionista puede editarla', async () => {
      const junta = await crearANombre({ participantes: [cuentas.contador.id] });
      assert.strictEqual(junta.creado_por.id, cuentas.admin.id);
      assert.strictEqual(junta.creado_por.nombre, cuentas.admin.nombre);
      assert.strictEqual(junta.soy_organizador, false);
      assert.strictEqual(junta.puede_editar, true);
      assert.deepStrictEqual(junta.responder_por, []);
      const [fila] = await query('SELECT creado_por FROM juntas WHERE id = ?', [junta.id]);
      assert.strictEqual(fila.creado_por, cuentas.admin.id);
    });

    test('el administrador la ve como organizador y los invitados ven al administrador', async () => {
      const junta = await crearANombre({ participantes: [cuentas.contador.id] });
      const delAdmin = await api('admin', 'GET', `/juntas/${junta.id}`);
      assert.strictEqual(delAdmin.body.junta.soy_organizador, true);
      assert.strictEqual(delAdmin.body.junta.puede_editar, true);
      const delContador = await api('contador', 'GET', `/juntas/${junta.id}`);
      assert.strictEqual(delContador.body.junta.creado_por.id, cuentas.admin.id);
      assert.strictEqual(delContador.body.junta.puede_editar, false);
    });

    test('puede crearla sin invitados y puede invitarse a sí misma, pero no al administrador organizador', async () => {
      await crearANombre();
      const conElla = await crearANombre({ participantes: [cuentas.recepcion.id] });
      assert.deepStrictEqual(
        conElla.participantes.map((p) => p.id),
        [cuentas.recepcion.id]
      );
      contador += 1;
      const alAdmin = await api('recepcion', 'POST', '/juntas', {
        titulo: `Junta secretaria ${contador}`,
        inicio: '2035-03-12 09:00',
        fin: '2035-03-12 10:00',
        organizador_id: cuentas.admin.id,
        participantes: [cuentas.admin.id],
      });
      assert.strictEqual(alAdmin.statusCode, 400);
      assert.match(alAdmin.body.mensaje, / sobre participantes: /);
    });

    test('sin organizador_id la recepcionista crea una junta propia, como antes', async () => {
      const junta = await crear('recepcion', { participantes: [cuentas.admin.id] });
      assert.strictEqual(junta.creado_por.id, cuentas.recepcion.id);
      assert.strictEqual(junta.soy_organizador, true);
      assert.strictEqual(junta.puede_editar, true);
    });

    test('organizador_id debe ser un administrador existente: si no, 400 sobre organizador', async () => {
      const invalidos = [cuentas.contador.id, cuentas.auxiliar.id, cuentas.recepcion2.id, ID_INEXISTENTE, 'abc', -1, null, {}, [1]];
      for (const valor of invalidos) {
        const r = await api('recepcion', 'POST', '/juntas', {
          titulo: 'No debe crearse (organizador)',
          inicio: '2035-03-12 09:00',
          fin: '2035-03-12 10:00',
          organizador_id: valor,
        });
        assert.strictEqual(r.statusCode, 400, JSON.stringify(valor));
        assert.match(r.body.mensaje, / sobre organizador: /);
      }
      const filas = await query("SELECT id FROM juntas WHERE titulo = 'No debe crearse (organizador)'");
      assert.strictEqual(filas.length, 0);
    });

    test('cualquier otro rol que envíe organizador_id recibe 403 y no se crea nada', async () => {
      for (const quien of ['admin', 'admin2', 'contador', 'auxiliar']) {
        const r = await api(quien, 'POST', '/juntas', {
          titulo: 'No debe crearse (403)',
          inicio: '2035-03-12 09:00',
          fin: '2035-03-12 10:00',
          organizador_id: cuentas.admin.id,
        });
        assert.strictEqual(r.statusCode, 403, quien);
      }
      const filas = await query("SELECT id FROM juntas WHERE titulo = 'No debe crearse (403)'");
      assert.strictEqual(filas.length, 0);
    });

    test('avisos: los invitados ven al administrador como quien invita y el administrador recibe el aviso de agendado con enlace', async () => {
      const junta = await crearANombre({ participantes: [cuentas.contador.id, cuentas.recepcion.id] });
      assert.deepStrictEqual(await mensajesDe('contador', junta.titulo), [
        `${cuentas.admin.nombre} te invitó a «${junta.titulo}» el 12-03-2035 a las 09:00`,
      ]);
      const delAdmin = await avisosDe('admin', junta.titulo);
      assert.deepStrictEqual(
        delAdmin.map((a) => a.mensaje),
        [`${cuentas.recepcion.nombre} agendó «${junta.titulo}» a tu nombre el 12-03-2035 a las 09:00`]
      );
      assert.strictEqual(delAdmin[0].junta_id, junta.id);
      assert.deepStrictEqual(await mensajesDe('recepcion', junta.titulo), [], 'nadie recibe aviso de su propia acción');
    });
  });

  describe('acceso a juntas de administradores', () => {
    test('ve completa una junta privada de un administrador y una de contador con un administrador invitado', async () => {
      const privada = await crear('admin', { participantes: [cuentas.contador.id], privada: true });
      const r = await api('recepcion', 'GET', `/juntas/${privada.id}`);
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      assert.strictEqual(r.body.junta.titulo, privada.titulo);
      assert.strictEqual(r.body.junta.privada, true);
      assert.strictEqual(r.body.junta.puede_editar, true);
      assert.deepStrictEqual(r.body.junta.responder_por, []);

      const deContador = await crear('contador', { participantes: [cuentas.admin.id, cuentas.contador2.id], privada: true });
      const otra = await api('recepcion', 'GET', `/juntas/${deContador.id}`);
      assert.strictEqual(otra.statusCode, 200);
      assert.strictEqual(otra.body.junta.puede_editar, false);
      assert.deepStrictEqual(otra.body.junta.responder_por, [
        { id: cuentas.admin.id, nombre: cuentas.admin.nombre, respuesta: 'pendiente' },
      ]);
      assert.deepStrictEqual(
        otra.body.junta.participantes.map((p) => p.id).sort(),
        [cuentas.admin.id, cuentas.contador2.id].sort()
      );
    });

    test('una junta de contadores o auxiliares donde no participa sigue siendo 404 para GET, PATCH, DELETE y respuesta', async () => {
      const junta = await crear('contador', { participantes: [cuentas.auxiliar.id] });
      const intentos = [
        ['GET', `/juntas/${junta.id}`],
        ['PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { titulo: 'Cambio no permitido' })],
        ['DELETE', `/juntas/${junta.id}`],
        ['PATCH', `/juntas/${junta.id}/respuesta`, { respuesta: 'aceptada', en_nombre_de: cuentas.admin.id }],
      ];
      for (const [metodo, ruta, cuerpo] of intentos) {
        const r = await api('recepcion', metodo, ruta, cuerpo);
        assert.strictEqual(r.statusCode, 404, `${metodo} ${ruta}`);
      }
      const delAuxiliar = await crear('auxiliar', { participantes: [cuentas.contador.id] });
      assert.strictEqual((await api('recepcion', 'DELETE', `/juntas/${delAuxiliar.id}`)).statusCode, 404);
      const sigue = await api('contador', 'GET', `/juntas/${junta.id}`);
      assert.strictEqual(sigue.body.junta.titulo, junta.titulo);
    });

    test('en una junta de contador con administrador invitado puede verla pero no cambiarla ni borrarla (403)', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id] });
      const patch = await api('recepcion', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { titulo: 'Cambio no permitido' }));
      assert.strictEqual(patch.statusCode, 403);
      assert.strictEqual((await api('recepcion', 'DELETE', `/juntas/${junta.id}`)).statusCode, 403);
      const [fila] = await query('SELECT titulo FROM juntas WHERE id = ?', [junta.id]);
      assert.strictEqual(fila.titulo, junta.titulo);
    });

    test('un contador sigue sin ver el detalle de una junta privada del administrador', async () => {
      const privada = await crear('admin', {
        participantes: [cuentas.contador2.id],
        privada: true,
        inicio: '2035-03-24 09:00',
        fin: '2035-03-24 10:00',
      });
      const r = await api('contador', 'GET', `/juntas/${privada.id}`);
      assert.strictEqual(r.statusCode, 404);
      const agenda = await api('contador', 'GET', `/juntas/agenda/${cuentas.admin.id}${RANGO}`);
      const bloque = agenda.body.juntas.find((j) => j.inicio === privada.inicio && j.privada);
      assert.deepStrictEqual(Object.keys(bloque).sort(), LLAVES_OCUPADO);
      assert.strictEqual(bloque.titulo, 'Ocupado');
    });

    test('responder_por va vacío para los demás roles y puede_editar solo para quien organiza', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id, cuentas.auxiliar.id] });
      for (const quien of ['contador', 'admin', 'auxiliar']) {
        const r = await api(quien, 'GET', `/juntas/${junta.id}`);
        assert.deepStrictEqual(r.body.junta.responder_por, [], quien);
        assert.strictEqual(r.body.junta.puede_editar, quien === 'contador', quien);
      }
    });
  });

  describe('editar y borrar a nombre del administrador', () => {
    test('la recepcionista edita una junta del administrador y el administrador recibe el aviso de cambio', async () => {
      const junta = await crearANombre({ participantes: [cuentas.contador.id] });
      const r = await api('recepcion', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { fin: '2035-03-12 10:30' }));
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      assert.strictEqual(r.body.junta.fin, '2035-03-12 10:30:00');
      assert.strictEqual(r.body.junta.creado_por.id, cuentas.admin.id);
      const delAdmin = await avisosDe('admin', junta.titulo);
      assert.strictEqual(delAdmin.at(-1).mensaje, `${cuentas.recepcion.nombre} cambió «${junta.titulo}»`);
      assert.strictEqual(delAdmin.at(-1).junta_id, junta.id);
      assert.deepStrictEqual(await mensajesDe('recepcion', junta.titulo), []);
    });

    test('los invitados reciben el aviso de cambio del administrador cuando cambia la hora', async () => {
      const junta = await crearANombre({ participantes: [cuentas.contador.id] });
      await api('recepcion', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { inicio: '2035-03-13 11:00', fin: '2035-03-13 12:00' }));
      assert.strictEqual(
        (await mensajesDe('contador', junta.titulo)).at(-1),
        `${cuentas.admin.nombre} cambió «${junta.titulo}» al 13-03-2035 a las 11:00. Vuelve a confirmar tu asistencia`
      );
    });

    test('los invitados nuevos ven al administrador como quien invita y las reglas de invitados son las del organizador', async () => {
      const junta = await crearANombre();
      const r = await api('recepcion', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { participantes: [cuentas.auxiliar.id] }));
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      assert.deepStrictEqual(await mensajesDe('auxiliar', junta.titulo), [
        `${cuentas.admin.nombre} te invitó a «${junta.titulo}» el 12-03-2035 a las 09:00`,
      ]);
      const alAdmin = await api('recepcion', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { participantes: [cuentas.admin.id] }));
      assert.strictEqual(alAdmin.statusCode, 400);
      const aSiMisma = await api('recepcion', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { participantes: [cuentas.recepcion.id] }));
      assert.strictEqual(aSiMisma.statusCode, 200, JSON.stringify(aSiMisma.body));
    });

    test('otra recepcionista también puede editarla y el administrador sigue pudiendo hacerlo', async () => {
      const junta = await crearANombre();
      const otra = await api('recepcion2', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { descripcion: 'por la otra recepcionista' }));
      assert.strictEqual(otra.statusCode, 200, JSON.stringify(otra.body));
      const admin = await api('admin', 'PATCH', `/juntas/${junta.id}`, cuerpoDe(junta, { descripcion: 'por el administrador' }));
      assert.strictEqual(admin.statusCode, 200);
      const cambios = (await mensajesDe('admin', junta.titulo)).filter((m) => m.includes('cambió'));
      assert.deepStrictEqual(cambios, [`${cuentas.recepcion2.nombre} cambió «${junta.titulo}»`]);
    });

    test('la recepcionista borra una junta del administrador: invitados y administrador reciben el aviso sin enlace', async () => {
      const junta = await crearANombre({ participantes: [cuentas.contador.id] });
      const r = await api('recepcion', 'DELETE', `/juntas/${junta.id}`);
      assert.strictEqual(r.statusCode, 200);
      assert.strictEqual((await api('admin', 'GET', `/juntas/${junta.id}`)).statusCode, 404);
      const delContador = await avisosDe('contador', junta.titulo);
      assert.deepStrictEqual(
        delContador.map((a) => a.mensaje),
        [`${cuentas.admin.nombre} canceló «${junta.titulo}» del 12-03-2035`]
      );
      const delAdmin = await avisosDe('admin', junta.titulo);
      assert.deepStrictEqual(
        delAdmin.map((a) => a.mensaje),
        [`${cuentas.recepcion.nombre} borró «${junta.titulo}» del 12-03-2035`]
      );
      assert.strictEqual(delAdmin[0].junta_id, null);
      assert.deepStrictEqual(await mensajesDe('recepcion', junta.titulo), []);
    });

    test('borrar una junta que no existe da 404', async () => {
      assert.strictEqual((await api('recepcion', 'DELETE', `/juntas/${ID_INEXISTENTE}`)).statusCode, 404);
    });
  });

  describe('responder por el administrador', () => {
    function responderPor(quien, junta, respuesta, enNombreDe) {
      return api(quien, 'PATCH', `/juntas/${junta.id}/respuesta`, { respuesta, en_nombre_de: enNombreDe });
    }

    test('la respuesta de la recepcionista queda en la fila del administrador y confirma o cancela la junta', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id, cuentas.contador2.id] });
      const acepta = await responderPor('recepcion', junta, 'aceptada', cuentas.admin.id);
      assert.strictEqual(acepta.statusCode, 200, JSON.stringify(acepta.body));
      const admin = acepta.body.junta.participantes.find((p) => p.id === cuentas.admin.id);
      assert.strictEqual(admin.respuesta, 'aceptada');
      assert.strictEqual(acepta.body.junta.estado, 'confirmada');
      assert.deepStrictEqual(acepta.body.junta.responder_por, [
        { id: cuentas.admin.id, nombre: cuentas.admin.nombre, respuesta: 'aceptada' },
      ]);
      const [fila] = await query('SELECT respuesta, respondido_en FROM junta_participantes WHERE junta_id = ? AND usuario_id = ?', [
        junta.id,
        cuentas.admin.id,
      ]);
      assert.strictEqual(fila.respuesta, 'aceptada');
      assert.ok(fila.respondido_en);
      const rechaza = await responderPor('recepcion', junta, 'rechazada', String(cuentas.admin.id));
      assert.strictEqual(rechaza.body.junta.estado, 'cancelada');
      const propia = await query('SELECT usuario_id FROM junta_participantes WHERE junta_id = ? AND usuario_id = ?', [
        junta.id,
        cuentas.recepcion.id,
      ]);
      assert.strictEqual(propia.length, 0, 'la recepcionista no queda como invitada');
    });

    test('el administrador sigue pudiendo responder él mismo y su respuesta se ve en la sección de la recepcionista', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id] });
      await api('admin', 'PATCH', `/juntas/${junta.id}/respuesta`, { respuesta: 'aceptada' });
      const r = await api('recepcion', 'GET', `/juntas/${junta.id}`);
      assert.strictEqual(r.body.junta.responder_por[0].respuesta, 'aceptada');
    });

    test('avisos: el organizador y los demás ven al administrador, y el administrador recibe «por ti» con enlace', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id, cuentas.contador2.id] });
      await responderPor('recepcion', junta, 'aceptada', cuentas.admin.id);
      assert.deepStrictEqual(await mensajesDe('contador', junta.titulo), [
        `${cuentas.admin.nombre} aceptó «${junta.titulo}»`,
        `La junta «${junta.titulo}» quedó confirmada`,
      ]);
      assert.strictEqual((await mensajesDe('contador2', junta.titulo)).at(-1), `La junta «${junta.titulo}» quedó confirmada`);
      const delAdmin = await avisosDe('admin', junta.titulo);
      assert.deepStrictEqual(
        delAdmin.map((a) => a.mensaje),
        [
          `${cuentas.contador.nombre} te invitó a «${junta.titulo}» el 12-03-2035 a las 09:00`,
          `${cuentas.recepcion.nombre} aceptó por ti «${junta.titulo}»`,
        ]
      );
      assert.strictEqual(delAdmin[1].junta_id, junta.id);
      assert.deepStrictEqual(await mensajesDe('recepcion', junta.titulo), []);
      await responderPor('recepcion', junta, 'rechazada', cuentas.admin.id);
      assert.strictEqual(
        (await mensajesDe('admin', junta.titulo)).at(-1),
        `${cuentas.recepcion.nombre} rechazó por ti «${junta.titulo}»`
      );
    });

    test('repetir la misma respuesta no vuelve a avisar', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id] });
      await responderPor('recepcion', junta, 'aceptada', cuentas.admin.id);
      const antes = (await mensajesDe('admin', junta.titulo)).length;
      await responderPor('recepcion', junta, 'aceptada', cuentas.admin.id);
      assert.strictEqual((await mensajesDe('admin', junta.titulo)).length, antes);
    });

    test('puede responder por el administrador en una junta que ella misma organiza', async () => {
      const junta = await crear('recepcion', { participantes: [cuentas.admin.id] });
      const r = await responderPor('recepcion', junta, 'aceptada', cuentas.admin.id);
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      assert.strictEqual(r.body.junta.estado, 'confirmada');
      const sinEnNombre = await api('recepcion', 'PATCH', `/juntas/${junta.id}/respuesta`, { respuesta: 'aceptada' });
      assert.strictEqual(sinEnNombre.statusCode, 403, 'sin en_nombre_de sigue valiendo la regla del organizador');
    });

    test('un administrador no invitado, un invitado que no es administrador o un id inexistente dan 404', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id, cuentas.contador2.id] });
      for (const valor of [cuentas.admin2.id, cuentas.contador2.id, ID_INEXISTENTE]) {
        const r = await responderPor('recepcion', junta, 'aceptada', valor);
        assert.strictEqual(r.statusCode, 404, JSON.stringify(valor));
      }
      const invalido = await responderPor('recepcion', junta, 'aceptada', 'abc');
      assert.strictEqual(invalido.statusCode, 400);
      const sinRespuesta = await responderPor('recepcion', junta, 'quizás', cuentas.admin.id);
      assert.strictEqual(sinRespuesta.statusCode, 400);
      const [fila] = await query('SELECT respuesta FROM junta_participantes WHERE junta_id = ? AND usuario_id = ?', [
        junta.id,
        cuentas.admin.id,
      ]);
      assert.strictEqual(fila.respuesta, 'pendiente');
    });

    test('cualquier otro rol que envíe en_nombre_de recibe 403 y no cambia ninguna respuesta', async () => {
      const junta = await crear('contador', { participantes: [cuentas.admin.id, cuentas.contador2.id, cuentas.auxiliar.id] });
      for (const quien of ['admin', 'contador2', 'auxiliar']) {
        const r = await responderPor(quien, junta, 'rechazada', cuentas.admin.id);
        assert.strictEqual(r.statusCode, 403, quien);
      }
      const filas = await query('SELECT respuesta FROM junta_participantes WHERE junta_id = ?', [junta.id]);
      assert.ok(filas.every((f) => f.respuesta === 'pendiente'));
    });
  });

  describe('agenda de un administrador', () => {
    test('la recepcionista recibe todas sus juntas completas, incluidas las privadas', async () => {
      const privada = await crear('admin', {
        participantes: [cuentas.contador.id],
        privada: true,
        inicio: '2035-03-20 09:00',
        fin: '2035-03-20 10:00',
      });
      const invitado = await crear('contador', {
        participantes: [cuentas.admin.id],
        privada: true,
        inicio: '2035-03-21 09:00',
        fin: '2035-03-21 10:00',
      });
      const r = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.admin.id}${RANGO}`);
      assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
      const completa = r.body.juntas.find((j) => j.id === privada.id);
      assert.strictEqual(completa.titulo, privada.titulo);
      assert.strictEqual(completa.puede_editar, true);
      assert.deepStrictEqual(
        completa.participantes.map((p) => p.id),
        [cuentas.contador.id]
      );
      const deContador = r.body.juntas.find((j) => j.id === invitado.id);
      assert.strictEqual(deContador.titulo, invitado.titulo);
      assert.strictEqual(deContador.puede_editar, false);
      assert.strictEqual(deContador.responder_por.length, 1);
      assert.ok(
        r.body.juntas.every((j) => j.ocupado === undefined),
        'ninguna llega como «Ocupado»'
      );
    });

    test('sobre un contador, la recepcionista recibe solo «Ocupado» y llaves mínimas, aunque haya un administrador invitado', async () => {
      const privada = await crear('contador', {
        participantes: [cuentas.admin.id],
        privada: true,
        inicio: '2035-03-22 09:00',
        fin: '2035-03-22 10:00',
      });
      const r = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.contador.id}${RANGO}`);
      const bloque = r.body.juntas.find((j) => j.inicio === privada.inicio);
      assert.deepStrictEqual(Object.keys(bloque).sort(), LLAVES_OCUPADO);
      assert.strictEqual(bloque.titulo, 'Ocupado');
      assert.strictEqual(bloque.id, null);
      assert.ok(!JSON.stringify(r.body).includes(privada.titulo));
    });

    test('la recepcionista también recibe, completas, las juntas canceladas y las que el administrador rechazó; los demás no', async () => {
      const cancelada = await crear('contador', {
        participantes: [cuentas.admin.id, cuentas.contador2.id],
        inicio: '2035-03-24 09:00',
        fin: '2035-03-24 10:00',
      });
      assert.strictEqual((await api('admin', 'PATCH', `/juntas/${cancelada.id}/respuesta`, { respuesta: 'rechazada' })).statusCode, 200);
      const rechazada = await crear('contador', {
        participantes: [cuentas.admin.id],
        inicio: '2035-03-25 09:00',
        fin: '2035-03-25 10:00',
      });
      assert.strictEqual((await api('admin', 'PATCH', `/juntas/${rechazada.id}/respuesta`, { respuesta: 'rechazada' })).statusCode, 200);

      const r = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.admin.id}${RANGO}`);
      for (const junta of [cancelada, rechazada]) {
        const completa = r.body.juntas.find((j) => j.id === junta.id);
        assert.ok(completa, `la recepcionista ve «${junta.titulo}»`);
        assert.strictEqual(completa.estado, 'cancelada');
        assert.strictEqual(completa.titulo, junta.titulo);
        assert.strictEqual(completa.ocupado, undefined);
      }
      const deOtro = await api('contador2', 'GET', `/juntas/agenda/${cuentas.admin.id}${RANGO}`);
      assert.ok(deOtro.body.juntas.every((j) => j.id !== cancelada.id && j.id !== rechazada.id), 'un tercero no las ve');

      process.env.ADMINISTRADORES_DE_RECEPCION = String(cuentas.admin2.id);
      try {
        const sinAtender = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.admin.id}${RANGO}`);
        assert.ok(
          sinAtender.body.juntas.every((j) => j.id !== cancelada.id && j.id !== rechazada.id),
          'si no atiende a ese administrador, es un tercero'
        );
      } finally {
        delete process.env.ADMINISTRADORES_DE_RECEPCION;
      }
    });

    test('un contador que consulta la agenda del administrador sigue sin ver el detalle', async () => {
      const privada = await crear('admin', {
        participantes: [cuentas.contador2.id],
        privada: true,
        inicio: '2035-03-23 09:00',
        fin: '2035-03-23 10:00',
      });
      const r = await api('contador', 'GET', `/juntas/agenda/${cuentas.admin.id}${RANGO}`);
      const bloque = r.body.juntas.find((j) => j.inicio === privada.inicio);
      assert.strictEqual(bloque.titulo, 'Ocupado');
      assert.strictEqual(bloque.id, null);
      assert.strictEqual(bloque.puede_editar, undefined);
    });
  });
});
