const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { seedDatabase } = require('../src/utils/seed');
const { importarDocumentos, deshacerImportacion, esCuentaDePrueba, esClienteDePrueba, normalizarRazonSocial } =
  require('../src/utils/importarDocumentos');
const { query } = require('../src/config/db');

/**
 * Fase 1 de la unión con Proyecto-documentos: una sola base de datos.
 * - El seed agrega lo que necesita el módulo de documentos (alias, usuario_modulos, clientes sin dueño,
 *   tablas y catálogos de documentos) y se puede repetir.
 * - `importarDocumentos` trae usuarios y clientes de la base de documentos sin duplicar, deja fuera
 *   las cuentas y los clientes de prueba, y `deshacerImportacion` lo revierte.
 * Los datos de origen son de mentira (ids 9000xx) para no depender de la base de documentos.
 */

const SUFIJO = Date.now().toString(36);

async function columna(tabla, nombre) {
  const filas = await query(
    'SELECT IS_NULLABLE AS nulo FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tabla, nombre]
  );
  return filas[0] || null;
}

async function existeTabla(nombre) {
  const [{ total }] = await query(
    'SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    [nombre]
  );
  return Number(total) === 1;
}

async function modulosDe(usuarioId) {
  return query('SELECT modulo, rol FROM usuario_modulos WHERE usuario_id = ? ORDER BY modulo', [usuarioId]);
}

describe('unificación: esquema del seed', () => {
  before(prepararBaseDeDatos);

  test('usuarios tiene alias opcional', async () => {
    const alias = await columna('usuarios', 'alias');
    assert.ok(alias, 'existe usuarios.alias');
    assert.strictEqual(alias.nulo, 'YES');
  });

  test('clientes admite no tener contador y trae clave, email y teléfono', async () => {
    assert.strictEqual((await columna('clientes', 'usuario_id')).nulo, 'YES');
    for (const nombre of ['clave', 'email', 'telefono']) {
      assert.ok(await columna('clientes', nombre), `existe clientes.${nombre}`);
    }
  });

  test('crea usuario_modulos y las tablas del módulo de documentos', async () => {
    const tablas = [
      'usuario_modulos',
      'unificacion_mapa',
      'empresas',
      'departamentos',
      'tipos_documento',
      'documentos',
      'documento_archivos',
      'documento_historial',
      'cliente_doc_requeridos',
      'contador_folio',
    ];
    for (const tabla of tablas) {
      assert.ok(await existeTabla(tabla), `existe la tabla ${tabla}`);
    }
  });

  test('los catálogos de documentos se siembran una sola vez', async () => {
    await seedDatabase({ cuentasDemo: false });
    await seedDatabase({ cuentasDemo: false });
    const [{ empresas }] = await query('SELECT COUNT(*) AS empresas FROM empresas');
    const [{ departamentos }] = await query('SELECT COUNT(*) AS departamentos FROM departamentos');
    const [{ tipos }] = await query('SELECT COUNT(*) AS tipos FROM tipos_documento');
    assert.strictEqual(Number(empresas), 2);
    assert.strictEqual(Number(departamentos), 4);
    assert.strictEqual(Number(tipos), 5);
  });

  test('ninguna cuenta queda sin módulo: la que no tenía ninguno recibe seguimiento', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    await seedDatabase({ cuentasDemo: false });
    assert.deepStrictEqual(
      (await modulosDe(cuenta.id)).map((m) => [m.modulo, m.rol]),
      [['seguimiento', null]]
    );
    const [{ sinModulo }] = await query(
      'SELECT COUNT(*) AS sinModulo FROM usuarios u WHERE NOT EXISTS (SELECT 1 FROM usuario_modulos m WHERE m.usuario_id = u.id)'
    );
    assert.strictEqual(Number(sinModulo), 0);
  });
});

