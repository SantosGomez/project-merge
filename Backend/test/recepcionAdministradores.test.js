const assert = require('node:assert');
const { describe, test, before, after, afterEach } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { administradorEsAtendido } = require('../src/config/recepcion');

/**
 * A qué administradores atiende la recepcionista (rebanada 28): variable ADMINISTRADORES_DE_RECEPCION.
 * La parte de configuración no necesita base de datos; la de integración requiere MariaDB en marcha
 * (XAMPP, puerto 3306) y solo usa cuentas `zz_test_`.
 */

const RANGO = '?desde=2035-04-01&hasta=2035-04-30';

describe('configuración de ADMINISTRADORES_DE_RECEPCION', () => {
  test('con una lista, solo atiende a los ids que aparecen en ella', () => {
    const env = { ADMINISTRADORES_DE_RECEPCION: '7947, 1' };
    assert.strictEqual(administradorEsAtendido(7947, env), true);
    assert.strictEqual(administradorEsAtendido('1', env), true);
    assert.strictEqual(administradorEsAtendido(11081, env), false);
  });

  test('definida pero vacía, no atiende a nadie', () => {
    assert.strictEqual(administradorEsAtendido(1, { ADMINISTRADORES_DE_RECEPCION: '' }), false);
  });

  test('sin definir, atiende a todos fuera de producción y a ninguno en producción', () => {
    assert.strictEqual(administradorEsAtendido(1, {}), true);
    assert.strictEqual(administradorEsAtendido(1, { NODE_ENV: 'test' }), true);
    assert.strictEqual(administradorEsAtendido(1, { NODE_ENV: 'production' }), false);
  });

  test('la lista ignora lo que no es un id y no trata el asterisco como comodín', () => {
    const env = { ADMINISTRADORES_DE_RECEPCION: '*, abc,,1.5' };
    assert.strictEqual(administradorEsAtendido(1, env), false);
    assert.strictEqual(administradorEsAtendido(2, env), false);
  });
});

