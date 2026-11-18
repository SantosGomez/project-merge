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
 * Pruebas de integración de GET /juntas/agenda/:usuarioId (rebanada 23). Requiere MariaDB en marcha.
 * La prueba clave es de privacidad: un tercero nunca recibe descripción, invitados ni `id` de una junta ajena,
 * ni el título si es privada. Solo usa cuentas `zz_test_`.
 */

const ID_INEXISTENTE = 99999999;
const RANGO = '?desde=2034-04-01&hasta=2034-04-30';
const LLAVES_COMPLETA = [
  'creado_por',
  'descripcion',
  'estado',
  'fin',
  'id',
  'inicio',
  'participantes',
  'privada',
  'soy_organizador',
  'titulo',
];

let servidor;
const cuentas = {};
const tokens = {};

function api(quien, metodo, ruta, cuerpo) {
  return peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[quien]);
}

function agendaDe(quien, de, consulta = RANGO) {
  return api(quien, 'GET', `/juntas/agenda/${cuentas[de].id}${consulta}`);
}

async function crear(quien, extra) {
  const r = await api(quien, 'POST', '/juntas', {
    titulo: 'Junta de prueba',
    inicio: '2034-04-10 09:00',
    fin: '2034-04-10 10:00',
    participantes: [cuentas.admin.id],
    ...extra,
  });
  assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
  return r.body.junta;
}

function responder(quien, juntaId, respuesta) {
  return api(quien, 'PATCH', `/juntas/${juntaId}/respuesta`, { respuesta });
}

