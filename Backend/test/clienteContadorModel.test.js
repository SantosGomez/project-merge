const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { query, pool } = require('../src/config/db');
const ClienteContadorModel = require('../src/models/ClienteContadorModel');
const ClienteModel = require('../src/models/ClienteModel');
const CarteraActividadModel = require('../src/models/CarteraActividadModel');

/**
 * Rebanada 55a: único punto que escribe `cliente_contador` y deja `clientes.usuario_id` como el
 * contador principal (el de menor `asignado_en`; a igualdad, el de menor `usuario_id`).
 * Datos `zz_test_`; al terminar no queda ninguno.
 */

const clientesCreados = [];

async function crearCliente(nombre, usuarioId = null) {
  const resultado = await query('INSERT INTO clientes (usuario_id, nombre, creado_en) VALUES (?, ?, NOW())', [
    usuarioId,
    nombre,
  ]);
  clientesCreados.push(resultado.insertId);
  return resultado.insertId;
}

async function estadoDe(clienteId) {
  const filas = await query(
    'SELECT usuario_id FROM cliente_contador WHERE cliente_id = ? ORDER BY asignado_en, usuario_id',
    [clienteId]
  );
  const [cliente] = await query('SELECT usuario_id FROM clientes WHERE id = ?', [clienteId]);
  return { filas: filas.map((f) => f.usuario_id), principal: cliente.usuario_id };
}