describe('la recepcionista solo atiende a los administradores configurados', () => {
  let servidor;
  const cuentas = {};
  const tokens = {};
  let contador = 0;
  let valorOriginal;
  let entornoOriginal;

  function api(quien, metodo, ruta, cuerpo) {
    return peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[quien]);
  }

  /** Fija la variable de la recepción; `undefined` la deja sin definir. */
  function fijarLista(valor) {
    if (valor === undefined) delete process.env.ADMINISTRADORES_DE_RECEPCION;
    else process.env.ADMINISTRADORES_DE_RECEPCION = valor;
  }

  function datosDeJunta(extra = {}) {
    contador += 1;
    return { titulo: `Junta recepcion ${contador}`, inicio: '2035-04-10 09:00', fin: '2035-04-10 10:00', ...extra };
  }

  async function crear(quien, extra = {}) {
    const r = await api(quien, 'POST', '/juntas', datosDeJunta(extra));
    assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
    return r.body.junta;
  }

  before(async () => {
    valorOriginal = process.env.ADMINISTRADORES_DE_RECEPCION;
    entornoOriginal = process.env.NODE_ENV;
    await prepararBaseDeDatos();
    for (const [nombre, rol] of [
      ['adminA', 'administrador'],
      ['adminB', 'administrador'],
      ['contador', 'contador'],
      ['recepcion', 'recepcionista'],
    ]) {
      cuentas[nombre] = await crearUsuarioDePrueba(rol);
    }
    servidor = await iniciarServidor();
    for (const nombre of Object.keys(cuentas)) {
      tokens[nombre] = await iniciarSesion(servidor.puerto, cuentas[nombre].correo, cuentas[nombre].password);
    }
  });

  afterEach(() => {
    fijarLista(valorOriginal);
    if (entornoOriginal === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = entornoOriginal;
  });

  after(async () => {
    fijarLista(valorOriginal);
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('con la lista [A], administra a A y no a B', async () => {
    const privadaA = await crear('adminA', { privada: true });
    const privadaB = await crear('adminB', { privada: true });
    const publicaB = await crear('adminB');
    const conAmbos = await crear('contador', { participantes: [cuentas.adminA.id, cuentas.adminB.id] });
    fijarLista(String(cuentas.adminA.id));

    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${privadaA.id}`)).statusCode, 200);
    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${privadaB.id}`)).statusCode, 404);
    const editarA = await api('recepcion', 'PATCH', `/juntas/${privadaA.id}`, {
      titulo: privadaA.titulo,
      inicio: '2035-04-10 09:00',
      fin: '2035-04-10 10:00',
      privada: true,
    });
    assert.strictEqual(editarA.statusCode, 200);
    const editarB = await api('recepcion', 'PATCH', `/juntas/${publicaB.id}`, datosDeJunta());
    assert.ok([403, 404].includes(editarB.statusCode), `editar a B: ${editarB.statusCode}`);
    assert.strictEqual((await api('recepcion', 'DELETE', `/juntas/${publicaB.id}`)).statusCode, 404);

    const agendaA = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.adminA.id}${RANGO}`);
    assert.ok(agendaA.body.juntas.some((j) => j.id === privadaA.id));
    const agendaB = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.adminB.id}${RANGO}`);
    const ocupado = agendaB.body.juntas.find((j) => j.privada);
    assert.deepStrictEqual(Object.keys(ocupado).sort(), ['fin', 'id', 'inicio', 'ocupado', 'privada', 'titulo']);
    assert.strictEqual(ocupado.titulo, 'Ocupado');

    const completa = await api('recepcion', 'GET', `/juntas/${conAmbos.id}`);
    assert.deepStrictEqual(
      completa.body.junta.responder_por.map((p) => p.id),
      [cuentas.adminA.id]
    );
    const porB = await api('recepcion', 'PATCH', `/juntas/${conAmbos.id}/respuesta`, {
      respuesta: 'aceptada',
      en_nombre_de: cuentas.adminB.id,
    });
    assert.strictEqual(porB.statusCode, 404);
    const porA = await api('recepcion', 'PATCH', `/juntas/${conAmbos.id}/respuesta`, {
      respuesta: 'aceptada',
      en_nombre_de: cuentas.adminA.id,
    });
    assert.strictEqual(porA.statusCode, 200);
  });

  test('agendar a nombre de B con la lista [A] responde 400 sobre organizador; a nombre de A funciona', async () => {
    fijarLista(String(cuentas.adminA.id));
    const aB = await api('recepcion', 'POST', '/juntas', datosDeJunta({ organizador_id: cuentas.adminB.id }));
    assert.strictEqual(aB.statusCode, 400);
    assert.match(aB.body.mensaje, / sobre organizador: /);
    const aA = await api('recepcion', 'POST', '/juntas', datosDeJunta({ organizador_id: cuentas.adminA.id }));
    assert.strictEqual(aA.statusCode, 201);
  });

  test('con la lista vacía no administra a nadie', async () => {
    const privadaA = await crear('adminA', { privada: true });
    fijarLista('');
    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${privadaA.id}`)).statusCode, 404);
    const agenda = await api('recepcion', 'GET', `/juntas/agenda/${cuentas.adminA.id}${RANGO}`);
    assert.strictEqual(agenda.body.juntas.find((j) => j.privada).titulo, 'Ocupado');
    const alta = await api('recepcion', 'POST', '/juntas', datosDeJunta({ organizador_id: cuentas.adminA.id }));
    assert.strictEqual(alta.statusCode, 400);
    const perfil = await api('recepcion', 'GET', '/auth/perfil');
    assert.deepStrictEqual(perfil.body.administradores_atendidos, []);
  });

  test('sin definir en producción no administra a nadie', async () => {
    const privadaA = await crear('adminA', { privada: true });
    fijarLista(undefined);
    process.env.NODE_ENV = 'production';
    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${privadaA.id}`)).statusCode, 404);
    const alta = await api('recepcion', 'POST', '/juntas', datosDeJunta({ organizador_id: cuentas.adminA.id }));
    assert.strictEqual(alta.statusCode, 400);
    const perfil = await api('recepcion', 'GET', '/auth/perfil');
    assert.deepStrictEqual(perfil.body.administradores_atendidos, []);
  });

  test('sin definir fuera de producción administra a todos', async () => {
    const privadaA = await crear('adminA', { privada: true });
    const privadaB = await crear('adminB', { privada: true });
    fijarLista(undefined);
    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${privadaA.id}`)).statusCode, 200);
    assert.strictEqual((await api('recepcion', 'GET', `/juntas/${privadaB.id}`)).statusCode, 200);
    const perfil = await api('recepcion', 'GET', '/auth/perfil');
    const ids = perfil.body.administradores_atendidos.map((a) => a.id);
    assert.ok(ids.includes(cuentas.adminA.id) && ids.includes(cuentas.adminB.id));
  });

  test('un id que no es administrador o no existe se ignora', async () => {
    fijarLista(`${cuentas.contador.id},99999999,${cuentas.adminA.id}`);
    const aContador = await api('recepcion', 'POST', '/juntas', datosDeJunta({ organizador_id: cuentas.contador.id }));
    assert.strictEqual(aContador.statusCode, 400);
    const perfil = await api('recepcion', 'GET', '/auth/perfil');
    assert.deepStrictEqual(perfil.body.administradores_atendidos, [
      { id: cuentas.adminA.id, nombre: cuentas.adminA.nombre },
    ]);
  });

  test('el login y el perfil traen administradores_atendidos solo para la recepcionista', async () => {
    fijarLista(String(cuentas.adminA.id));
    const esperado = [{ id: cuentas.adminA.id, nombre: cuentas.adminA.nombre }];
    const login = await peticion(servidor.puerto, 'POST', '/auth/login', {
      correo: cuentas.recepcion.correo,
      password: cuentas.recepcion.password,
    });
    assert.deepStrictEqual(login.body.administradores_atendidos, esperado);
    for (const quien of ['adminA', 'contador']) {
      const otro = await peticion(servidor.puerto, 'POST', '/auth/login', {
        correo: cuentas[quien].correo,
        password: cuentas[quien].password,
      });
      assert.ok(!('administradores_atendidos' in otro.body), `${quien} no recibe la llave en el login`);
      const perfil = await api(quien, 'GET', '/auth/perfil');
      assert.ok(!('administradores_atendidos' in perfil.body), `${quien} no recibe la llave en el perfil`);
    }
  });
});
