const assert = require('node:assert');
const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query, pool } = require('../src/config/db');
const bitacora = require('../src/utils/bitacoraSeguridad');
const ClienteContadorModel = require('../src/models/ClienteContadorModel');

/**
 * Rebanada 56b: cartera propia de clientes (vincular y quitar del catálogo) y la regla única de quién
 * puede llevar clientes. Requiere MariaDB (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
const cuentas = {};
const tokens = {};
let contadorB;
let adminConDocumentos;
let lineas;
let restaurar;
let secuencia = 0;

const pedir = (metodo, ruta, token, cuerpo) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);
const eventos = (nombre) => lineas.map((l) => JSON.parse(l)).filter((e) => e.evento === nombre);
const totalClientes = async () => Number((await query('SELECT COUNT(*) AS n FROM clientes'))[0].n);

/** Verifica el formato de seguimiento: «qué pasó sobre X: qué hacer». */
function assertTresPartes(cuerpo, contexto) {
  assert.ok(cuerpo && typeof cuerpo.mensaje === 'string', `${contexto}: falta el mensaje`);
  assert.match(cuerpo.mensaje, / sobre .+: .+/, `${contexto}: ${cuerpo.mensaje}`);
}

/** Crea un cliente de prueba directo en la base (sin contadores). */
async function crearCliente(nombre, { activo = 1, clave = null } = {}) {
  secuencia += 1;
  const resultado = await query(
    'INSERT INTO clientes (clave, usuario_id, nombre, activo, creado_en) VALUES (?, NULL, ?, ?, NOW())',
    [clave, `zz_test_ ${nombre} ${secuencia}`, activo]
  );
  return resultado.insertId;
}

async function darRolEnDocumentos(usuarioId, rol) {
  await query(
    'INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE rol = VALUES(rol)',
    [usuarioId, 'documentos', rol]
  );
}

async function estadoDe(clienteId) {
  const filas = await query(
    'SELECT usuario_id FROM cliente_contador WHERE cliente_id = ? ORDER BY asignado_en, usuario_id',
    [clienteId]
  );
  const [cliente] = await query('SELECT usuario_id, activo FROM clientes WHERE id = ?', [clienteId]);
  return { contadores: filas.map((f) => f.usuario_id), principal: cliente.usuario_id, activo: cliente.activo };
}