describe('ClienteContadorModel (rebanada 55a)', () => {
  let a;
  let b;
  let c;

  before(async () => {
    await prepararBaseDeDatos();
    a = await crearUsuarioDePrueba('contador');
    b = await crearUsuarioDePrueba('contador');
    c = await crearUsuarioDePrueba('contador');
  });

  after(async () => {
    if (clientesCreados.length > 0) {
      const marcas = clientesCreados.map(() => '?').join(', ');
      await query(`DELETE FROM clientes WHERE id IN (${marcas})`, clientesCreados);
    }
    await limpiarDatosDePrueba();
    const [restos] = await query("SELECT COUNT(*) AS n FROM clientes WHERE nombre LIKE 'zz\\_test\\_%'");
    assert.strictEqual(Number(restos.n), 0, 'no deben quedar clientes zz_test_');
    await cerrarBaseDeDatos();
  });

  test('agregar un contador a un cliente sin contador lo deja como principal', async () => {
    const cliente = await crearCliente('zz_test_ modelo agregar');
    await ClienteContadorModel.agregarContador(cliente, a.id);
    assert.deepStrictEqual(await estadoDe(cliente), { filas: [a.id], principal: a.id });
    assert.strictEqual(await ClienteContadorModel.principalDe(cliente), a.id);
  });

  test('agregar dos veces al mismo contador no duplica ni cambia su fecha de asignación', async () => {
    const cliente = await crearCliente('zz_test_ modelo idempotente');
    await ClienteContadorModel.agregarContador(cliente, a.id);
    await query("UPDATE cliente_contador SET asignado_en = '2020-01-01 00:00:00' WHERE cliente_id = ?", [cliente]);
    await ClienteContadorModel.agregarContador(cliente, a.id);
    const filas = await query('SELECT asignado_en FROM cliente_contador WHERE cliente_id = ?', [cliente]);
    assert.strictEqual(filas.length, 1);
    assert.strictEqual(new Date(filas[0].asignado_en).getFullYear(), 2020);
  });

  test('con varios contadores el principal es el más antiguo y, a igualdad, el de menor id', async () => {
    const cliente = await crearCliente('zz_test_ modelo principal');
    await ClienteContadorModel.reemplazarContadores(cliente, [c.id, b.id, a.id]);
    await query("UPDATE cliente_contador SET asignado_en = '2020-01-01 00:00:00' WHERE cliente_id = ? AND usuario_id = ?", [
      cliente,
      c.id,
    ]);
    await query("UPDATE cliente_contador SET asignado_en = '2021-01-01 00:00:00' WHERE cliente_id = ? AND usuario_id IN (?, ?)", [
      cliente,
      a.id,
      b.id,
    ]);
    await ClienteContadorModel.agregarContador(cliente, a.id); // vuelve a sincronizar
    assert.strictEqual((await estadoDe(cliente)).principal, c.id, 'gana el más antiguo');

    await ClienteContadorModel.quitarContador(cliente, c.id);
    const { filas, principal } = await estadoDe(cliente);
    assert.deepStrictEqual([...filas].sort((x, y) => x - y), [a.id, b.id].sort((x, y) => x - y));
    assert.strictEqual(principal, Math.min(a.id, b.id), 'a igualdad de fecha gana el menor id');

    const contadores = await ClienteContadorModel.contadoresDe(cliente);
    assert.deepStrictEqual(contadores.map((x) => x.id), [Math.min(a.id, b.id), Math.max(a.id, b.id)]);
    assert.ok(contadores.every((x) => typeof x.nombre === 'string' && x.nombre.startsWith('zz_test_')));
  });

  test('reemplazar deja exactamente el conjunto pedido y conserva la fecha de quien ya estaba', async () => {
    const cliente = await crearCliente('zz_test_ modelo reemplazo', a.id);
    await ClienteContadorModel.agregarContador(cliente, a.id);
    await query("UPDATE cliente_contador SET asignado_en = '2020-01-01 00:00:00' WHERE cliente_id = ?", [cliente]);

    await ClienteContadorModel.reemplazarContadores(cliente, [a.id, b.id, b.id]);
    assert.deepStrictEqual((await estadoDe(cliente)).filas.sort(), [a.id, b.id].sort());
    assert.strictEqual((await estadoDe(cliente)).principal, a.id, 'a conserva su fecha antigua y sigue de principal');

    await ClienteContadorModel.reemplazarContadores(cliente, [b.id]);
    assert.deepStrictEqual(await estadoDe(cliente), { filas: [b.id], principal: b.id });
  });

  test('reemplazar por un conjunto vacío o quitar al último deja el cliente sin contador (NULL)', async () => {
    const cliente = await crearCliente('zz_test_ modelo vacío');
    await ClienteContadorModel.reemplazarContadores(cliente, [a.id]);
    await ClienteContadorModel.reemplazarContadores(cliente, []);
    assert.deepStrictEqual(await estadoDe(cliente), { filas: [], principal: null });
    assert.strictEqual(await ClienteContadorModel.principalDe(cliente), null);

    await ClienteContadorModel.agregarContador(cliente, b.id);
    await ClienteContadorModel.quitarContador(cliente, b.id);
    assert.deepStrictEqual(await estadoDe(cliente), { filas: [], principal: null });
  });

  test('si algo falla a la mitad no cambia nada (rollback completo)', async () => {
    const cliente = await crearCliente('zz_test_ modelo rollback', a.id);
    await ClienteContadorModel.agregarContador(cliente, a.id);
    const antes = await estadoDe(cliente);

    // 2147483000 no es una cuenta: la llave foránea rechaza el segundo alta, después de haber quitado a «a».
    await assert.rejects(ClienteContadorModel.reemplazarContadores(cliente, [b.id, 2147483000]));
    assert.deepStrictEqual(await estadoDe(cliente), antes);
  });

  test('con una conexión ajena participa de su transacción y se deshace con ella', async () => {
    const cliente = await crearCliente('zz_test_ modelo conexión ajena');
    const conexion = await pool.getConnection();
    try {
      await conexion.beginTransaction();
      const ejecutar = async (sql, params = []) => (await conexion.query(sql, params))[0];
      await ClienteContadorModel.reemplazarContadores(cliente, [a.id], ejecutar);
      await conexion.rollback();
    } finally {
      conexion.release();
    }
    assert.deepStrictEqual(await estadoDe(cliente), { filas: [], principal: null });
  });

  test('borrar la cuenta o el cliente mantiene el invariante', async () => {
    const extra = await crearUsuarioDePrueba('contador');
    const cliente = await crearCliente('zz_test_ modelo borrado');
    await ClienteContadorModel.reemplazarContadores(cliente, [extra.id]);
    await query('DELETE FROM sesiones WHERE usuario_id = ?', [extra.id]);
    await query('DELETE FROM usuarios WHERE id = ?', [extra.id]);
    // La llave de clientes.usuario_id es CASCADE: el cliente desaparece con la cuenta y su fila también.
    const huerfanas = await query(
      'SELECT cc.cliente_id FROM cliente_contador cc LEFT JOIN clientes c ON c.id = cc.cliente_id WHERE c.id IS NULL'
    );
    assert.strictEqual(huerfanas.length, 0);

    const otro = await crearCliente('zz_test_ modelo borrado cliente');
    await ClienteContadorModel.reemplazarContadores(otro, [a.id]);
    await query('DELETE FROM clientes WHERE id = ?', [otro]);
    assert.deepStrictEqual(await query('SELECT 1 FROM cliente_contador WHERE cliente_id = ?', [otro]), []);
  });

  test('tras correr el seed, todo cliente cumple el invariante', async () => {
    const { seedDatabase } = require('../src/utils/seed');
    await seedDatabase({ cuentasDemo: false });
    const sinPareja = await query(
      `SELECT c.id FROM clientes c
       WHERE c.nombre NOT LIKE 'zz\\_test\\_%'
         AND ((c.usuario_id IS NULL AND EXISTS (SELECT 1 FROM cliente_contador x WHERE x.cliente_id = c.id))
           OR (c.usuario_id IS NOT NULL AND NOT EXISTS
               (SELECT 1 FROM cliente_contador x WHERE x.cliente_id = c.id AND x.usuario_id = c.usuario_id)))`
    );
    assert.deepStrictEqual(sinPareja, []);
  });

  describe('alta y edición de clientes de documentos con la base real (rebanada 55a)', () => {
    let ruta;
    const idsDocumentos = [];

    async function darRolContador(usuarioId) {
      await query(
        "INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', 'contador') ON DUPLICATE KEY UPDATE rol = VALUES(rol)",
        [usuarioId]
      );
    }

    before(async () => {
      await darRolContador(a.id);
      await darRolContador(b.id);
      ruta = await import('../src/modulos/documentos/rutas/clientes.mjs');
    });

    after(async () => {
      if (idsDocumentos.length > 0) {
        const marcas = idsDocumentos.map(() => '?').join(', ');
        await query(`DELETE FROM clientes WHERE id IN (${marcas})`, idsDocumentos);
      }
    });

    test('el alta deja el conjunto en [contadorId]', async () => {
      const respuesta = await ruta.rutaCrearCliente(pool, { razonSocial: 'zz_test_ Docs alta', contadorId: a.id });
      assert.strictEqual(respuesta.status, 201);
      idsDocumentos.push(respuesta.body.cliente.id);
      assert.deepStrictEqual(await estadoDe(respuesta.body.cliente.id), { filas: [a.id], principal: a.id });
    });

    test('el alta sin contador no deja filas', async () => {
      const respuesta = await ruta.rutaCrearCliente(pool, { razonSocial: 'zz_test_ Docs alta sin contador' });
      assert.strictEqual(respuesta.status, 201);
      idsDocumentos.push(respuesta.body.cliente.id);
      assert.deepStrictEqual(await estadoDe(respuesta.body.cliente.id), { filas: [], principal: null });
    });

    test('la edición reemplaza el conjunto completo y también puede dejarlo vacío', async () => {
      const alta = await ruta.rutaCrearCliente(pool, { razonSocial: 'zz_test_ Docs edición', contadorId: a.id });
      const id = alta.body.cliente.id;
      idsDocumentos.push(id);
      await ClienteContadorModel.agregarContador(id, b.id); // un segundo contador asignado por otra vía

      const cambio = await ruta.rutaEditarCliente(pool, id, { razonSocial: 'zz_test_ Docs edición', contadorId: b.id });
      assert.strictEqual(cambio.status, 200);
      assert.deepStrictEqual(await estadoDe(id), { filas: [b.id], principal: b.id });

      const sin = await ruta.rutaEditarCliente(pool, id, { razonSocial: 'zz_test_ Docs edición', contadorId: null });
      assert.strictEqual(sin.status, 200);
      assert.deepStrictEqual(await estadoDe(id), { filas: [], principal: null });
    });

    test('un fallo de la edición (razón social repetida del contador) no cambia el conjunto', async () => {
      const uno = await ruta.rutaCrearCliente(pool, { razonSocial: 'zz_test_ Docs repetida uno', contadorId: a.id });
      const dos = await ruta.rutaCrearCliente(pool, { razonSocial: 'zz_test_ Docs repetida dos', contadorId: b.id });
      idsDocumentos.push(uno.body.cliente.id, dos.body.cliente.id);

      const choque = await ruta.rutaEditarCliente(pool, dos.body.cliente.id, {
        razonSocial: 'zz_test_ Docs repetida uno',
        contadorId: a.id,
      });
      assert.strictEqual(choque.status, 409);
      assert.deepStrictEqual(await estadoDe(dos.body.cliente.id), { filas: [b.id], principal: b.id });
    });
  });

  describe('lecturas con varios contadores (rebanada 55b)', () => {
    let clienteId;
    let principal;
    let secundario;

    before(async () => {
      clienteId = await crearCliente('zz_test_ lectura dos contadores');
      await ClienteContadorModel.reemplazarContadores(clienteId, [a.id, b.id]);
      // Un empate de fecha lo gana el menor id: el otro es el secundario.
      principal = Math.min(a.id, b.id);
      secundario = Math.max(a.id, b.id);
    });

    test('«mis clientes» lo lista a cada uno de sus contadores, una sola vez, y a nadie más', async () => {
      for (const usuarioId of [a.id, b.id]) {
        const lista = await ClienteModel.listarDeUsuario(usuarioId);
        assert.strictEqual(lista.filter((cliente) => cliente.id === clienteId).length, 1);
        assert.ok(await ClienteModel.buscarDeUsuario(clienteId, usuarioId));
      }
      assert.ok(!(await ClienteModel.listarDeUsuario(c.id)).some((cliente) => cliente.id === clienteId));
      assert.strictEqual(await ClienteModel.buscarDeUsuario(clienteId, c.id), null);
    });

    test('cualquiera de sus contadores lo edita, no solo el principal; un ajeno no puede', async () => {
      const editado = await ClienteModel.actualizar(clienteId, secundario, { rfc: 'XAXX010101000' });
      assert.strictEqual(editado.rfc, 'XAXX010101000');
      assert.strictEqual(await ClienteModel.actualizar(clienteId, c.id, { rfc: 'MALO010101000' }), null);
      const [fila] = await query('SELECT rfc FROM clientes WHERE id = ?', [clienteId]);
      assert.strictEqual(fila.rfc, 'XAXX010101000');
    });

    test('la cartera de actividades lo reconoce como cliente de cada uno de ellos', async () => {
      for (const usuarioId of [a.id, b.id]) {
        const encontrados = await CarteraActividadModel.clientesDeUsuario(usuarioId, [clienteId]);
        assert.deepStrictEqual(encontrados, [{ id: clienteId, activo: true }]);
      }
      assert.deepStrictEqual(await CarteraActividadModel.clientesDeUsuario(c.id, [clienteId]), []);
    });

    test('el listado de Ajustes trae a los dos y el principal en contador_id', async () => {
      const filas = (await ClienteModel.listarTodos()).filter((cliente) => cliente.id === clienteId);
      assert.strictEqual(filas.length, 1);
      assert.deepStrictEqual(filas[0].contadores.map((x) => x.id), [principal, secundario]);
      assert.strictEqual(filas[0].contador_id, principal);
    });

    test('Documentos: listado, ficha y catálogo de Recepción traen a los dos y proponen al principal', async () => {
      const rutas = await import('../src/modulos/documentos/rutas/clientes.mjs');
      const catalogos = await import('../src/modulos/documentos/rutas/catalogos.mjs');

      const lista = await rutas.rutaClientes(pool, { busqueda: 'zz_test_ lectura dos contadores' });
      const enLista = lista.body.clientes.filter((cliente) => cliente.id === clienteId);
      assert.strictEqual(enLista.length, 1);
      assert.deepStrictEqual(enLista[0].contadores.map((x) => x.id), [principal, secundario]);
      const [filaPrincipal] = await query('SELECT nombre FROM usuarios WHERE id = ?', [principal]);
      assert.strictEqual(enLista[0].contador, filaPrincipal.nombre);

      const ficha = (await rutas.rutaConsultarCliente(pool, clienteId)).body.cliente;
      assert.strictEqual(ficha.contadorId, principal);
      assert.strictEqual(ficha.contador, filaPrincipal.nombre);
      assert.deepStrictEqual(ficha.contadores.map((x) => x.id), [principal, secundario]);

      const catalogo = (await catalogos.rutaCatalogos(pool)).body.clientes.find((cliente) => cliente.id === clienteId);
      assert.strictEqual(catalogo.contadorId, principal);
    });
  });
});
