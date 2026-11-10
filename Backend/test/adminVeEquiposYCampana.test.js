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
const CaseModel = require('../src/models/CaseModel');

let servidor;
let admin;
let dueno;
let auxiliar;
let tokenAdmin;
let tokenDueno;
let tokenAuxiliar;

async function casosDelContadorParaAdmin(contadorId, token) {
  return peticion(servidor.puerto, 'GET', `/contadores/${contadorId}/casos`, undefined, token);
}

async function avisosDe(usuarioId) {
  return query('SELECT id, caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);
}

async function crearCaso(contadorId, datos = {}) {
  const resultado = await query(
    `INSERT INTO casos (contador_id, cliente, estado, prioridad, importante, fecha_inicio, fecha_vencimiento, descripcion, observaciones, creado_en, actualizado_en) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      contadorId,
      datos.cliente ?? 'zz_test cliente',
      datos.estado ?? 'Pendiente',
      datos.prioridad ?? 'Media',
      datos.importante ?? 0,
      datos.fecha_inicio ?? '2026-11-02',
      datos.fecha_vencimiento ?? '2026-11-20',
      datos.descripcion ?? null,
      datos.observaciones ?? null,
    ]
  );
  return Number(resultado.insertId);
}

describe('Rebanada 8: Admin ve equipos y campana con enlace', () => {
  before(async () => {
    await prepararBaseDeDatos();
    admin = await crearUsuarioDePrueba('administrador');
    dueno = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('contador');
    await asignarAuxiliar(dueno.id, auxiliar.id);
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenDueno = await iniciarSesion(servidor.puerto, dueno.correo, dueno.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
    console.log('SETUP: dueno.id=', dueno.id, 'auxiliar.id=', auxiliar.id, 'admin.id=', admin.id);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  beforeEach(async () => {
    await query('DELETE FROM casos WHERE contador_id IN (?, ?)', [dueno.id, auxiliar.id]);
  });

  // ---------- Admin ve casos de auxiliares ----------
  test('el admin ve los casos del contador Y de su auxiliar', async () => {
    // Caso propio del dueño
    await crearCaso(dueno.id, { cliente: 'zz_test caso dueno' });
    // Caso del auxiliar (guardado con contador_id = dueno.id por rebanada 6)
    await crearCaso(dueno.id, { cliente: 'zz_test caso auxiliar' });

    const respuesta = await casosDelContadorParaAdmin(dueno.id, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.ok(Array.isArray(respuesta.body.casos));

    // Debe venir nombre_contador en cada fila
    const clientes = respuesta.body.casos.map((c) => c.cliente).sort();
    assert.deepStrictEqual(clientes, ['zz_test caso auxiliar', 'zz_test caso dueno']);

    // Cada caso trae nombre_contador (el dueño)
    for (const caso of respuesta.body.casos) {
      assert.ok(caso.nombre_contador, `caso ${caso.cliente} debe traer nombre_contador`);
      assert.strictEqual(caso.nombre_contador, dueno.nombre);
    }
  });

  test('el admin ve solo los casos importantes del contador y auxiliares', async () => {
    await crearCaso(dueno.id, { cliente: 'zz_test caso importante', importante: 1 });
    await crearCaso(dueno.id, { cliente: 'zz_test caso normal', importante: 0 });

    // Debug: ver qué devuelve el modelo directamente
    const casosModelo = await CaseModel.findByCounterParaAdmin(dueno.id, { soloImportantes: true });
    console.log('DEBUG modelo dueno.id=', dueno.id, ':', JSON.stringify(casosModelo.map(c => ({cliente: c.cliente, importante: c.importante}))));

    // Con ?importantes=true (lo que usa el dashboard)
    const respuesta = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${dueno.id}/casos?importantes=true`,
      undefined,
      tokenAdmin
    );
    console.log('DEBUG respuesta dueno.id=', dueno.id, ':', JSON.stringify(respuesta.body.casos.map(c => ({cliente: c.cliente, importante: c.importante}))));
    assert.strictEqual(respuesta.statusCode, 200);
    assert.strictEqual(respuesta.body.casos.length, 1);
    assert.strictEqual(respuesta.body.casos[0].cliente, 'zz_test caso importante');
  });

  // ---------- Campana con enlace: notificaciones traen casoId ----------
  test('el aviso de auxiliar crea caso incluye casoId', async () => {
    const antes = await avisosDe(dueno.id);

    // El auxiliar crea un caso via POST /casos/para-auxiliar
    await peticion(
      servidor.puerto,
      'POST',
      '/casos/para-auxiliar',
      {
        contador_id: dueno.id,
        cliente: 'zz_test caso del auxiliar',
        prioridad: 'Alta',
        fecha_inicio: '2026-11-02',
        fecha_vencimiento: '2026-11-20',
      },
      tokenAuxiliar
    );

    const despues = await avisosDe(dueno.id);
    assert.strictEqual(despues.length, antes.length + 1);
    const aviso = despues[despues.length - 1];
    assert.ok(aviso.caso_id, 'el aviso debe traer caso_id');
    assert.strictEqual(typeof aviso.caso_id, 'number');
  });

  test('el aviso de auxiliar edita estado incluye casoId', async () => {
    const casoId = await crearCaso(dueno.id, { cliente: 'zz_test caso para editar' });
    const antes = await avisosDe(dueno.id);

    // El auxiliar edita el estado
    await peticion(
      servidor.puerto,
      'PATCH',
      '/casos/' + casoId,
      { estado: 'En proceso' },
      tokenAuxiliar
    );

    const despues = await avisosDe(dueno.id);
    assert.strictEqual(despues.length, antes.length + 1);
    const aviso = despues[despues.length - 1];
    assert.ok(aviso.caso_id, 'el aviso debe traer caso_id');
    assert.strictEqual(aviso.caso_id, casoId);
  });
});