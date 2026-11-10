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

/**
 * Pruebas de integración: un auxiliar crea un caso a nombre de su contador
 * (POST /casos/para-auxiliar) y el contador dueño recibe un aviso.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let contadorDueño;
let contadorAuxiliar;
let tokenAuxiliarValido;

async function avisosDe(usuarioId) {
  return query('SELECT caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);
}

async function casosDeContador(contadorId) {
  return query('SELECT id, cliente, estado, prioridad FROM casos WHERE contador_id = ?', [contadorId]);
}

// ---------- El auxiliar crea un caso para su contador y el dueño recibe aviso ----------
async function testAuxiliarCreaCasoParaSuContadorYAvisa() {
  // El auxiliar está asignado al dueño
  await asignarAuxiliar(contadorDueño.id, contadorAuxiliar.id);

  const antesAvisos = (await avisosDe(contadorDueño.id)).length;
  const antesCasos = (await casosDeContador(contadorDueño.id)).length;

  const cuerpo = {
    contador_id: contadorDueño.id,
    cliente: 'zz_test cliente del auxiliar',
    prioridad: 'Alta',
    fecha_inicio: '2026-11-02',
    fecha_vencimiento: '2026-11-20',
    descripcion: 'Creado por el auxiliar',
  };

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos/para-auxiliar',
    cuerpo,
    await tokenAuxiliarValido()
  );

  assert.strictEqual(respuesta.statusCode, 201, 'el auxiliar puede crear un caso para su contador');
  const { caso } = respuesta.body;
  assert.strictEqual(caso.contador_id, contadorDueño.id, 'el caso es del contador dueño, no del auxiliar');
  assert.strictEqual(caso.cliente, 'zz_test cliente del auxiliar');

  const despuesCasos = (await casosDeContador(contadorDueño.id)).length;
  assert.strictEqual(despuesCasos, antesCasos + 1, 'se creó un caso para el contador dueño');

  const avisos = await avisosDe(contadorDueño.id);
  assert.strictEqual(
    avisos.length,
    antesAvisos + 1,
    'el contador dueño recibe un aviso nuevo'
  );
  const ultimo = avisos[avisos.length - 1];
  assert.strictEqual(ultimo.caso_id, caso.id);
  assert.strictEqual(ultimo.leida, 0);
  assert.ok(
    ultimo.mensaje.includes('creó el caso'),
    'el aviso menciona que el auxiliar creó el caso: ' + ultimo.mensaje
  );
}

// ---------- El contador dueño no puede usar este endpoint para sí mismo ----------
async function testContadorDueñoNoPuedeUsarEndpointDeAuxiliar() {
  const cuerpo = {
    contador_id: contadorDueño.id,
    cliente: 'zz_test caso invalido',
    prioridad: 'Media',
    fecha_inicio: '2026-11-02',
    fecha_vencimiento: '2026-11-20',
  };

  const tokenDueño = await iniciarSesion(servidor.puerto, contadorDueño.correo, contadorDueño.password);

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos/para-auxiliar',
    cuerpo,
    tokenDueño
  );

  assert.strictEqual(respuesta.statusCode, 403, 'el contador dueño no puede crearse caso como auxiliar');
}

// ---------- Un contador que no es auxiliar no puede usar el endpoint ----------
async function testContadorNoAuxiliarNoPuedeUsarEndpoint() {
  const otroContador = await crearUsuarioDePrueba('contador');
  const tokenOtro = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);

  const cuerpo = {
    contador_id: contadorDueño.id,
    cliente: 'zz_test caso invalido',
    prioridad: 'Media',
    fecha_inicio: '2026-11-02',
    fecha_vencimiento: '2026-11-20',
  };

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos/para-auxiliar',
    cuerpo,
    tokenOtro
  );

  assert.strictEqual(respuesta.statusCode, 403, 'un contador no auxiliar recibe 403');
}

// ---------- Datos inválidos no crean nada ----------
async function testDatosInvalidosNoCreanCaso() {
  const antesCasos = (await casosDeContador(contadorDueño.id)).length;

  const cuerpoInvalido = {
    contador_id: contadorDueño.id,
    cliente: '', // cliente vacío: inválido
    prioridad: 'Alta',
    fecha_inicio: '2026-11-02',
    fecha_vencimiento: '2026-11-20',
  };

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/casos/para-auxiliar',
    cuerpoInvalido,
    await tokenAuxiliarValido()
  );

  assert.strictEqual(respuesta.statusCode, 400, 'datos inválidos responden 400');

  const despuesCasos = (await casosDeContador(contadorDueño.id)).length;
  assert.strictEqual(despuesCasos, antesCasos, 'no se creó ningún caso con datos inválidos');
}

describe('el auxiliar crea un caso para su contador', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contadorDueño = await crearUsuarioDePrueba('contador');
    contadorAuxiliar = await crearUsuarioDePrueba('auxiliar');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  beforeEach(async () => {
    tokenAuxiliarValido = async () =>
      iniciarSesion(servidor.puerto, contadorAuxiliar.correo, contadorAuxiliar.password);
  });

  test('el auxiliar crea un caso para su contador y el dueño recibe aviso', testAuxiliarCreaCasoParaSuContadorYAvisa);
  test('el contador dueño no puede usar el endpoint de auxiliar', testContadorDueñoNoPuedeUsarEndpointDeAuxiliar);
  test('un contador no auxiliar no puede usar el endpoint', testContadorNoAuxiliarNoPuedeUsarEndpoint);
  test('datos inválidos no crean caso', testDatosInvalidosNoCreanCaso);
});