describe('cartera propia de clientes (rebanada 56b)', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista', 'contador', 'auxiliar']) {
      cuentas[rol] = await crearUsuarioDePrueba(rol);
      tokens[rol] = await iniciarSesion(servidor.puerto, cuentas[rol].correo, cuentas[rol].password);
    }
    contadorB = await crearUsuarioDePrueba('contador');
    tokens.contadorB = await iniciarSesion(servidor.puerto, contadorB.correo, contadorB.password);
    adminConDocumentos = await crearUsuarioDePrueba('administrador');
    await darRolEnDocumentos(adminConDocumentos.id, 'contador');
    tokens.adminConDocumentos = await iniciarSesion(servidor.puerto, adminConDocumentos.correo, adminConDocumentos.password);
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

  describe('regla única «puede llevar clientes»', () => {
    test('contador, auxiliar y quien tiene Contador en Documentos pueden; el resto no', async () => {
      const aprobados = [cuentas.contador.id, cuentas.auxiliar.id, adminConDocumentos.id];
      const rechazados = [cuentas.administrador.id, cuentas.usuarios_de_sistema.id, cuentas.recepcionista.id];
      assert.deepStrictEqual(await ClienteContadorModel.idsQueNoPuedenLlevarClientes(aprobados), []);
      assert.deepStrictEqual(
        (await ClienteContadorModel.idsQueNoPuedenLlevarClientes(rechazados)).sort((a, b) => a - b),
        [...rechazados].sort((a, b) => a - b)
      );
    });

    test('un id que no existe no puede y la lista vacía no devuelve nada', async () => {
      assert.deepStrictEqual(await ClienteContadorModel.idsQueNoPuedenLlevarClientes([2147483000]), [2147483000]);
      assert.deepStrictEqual(await ClienteContadorModel.idsQueNoPuedenLlevarClientes([]), []);
    });

    test('un rol de Documentos distinto de Contador no basta (un administrador con rol Recepcionista en Documentos)', async () => {
      const otro = await crearUsuarioDePrueba('administrador');
      await darRolEnDocumentos(otro.id, 'recepcionista');
      assert.deepStrictEqual(await ClienteContadorModel.idsQueNoPuedenLlevarClientes([otro.id]), [otro.id]);
      assert.strictEqual(await ClienteContadorModel.puedeLlevarClientes(otro.id), false);
      assert.strictEqual(await ClienteContadorModel.puedeLlevarClientes(cuentas.auxiliar.id), true);
    });

    test('Ajustes acepta a un auxiliar y a un contador sin rol en Documentos, y rechaza a un administrador sin rol', async () => {
      const cliente = await crearCliente('Regla ajustes');
      const bien = await pedir('PUT', `/ajustes/clientes/${cliente}/contadores`, tokens.administrador, {
        contadores: [cuentas.auxiliar.id, cuentas.contador.id],
      });
      assert.strictEqual(bien.statusCode, 200, JSON.stringify(bien.body));
      assert.deepStrictEqual((await estadoDe(cliente)).contadores, [cuentas.auxiliar.id, cuentas.contador.id]);

      const mal = await pedir('PUT', `/ajustes/clientes/${cliente}/contadores`, tokens.administrador, {
        contadores: [cuentas.administrador.id],
      });
      assert.strictEqual(mal.statusCode, 400);
      assertTresPartes(mal.body, 'administrador sin rol');
      assert.match(mal.body.mensaje, /contador, auxiliar|Contador en Documentos/);
      assert.deepStrictEqual((await estadoDe(cliente)).contadores, [cuentas.auxiliar.id, cuentas.contador.id]);
    });

    test('el alta de Ajustes con un auxiliar como contador funciona', async () => {
      secuencia += 1;
      const respuesta = await pedir('POST', '/ajustes/clientes', tokens.administrador, {
        clave: `ZV${String(secuencia).padStart(2, '0')}`,
        nombre: `zz_test_ alta con auxiliar ${secuencia}`,
        contadores: [cuentas.auxiliar.id],
      });
      assert.strictEqual(respuesta.statusCode, 201, JSON.stringify(respuesta.body));
      assert.strictEqual(respuesta.body.cliente.contador_id, cuentas.auxiliar.id);
    });
  });

  describe('permisos de las rutas nuevas', () => {
    const rutas = [
      ['GET', '/clientes/mi-cartera'],
      ['GET', '/clientes/catalogo'],
      ['POST', '/clientes/vinculos', { clienteIds: [2147483000] }],
      ['DELETE', '/clientes/vinculos/2147483000'],
    ];

    test('sin sesión responden 401', async () => {
      for (const [metodo, ruta, cuerpo] of rutas) {
        assert.strictEqual((await pedir(metodo, ruta, undefined, cuerpo)).statusCode, 401, `${metodo} ${ruta}`);
      }
    });

    test('administrador, sistemas y recepcionista sin la condición reciben 403', async () => {
      for (const rol of ['administrador', 'usuarios_de_sistema', 'recepcionista']) {
        for (const [metodo, ruta, cuerpo] of rutas) {
          const respuesta = await pedir(metodo, ruta, tokens[rol], cuerpo);
          assert.strictEqual(respuesta.statusCode, 403, `${rol} ${metodo} ${ruta}`);
          assertTresPartes(respuesta.body, `${rol} ${metodo} ${ruta}`);
        }
      }
    });

    test('contador, auxiliar y quien tiene Contador en Documentos entran (nunca 401 ni 403)', async () => {
      for (const quien of ['contador', 'auxiliar', 'adminConDocumentos']) {
        for (const [metodo, ruta, cuerpo] of rutas) {
          const respuesta = await pedir(metodo, ruta, tokens[quien], cuerpo);
          assert.ok(![401, 403].includes(respuesta.statusCode), `${quien} ${metodo} ${ruta}: ${respuesta.statusCode}`);
        }
      }
    });

    test('sin el módulo «Mis actividades» las rutas nuevas siguen abiertas, y GET /clientes se cierra', async () => {
      const anterior = process.env.USUARIOS_CON_ACTIVIDADES;
      process.env.USUARIOS_CON_ACTIVIDADES = '';
      try {
        assert.strictEqual((await pedir('GET', '/clientes/mi-cartera', tokens.contador)).statusCode, 200);
        assert.strictEqual((await pedir('GET', '/clientes/catalogo', tokens.contador)).statusCode, 200);
        assert.strictEqual((await pedir('GET', '/clientes', tokens.contador)).statusCode, 403);
      } finally {
        if (anterior === undefined) delete process.env.USUARIOS_CON_ACTIVIDADES;
        else process.env.USUARIOS_CON_ACTIVIDADES = anterior;
      }
    });
  });

  describe('GET /clientes/mi-cartera', () => {
    test('lista los vinculados (activos e inactivos) por nombre, solo con id, clave, nombre y activo', async () => {
      const zeta = await crearCliente('Cartera Zeta', { clave: 'ZQ01' });
      const alfa = await crearCliente('Cartera Alfa');
      const inactivo = await crearCliente('Cartera Beta inactivo', { activo: 0 });
      const ajeno = await crearCliente('Cartera Ajeno');
      // Una cuenta nueva: la cartera de las demás ya trae clientes de otras pruebas.
      const nuevo = await crearUsuarioDePrueba('contador');
      const token = await iniciarSesion(servidor.puerto, nuevo.correo, nuevo.password);
      for (const id of [zeta, alfa, inactivo]) await ClienteContadorModel.agregarContador(id, nuevo.id);
      await ClienteContadorModel.agregarContador(ajeno, contadorB.id);

      const respuesta = await pedir('GET', '/clientes/mi-cartera', token);
      assert.strictEqual(respuesta.statusCode, 200);
      assert.deepStrictEqual(
        respuesta.body.clientes.map((c) => c.id),
        [alfa, inactivo, zeta]
      );
      assert.deepStrictEqual(Object.keys(respuesta.body.clientes[0]).sort(), ['activo', 'clave', 'id', 'nombre']);
      assert.strictEqual(respuesta.body.clientes[1].activo, false);
      assert.strictEqual(respuesta.body.clientes[2].clave, 'ZQ01');
    });

    test('un cliente con dos contadores aparece en la cartera de los dos', async () => {
      const compartido = await crearCliente('Cartera compartida');
      await ClienteContadorModel.agregarContador(compartido, cuentas.contador.id);
      await ClienteContadorModel.agregarContador(compartido, contadorB.id);
      for (const token of [tokens.contador, tokens.contadorB]) {
        const respuesta = await pedir('GET', '/clientes/mi-cartera', token);
        assert.ok(respuesta.body.clientes.some((c) => c.id === compartido));
      }
    });

    test('una cuenta sin clientes recibe una lista vacía', async () => {
      const nuevo = await crearUsuarioDePrueba('auxiliar');
      const token = await iniciarSesion(servidor.puerto, nuevo.correo, nuevo.password);
      const respuesta = await pedir('GET', '/clientes/mi-cartera', token);
      assert.strictEqual(respuesta.statusCode, 200);
      assert.deepStrictEqual(respuesta.body.clientes, []);
    });
  });

  describe('GET /clientes/catalogo', () => {
    test('busca por nombre sin distinguir acentos ni mayúsculas y por clave', async () => {
      const id = await crearCliente('Peña Buscable', { clave: 'ZQ02' });
      const porNombre = await pedir('GET', '/clientes/catalogo?q=PENA%20buscable', tokens.contador);
      assert.strictEqual(porNombre.statusCode, 200);
      assert.deepStrictEqual(porNombre.body.clientes.map((c) => c.id), [id]);
      assert.deepStrictEqual(Object.keys(porNombre.body.clientes[0]).sort(), ['clave', 'id', 'nombre', 'vinculado']);
      const porClave = await pedir('GET', '/clientes/catalogo?q=zq02', tokens.contador);
      assert.deepStrictEqual(porClave.body.clientes.map((c) => c.id), [id]);
    });

    test('solo trae clientes activos', async () => {
      await crearCliente('Solo activos', { activo: 0 });
      const activo = await crearCliente('Solo activos', { activo: 1 });
      const respuesta = await pedir('GET', '/clientes/catalogo?q=zz_test_%20solo%20activos', tokens.contador);
      assert.deepStrictEqual(respuesta.body.clientes.map((c) => c.id), [activo]);
    });

    test('marca «vinculado» solo para quien consulta', async () => {
      const mio = await crearCliente('Marca vinculado A');
      const deOtro = await crearCliente('Marca vinculado B');
      await ClienteContadorModel.agregarContador(mio, cuentas.contador.id);
      await ClienteContadorModel.agregarContador(deOtro, contadorB.id);
      const respuesta = await pedir('GET', '/clientes/catalogo?q=zz_test_%20marca%20vinculado', tokens.contador);
      assert.deepStrictEqual(
        respuesta.body.clientes.map((c) => [c.id, c.vinculado]),
        [[mio, true], [deOtro, false]]
      );
    });

    test('los comodines % y _ del texto buscado se toman literales', async () => {
      const conPorcentaje = await crearCliente('Comodin 100%');
      await crearCliente('Comodin 100x');
      const conGuion = await crearCliente('Comodin a_b');
      await crearCliente('Comodin aXb');
      const porcentaje = await pedir('GET', `/clientes/catalogo?q=${encodeURIComponent('comodin 100%')}`, tokens.contador);
      assert.deepStrictEqual(porcentaje.body.clientes.map((c) => c.id), [conPorcentaje]);
      const guion = await pedir('GET', `/clientes/catalogo?q=${encodeURIComponent('comodin a_b')}`, tokens.contador);
      assert.deepStrictEqual(guion.body.clientes.map((c) => c.id), [conGuion]);
      const solo = await pedir('GET', `/clientes/catalogo?q=${encodeURIComponent('%')}`, tokens.contador);
      assert.ok(solo.body.clientes.length <= 50);
      assert.ok(solo.body.clientes.every((c) => c.nombre.includes('%') || (c.clave || '').includes('%')));
    });

    test('máximo 50 por llamada, 25 por omisión; un límite inválido da 400 en tres partes', async () => {
      for (let i = 1; i <= 55; i += 1) await crearCliente(`Limite ${String(i).padStart(2, '0')}`);
      const q = 'q=zz_test_%20limite';
      assert.strictEqual((await pedir('GET', `/clientes/catalogo?${q}`, tokens.contador)).body.clientes.length, 25);
      assert.strictEqual((await pedir('GET', `/clientes/catalogo?${q}&limite=10`, tokens.contador)).body.clientes.length, 10);
      assert.strictEqual((await pedir('GET', `/clientes/catalogo?${q}&limite=50`, tokens.contador)).body.clientes.length, 50);
      assert.strictEqual((await pedir('GET', `/clientes/catalogo?${q}&limite=999`, tokens.contador)).body.clientes.length, 50);
      for (const invalido of ['0', '-3', 'abc', '2.5']) {
        const respuesta = await pedir('GET', `/clientes/catalogo?${q}&limite=${invalido}`, tokens.contador);
        assert.strictEqual(respuesta.statusCode, 400, invalido);
        assertTresPartes(respuesta.body, `limite ${invalido}`);
      }
    });

    test('ordena por nombre', async () => {
      const segundo = await crearCliente('Orden B');
      const primero = await crearCliente('Orden A');
      const respuesta = await pedir('GET', '/clientes/catalogo?q=zz_test_%20orden', tokens.contador);
      assert.deepStrictEqual(respuesta.body.clientes.map((c) => c.id), [primero, segundo]);
    });
  });

  describe('POST /clientes/vinculos', () => {
    test('vincula uno o varios activos y deja a la cuenta como contador (el invariante de usuario_id)', async () => {
      const uno = await crearCliente('Vincula uno');
      const respuesta = await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: [uno] });
      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      assert.deepStrictEqual(respuesta.body, { vinculados: 1, yaEstaban: 0 });
      assert.deepStrictEqual(await estadoDe(uno), { contadores: [cuentas.contador.id], principal: cuentas.contador.id, activo: 1 });

      const dos = await crearCliente('Vincula dos');
      const tres = await crearCliente('Vincula tres');
      const varios = await pedir('POST', '/clientes/vinculos', tokens.auxiliar, { clienteIds: [dos, tres] });
      assert.deepStrictEqual(varios.body, { vinculados: 2, yaEstaban: 0 });
      assert.strictEqual((await estadoDe(dos)).principal, cuentas.auxiliar.id);
      assert.strictEqual((await estadoDe(tres)).principal, cuentas.auxiliar.id);
    });

    test('un cliente que ya tiene otro contador se puede vincular y el principal no cambia', async () => {
      const id = await crearCliente('Vincula con otro');
      await ClienteContadorModel.agregarContador(id, cuentas.contador.id);
      const respuesta = await pedir('POST', '/clientes/vinculos', tokens.contadorB, { clienteIds: [id] });
      assert.deepStrictEqual(respuesta.body, { vinculados: 1, yaEstaban: 0 });
      const estado = await estadoDe(id);
      assert.deepStrictEqual(estado.contadores, [cuentas.contador.id, contadorB.id]);
      assert.strictEqual(estado.principal, cuentas.contador.id);
    });

    test('es idempotente: uno ya vinculado cuenta en yaEstaban y no cambia su fecha', async () => {
      const id = await crearCliente('Vincula repetido');
      const otro = await crearCliente('Vincula repetido otro');
      await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: [id] });
      const [antes] = await query('SELECT asignado_en FROM cliente_contador WHERE cliente_id = ? AND usuario_id = ?', [id, cuentas.contador.id]);
      const respuesta = await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: [id, otro] });
      assert.deepStrictEqual(respuesta.body, { vinculados: 1, yaEstaban: 1 });
      const [despues] = await query('SELECT asignado_en FROM cliente_contador WHERE cliente_id = ? AND usuario_id = ?', [id, cuentas.contador.id]);
      assert.strictEqual(String(despues.asignado_en), String(antes.asignado_en));
      const repetido = await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: [id, otro] });
      assert.deepStrictEqual(repetido.body, { vinculados: 0, yaEstaban: 2 });
    });

    test('todo o nada: un id inexistente o de un cliente inactivo da 400 y no vincula ninguno', async () => {
      const bueno = await crearCliente('Todo o nada bueno');
      const inactivo = await crearCliente('Todo o nada inactivo', { activo: 0 });
      for (const [descripcion, ids] of [
        ['inexistente', [bueno, 2147483000]],
        ['inactivo', [bueno, inactivo]],
      ]) {
        const respuesta = await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: ids });
        assert.strictEqual(respuesta.statusCode, 400, descripcion);
        assertTresPartes(respuesta.body, descripcion);
        assert.deepStrictEqual((await estadoDe(bueno)).contadores, [], `${descripcion}: no debe quedar vinculado`);
      }
      assert.strictEqual(eventos('cliente_vinculado').length, 0, 'un rechazo no se registra como vínculo');
    });

    test('cuerpo inválido: sin lista, vacía, no entera, repetida o de más de 50 da 400 en tres partes', async () => {
      const id = await crearCliente('Cuerpo invalido');
      const casos = [
        ['sin cuerpo', undefined],
        ['sin la lista', {}],
        ['no es lista', { clienteIds: id }],
        ['lista vacía', { clienteIds: [] }],
        ['id no entero', { clienteIds: [id, 'abc'] }],
        ['id decimal', { clienteIds: [1.5] }],
        ['id cero o negativo', { clienteIds: [0] }],
        ['id repetido', { clienteIds: [id, id] }],
        ['51 ids', { clienteIds: Array.from({ length: 51 }, (_, i) => i + 1) }],
      ];
      for (const [descripcion, cuerpo] of casos) {
        const respuesta = await pedir('POST', '/clientes/vinculos', tokens.contador, cuerpo);
        assert.strictEqual(respuesta.statusCode, 400, `${descripcion}: ${JSON.stringify(respuesta.body)}`);
        assertTresPartes(respuesta.body, descripcion);
      }
      assert.deepStrictEqual((await estadoDe(id)).contadores, []);
    });

    test('50 ids exactos sí se aceptan', async () => {
      const ids = [];
      for (let i = 1; i <= 50; i += 1) ids.push(await crearCliente(`Cincuenta ${i}`));
      const respuesta = await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: ids });
      assert.deepStrictEqual(respuesta.body, { vinculados: 50, yaEstaban: 0 });
    });

    test('registra cliente_vinculado con ids y cantidades, sin nombres', async () => {
      const id = await crearCliente('Bitacora vincula');
      await pedir('POST', '/clientes/vinculos', tokens.contador, { clienteIds: [id] });
      const [evento] = eventos('cliente_vinculado');
      assert.ok(evento, 'falta el evento');
      assert.strictEqual(evento.usuarioId, cuentas.contador.id);
      assert.strictEqual(evento.vinculados, 1);
      assert.strictEqual(evento.yaEstaban, 0);
      assert.strictEqual(evento.clienteIds, String(id));
      assert.ok(!lineas.join('').includes('Bitacora vincula'), 'la bitácora no lleva el nombre del cliente');
    });
  });

  describe('DELETE /clientes/vinculos/:clienteId', () => {
    test('quita solo el vínculo propio; el otro contador y el cliente se quedan', async () => {
      const id = await crearCliente('Quita propio');
      await ClienteContadorModel.agregarContador(id, cuentas.contador.id);
      await ClienteContadorModel.agregarContador(id, contadorB.id);
      const respuesta = await pedir('DELETE', `/clientes/vinculos/${id}`, tokens.contador);
      assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
      assert.deepStrictEqual(await estadoDe(id), { contadores: [contadorB.id], principal: contadorB.id, activo: 1 });
    });

    test('si era el único contador, el cliente queda activo y sin contador (usuario_id NULL)', async () => {
      const id = await crearCliente('Quita unico');
      await ClienteContadorModel.agregarContador(id, cuentas.auxiliar.id);
      const antes = await totalClientes();
      const respuesta = await pedir('DELETE', `/clientes/vinculos/${id}`, tokens.auxiliar);
      assert.strictEqual(respuesta.statusCode, 200);
      assert.deepStrictEqual(await estadoDe(id), { contadores: [], principal: null, activo: 1 });
      assert.strictEqual(await totalClientes(), antes, 'el cliente no se borra');
    });

    test('un cliente que no estaba en su cartera da 404 en tres partes y no toca a los demás', async () => {
      const id = await crearCliente('Quita ajeno');
      await ClienteContadorModel.agregarContador(id, contadorB.id);
      const ajeno = await pedir('DELETE', `/clientes/vinculos/${id}`, tokens.contador);
      assert.strictEqual(ajeno.statusCode, 404);
      assertTresPartes(ajeno.body, 'ajeno');
      assert.deepStrictEqual((await estadoDe(id)).contadores, [contadorB.id]);
      const inexistente = await pedir('DELETE', '/clientes/vinculos/2147483000', tokens.contador);
      assert.strictEqual(inexistente.statusCode, 404);
    });

    test('un id inválido da 400', async () => {
      for (const invalido of ['abc', '0', '1.5']) {
        const respuesta = await pedir('DELETE', `/clientes/vinculos/${invalido}`, tokens.contador);
        assert.strictEqual(respuesta.statusCode, 400, invalido);
        assertTresPartes(respuesta.body, invalido);
      }
    });

    test('registra cliente_desvinculado con el id y sin nombres', async () => {
      const id = await crearCliente('Bitacora quita');
      await ClienteContadorModel.agregarContador(id, cuentas.contador.id);
      await pedir('DELETE', `/clientes/vinculos/${id}`, tokens.contador);
      const [evento] = eventos('cliente_desvinculado');
      assert.ok(evento, 'falta el evento');
      assert.strictEqual(evento.clienteId, id);
      assert.ok(!lineas.join('').includes('Bitacora quita'));
    });
  });

  describe('Recepción solo propone al principal si tiene rol Contador en Documentos', () => {
    const principalPropuesto = async (clienteId) => {
      const catalogos = await import('../src/modulos/documentos/rutas/catalogos.mjs');
      const { body } = await catalogos.rutaCatalogos(pool);
      return body.clientes.find((c) => c.id === clienteId).contadorId;
    };

    test('un auxiliar como principal no se propone; con rol Contador en Documentos sí', async () => {
      const id = await crearCliente('Recepcion propone');
      await ClienteContadorModel.agregarContador(id, cuentas.auxiliar.id);
      assert.strictEqual((await estadoDe(id)).principal, cuentas.auxiliar.id);
      assert.strictEqual(await principalPropuesto(id), null);

      await darRolEnDocumentos(cuentas.auxiliar.id, 'contador');
      assert.strictEqual(await principalPropuesto(id), cuentas.auxiliar.id);
    });

    test('si el principal no tiene el rol no se propone a nadie, aunque otro contador sí lo tenga', async () => {
      const id = await crearCliente('Recepcion no propone');
      await ClienteContadorModel.agregarContador(id, cuentas.recepcionista.id);
      await ClienteContadorModel.agregarContador(id, adminConDocumentos.id);
      assert.strictEqual(await principalPropuesto(id), null);
    });
  });
});
