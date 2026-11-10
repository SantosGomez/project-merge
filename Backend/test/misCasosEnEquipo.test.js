const assert = require('node:assert');
const { describe, test, before, after, beforeEach } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración de «Mis casos» en equipo (decisión del usuario, 2026-11-10):
 * - El dueño ve los casos de su auxiliar y los edita completos.
 * - El auxiliar ve los casos del dueño y solo les cambia el estado.
 * - El administrador ve en el detalle de un contador solo los casos de ese contador.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let admin;
let dueno;
let auxiliar;
let ajeno;
let tokenAdmin;
let tokenDueno;
let tokenAuxiliar;
let tokenAjeno;

const misCasos = (token) => peticion(servidor.puerto, 'GET', '/casos/mis-casos', undefined, token);
const patch = (casoId, cuerpo, token) => peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, cuerpo, token);
const buscar = (respuesta, casoId) => respuesta.body.casos.find((c) => Number(c.id) === Number(casoId));

async function casoGuardado(casoId) {
  const [fila] = await query('SELECT cliente, estado, prioridad FROM casos WHERE id = ?', [casoId]);
  return fila;
}

describe('«Mis casos» en equipo: dueño y auxiliar', () => {
  before(async () => {
    await prepararBaseDeDatos();
    admin = await crearUsuarioDePrueba('administrador');
    dueno = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('contador');
    ajeno = await crearUsuarioDePrueba('contador');
    await asignarAuxiliar(dueno.id, auxiliar.id);
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenDueno = await iniciarSesion(servidor.puerto, dueno.correo, dueno.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
    tokenAjeno = await iniciarSesion(servidor.puerto, ajeno.correo, ajeno.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  beforeEach(async () => {
    await query('DELETE FROM notificaciones WHERE usuario_id IN (?, ?, ?)', [dueno.id, auxiliar.id, ajeno.id]);
    await query('DELETE FROM casos WHERE contador_id IN (?, ?, ?)', [dueno.id, auxiliar.id, ajeno.id]);
  });

  test('el dueño ve sus casos y los de su auxiliar, con edición completa en ambos', async () => {
    const propio = await crearCasoDePrueba(dueno.id, { cliente: 'zz_test propio del dueño' });
    const delAuxiliar = await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test del auxiliar' });
    await crearCasoDePrueba(ajeno.id, { cliente: 'zz_test de un ajeno' });

    const respuesta = await misCasos(tokenDueno);

    assert.strictEqual(respuesta.statusCode, 200);
    assert.strictEqual(respuesta.body.casos.length, 2, 'no incluye casos de contadores ajenos');
    assert.strictEqual(buscar(respuesta, propio).solo_estado, false);
    assert.strictEqual(buscar(respuesta, delAuxiliar).solo_estado, false, 'el dueño edita completo el caso del auxiliar');
  });

  test('el auxiliar ve sus casos y los del dueño; en los del dueño solo cambia el estado', async () => {
    const propio = await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test propio del auxiliar' });
    const delDueno = await crearCasoDePrueba(dueno.id, { cliente: 'zz_test del dueño' });

    const respuesta = await misCasos(tokenAuxiliar);

    assert.strictEqual(respuesta.statusCode, 200);
    assert.strictEqual(respuesta.body.casos.length, 2);
    assert.strictEqual(buscar(respuesta, propio).solo_estado, false);
    assert.strictEqual(buscar(respuesta, delDueno).solo_estado, true, 'el auxiliar solo cambia el estado del caso del dueño');
    assert.strictEqual(buscar(respuesta, delDueno).nombre_contador, dueno.nombre);
  });

  test('el dueño edita cliente y prioridad de un caso de su auxiliar', async () => {
    const casoId = await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test antes', prioridad: 'Baja' });

    const respuesta = await patch(casoId, { cliente: 'zz_test después', prioridad: 'Alta' }, tokenDueno);

    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    const guardado = await casoGuardado(casoId);
    assert.strictEqual(guardado.cliente, 'zz_test después');
    assert.strictEqual(guardado.prioridad, 'Alta');
  });

  test('cuando el dueño cambia el estado de un caso del auxiliar, el auxiliar recibe aviso', async () => {
    const casoId = await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test con aviso', estado: 'Pendiente' });

    const respuesta = await patch(casoId, { estado: 'En proceso' }, tokenDueno);

    assert.strictEqual(respuesta.statusCode, 200);
    const avisos = await query('SELECT caso_id FROM notificaciones WHERE usuario_id = ?', [auxiliar.id]);
    assert.strictEqual(avisos.length, 1);
    assert.strictEqual(Number(avisos[0].caso_id), casoId);
  });

  test('el auxiliar sigue sin poder cambiar el cliente de un caso del dueño', async () => {
    const casoId = await crearCasoDePrueba(dueno.id, { cliente: 'zz_test del dueño' });

    const respuesta = await patch(casoId, { cliente: 'zz_test cambiado' }, tokenAuxiliar);

    assert.strictEqual(respuesta.statusCode, 403);
    assert.strictEqual((await casoGuardado(casoId)).cliente, 'zz_test del dueño');
  });

  test('un contador ajeno no puede editar los casos del equipo', async () => {
    const casoId = await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test del auxiliar' });

    const respuesta = await patch(casoId, { estado: 'Finalizado' }, tokenAjeno);

    assert.strictEqual(respuesta.statusCode, 403);
  });

  test('el administrador ve en el detalle del dueño solo los casos del dueño', async () => {
    await crearCasoDePrueba(dueno.id, { cliente: 'zz_test del dueño' });
    await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test del auxiliar' });

    const respuesta = await peticion(servidor.puerto, 'GET', `/contadores/${dueno.id}/casos`, undefined, tokenAdmin);

    assert.strictEqual(respuesta.statusCode, 200);
    assert.deepStrictEqual(
      respuesta.body.casos.map((c) => c.cliente),
      ['zz_test del dueño'],
      'el caso del auxiliar se ve solo en el detalle del auxiliar'
    );
  });
});
