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
 * Rebanada 56c: lecturas nuevas de Ajustes > Clientes.
 * - GET /ajustes/clientes trae email y telefono, y también le responde a la recepcionista.
 * - GET /ajustes/contadores lista las cuentas que pueden llevar clientes (regla `puedeLlevarClientes`).
 * Requiere MariaDB (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
const cuentas = {};
const tokens = {};
let idCliente;

const pedir = (metodo, ruta, token, cuerpo) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);

describe('lecturas de Ajustes > Clientes (56c)', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista', 'contador', 'auxiliar']) {
      cuentas[rol] = await crearUsuarioDePrueba(rol);
      tokens[rol] = await iniciarSesion(servidor.puerto, cuentas[rol].correo, cuentas[rol].password);
    }
    // Una recepcionista con rol Contador en Documentos también puede llevar clientes.
    cuentas.recepConRol = await crearUsuarioDePrueba('recepcionista');
    await query("INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', 'contador')", [
      cuentas.recepConRol.id,
    ]);
    // El contador de la cuenta también es Contador en Documentos: prueba la marca contador_documentos.
    await query("INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', 'contador')", [
      cuentas.contador.id,
    ]);
    const alta = await query(
      "INSERT INTO clientes (usuario_id, clave, nombre, rfc, email, telefono, activo, creado_en) VALUES (NULL, 'ZT56', 'zz_test_ Cliente 56c', 'XAXX010101000', 'zz_test_@ejemplo.com', '5551234567', 1, NOW())"
    );
    idCliente = alta.insertId;
  });

  after(async () => {
    await query("DELETE FROM clientes WHERE nombre LIKE 'zz\\_test\\_%'");
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  describe('GET /ajustes/clientes', () => {
    test('cada cliente trae email y telefono además de los campos de antes', async () => {
      const respuesta = await pedir('GET', '/ajustes/clientes', tokens.administrador);
      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      const cliente = respuesta.body.clientes.find((c) => c.id === idCliente);
      assert.strictEqual(cliente.email, 'zz_test_@ejemplo.com');
      assert.strictEqual(cliente.telefono, '5551234567');
      assert.strictEqual(cliente.clave, 'ZT56');
      assert.strictEqual(cliente.rfc, 'XAXX010101000');
      assert.deepStrictEqual(cliente.contadores, []);
    });

    test('un cliente sin correo ni teléfono los trae en null', async () => {
      const sin = await query(
        "INSERT INTO clientes (usuario_id, clave, nombre, activo, creado_en) VALUES (NULL, 'ZT57', 'zz_test_ Cliente sin datos 56c', 1, NOW())"
      );
      const respuesta = await pedir('GET', '/ajustes/clientes', tokens.administrador);
      const cliente = respuesta.body.clientes.find((c) => c.id === sin.insertId);
      assert.strictEqual(cliente.email, null);
      assert.strictEqual(cliente.telefono, null);
    });

    test('administrador, sistemas y recepcionista reciben la misma lista', async () => {
      const cuerpos = [];
      for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista']) {
        const respuesta = await pedir('GET', '/ajustes/clientes', tokens[rol]);
        assert.strictEqual(respuesta.statusCode, 200, rol);
        cuerpos.push(respuesta.body);
      }
      assert.deepStrictEqual(cuerpos[1], cuerpos[0]);
      assert.deepStrictEqual(cuerpos[2], cuerpos[0]);
    });

    test('el contador y el auxiliar siguen en 403', async () => {
      for (const rol of ['contador', 'auxiliar']) {
        const respuesta = await pedir('GET', '/ajustes/clientes', tokens[rol]);
        assert.strictEqual(respuesta.statusCode, 403, rol);
      }
    });

    test('la recepcionista sigue sin poder editar ni cambiar contadores', async () => {
      const patch = await pedir('PATCH', `/ajustes/clientes/${idCliente}`, tokens.recepcionista, { telefono: '5550000000' });
      const put = await pedir('PUT', `/ajustes/clientes/${idCliente}/contadores`, tokens.recepcionista, { contadores: [] });
      assert.strictEqual(patch.statusCode, 403);
      assert.strictEqual(put.statusCode, 403);
    });
  });

  describe('GET /ajustes/contadores', () => {
    test('lista contadores, auxiliares y recepcionistas con rol Contador en Documentos, solo con id, nombre, rol y marca', async () => {
      const respuesta = await pedir('GET', '/ajustes/contadores', tokens.administrador);
      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      const porId = new Map(respuesta.body.contadores.map((c) => [c.id, c]));
      assert.ok(porId.has(cuentas.contador.id), 'contador');
      assert.ok(porId.has(cuentas.auxiliar.id), 'auxiliar');
      assert.ok(porId.has(cuentas.recepConRol.id), 'recepcionista con rol Contador en Documentos');
      assert.deepStrictEqual(porId.get(cuentas.contador.id), {
        id: cuentas.contador.id,
        nombre: cuentas.contador.nombre,
        rol: 'contador',
        contador_documentos: true,
      });
      assert.strictEqual(porId.get(cuentas.auxiliar.id).rol, 'auxiliar');
      assert.strictEqual(porId.get(cuentas.auxiliar.id).contador_documentos, false);
      assert.strictEqual(porId.get(cuentas.recepConRol.id).rol, 'recepcionista');
      assert.strictEqual(porId.get(cuentas.recepConRol.id).contador_documentos, true);
      for (const cuenta of respuesta.body.contadores) {
        assert.deepStrictEqual(Object.keys(cuenta).sort(), ['contador_documentos', 'id', 'nombre', 'rol']);
      }
    });

    test('no incluye al administrador, a sistemas ni a la recepcionista sin rol de contador', async () => {
      const respuesta = await pedir('GET', '/ajustes/contadores', tokens.administrador);
      const ids = respuesta.body.contadores.map((c) => c.id);
      assert.ok(!ids.includes(cuentas.administrador.id));
      assert.ok(!ids.includes(cuentas.usuarios_de_sistema.id));
      assert.ok(!ids.includes(cuentas.recepcionista.id));
    });

    test('viene ordenada por nombre', async () => {
      const respuesta = await pedir('GET', '/ajustes/contadores', tokens.administrador);
      // Solo las cuentas de prueba: la colación de la base y localeCompare difieren con acentos de cuentas reales.
      const nombres = respuesta.body.contadores.map((c) => c.nombre).filter((n) => n.startsWith('zz_test_'));
      assert.ok(nombres.length >= 3);
      assert.deepStrictEqual(nombres, [...nombres].sort());
    });

    test('administrador, sistemas y recepcionista pueden leerla; contador y auxiliar reciben 403', async () => {
      for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista']) {
        assert.strictEqual((await pedir('GET', '/ajustes/contadores', tokens[rol])).statusCode, 200, rol);
      }
      for (const rol of ['contador', 'auxiliar']) {
        assert.strictEqual((await pedir('GET', '/ajustes/contadores', tokens[rol])).statusCode, 403, rol);
      }
    });

    test('sin sesión responde 401', async () => {
      assert.strictEqual((await pedir('GET', '/ajustes/contadores')).statusCode, 401);
    });

    test('no entrega correo ni contraseña de nadie', async () => {
      const respuesta = await pedir('GET', '/ajustes/contadores', tokens.administrador);
      const texto = JSON.stringify(respuesta.body);
      assert.ok(!texto.includes(cuentas.contador.correo));
      assert.ok(!/password|hash|correo/i.test(texto));
    });
  });
});
