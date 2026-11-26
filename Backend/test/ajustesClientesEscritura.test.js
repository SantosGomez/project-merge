const assert = require('node:assert');
const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const bitacora = require('../src/utils/bitacoraSeguridad');
const ClienteModel = require('../src/models/ClienteModel');
const ClienteContadorModel = require('../src/models/ClienteContadorModel');

/**
 * Rebanada 56a: escrituras del catálogo de clientes en Ajustes.
 * POST /ajustes/clientes (administrador, sistemas y recepcionista), PATCH /ajustes/clientes/:id y
 * PUT /ajustes/clientes/:id/contadores (administrador y sistemas).
 * Requiere MariaDB (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
const cuentas = {};
const tokens = {};
let contadorA;
let contadorB;
let contadorSinRol;
let secuencia = 0;
let lineas;
let restaurar;

const pedir = (metodo, ruta, token, cuerpo) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);
const eventos = (nombre) => lineas.map((l) => JSON.parse(l)).filter((e) => e.evento === nombre);

// Claves de prueba únicas dentro de la corrida: ZT01, ZT02…
const claveNueva = () => `ZT${String((secuencia += 1)).padStart(2, '0')}`;
const nombreNuevo = (texto) => `zz_test_ ${texto} ${secuencia}`;

/** Un cuerpo de alta válido; `extra` pisa campos. */
function altaValida(extra = {}) {
  const clave = claveNueva();
  return { clave, nombre: nombreNuevo('Cliente'), ...extra };
}

async function darRolContador(usuarioId) {
  await query(
    "INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', 'contador') ON DUPLICATE KEY UPDATE rol = VALUES(rol)",
    [usuarioId]
  );
}

async function crearViaApi(extra = {}, token = tokens.administrador) {
  const respuesta = await pedir('POST', '/ajustes/clientes', token, altaValida(extra));
  assert.strictEqual(respuesta.statusCode, 201, JSON.stringify(respuesta.body));
  return respuesta.body.cliente;
}

async function filaDe(id) {
  const [fila] = await query('SELECT * FROM clientes WHERE id = ?', [id]);
  return fila;
}

const totalClientes = async () => Number((await query('SELECT COUNT(*) AS n FROM clientes'))[0].n);

/** Verifica que el cuerpo del error siga el formato de seguimiento: «qué pasó sobre X: qué hacer». */
function assertTresPartes(cuerpo, contexto) {
  assert.ok(cuerpo && typeof cuerpo.mensaje === 'string', `${contexto}: falta el mensaje`);
  assert.match(cuerpo.mensaje, / sobre .+: .+/, `${contexto}: ${cuerpo.mensaje}`);
}

