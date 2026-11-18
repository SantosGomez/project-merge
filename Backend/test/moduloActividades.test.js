const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion } = require('../soporte-pruebas/http');
const { usuarioTieneActividades } = require('../src/config/modulos');

/**
 * Acceso por usuario al módulo «Mis actividades»: solo las cuentas de USUARIOS_CON_ACTIVIDADES
 * entran a sus rutas. Requiere MariaDB en marcha (XAMPP, puerto 3306); solo usa cuentas `zz_test_`.
 */

// Una ruta de lectura por cada grupo de rutas del módulo
const RUTAS_DEL_MODULO = [
  '/clientes',
  '/tipos-actividad',
  '/actividades',
  '/tiempo/activo',
  '/jornadas/hoy',
  '/informes/tiempo?desde=2026-11-01&hasta=2026-11-30',
];

let servidor;
let habilitado;
let sinModulo;
let auxiliarSinModulo;
let auxiliarHabilitado;
let administrador;
let tokens = {};
let valorOriginal;

async function entrar(cuenta) {
  const r = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: cuenta.correo, password: cuenta.password });
  assert.strictEqual(r.statusCode, 200);
  return { token: r.body.token, cuerpo: r.body };
}

describe('Módulo «Mis actividades» por usuario', () => {
  before(async () => {
    valorOriginal = process.env.USUARIOS_CON_ACTIVIDADES;
    await prepararBaseDeDatos();
    habilitado = await crearUsuarioDePrueba('contador');
    sinModulo = await crearUsuarioDePrueba('contador');
    auxiliarHabilitado = await crearUsuarioDePrueba('auxiliar');
    auxiliarSinModulo = await crearUsuarioDePrueba('auxiliar');
    administrador = await crearUsuarioDePrueba('administrador');
    process.env.USUARIOS_CON_ACTIVIDADES = ` ${habilitado.id} , ${auxiliarHabilitado.id}`;
    servidor = await iniciarServidor();
    for (const [nombre, cuenta] of Object.entries({ habilitado, sinModulo, auxiliarHabilitado, auxiliarSinModulo, administrador })) {
      tokens[nombre] = await entrar(cuenta);
    }
  });

  after(async () => {
    if (valorOriginal === undefined) delete process.env.USUARIOS_CON_ACTIVIDADES;
    else process.env.USUARIOS_CON_ACTIVIDADES = valorOriginal;
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('la cuenta habilitada entra a todas las rutas del módulo', async () => {
    for (const ruta of RUTAS_DEL_MODULO) {
      const r = await peticion(servidor.puerto, 'GET', ruta, null, tokens.habilitado.token);
      assert.strictEqual(r.statusCode, 200, `${ruta} → ${r.statusCode}`);
    }
  });

  test('un auxiliar habilitado entra también', async () => {
    const r = await peticion(servidor.puerto, 'GET', '/actividades', null, tokens.auxiliarHabilitado.token);
    assert.strictEqual(r.statusCode, 200);
  });

  test('un contador no habilitado recibe 403 con mensaje en tres partes en todas las rutas', async () => {
    for (const ruta of RUTAS_DEL_MODULO) {
      const r = await peticion(servidor.puerto, 'GET', ruta, null, tokens.sinModulo.token);
      assert.strictEqual(r.statusCode, 403, `${ruta} → ${r.statusCode}`);
      assert.deepStrictEqual(Object.keys(r.body).sort(), ['mensaje']);
      assert.match(r.body.mensaje, /Módulo no habilitado/);
      assert.match(r.body.mensaje, /Mis actividades/);
    }
  });

  test('un auxiliar no habilitado recibe 403', async () => {
    const r = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, tokens.auxiliarSinModulo.token);
    assert.strictEqual(r.statusCode, 403);
  });

  test('las escrituras también se bloquean para quien no está habilitado', async () => {
    const crear = await peticion(servidor.puerto, 'POST', '/clientes', { nombre: 'zz_test cliente' }, tokens.sinModulo.token);
    assert.strictEqual(crear.statusCode, 403);
    const marcar = await peticion(servidor.puerto, 'POST', '/jornadas/hoy/marcar', { paso: 'entrada' }, tokens.sinModulo.token);
    assert.strictEqual(marcar.statusCode, 403);
  });

  test('sin token sigue dando 401 y el administrador sigue sin entrar por su rol', async () => {
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/actividades')).statusCode, 401);
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/actividades', null, tokens.administrador.token)).statusCode, 403);
  });

  test('«Mis casos» no se ve afectado para quien no tiene el módulo', async () => {
    const r = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, tokens.sinModulo.token);
    assert.strictEqual(r.statusCode, 200);
  });

  test('el login y el perfil avisan si el módulo está habilitado', async () => {
    assert.strictEqual(tokens.habilitado.cuerpo.actividades_habilitadas, true);
    assert.strictEqual(tokens.sinModulo.cuerpo.actividades_habilitadas, false);
    const perfil = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, tokens.sinModulo.token);
    assert.strictEqual(perfil.body.actividades_habilitadas, false);
    const perfilHabilitado = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, tokens.habilitado.token);
    assert.strictEqual(perfilHabilitado.body.actividades_habilitadas, true);
  });

  test('con `*` todas las cuentas que trabajan casos entran', async () => {
    process.env.USUARIOS_CON_ACTIVIDADES = '*';
    const r = await peticion(servidor.puerto, 'GET', '/actividades', null, tokens.sinModulo.token);
    assert.strictEqual(r.statusCode, 200);
    process.env.USUARIOS_CON_ACTIVIDADES = ` ${habilitado.id} , ${auxiliarHabilitado.id}`;
  });
});

describe('usuarioTieneActividades', () => {
  test('lista de ids con espacios y comas', () => {
    const env = { USUARIOS_CON_ACTIVIDADES: ' 7917 , 8001 ' };
    assert.strictEqual(usuarioTieneActividades(7917, env), true);
    assert.strictEqual(usuarioTieneActividades('8001', env), true);
    assert.strictEqual(usuarioTieneActividades(79170, env), false);
    assert.strictEqual(usuarioTieneActividades(791, env), false);
  });

  test('`*` abre para todos y la lista vacía cierra para todos', () => {
    assert.strictEqual(usuarioTieneActividades(1, { USUARIOS_CON_ACTIVIDADES: '*' }), true);
    assert.strictEqual(usuarioTieneActividades(1, { USUARIOS_CON_ACTIVIDADES: '' }), false);
    assert.strictEqual(usuarioTieneActividades(1, { USUARIOS_CON_ACTIVIDADES: ' , ' }), false);
  });

  test('sin definir: abierta en desarrollo y cerrada en producción', () => {
    assert.strictEqual(usuarioTieneActividades(1, {}), true);
    assert.strictEqual(usuarioTieneActividades(1, { NODE_ENV: 'production' }), false);
  });

  test('un valor con forma de ataque no coincide con ningún id', () => {
    const env = { USUARIOS_CON_ACTIVIDADES: '7917' };
    for (const id of ['7917 OR 1=1', '7917,', undefined, null, {}, [7917, 1]]) {
      assert.strictEqual(usuarioTieneActividades(id, env), false);
    }
  });
});
