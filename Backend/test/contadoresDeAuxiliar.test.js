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
let tokenContadorDos;
let contadorUno;
let contadorDos;
let auxiliar;

const pedir = (metodo, ruta, cuerpo, token = tokenSistema) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);
const idsDe = (respuesta) => respuesta.body.contadores.map((c) => c.id).sort((a, b) => a - b);
const avisosDe = async (usuarioId) =>
  Number((await query('SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = ?', [usuarioId]))[0].n);
const ultimoAvisoDe = async (usuarioId) => {
  const filas = await query(
    'SELECT mensaje FROM notificaciones WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC LIMIT 1',
    [usuarioId]
  );
  return filas.length > 0 ? filas[0].mensaje : null;
};
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
    tokenContadorDos = await iniciarSesion(servidor.puerto, contadorDos.correo, contadorDos.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('agrega, consulta y quita; solo avisa de los vínculos nuevos', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    assert.deepStrictEqual(idsDe(await pedir('GET', ruta)), []);

    const ambos = await pedir('PUT', ruta, { agregar: [contadorUno.id, contadorDos.id], quitar: [] });
    assert.strictEqual(ambos.statusCode, 200, JSON.stringify(ambos.body));
    assert.deepStrictEqual(idsDe(ambos), [contadorUno.id, contadorDos.id].sort((a, b) => a - b));
    assert.strictEqual(await avisosDe(contadorUno.id), 1, 'el contador sabe que tiene un auxiliar nuevo');
    assert.strictEqual(await avisosDe(auxiliar.id), 2, 'el auxiliar sabe a quién apoya');

    const soloDos = await pedir('PUT', ruta, { agregar: [], quitar: [contadorUno.id] }, tokenAdmin);
    assert.strictEqual(soloDos.statusCode, 200);
    assert.deepStrictEqual(idsDe(soloDos), [contadorDos.id]);
    assert.strictEqual(await avisosDe(contadorDos.id), 1, 'conservar un vínculo no vuelve a avisar');
  });

  test('repetir un cambio no duplica, no falla y no vuelve a avisar', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    const avisosContador = await avisosDe(contadorDos.id);
    const avisosAuxiliar = await avisosDe(auxiliar.id);

    const repetido = await pedir('PUT', ruta, { agregar: [contadorDos.id], quitar: [contadorUno.id] });
    assert.strictEqual(repetido.statusCode, 200, JSON.stringify(repetido.body));
    assert.deepStrictEqual(idsDe(repetido), [contadorDos.id], 'Dos sigue una sola vez y Uno ya no estaba');
    assert.strictEqual(await avisosDe(contadorDos.id), avisosContador, 'el contador no recibe otro aviso');
    assert.strictEqual(await avisosDe(auxiliar.id), avisosAuxiliar, 'el auxiliar no recibe otro aviso');
  });

  test('rechaza datos inválidos sin cambiar nada', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    const antes = idsDe(await pedir('GET', ruta));
    assert.deepStrictEqual(antes, [contadorDos.id]);
    const estado = async (cuerpo, otraRuta = ruta) => (await pedir('PUT', otraRuta, cuerpo)).statusCode;

    assert.strictEqual(await estado({ contadores: [contadorUno.id] }), 400, 'el cuerpo anterior (lista completa) ya no se acepta');
    assert.strictEqual(await estado({ agregar: 'uno', quitar: [] }), 400);
    assert.strictEqual(await estado({ agregar: [contadorUno.id] }), 400, 'faltan los que se quitan');
    assert.strictEqual(await estado({ agregar: [contadorUno.id], quitar: [contadorUno.id] }), 400, 'el mismo contador en las dos listas');
    assert.strictEqual(await estado({ agregar: [contadorUno.id, auxiliar.id], quitar: [contadorDos.id] }), 400, 'un auxiliar no es contador');
    assert.strictEqual(await estado({ agregar: [contadorUno.id, 999999999], quitar: [contadorDos.id] }), 404, 'un contador que no existe');
    assert.strictEqual(await estado({ agregar: [], quitar: [] }, `/usuarios/${contadorUno.id}/contadores`), 400, 'la cuenta no es auxiliar');

    assert.deepStrictEqual(idsDe(await pedir('GET', ruta)), antes, 'ni el contador válido se agregó ni Dos se quitó');
  });

  test('el despacho no pisa al contador que agregó al auxiliar mientras el diálogo estaba abierto', async () => {
    const otroAuxiliar = await crearUsuarioDePrueba('auxiliar');
    const ruta = `/usuarios/${otroAuxiliar.id}/contadores`;
    await pedir('PUT', ruta, { agregar: [contadorUno.id], quitar: [] });

    // El despacho abre el diálogo: ve solo a Uno.
    assert.deepStrictEqual(idsDe(await pedir('GET', ruta)), [contadorUno.id]);

    // Mientras tanto, el contador Dos lo agrega desde «Mis auxiliares».
    const porSuCuenta = await pedir('POST', `/contadores/${contadorDos.id}/auxiliares/${otroAuxiliar.id}`, undefined, tokenContadorDos);
    assert.strictEqual(porSuCuenta.statusCode, 201, JSON.stringify(porSuCuenta.body));

    // El despacho desmarca a Uno y guarda: solo viaja lo que cambió.
    const guardado = await pedir('PUT', ruta, { agregar: [], quitar: [contadorUno.id] });
    assert.strictEqual(guardado.statusCode, 200, JSON.stringify(guardado.body));
    assert.deepStrictEqual(idsDe(guardado), [contadorDos.id], 'el vínculo del contador Dos sigue vivo');
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

  test('al quitar un contador del equipo se avisa al auxiliar y al contador', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    const antesContador = await avisosDe(contadorDos.id);
    const antesAuxiliar = await avisosDe(auxiliar.id);

    const quitado = await pedir('PUT', ruta, { agregar: [], quitar: [contadorDos.id] });
    assert.strictEqual(quitado.statusCode, 200, JSON.stringify(quitado.body));
    assert.deepStrictEqual(idsDe(quitado), [], 'el vínculo se quitó de verdad');

    assert.strictEqual(await avisosDe(contadorDos.id), antesContador + 1, 'el contador recibe aviso de la baja');
    assert.strictEqual(await avisosDe(auxiliar.id), antesAuxiliar + 1, 'el auxiliar recibe aviso de la baja');

    assert.strictEqual(
      await ultimoAvisoDe(auxiliar.id),
      `Ya no apoyas a ${contadorDos.nombre} con sus casos.`,
      'texto del aviso al auxiliar'
    );
    assert.strictEqual(
      await ultimoAvisoDe(contadorDos.id),
      `${auxiliar.nombre} ya no es tu auxiliar.`,
      'texto del aviso al contador'
    );
  });

  test('quitar a quien no estaba vinculado no crea avisos', async () => {
    const ruta = `/usuarios/${auxiliar.id}/contadores`;
    const antesContador = await avisosDe(contadorUno.id);
    const antesAuxiliar = await avisosDe(auxiliar.id);

    const quitado = await pedir('PUT', ruta, { agregar: [], quitar: [contadorUno.id] });
    assert.strictEqual(quitado.statusCode, 200);
    assert.deepStrictEqual(idsDe(quitado), [], 'no había vínculo que quitar');

    assert.strictEqual(await avisosDe(contadorUno.id), antesContador, 'el contador no recibe aviso');
    assert.strictEqual(await avisosDe(auxiliar.id), antesAuxiliar, 'el auxiliar no recibe aviso');
  });
});