describe('escrituras de Ajustes > Clientes (rebanada 56a)', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista', 'contador']) {
      cuentas[rol] = await crearUsuarioDePrueba(rol);
      tokens[rol] = await iniciarSesion(servidor.puerto, cuentas[rol].correo, cuentas[rol].password);
    }
    contadorA = cuentas.contador;
    contadorB = await crearUsuarioDePrueba('contador');
    contadorSinRol = await crearUsuarioDePrueba('contador');
    await darRolContador(contadorA.id);
    await darRolContador(contadorB.id);
    const ocupadas = await query("SELECT clave FROM clientes WHERE clave LIKE 'ZT__'");
    assert.deepStrictEqual(ocupadas, [], 'las claves ZTnn de prueba deben estar libres');
  });

  beforeEach(() => {
    lineas = [];
    restaurar = bitacora.configurarSalida((linea) => lineas.push(linea));
  });

  afterEach(() => restaurar());

  after(async () => {
    await servidor.cerrar();
    await query("DELETE FROM clientes WHERE nombre LIKE 'zz\\_test\\_%'");
    await limpiarDatosDePrueba();
    const [restos] = await query("SELECT COUNT(*) AS n FROM clientes WHERE nombre LIKE 'zz\\_test\\_%'");
    assert.strictEqual(Number(restos.n), 0, 'no deben quedar clientes zz_test_');
    await cerrarBaseDeDatos();
  });

  describe('permisos', () => {
    test('sin sesión las tres rutas responden 401', async () => {
      assert.strictEqual((await pedir('POST', '/ajustes/clientes', undefined, altaValida())).statusCode, 401);
      assert.strictEqual((await pedir('PATCH', '/ajustes/clientes/1', undefined, { activo: false })).statusCode, 401);
      assert.strictEqual((await pedir('PUT', '/ajustes/clientes/1/contadores', undefined, { contadores: [] })).statusCode, 401);
    });

    test('administrador, sistemas y recepcionista pueden dar de alta; el contador recibe 403', async () => {
      const antes = await totalClientes();
      for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista']) {
        const respuesta = await pedir('POST', '/ajustes/clientes', tokens[rol], altaValida());
        assert.strictEqual(respuesta.statusCode, 201, `${rol}: ${JSON.stringify(respuesta.body)}`);
      }
      const rechazada = await pedir('POST', '/ajustes/clientes', tokens.contador, altaValida());
      assert.strictEqual(rechazada.statusCode, 403);
      assert.ok(rechazada.body.mensaje);
      assert.strictEqual(await totalClientes(), antes + 3, 'el rechazado no crea nada');
    });

    test('editar y cambiar contadores: administrador y sistemas sí; recepcionista y contador reciben 403 sin cambiar nada', async () => {
      const cliente = await crearViaApi();
      for (const rol of ['administrador', 'usuarios_de_sistema']) {
        const editado = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens[rol], { telefono: '5551112222' });
        assert.strictEqual(editado.statusCode, 200, `${rol}: ${JSON.stringify(editado.body)}`);
        const reemplazado = await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens[rol], { contadores: [] });
        assert.strictEqual(reemplazado.statusCode, 200, `${rol}: ${JSON.stringify(reemplazado.body)}`);
      }
      for (const rol of ['recepcionista', 'contador']) {
        const editado = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens[rol], { nombre: nombreNuevo('Intruso') });
        assert.strictEqual(editado.statusCode, 403, rol);
        const reemplazado = await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens[rol], {
          contadores: [contadorA.id],
        });
        assert.strictEqual(reemplazado.statusCode, 403, rol);
      }
      const fila = await filaDe(cliente.id);
      assert.strictEqual(fila.nombre, cliente.nombre, 'el nombre no cambió');
      assert.deepStrictEqual(await ClienteContadorModel.contadoresDe(cliente.id), [], 'los contadores no cambiaron');
    });
  });

  describe('POST /ajustes/clientes', () => {
    test('alta válida: 201 con el cliente y su lista de contadores, el primero es el principal', async () => {
      const cuerpo = altaValida({
        clave: 'zt90',
        rfc: ' abc010101xy1 ',
        email: 'cliente@ejemplo.com',
        telefono: '5551234567',
        contadores: [contadorB.id, contadorA.id],
      });
      const respuesta = await pedir('POST', '/ajustes/clientes', tokens.administrador, cuerpo);

      assert.strictEqual(respuesta.statusCode, 201, JSON.stringify(respuesta.body));
      const { cliente } = respuesta.body;
      assert.strictEqual(cliente.clave, 'ZT90');
      assert.strictEqual(cliente.nombre, cuerpo.nombre);
      assert.strictEqual(cliente.rfc, 'ABC010101XY1');
      assert.strictEqual(cliente.email, 'cliente@ejemplo.com');
      assert.strictEqual(cliente.telefono, '5551234567');
      assert.strictEqual(cliente.activo, true);
      assert.deepStrictEqual(cliente.contadores, [
        { id: contadorB.id, nombre: contadorB.nombre },
        { id: contadorA.id, nombre: contadorA.nombre },
      ]);
      assert.strictEqual(cliente.contador_id, contadorB.id);
      assert.strictEqual(cliente.contador_nombre, contadorB.nombre);

      const fila = await filaDe(cliente.id);
      assert.strictEqual(fila.usuario_id, contadorB.id, 'clientes.usuario_id queda en el principal');
      assert.strictEqual(fila.clave, 'ZT90');
      assert.strictEqual(fila.activo, 1);
      const [enLista] = (await pedir('GET', '/ajustes/clientes', tokens.administrador)).body.clientes.filter((c) => c.id === cliente.id);
      assert.strictEqual(enLista.contador_id, contadorB.id);
    });

    test('sin contadores ni datos opcionales: se crea sin contador', async () => {
      const cliente = await crearViaApi();
      assert.deepStrictEqual(cliente.contadores, []);
      assert.strictEqual(cliente.contador_id, null);
      assert.strictEqual(cliente.rfc, null);
      assert.strictEqual(cliente.email, null);
      assert.strictEqual((await filaDe(cliente.id)).usuario_id, null);
    });

    test('la recepcionista puede dar de alta con contadores', async () => {
      const cliente = await crearViaApi({ contadores: [contadorA.id] }, tokens.recepcionista);
      assert.deepStrictEqual(cliente.contadores, [{ id: contadorA.id, nombre: contadorA.nombre }]);
    });

    test('datos inválidos: 400 en tres partes y no se crea nada', async () => {
      const antes = await totalClientes();
      const casos = [
        ['sin clave', { clave: undefined }],
        ['clave vacía', { clave: '   ' }],
        ['clave de más de 4 caracteres', { clave: 'ABCDE' }],
        ['clave con espacios', { clave: 'A B' }],
        ['sin nombre', { nombre: undefined }],
        ['nombre vacío', { nombre: '  ' }],
        ['nombre de más de 150 caracteres', { nombre: 'zz_test_ ' + 'x'.repeat(150) }],
        ['RFC mal formado', { rfc: 'RFC-MALO' }],
        ['correo inválido', { email: 'no-es-correo' }],
        ['teléfono de más de 20 caracteres', { telefono: '1'.repeat(21) }],
        ['contadores que no es lista', { contadores: 'uno' }],
        ['contador que no es número', { contadores: ['abc'] }],
        ['contador repetido en la lista', { contadores: [contadorA.id, contadorA.id] }],
        ['contador que no existe', { contadores: [2147483000] }],
        ['contador sin rol Contador en Documentos', { contadores: [contadorSinRol.id] }],
        ['contador que es administrador', { contadores: [cuentas.administrador.id] }],
      ];
      for (const [descripcion, extra] of casos) {
        const cuerpo = altaValida(extra);
        for (const [campo, valor] of Object.entries(extra)) if (valor === undefined) delete cuerpo[campo];
        const respuesta = await pedir('POST', '/ajustes/clientes', tokens.administrador, cuerpo);
        assert.strictEqual(respuesta.statusCode, 400, `${descripcion}: ${JSON.stringify(respuesta.body)}`);
        assertTresPartes(respuesta.body, descripcion);
      }
      assert.strictEqual(await totalClientes(), antes, 'ninguna alta inválida crea un cliente');
    });

    test('el mensaje de una clave ausente nombra la clave', async () => {
      const cuerpo = altaValida();
      delete cuerpo.clave;
      const respuesta = await pedir('POST', '/ajustes/clientes', tokens.administrador, cuerpo);
      assert.match(respuesta.body.mensaje, /sobre (la )?clave/i);
    });

    test('nombre repetido (aunque cambie en mayúsculas o acentos): 409 y no crea otro', async () => {
      const original = await crearViaApi({ nombre: 'zz_test_ Peña Repetida' });
      const antes = await totalClientes();
      for (const repetido of ['zz_test_ Peña Repetida', 'ZZ_TEST_ PEÑA REPETIDA', 'zz_test_ pena repetida']) {
        const respuesta = await pedir('POST', '/ajustes/clientes', tokens.administrador, altaValida({ nombre: repetido }));
        assert.strictEqual(respuesta.statusCode, 409, `${repetido}: ${JSON.stringify(respuesta.body)}`);
        assert.match(respuesta.body.mensaje, /Ya existe un cliente con ese nombre/);
        assertTresPartes(respuesta.body, repetido);
      }
      assert.strictEqual(await totalClientes(), antes);
      assert.ok(original.id);
    });

    test('clave repetida: 409', async () => {
      const original = await crearViaApi();
      const respuesta = await pedir('POST', '/ajustes/clientes', tokens.administrador, altaValida({ clave: original.clave.toLowerCase() }));
      assert.strictEqual(respuesta.statusCode, 409, JSON.stringify(respuesta.body));
      assert.match(respuesta.body.mensaje, /Ya existe un cliente con esa clave/);
      assertTresPartes(respuesta.body, 'clave repetida');
    });

    test('registra el alta en la bitácora sin datos del cliente', async () => {
      const cliente = await crearViaApi({ rfc: 'ABC010101XY1' });
      const [evento] = eventos('cliente_catalogo_creado');
      assert.ok(evento, 'falta el evento de alta');
      assert.strictEqual(evento.clienteId, cliente.id);
      assert.strictEqual(evento.rol, 'administrador');
      assert.ok(!JSON.stringify(evento).includes('ABC010101XY1'), 'la bitácora no lleva el RFC');
    });
  });

  describe('PATCH /ajustes/clientes/:id', () => {
    test('cambia solo los campos enviados y no toca a los contadores', async () => {
      const cliente = await crearViaApi({ rfc: 'ABC010101XY1', email: 'viejo@ejemplo.com', contadores: [contadorA.id, contadorB.id] });
      const nuevoNombre = nombreNuevo('Renombrado');
      const respuesta = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.administrador, { nombre: nuevoNombre });

      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      assert.strictEqual(respuesta.body.cliente.nombre, nuevoNombre);
      assert.strictEqual(respuesta.body.cliente.clave, cliente.clave);
      assert.strictEqual(respuesta.body.cliente.rfc, 'ABC010101XY1');
      assert.strictEqual(respuesta.body.cliente.email, 'viejo@ejemplo.com');
      assert.deepStrictEqual(respuesta.body.cliente.contadores.map((c) => c.id), [contadorA.id, contadorB.id]);

      const todo = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.usuarios_de_sistema, {
        clave: 'zt91',
        rfc: 'xaxx010101000',
        email: 'nuevo@ejemplo.com',
        telefono: '5550000000',
      });
      assert.strictEqual(todo.statusCode, 200, JSON.stringify(todo.body));
      assert.strictEqual(todo.body.cliente.clave, 'ZT91');
      assert.strictEqual(todo.body.cliente.rfc, 'XAXX010101000');
      assert.strictEqual(todo.body.cliente.email, 'nuevo@ejemplo.com');
      assert.strictEqual(todo.body.cliente.telefono, '5550000000');
      assert.strictEqual(todo.body.cliente.nombre, nuevoNombre);
      assert.deepStrictEqual((await ClienteContadorModel.contadoresDe(cliente.id)).map((c) => c.id), [contadorA.id, contadorB.id]);
    });

    test('permite borrar el RFC, el correo y el teléfono enviándolos vacíos', async () => {
      const cliente = await crearViaApi({ rfc: 'ABC010101XY1', email: 'a@ejemplo.com', telefono: '555' });
      const respuesta = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.administrador, { rfc: '', email: null, telefono: '' });
      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      assert.strictEqual(respuesta.body.cliente.rfc, null);
      assert.strictEqual(respuesta.body.cliente.email, null);
      assert.strictEqual(respuesta.body.cliente.telefono, null);
    });

    test('desactivar y reactivar', async () => {
      const cliente = await crearViaApi();
      const apagado = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.administrador, { activo: false });
      assert.strictEqual(apagado.statusCode, 200);
      assert.strictEqual(apagado.body.cliente.activo, false);
      assert.strictEqual((await filaDe(cliente.id)).activo, 0);
      const encendido = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.administrador, { activo: true });
      assert.strictEqual(encendido.body.cliente.activo, true);
      assert.strictEqual((await filaDe(cliente.id)).activo, 1);
    });

    test('datos inválidos: 400 en tres partes y el cliente queda igual', async () => {
      const cliente = await crearViaApi();
      const casos = [
        ['sin ningún campo', {}],
        ['activo que no es booleano', { activo: 'no' }],
        ['nombre vacío', { nombre: '   ' }],
        ['clave vacía (es obligatoria)', { clave: '' }],
        ['clave con espacios', { clave: 'A B' }],
        ['RFC mal formado', { rfc: '123' }],
        ['correo inválido', { email: 'x' }],
        ['teléfono largo', { telefono: '9'.repeat(25) }],
      ];
      for (const [descripcion, cuerpo] of casos) {
        const respuesta = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.administrador, cuerpo);
        assert.strictEqual(respuesta.statusCode, 400, `${descripcion}: ${JSON.stringify(respuesta.body)}`);
        assertTresPartes(respuesta.body, descripcion);
      }
      const fila = await filaDe(cliente.id);
      assert.strictEqual(fila.nombre, cliente.nombre);
      assert.strictEqual(fila.clave, cliente.clave);
    });

    test('un cliente que no existe responde 404 y un id mal escrito 400', async () => {
      const inexistente = await pedir('PATCH', '/ajustes/clientes/2147483000', tokens.administrador, { activo: false });
      assert.strictEqual(inexistente.statusCode, 404);
      assertTresPartes(inexistente.body, '404');
      const mal = await pedir('PATCH', '/ajustes/clientes/abc', tokens.administrador, { activo: false });
      assert.strictEqual(mal.statusCode, 400);
    });

    test('renombrar a un nombre o una clave que ya tiene otro cliente: 409 y nada cambia', async () => {
      const uno = await crearViaApi({ nombre: 'zz_test_ Nombre Uno' });
      const dos = await crearViaApi();
      const nombreRepetido = await pedir('PATCH', `/ajustes/clientes/${dos.id}`, tokens.administrador, { nombre: 'ZZ_TEST_ NOMBRE UNO' });
      assert.strictEqual(nombreRepetido.statusCode, 409, JSON.stringify(nombreRepetido.body));
      assert.match(nombreRepetido.body.mensaje, /Ya existe un cliente con ese nombre/);
      const claveRepetida = await pedir('PATCH', `/ajustes/clientes/${dos.id}`, tokens.administrador, { clave: uno.clave });
      assert.strictEqual(claveRepetida.statusCode, 409, JSON.stringify(claveRepetida.body));
      assert.match(claveRepetida.body.mensaje, /Ya existe un cliente con esa clave/);
      assert.strictEqual((await filaDe(dos.id)).nombre, dos.nombre);
      assert.strictEqual((await filaDe(dos.id)).clave, dos.clave);
    });

    test('conservar su propio nombre o clave (o cambiar solo mayúsculas) no choca consigo mismo', async () => {
      const cliente = await crearViaApi({ nombre: 'zz_test_ Mismo Nombre' });
      const respuesta = await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.administrador, {
        nombre: 'ZZ_TEST_ MISMO NOMBRE',
        clave: cliente.clave,
      });
      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      assert.strictEqual(respuesta.body.cliente.nombre, 'ZZ_TEST_ MISMO NOMBRE');
    });

    test('registra la edición en la bitácora con los campos cambiados, sin sus valores', async () => {
      const cliente = await crearViaApi();
      await pedir('PATCH', `/ajustes/clientes/${cliente.id}`, tokens.usuarios_de_sistema, { activo: false, telefono: '5559998888' });
      const [evento] = eventos('cliente_catalogo_editado');
      assert.ok(evento, 'falta el evento de edición');
      assert.strictEqual(evento.clienteId, cliente.id);
      assert.strictEqual(evento.rol, 'usuarios_de_sistema');
      assert.match(evento.campos, /activo/);
      assert.match(evento.campos, /telefono/);
      assert.ok(!JSON.stringify(evento).includes('5559998888'));
    });
  });

  describe('PUT /ajustes/clientes/:id/contadores', () => {
    test('reemplaza el conjunto: uno, varios (el primero es el principal), y vacío', async () => {
      const cliente = await crearViaApi();
      const uno = await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens.administrador, { contadores: [contadorA.id] });
      assert.strictEqual(uno.statusCode, 200, JSON.stringify(uno.body));
      assert.deepStrictEqual(uno.body.cliente.contadores, [{ id: contadorA.id, nombre: contadorA.nombre }]);
      assert.strictEqual(uno.body.cliente.contador_id, contadorA.id);

      const varios = await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens.usuarios_de_sistema, {
        contadores: [contadorB.id, contadorA.id],
      });
      assert.deepStrictEqual(varios.body.cliente.contadores.map((c) => c.id), [contadorB.id, contadorA.id]);
      assert.strictEqual(varios.body.cliente.contador_id, contadorB.id, 'el primero de la lista es el principal');
      assert.strictEqual((await filaDe(cliente.id)).usuario_id, contadorB.id);

      const vacio = await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens.administrador, { contadores: [] });
      assert.strictEqual(vacio.statusCode, 200);
      assert.deepStrictEqual(vacio.body.cliente.contadores, []);
      assert.strictEqual(vacio.body.cliente.contador_id, null);
      assert.strictEqual((await filaDe(cliente.id)).usuario_id, null);
    });

    test('lista inválida: 400 en tres partes y el conjunto no cambia', async () => {
      const cliente = await crearViaApi({ contadores: [contadorA.id] });
      const casos = [
        ['sin la lista', {}],
        ['lista que no es arreglo', { contadores: contadorA.id }],
        ['id que no es número', { contadores: ['x'] }],
        ['id repetido', { contadores: [contadorB.id, contadorB.id] }],
        ['id inexistente', { contadores: [contadorB.id, 2147483000] }],
        ['contador sin rol Contador en Documentos', { contadores: [contadorSinRol.id] }],
        ['cuenta con otro rol', { contadores: [cuentas.recepcionista.id] }],
      ];
      for (const [descripcion, cuerpo] of casos) {
        const respuesta = await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens.administrador, cuerpo);
        assert.strictEqual(respuesta.statusCode, 400, `${descripcion}: ${JSON.stringify(respuesta.body)}`);
        assertTresPartes(respuesta.body, descripcion);
      }
      assert.deepStrictEqual((await ClienteContadorModel.contadoresDe(cliente.id)).map((c) => c.id), [contadorA.id]);
    });

    test('un cliente que no existe responde 404', async () => {
      const respuesta = await pedir('PUT', '/ajustes/clientes/2147483000/contadores', tokens.administrador, { contadores: [contadorA.id] });
      assert.strictEqual(respuesta.statusCode, 404);
      assertTresPartes(respuesta.body, '404');
    });

    test('registra el cambio de contadores en la bitácora', async () => {
      const cliente = await crearViaApi();
      await pedir('PUT', `/ajustes/clientes/${cliente.id}/contadores`, tokens.administrador, { contadores: [contadorA.id, contadorB.id] });
      const [evento] = eventos('cliente_catalogo_contadores');
      assert.ok(evento, 'falta el evento de contadores');
      assert.strictEqual(evento.clienteId, cliente.id);
      assert.strictEqual(evento.cantidad, 2);
    });
  });

  describe('modelo ClienteModel del catálogo', () => {
    test('crearEnCatalogo hace rollback completo si un contador falla a la mitad', async () => {
      const antes = await totalClientes();
      const nombre = nombreNuevo('Rollback');
      await assert.rejects(
        ClienteModel.crearEnCatalogo({ clave: claveNueva(), nombre, rfc: null, email: null, telefono: null }, [contadorA.id, 2147483000])
      );
      assert.strictEqual(await totalClientes(), antes, 'el INSERT del cliente se deshace');
      assert.deepStrictEqual(await query('SELECT id FROM clientes WHERE nombre = ?', [nombre]), []);
    });

    test('los duplicados salen con código NOMBRE_REPETIDO o CLAVE_REPETIDA', async () => {
      const cliente = await crearViaApi({ nombre: 'zz_test_ Codigos' });
      await assert.rejects(
        ClienteModel.crearEnCatalogo({ clave: claveNueva(), nombre: 'ZZ_TEST_ CÓDIGOS', rfc: null, email: null, telefono: null }, []),
        (error) => error.codigo === 'NOMBRE_REPETIDO'
      );
      await assert.rejects(
        ClienteModel.crearEnCatalogo({ clave: cliente.clave, nombre: nombreNuevo('Otro'), rfc: null, email: null, telefono: null }, []),
        (error) => error.codigo === 'CLAVE_REPETIDA'
      );
    });

    test('buscarDelCatalogo devuelve null si no existe', async () => {
      assert.strictEqual(await ClienteModel.buscarDelCatalogo(2147483000), null);
    });
  });
});
