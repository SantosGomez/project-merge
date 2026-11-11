const assert = require('node:assert');
const { describe, test, before, after, beforeEach } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { query } = require('../src/config/db');

/*
 * Escalar casos de un auxiliar: el auxiliar no marca «Importante»; lo marca su contador,
 * y entonces el administrador lo ve en el detalle y en las cifras de ese contador.
 */

let servidor;
let admin;
let dueno;
let auxiliar;
let tokenAdmin;
let tokenDueno;
let tokenAuxiliar;

const CASO_NUEVO = { cliente: 'zz_test_ caso nuevo', prioridad: 'Media', fecha_vencimiento: '2099-12-31' };

async function crearCaso(contadorId, datos = {}) {
  const resultado = await query(
    `INSERT INTO casos (contador_id, cliente, estado, prioridad, importante, fecha_inicio, fecha_vencimiento, creado_en, actualizado_en)
     VALUES (?, ?, ?, 'Media', ?, '2026-11-02', '2099-12-31', NOW(), NOW())`,
    [contadorId, datos.cliente ?? 'zz_test_ cliente', datos.estado ?? 'Pendiente', datos.importante ?? 0]
  );
  return Number(resultado.insertId);
}

const importanteDe = async (casoId) =>
  Number((await query('SELECT importante FROM casos WHERE id = ?', [casoId]))[0].importante);

describe('Escalar casos de un auxiliar', () => {
  before(async () => {
    await prepararBaseDeDatos();
    admin = await crearUsuarioDePrueba('administrador');
    dueno = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    await asignarAuxiliar(dueno.id, auxiliar.id);
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenDueno = await iniciarSesion(servidor.puerto, dueno.correo, dueno.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  beforeEach(async () => {
    await query('DELETE FROM casos WHERE contador_id IN (?, ?)', [dueno.id, auxiliar.id]);
  });

  // ---------- El auxiliar no marca «Importante» ----------
  test('el auxiliar no puede marcar ni desmarcar «Importante» en su propio caso', async () => {
    const casoId = await crearCaso(auxiliar.id);

    const marcar = await peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { importante: true }, tokenAuxiliar);
    assert.strictEqual(marcar.statusCode, 403);
    assert.match(marcar.body.mensaje, /Solo tu contador puede marcar/);
    assert.strictEqual(await importanteDe(casoId), 0);

    await query('UPDATE casos SET importante = 1 WHERE id = ?', [casoId]);
    const desmarcar = await peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { importante: false }, tokenAuxiliar);
    assert.strictEqual(desmarcar.statusCode, 403);
    assert.strictEqual(await importanteDe(casoId), 1);
  });

  test('el auxiliar sigue editando el resto de su caso', async () => {
    const casoId = await crearCaso(auxiliar.id);
    const respuesta = await peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { estado: 'En proceso' }, tokenAuxiliar);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.strictEqual(respuesta.body.caso.estado, 'En proceso');
  });

  test('el auxiliar no puede registrar un caso ya marcado como importante', async () => {
    const propio = await peticion(servidor.puerto, 'POST', '/casos', { ...CASO_NUEVO, importante: true }, tokenAuxiliar);
    assert.strictEqual(propio.statusCode, 403);

    const paraSuContador = await peticion(
      servidor.puerto,
      'POST',
      '/casos/para-auxiliar',
      { ...CASO_NUEVO, contador_id: dueno.id, importante: true },
      tokenAuxiliar
    );
    assert.strictEqual(paraSuContador.statusCode, 403);

    const [{ total }] = await query('SELECT COUNT(*) AS total FROM casos WHERE contador_id IN (?, ?)', [
      dueno.id,
      auxiliar.id,
    ]);
    assert.strictEqual(Number(total), 0, 'no se guardó ningún caso');

    const sinMarca = await peticion(servidor.puerto, 'POST', '/casos', { ...CASO_NUEVO, importante: false }, tokenAuxiliar);
    assert.strictEqual(sinMarca.statusCode, 201);
  });

  // ---------- El contador escala ----------
  test('el contador marca como importante el caso de su auxiliar', async () => {
    const casoId = await crearCaso(auxiliar.id);
    const respuesta = await peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { importante: true }, tokenDueno);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.strictEqual(await importanteDe(casoId), 1);
  });

  // ---------- El administrador ve lo escalado bajo el contador ----------
  test('el admin ve en el detalle del contador los casos escalados de su auxiliar, con el nombre del dueño', async () => {
    await crearCaso(dueno.id, { cliente: 'zz_test_ del contador', importante: 1 });
    await crearCaso(auxiliar.id, { cliente: 'zz_test_ escalado', importante: 1 });
    await crearCaso(auxiliar.id, { cliente: 'zz_test_ sin escalar', importante: 0 });

    const respuesta = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${dueno.id}/casos?importantes=true`,
      undefined,
      tokenAdmin
    );
    assert.strictEqual(respuesta.statusCode, 200);
    const casos = respuesta.body.casos;
    assert.deepStrictEqual(casos.map((c) => c.cliente).sort(), ['zz_test_ del contador', 'zz_test_ escalado']);

    const escalado = casos.find((c) => c.cliente === 'zz_test_ escalado');
    assert.strictEqual(Number(escalado.contador_id), auxiliar.id);
    assert.strictEqual(escalado.nombre_contador, auxiliar.nombre);
  });

  test('los casos escalados cuentan en los conteos y en el resumen del contador', async () => {
    await crearCaso(dueno.id, { importante: 1 });
    await crearCaso(auxiliar.id, { importante: 1, estado: 'En proceso' });
    await crearCaso(auxiliar.id, { importante: 0 });

    const conteos = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${dueno.id}/conteos?importantes=true`,
      undefined,
      tokenAdmin
    );
    assert.strictEqual(conteos.statusCode, 200);
    assert.strictEqual(Number(conteos.body.pendiente), 1);
    assert.strictEqual(Number(conteos.body.en_proceso), 1);

    const resumen = await peticion(servidor.puerto, 'GET', '/contadores/resumen?importantes=true', undefined, tokenAdmin);
    assert.strictEqual(resumen.statusCode, 200);
    const fila = resumen.body.por_contador.find((f) => Number(f.contador_id) === dueno.id);
    assert.strictEqual(fila.abiertos, 2);
    assert.strictEqual(fila.en_proceso, 1);
  });

  // ---------- Directorio: casos importantes del auxiliar ----------
  test('el admin consulta los casos importantes de un auxiliar', async () => {
    await crearCaso(auxiliar.id, { cliente: 'zz_test_ escalado', importante: 1 });
    await crearCaso(auxiliar.id, { cliente: 'zz_test_ sin escalar', importante: 0 });

    const respuesta = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${auxiliar.id}/casos?importantes=true`,
      undefined,
      tokenAdmin
    );
    assert.strictEqual(respuesta.statusCode, 200);
    assert.deepStrictEqual(
      respuesta.body.casos.map((c) => c.cliente),
      ['zz_test_ escalado']
    );
  });

  test('una cuenta que no trabaja casos sigue dando 404', async () => {
    const respuesta = await peticion(servidor.puerto, 'GET', `/contadores/${admin.id}/casos`, undefined, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 404);
  });
});
