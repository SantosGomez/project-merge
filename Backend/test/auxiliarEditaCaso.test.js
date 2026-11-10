const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
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
 * Pruebas de integración: un auxiliar edita el estado de un caso de su contador
 * (PATCH /casos/:id) y el contador dueño recibe un aviso dentro de la app.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let contadorDueño;
let contadorAuxiliar;
let casoDelDueño;

const tokenDueño = () => iniciarSesion(servidor.puerto, contadorDueño.correo, contadorDueño.password);
const tokenAuxiliar = () => iniciarSesion(servidor.puerto, contadorAuxiliar.correo, contadorAuxiliar.password);

async function avisosDe(usuarioId) {
  return query('SELECT caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);
}

async function estadoDelCaso(casoId) {
  const [fila] = await query('SELECT estado FROM casos WHERE id = ?', [casoId]);
  return fila && fila.estado;
}

// ---------- Un auxiliar edita el estado de un caso de su contador y el dueño recibe aviso ----------
async function testAuxiliarEditaEstadoYAvisaAlDueño() {
  // El auxiliar está asignado al dueño
  await asignarAuxiliar(contadorDueño.id, contadorAuxiliar.id);

  const antesAvisos = (await avisosDe(contadorDueño.id)).length;

  const respuesta = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoDelDueño}`,
    { estado: 'En proceso' },
    await tokenAuxiliar()
  );

  assert.strictEqual(respuesta.statusCode, 200, 'el auxiliar puede editar el estado');
  assert.strictEqual(await estadoDelCaso(casoDelDueño), 'En proceso', 'el estado cambió');

  const avisos = await avisosDe(contadorDueño.id);
  assert.strictEqual(
    avisos.length,
    antesAvisos + 1,
    'el contador dueño recibe un aviso nuevo'
  );
  const ultimo = avisos[avisos.length - 1];
  assert.strictEqual(ultimo.caso_id, casoDelDueño);
  assert.strictEqual(ultimo.leida, 0);
  assert.ok(
    ultimo.mensaje.includes('cambió el estado'),
    'el aviso menciona el cambio de estado: ' + ultimo.mensaje
  );
}

// ---------- Un contador que no es auxiliar no puede editar ----------
async function testContadorNoAuxiliarNoPuedeEditar() {
  const otroContador = await crearUsuarioDePrueba('contador');
  const tokenOtro = () =>
    iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);

  // Caso nuevo del dueño, aún no tocado
  const casoNuevo = await crearCasoDePrueba(contadorDueño.id, {
    cliente: 'zz_test caso no editable por ajeno',
    estado: 'Pendiente',
  });

  const respuesta = await peticion(
    servidor.puerto,
    'PATCH',
    `/casos/${casoNuevo}`,
    { estado: 'Finalizado' },
    await tokenOtro()
  );

  assert.strictEqual(respuesta.statusCode, 403, 'un contador no auxiliar recibe 403');
  assert.strictEqual(await estadoDelCaso(casoNuevo), 'Pendiente', 'el estado no cambió');
}

describe('el auxiliar edita casos de su contador', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contadorDueño = await crearUsuarioDePrueba('contador');
    contadorAuxiliar = await crearUsuarioDePrueba('contador');
    casoDelDueño = await crearCasoDePrueba(contadorDueño.id, {
      cliente: 'zz_test caso del dueño',
      estado: 'Pendiente',
    });
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el auxiliar edita el estado y el dueño recibe aviso', testAuxiliarEditaEstadoYAvisaAlDueño);
  test('un contador no auxiliar no puede editar', testContadorNoAuxiliarNoPuedeEditar);
});