describe('unificación: reglas de datos de prueba', () => {
  test('reconoce las cuentas de prueba por su dominio', () => {
    assert.strictEqual(esCuentaDePrueba('test@example.com'), true);
    assert.strictEqual(esCuentaDePrueba('Recepcionista@Test.com'), true);
    assert.strictEqual(esCuentaDePrueba('contador@ejemplo.com'), true);
    assert.strictEqual(esCuentaDePrueba('alguien@delgrow.mx'), false);
    assert.strictEqual(esCuentaDePrueba('practicante.delgrow06@gmail.com'), false);
  });

  test('reconoce el cliente de prueba', () => {
    assert.strictEqual(esClienteDePrueba({ razon_social: 'Cliente Test', rfc: 'TEST123456789' }), true);
    assert.strictEqual(esClienteDePrueba({ razon_social: 'GFL CUSTOMS MEXICO SA DE CV', rfc: null }), false);
  });

  test('la razón social se compara sin acentos, puntuación ni tipo de sociedad', () => {
    assert.strictEqual(
      normalizarRazonSocial('Gfl Customs Mexico, S.A. de C.V.'),
      normalizarRazonSocial('GFL CUSTOMS MEXICO SA DE CV')
    );
    assert.strictEqual(
      normalizarRazonSocial('Tres Raíces, S.P.R. de R.L. de C.V.'),
      normalizarRazonSocial('TRES RAICES SPR DE RL DE CV')
    );
    assert.notStrictEqual(normalizarRazonSocial('Bespoke Maquila'), normalizarRazonSocial('Bespoke Industrial'));
  });
});

