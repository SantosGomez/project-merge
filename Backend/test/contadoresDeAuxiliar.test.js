const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const crypto = require('node:crypto');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * El despacho (usuario de sistema o administrador) vincula un auxiliar con sus contadores:
 * al darlo de alta y después desde el directorio (rama experimento, 2026-11-10).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let tokenSistema;
let tokenAdmin;
let tokenContador;
let contadorUno;
let contadorDos;
let auxiliar;

const pedir = (metodo, ruta, cuerpo, token = tokenSistema) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);
const idsDe = (respuesta) => respuesta.body.contadores.map((c) => c.id).sort((a, b) => a - b);
const avisosDe = async (usuarioId) =>
  Number((await query('SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ?', [usuarioId]))[0].n);
const correoNuevo = () => {
  const correo = `zz_test_alta_aux_${crypto.randomBytes(4).toString('hex')}@prueba.local`;
  registrarUsuarioCreado(correo);
  return correo;
};

describe('contadores que apoya un auxiliar (despacho)', () => {
  before(async () => {
    await prepararBaseDeDatos();
    const sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    const admin = await crearUsuarioDePrueba('administrador');
    contadorUno = await crearUsuarioDePrueba('contador');
    contadorDos = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    servidor = await iniciarServidor();
    tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenContador = await iniciarSesion(servidor.puerto, contadorUno.correo, contadorUno.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('vincula, consulta y desvincula; solo avisa de los vínculos nuevos', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    assert.deepStrictEqual(idsDe(await pedir('GET', ruta)), []);

    const ambos = await pedir('PUT', ruta, { contadores: [contadorUno.id, contadorDos.id] });
    assert.strictEqual(ambos.statusCode, 200, JSON.stringify(ambos.body));
    assert.deepStrictEqual(idsDe(ambos), [contadorUno.id, contadorDos.id].sort((a, b) => a - b));
    assert.strictEqual(await avisosDe(contadorUno.id), 1, 'el contador sabe que tiene un auxiliar nuevo');
    assert.strictEqual(await avisosDe(auxiliar.id), 2, 'el auxiliar sabe a quién apoya');

    const soloDos = await pedir('PUT', ruta, { contadores: [contadorDos.id] }, tokenAdmin);
    assert.strictEqual(soloDos.statusCode, 200);
    assert.deepStrictEqual(idsDe(soloDos), [contadorDos.id]);
    assert.strictEqual(await avisosDe(contadorDos.id), 1, 'conservar un vínculo no vuelve a avisar');
  });

  test('rechaza datos inválidos sin cambiar nada', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    const antes = idsDe(await pedir('GET', ruta));

    assert.strictEqual((await pedir('PUT', ruta, { contadores: 'uno' })).statusCode, 400);
    assert.strictEqual((await pedir('PUT', ruta, { contadores: [auxiliar.id] })).statusCode, 400, 'un auxiliar no es contador');
    assert.strictEqual((await pedir('PUT', `/usuarios/${contadorUno.id}/contadores`, { contadores: [] })).statusCode, 400, 'la cuenta no es auxiliar');
    assert.deepStrictEqual(idsDe(await pedir('GET', ruta)), antes);
  });

  test('un contador no puede usar estas rutas', async () => {
    assert.strictEqual((await pedir('GET', `/usuarios/${auxiliar.id}/contadores`, undefined, tokenContador)).statusCode, 403);
  });

  test('el alta de un auxiliar lo vincula en el mismo paso', async () => {
    const correo = correoNuevo();
    const alta = await pedir('POST', '/usuarios', {
      nombre: 'zz_test Auxiliar con contador',
      correo,
      password: 'NuevoPass1234',
      rol: 'auxiliar',
      contadores: [contadorUno.id],
    });
    assert.strictEqual(alta.statusCode, 201, JSON.stringify(alta.body));

    const [nuevo] = await query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
    assert.deepStrictEqual(idsDe(await pedir('GET', `/usuarios/${nuevo.id}/contadores`)), [contadorUno.id]);
  });

  test('si un contador del alta no es válido, no crea la cuenta', async () => {
    const correo = correoNuevo();
    const alta = await pedir('POST', '/usuarios', {
      nombre: 'zz_test Auxiliar fallido',
      correo,
      password: 'NuevoPass1234',
      rol: 'auxiliar',
      contadores: [auxiliar.id],
    });
    assert.strictEqual(alta.statusCode, 400);
    assert.strictEqual((await query('SELECT id FROM usuarios WHERE correo = ?', [correo])).length, 0);
  });
});
