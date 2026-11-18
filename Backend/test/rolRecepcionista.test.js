const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Rol recepcionista (rebanada 20, 2026-11-18):
 * - El usuario de sistema la da de alta y la edita desde el directorio.
 * - Entra al directorio en solo consulta: GET /usuarios sí, escrituras de /usuarios no.
 * - El bloqueo del resto de rutas lo cubre la matriz de autorización (`autorizacionMatriz.test.js`).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let sistema;
let recepcionista;
let tokenSistema;
let tokenRecepcionista;

const pedir = (metodo, ruta, cuerpo, token) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);

describe('rol recepcionista', () => {
  before(async () => {
    await prepararBaseDeDatos();
    sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    recepcionista = await crearUsuarioDePrueba('recepcionista');
    servidor = await iniciarServidor();
    tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);
    tokenRecepcionista = await iniciarSesion(servidor.puerto, recepcionista.correo, recepcionista.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el usuario de sistema da de alta a una recepcionista', async () => {
    const correo = `zz_test_recepcion_alta_${Date.now()}@prueba.local`;
    registrarUsuarioCreado(correo);

    const respuesta = await pedir(
      'POST',
      '/usuarios',
      { nombre: 'zz_test_ Recepción alta', correo, password: 'Recepcion1234', rol: 'recepcionista' },
      tokenSistema
    );

    assert.strictEqual(respuesta.statusCode, 201, JSON.stringify(respuesta.body));
    const directorio = await pedir('GET', '/usuarios', undefined, tokenSistema);
    const creada = directorio.body.usuarios.find((u) => u.correo === correo);
    assert.strictEqual(creada.rol, 'recepcionista');
  });

  test('el usuario de sistema edita el rol de una cuenta a recepcionista', async () => {
    const cuenta = await crearUsuarioDePrueba('administrador');

    const respuesta = await pedir(
      'PATCH',
      `/usuarios/${cuenta.id}`,
      { nombre: cuenta.nombre, correo: cuenta.correo, rol: 'recepcionista' },
      tokenSistema
    );

    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
  });

  test('un rol que no existe se rechaza y el aviso incluye a la recepcionista', async () => {
    const respuesta = await pedir(
      'POST',
      '/usuarios',
      { nombre: 'zz_test_ rol raro', correo: `zz_test_rol_raro_${Date.now()}@prueba.local`, password: 'Recepcion1234', rol: 'Recepcionista ' },
      tokenSistema
    );

    assert.strictEqual(respuesta.statusCode, 400);
    assert.match(respuesta.body.mensaje, /recepcionista/);
  });

  test('la recepcionista consulta el directorio', async () => {
    const respuesta = await pedir('GET', '/usuarios', undefined, tokenRecepcionista);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.ok(respuesta.body.usuarios.some((u) => u.id === recepcionista.id));
  });

  test('la recepcionista no escribe en el directorio', async () => {
    const otra = await crearUsuarioDePrueba('contador');
    const intentos = [
      ['POST', '/usuarios', { nombre: 'zz_test_ x', correo: 'zz_test_x@prueba.local', password: 'Recepcion1234', rol: 'contador' }],
      ['PATCH', `/usuarios/${otra.id}`, { nombre: otra.nombre, correo: otra.correo, rol: 'contador' }],
      ['PATCH', '/usuarios/restablecer-contrasena', { correo: otra.correo }],
      ['GET', `/usuarios/${otra.id}/contadores`],
      ['PUT', `/usuarios/${otra.id}/contadores`, { agregar: [], quitar: [] }],
    ];
    for (const [metodo, ruta, cuerpo] of intentos) {
      const respuesta = await pedir(metodo, ruta, cuerpo, tokenRecepcionista);
      assert.strictEqual(respuesta.statusCode, 403, `${metodo} ${ruta} → ${respuesta.statusCode}`);
    }
  });
});