describe('GET /juntas/agenda/:usuarioId', () => {
  before(async () => {
    await prepararBaseDeDatos();
    for (const [nombre, rol] of [
      ['admin', 'administrador'],
      ['contador', 'contador'],
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

  test('responde { usuario, juntas } y los 4 roles del calendario pueden consultar a cualquiera de ellos', async () => {
    for (const quien of ['admin', 'contador', 'auxiliar', 'recepcion']) {
      for (const de of ['admin', 'contador', 'auxiliar', 'recepcion']) {
        const r = await agendaDe(quien, de);
        assert.strictEqual(r.statusCode, 200, `${quien} consulta a ${de}: ${JSON.stringify(r.body)}`);
        assert.deepStrictEqual(Object.keys(r.body).sort(), ['juntas', 'usuario']);
        assert.deepStrictEqual(r.body.usuario, {
          id: cuentas[de].id,
          nombre: cuentas[de].nombre,
          rol: { admin: 'administrador', contador: 'contador', auxiliar: 'auxiliar', recepcion: 'recepcionista' }[de],
        });
        assert.ok(Array.isArray(r.body.juntas));
      }
    }
  });

  test('un tercero ve la junta pública solo con título, horario y organizador, sin id, descripción ni invitados', async () => {
    await crear('contador', {
      titulo: 'Cierre pública',
      descripcion: 'Descripción secreta',
      participantes: [cuentas.admin.id, cuentas.recepcion.id],
    });
    const r = await agendaDe('auxiliar', 'admin');
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body.juntas.length, 1);
    assert.deepStrictEqual(r.body.juntas[0], {
      id: null,
      titulo: 'Cierre pública',
      inicio: '2034-04-10 09:00:00',
      fin: '2034-04-10 10:00:00',
      organizador: { nombre: cuentas.contador.nombre },
      privada: false,
      ocupado: true,
    });
    assert.ok(!JSON.stringify(r.body).includes('Descripción secreta'));
    assert.ok(!JSON.stringify(r.body).includes(cuentas.recepcion.nombre), 'no filtra a los invitados');
  });

  test('un tercero ve la junta privada solo como «Ocupado», sin título, organizador, id ni invitados', async () => {
    await crear('contador', {
      titulo: 'Despido reservado',
      descripcion: 'Detalle confidencial',
      participantes: [cuentas.admin.id, cuentas.recepcion.id],
      privada: true,
      inicio: '2034-04-11 09:00',
      fin: '2034-04-11 10:00',
    });
    const r = await agendaDe('auxiliar', 'admin');
    const ocupado = r.body.juntas.find((j) => j.inicio === '2034-04-11 09:00:00');
    assert.deepStrictEqual(ocupado, {
      id: null,
      titulo: 'Ocupado',
      inicio: '2034-04-11 09:00:00',
      fin: '2034-04-11 10:00:00',
      privada: true,
      ocupado: true,
    });
    for (const secreto of ['Despido reservado', 'Detalle confidencial']) {
      assert.ok(!JSON.stringify(r.body).includes(secreto), `la respuesta completa no filtra ${secreto}`);
    }
    const texto = JSON.stringify(ocupado);
    for (const secreto of ['Despido reservado', 'Detalle confidencial', cuentas.contador.nombre, cuentas.recepcion.nombre]) {
      assert.ok(!texto.includes(secreto), `no debe filtrar ${secreto}`);
    }
  });

  test('quien participa (organiza o está invitado) recibe la junta completa, privada o no', async () => {
    const privada = await crear('contador', {
      titulo: 'Privada con invitado',
      privada: true,
      inicio: '2034-04-12 09:00',
      fin: '2034-04-12 10:00',
    });
    const comoInvitado = await agendaDe('admin', 'contador');
    const suya = comoInvitado.body.juntas.find((j) => j.id === privada.id);
    assert.deepStrictEqual(Object.keys(suya).sort(), LLAVES_COMPLETA);
    assert.strictEqual(suya.titulo, 'Privada con invitado');
    assert.strictEqual(suya.privada, true);
    assert.strictEqual(suya.soy_organizador, false);
    const comoOrganizador = await agendaDe('contador', 'admin');
    const propia = comoOrganizador.body.juntas.find((j) => j.id === privada.id);
    assert.deepStrictEqual(Object.keys(propia).sort(), LLAVES_COMPLETA);
    assert.strictEqual(propia.soy_organizador, true);
    const idsDelAdmin = (await agendaDe('admin', 'admin')).body.juntas.map((j) => j.id);
    assert.ok(idsDelAdmin.includes(privada.id) && idsDelAdmin.every((id) => id !== null));
  });

  test('no incluye las juntas canceladas ni las que esa persona rechazó', async () => {
    const cancelada = await crear('contador', {
      titulo: 'Cancelada por admin',
      inicio: '2034-04-15 09:00',
      fin: '2034-04-15 10:00',
    });
    assert.strictEqual((await responder('admin', cancelada.id, 'rechazada')).statusCode, 200);
    const rechazada = await crear('contador', {
      titulo: 'Rechazada por recepción',
      participantes: [cuentas.recepcion.id],
      inicio: '2034-04-16 09:00',
      fin: '2034-04-16 10:00',
    });
    assert.strictEqual((await responder('recepcion', rechazada.id, 'rechazada')).statusCode, 200);
    const aceptada = await crear('contador', {
      titulo: 'Aceptada por recepción',
      participantes: [cuentas.recepcion.id],
      inicio: '2034-04-17 09:00',
      fin: '2034-04-17 10:00',
    });
    assert.strictEqual((await responder('recepcion', aceptada.id, 'aceptada')).statusCode, 200);

    const delAdmin = JSON.stringify((await agendaDe('auxiliar', 'admin')).body);
    assert.ok(!delAdmin.includes('Cancelada por admin'));
    const delContador = JSON.stringify((await agendaDe('auxiliar', 'contador')).body);
    assert.ok(!delContador.includes('Cancelada por admin'), 'la cancelada tampoco ocupa al organizador');
    const deRecepcion = JSON.stringify((await agendaDe('auxiliar', 'recepcion')).body);
    assert.ok(!deRecepcion.includes('Rechazada por recepción'));
    assert.ok(deRecepcion.includes('Aceptada por recepción'));
    assert.ok(delContador.includes('Rechazada por recepción'), 'al organizador sí lo ocupa');
  });

  test('respeta el rango y exige las mismas reglas que GET /juntas', async () => {
    const fuera = await agendaDe('auxiliar', 'admin', '?desde=2034-06-01&hasta=2034-06-30');
    assert.strictEqual(fuera.statusCode, 200);
    assert.deepStrictEqual(fuera.body.juntas, []);
    for (const consulta of ['', '?desde=2034-04-01', '?desde=2034-04-30&hasta=2034-04-01', '?desde=2034-01-01&hasta=2035-03-01']) {
      const r = await agendaDe('auxiliar', 'admin', consulta);
      assert.strictEqual(r.statusCode, 400, consulta);
      assert.match(r.body.mensaje, / sobre rango de fechas: /);
    }
  });

  test('un usuarioId inexistente o sin rol del calendario da 404 y uno no numérico 400', async () => {
    assert.strictEqual((await api('auxiliar', 'GET', `/juntas/agenda/${ID_INEXISTENTE}${RANGO}`)).statusCode, 404);
    assert.strictEqual((await agendaDe('auxiliar', 'sistema')).statusCode, 404);
    const mala = await api('auxiliar', 'GET', `/juntas/agenda/abc${RANGO}`);
    assert.strictEqual(mala.statusCode, 400);
    assert.match(mala.body.mensaje, / sobre .+: /);
  });

  test('usuarios_de_sistema recibe 403 y sin token 401', async () => {
    const ruta = `/juntas/agenda/${cuentas.admin.id}${RANGO}`;
    assert.strictEqual((await api('sistema', 'GET', ruta)).statusCode, 403);
    assert.strictEqual((await peticion(servidor.puerto, 'GET', ruta)).statusCode, 401);
  });

  test('las demás rutas no cambian: una junta ajena sigue dando 404 y no aparece en GET /juntas', async () => {
    const ajena = await crear('contador', {
      titulo: 'Ajena a recepción',
      participantes: [cuentas.admin.id],
      inicio: '2034-04-20 09:00',
      fin: '2034-04-20 10:00',
    });
    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${ajena.id}`)).statusCode, 404);
    const lista = await api('recepcion', 'GET', `/juntas${RANGO}`);
    assert.ok(!lista.body.juntas.some((j) => j.titulo === 'Ajena a recepción'));
  });
});