describe('unificación: importación desde la base de documentos', () => {
  let contador;
  let clienteExistenteId;
  const correoNuevo = `zz_test_nuevo_${SUFIJO}@prueba.local`;
  const razonExistente = `ZZ Cliente Existente ${SUFIJO}, S.A. de C.V.`;
  const razonNueva = `ZZ CLIENTE NUEVO ${SUFIJO} SA DE CV`;

  const origen = () => ({
    usuarios: [
      { id: 900001, nombre: 'Coincide', usuario: `zz_alias_${SUFIJO}`, email: contador.correo.toUpperCase(), password: 'scrypt$a$b', rol: 'Practicante', debe_cambiar_contrasena: 0, created_at: new Date() },
      { id: 900002, nombre: 'Solo documentos', usuario: `zz_solo_${SUFIJO}`, email: correoNuevo, password: 'scrypt$c$d', rol: 'Contador', debe_cambiar_contrasena: 1, created_at: new Date() },
      { id: 900003, nombre: 'Prueba', usuario: `zz_prueba_${SUFIJO}`, email: `zz_${SUFIJO}@test.com`, password: 'scrypt$e$f', rol: 'Administrador', debe_cambiar_contrasena: 0, created_at: new Date() },
    ],
    clientes: [
      { id: 900101, clave: null, rfc: null, razon_social: razonExistente.toUpperCase().replace(/[.,]/g, ''), email: 'a@b.mx', telefono: '899', estado: 'ACTIVO', created_at: new Date() },
      { id: 900102, clave: null, rfc: null, razon_social: razonNueva, email: null, telefono: null, estado: 'INACTIVO', created_at: new Date() },
      { id: 900103, clave: null, rfc: `TEST${SUFIJO}`.slice(0, 13), razon_social: 'Cliente Test', email: null, telefono: null, estado: 'ACTIVO', created_at: new Date() },
    ],
  });

  async function usuarioNuevo() {
    const [fila] = await query('SELECT * FROM usuarios WHERE correo = ?', [correoNuevo]);
    return fila;
  }

  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    const resultado = await query(
      'INSERT INTO clientes (usuario_id, nombre, rfc, activo, creado_en) VALUES (?, ?, NULL, 1, NOW())',
      [contador.id, razonExistente]
    );
    clienteExistenteId = resultado.insertId;
  });

  after(async () => {
    await deshacerImportacion({ soloOrigen: [900001, 900002, 900003, 900101, 900102, 900103] });
    await query('DELETE FROM usuarios WHERE correo = ?', [correoNuevo]);
    await query('DELETE FROM clientes WHERE nombre IN (?, ?)', [razonExistente, razonNueva]);
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('importa usuarios y clientes sin traer los de prueba', async () => {
    const resumen = await importarDocumentos(origen());
    assert.deepStrictEqual(resumen.usuarios, { ligados: 1, insertados: 1, omitidosDePrueba: 1, yaImportados: 0 });
    assert.deepStrictEqual(resumen.clientes, { ligados: 1, insertados: 1, omitidosDePrueba: 1, yaImportados: 0 });
  });

  test('la cuenta que ya existía recibe su alias y el módulo de documentos con su rol de allá', async () => {
    const [fila] = await query('SELECT alias, rol FROM usuarios WHERE id = ?', [contador.id]);
    assert.strictEqual(fila.alias, `zz_alias_${SUFIJO}`);
    assert.strictEqual(fila.rol, 'contador', 'su rol de seguimiento no cambia');
    const modulos = await modulosDe(contador.id);
    assert.deepStrictEqual(
      modulos.map((m) => [m.modulo, m.rol]),
      [['documentos', 'practicante']]
    );
  });

  test('la cuenta que solo estaba en documentos entra como auxiliar y solo con ese módulo', async () => {
    const fila = await usuarioNuevo();
    assert.ok(fila, 'se creó la cuenta');
    assert.strictEqual(fila.rol, 'auxiliar');
    assert.strictEqual(fila.alias, `zz_solo_${SUFIJO}`);
    assert.strictEqual(fila.password_hash, 'scrypt$c$d', 'conserva su contraseña de documentos');
    assert.strictEqual(Number(fila.debe_cambiar_contrasena), 1);
    const modulos = await modulosDe(fila.id);
    assert.deepStrictEqual(
      modulos.map((m) => [m.modulo, m.rol]),
      [['documentos', 'contador']]
    );
  });

  test('las cuentas de prueba no se importan', async () => {
    const filas = await query('SELECT id FROM usuarios WHERE correo = ?', [`zz_${SUFIJO}@test.com`]);
    assert.strictEqual(filas.length, 0);
  });

  test('el cliente que ya existía se completa y el nuevo entra sin contador', async () => {
    const [existente] = await query('SELECT usuario_id, email, telefono FROM clientes WHERE id = ?', [clienteExistenteId]);
    assert.strictEqual(existente.usuario_id, contador.id, 'conserva a su contador');
    assert.strictEqual(existente.email, 'a@b.mx');
    assert.strictEqual(existente.telefono, '899');
    const [nuevo] = await query('SELECT usuario_id, activo FROM clientes WHERE nombre = ?', [razonNueva]);
    assert.ok(nuevo, 'se creó el cliente nuevo');
    assert.strictEqual(nuevo.usuario_id, null);
    assert.strictEqual(Number(nuevo.activo), 0, 'INACTIVO queda como inactivo');
    const prueba = await query("SELECT id FROM clientes WHERE nombre = 'Cliente Test'");
    assert.strictEqual(prueba.length, 0);
  });

  test('correrla otra vez no duplica nada', async () => {
    const resumen = await importarDocumentos(origen());
    assert.deepStrictEqual(resumen.usuarios, { ligados: 0, insertados: 0, omitidosDePrueba: 1, yaImportados: 2 });
    assert.deepStrictEqual(resumen.clientes, { ligados: 0, insertados: 0, omitidosDePrueba: 1, yaImportados: 2 });
    const [{ total }] = await query('SELECT COUNT(*) AS total FROM clientes WHERE nombre = ?', [razonNueva]);
    assert.strictEqual(Number(total), 1);
  });

  test('deshacer quita lo insertado y limpia lo ligado', async () => {
    await deshacerImportacion({ soloOrigen: [900001, 900002, 900101, 900102] });
    assert.strictEqual(await usuarioNuevo(), undefined);
    const [fila] = await query('SELECT alias FROM usuarios WHERE id = ?', [contador.id]);
    assert.strictEqual(fila.alias, null);
    assert.deepStrictEqual(await modulosDe(contador.id), []);
    const [existente] = await query('SELECT email, telefono FROM clientes WHERE id = ?', [clienteExistenteId]);
    assert.strictEqual(existente.email, null);
    assert.strictEqual(existente.telefono, null);
    const nuevos = await query('SELECT id FROM clientes WHERE nombre = ?', [razonNueva]);
    assert.strictEqual(nuevos.length, 0);
  });
});
