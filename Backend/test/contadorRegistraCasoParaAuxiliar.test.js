const assert = require('node:assert');
const { describe, test, before, after, mock } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { eventos } = require('../src/utils/eventos');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración: el contador registra un caso nuevo a nombre de su auxiliar
 * (POST /casos/para-mi-auxiliar). Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo crea y borra datos `zz_test_` de este proceso.
 */

let servidor;
let contador;
let auxiliarDeContador;
let otroContador;
let auxiliarAjeno;
let administrador;
let tokenContador;

const cuerpoBase = () => ({
  cliente: 'zz_test cliente para el auxiliar',
  prioridad: 'Alta',
  fecha_inicio: '2026-11-02',
  fecha_vencimiento: '2026-11-20',
  descripcion: 'Registrado por el contador',
});

const casosDe = (usuarioId) => query('SELECT id, estado, importante FROM casos WHERE contador_id = ?', [usuarioId]);
const avisosDe = (usuarioId) => query('SELECT caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);

describe('el contador registra un caso para su auxiliar', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    auxiliarDeContador = await crearUsuarioDePrueba('auxiliar');
    otroContador = await crearUsuarioDePrueba('contador');
    auxiliarAjeno = await crearUsuarioDePrueba('auxiliar');
    administrador = await crearUsuarioDePrueba('administrador');
    await asignarAuxiliar(contador.id, auxiliarDeContador.id);
    await asignarAuxiliar(otroContador.id, auxiliarAjeno.id);
    servidor = await iniciarServidor();
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  });

  after(async () => {
    mock.restoreAll();
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('crea el caso a nombre del auxiliar, Pendiente e Importante, y le avisa', async () => {
    const aUsuario = mock.method(eventos, 'enviarAUsuario', () => {});
    const aRol = mock.method(eventos, 'enviarARol', () => {});

    const respuesta = await peticion(
      servidor.puerto,
      'POST',
      '/casos/para-mi-auxiliar',
      { ...cuerpoBase(), auxiliar_id: auxiliarDeContador.id, importante: true },
      tokenContador
    );

    assert.strictEqual(respuesta.statusCode, 201);
    assert.strictEqual(respuesta.body.mensaje, 'Caso asignado correctamente');
    const { caso } = respuesta.body;
    assert.strictEqual(caso.contador_id, auxiliarDeContador.id, 'el caso queda a nombre del auxiliar');
    assert.strictEqual(caso.estado, 'Pendiente');
    assert.strictEqual(caso.importante, true);
    assert.strictEqual(caso.fecha_vencimiento, '2026-11-20 00:00:00');

    const avisos = await avisosDe(auxiliarDeContador.id);
    assert.strictEqual(avisos.length, 1, 'el auxiliar recibe un aviso');
    assert.strictEqual(avisos[0].caso_id, caso.id);
    assert.strictEqual(avisos[0].mensaje, `${contador.nombre} te asignó el caso «zz_test cliente para el auxiliar».`);

    assert.ok(
      aUsuario.mock.calls.some((c) => c.arguments[0] === auxiliarDeContador.id && c.arguments[1] === 'aviso-nuevo'),
      'SSE aviso-nuevo al auxiliar'
    );
    assert.ok(
      aRol.mock.calls.some((c) => c.arguments[0] === 'administrador' && c.arguments[1] === 'caso-actualizado'),
      'SSE caso-actualizado a los administradores'
    );
    mock.restoreAll();
  });

  test('sin importante, el caso nace no importante', async () => {
    const respuesta = await peticion(
      servidor.puerto,
      'POST',
      '/casos/para-mi-auxiliar',
      { ...cuerpoBase(), auxiliar_id: auxiliarDeContador.id },
      tokenContador
    );
    assert.strictEqual(respuesta.statusCode, 201);
    assert.strictEqual(respuesta.body.caso.importante, false);
  });

  test('un auxiliar de otro contador responde 403 y no crea nada', async () => {
    const antes = (await casosDe(auxiliarAjeno.id)).length;
    const respuesta = await peticion(
      servidor.puerto,
      'POST',
      '/casos/para-mi-auxiliar',
      { ...cuerpoBase(), auxiliar_id: auxiliarAjeno.id },
      tokenContador
    );
    assert.strictEqual(respuesta.statusCode, 403);
    assert.ok(respuesta.body.mensaje.includes('No es tu auxiliar'), respuesta.body.mensaje);
    assert.strictEqual((await casosDe(auxiliarAjeno.id)).length, antes);
  });

  test('id inválido, inexistente o de una cuenta que no es auxiliar responde 404', async () => {
    for (const auxiliar_id of ['abc', 99999999, otroContador.id, undefined]) {
      const respuesta = await peticion(
        servidor.puerto,
        'POST',
        '/casos/para-mi-auxiliar',
        { ...cuerpoBase(), auxiliar_id },
        tokenContador
      );
      assert.strictEqual(respuesta.statusCode, 404, `auxiliar_id ${auxiliar_id}`);
    }
  });

  test('un auxiliar o un administrador no pueden usar la ruta (403)', async () => {
    for (const cuenta of [auxiliarDeContador, administrador]) {
      const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
      const respuesta = await peticion(
        servidor.puerto,
        'POST',
        '/casos/para-mi-auxiliar',
        { ...cuerpoBase(), auxiliar_id: auxiliarDeContador.id },
        token
      );
      assert.strictEqual(respuesta.statusCode, 403, cuenta.nombre);
    }
  });

  test('datos inválidos responden 400 y no crean caso ni aviso', async () => {
    const casosAntes = (await casosDe(auxiliarDeContador.id)).length;
    const avisosAntes = (await avisosDe(auxiliarDeContador.id)).length;
    const respuesta = await peticion(
      servidor.puerto,
      'POST',
      '/casos/para-mi-auxiliar',
      { ...cuerpoBase(), cliente: '', auxiliar_id: auxiliarDeContador.id },
      tokenContador
    );
    assert.strictEqual(respuesta.statusCode, 400);
    assert.strictEqual((await casosDe(auxiliarDeContador.id)).length, casosAntes);
    assert.strictEqual((await avisosDe(auxiliarDeContador.id)).length, avisosAntes);
  });
});
