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
 * Ajustes > Clientes (rebanada 52): GET /ajustes/clientes lista todos los clientes del catálogo
 * y solo lo ven administrador y usuario de sistemas.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
const cuentas = {};
const tokens = {};
let idClienteConContador;
let idClienteSinContador;

const pedir = (metodo, ruta, token) => peticion(servidor.puerto, metodo, ruta, undefined, token);

describe('GET /ajustes/clientes', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista', 'contador']) {
      cuentas[rol] = await crearUsuarioDePrueba(rol);
      tokens[rol] = await iniciarSesion(servidor.puerto, cuentas[rol].correo, cuentas[rol].password);
    }
    const conContador = await query(
      "INSERT INTO clientes (usuario_id, clave, nombre, rfc, activo, creado_en) VALUES (?, NULL, 'zz_test_ Cliente con contador', 'XAXX010101000', 1, NOW())",
      [cuentas.contador.id]
    );
    idClienteConContador = conContador.insertId;
    const sinContador = await query(
      "INSERT INTO clientes (usuario_id, clave, nombre, rfc, activo, creado_en) VALUES (NULL, NULL, 'zz_test_ Cliente sin contador', NULL, 0, NOW())"
    );
    idClienteSinContador = sinContador.insertId;
  });

  after(async () => {
    await query("DELETE FROM clientes WHERE nombre LIKE 'zz\_test\_%'");
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el administrador ve todos los clientes con contador, estado y RFC', async () => {
    const respuesta = await pedir('GET', '/ajustes/clientes', tokens.administrador);

    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    const con = respuesta.body.clientes.find((c) => c.id === idClienteConContador);
    const sin = respuesta.body.clientes.find((c) => c.id === idClienteSinContador);
    assert.strictEqual(con.nombre, 'zz_test_ Cliente con contador');
    assert.strictEqual(con.rfc, 'XAXX010101000');
    assert.strictEqual(con.activo, true);
    assert.strictEqual(con.contador_id, cuentas.contador.id);
    assert.ok(con.contador_nombre);
    assert.strictEqual(sin.activo, false);
    assert.strictEqual(sin.contador_id, null);
    assert.strictEqual(sin.contador_nombre, null);
  });

  test('el usuario de sistemas también lo ve', async () => {
    const respuesta = await pedir('GET', '/ajustes/clientes', tokens.usuarios_de_sistema);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.ok(Array.isArray(respuesta.body.clientes));
  });

  test('la recepcionista y el contador reciben 403', async () => {
    for (const rol of ['recepcionista', 'contador']) {
      const respuesta = await pedir('GET', '/ajustes/clientes', tokens[rol]);
      assert.strictEqual(respuesta.statusCode, 403, rol);
      assert.ok(respuesta.body.mensaje);
    }
  });

  test('sin sesión responde 401', async () => {
    const respuesta = await pedir('GET', '/ajustes/clientes');
    assert.strictEqual(respuesta.statusCode, 401);
  });
});
