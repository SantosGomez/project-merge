const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Pruebas de integración del chat de auditorías (experimento, rebanada 1): cada auditoría
 * tiene un hilo de mensajes entre el administrador y sus contadores asignados.
 * Levanta la app real y usa la base de MariaDB local; al final borra solo lo de este proceso.
 */

let servidor;
let contador;
let otroContador;
let administrador;
let tokenContador;
let tokenOtroContador;
let tokenAdmin;
let auditoria;

async function registrarAuditoria(token) {
  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/auditorias',
    {
      cliente: 'Cliente Ejemplo Chat, S.A. de C.V.',
      no_expediente: 'VDM-CHAT-001/2026',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Visita Domiciliaria',
      periodo_inicio: '01-01-2023',
      periodo_final: '31-12-2023',
      fecha_inicio: '15-02-2026',
      fecha_vencimiento: '15-02-2027',
    },
    token
  );
  return respuesta.body.auditoria;
}

async function enviarMensaje(texto, token, auditoriaId = auditoria.id) {
  return peticion(servidor.puerto, 'POST', `/auditorias/${auditoriaId}/mensajes`, { texto }, token);
}

async function listarMensajes(token, auditoriaId = auditoria.id) {
  return peticion(servidor.puerto, 'GET', `/auditorias/${auditoriaId}/mensajes`, undefined, token);
}

async function testContadorAsignadoEnviaMensaje() {
  const respuesta = await enviarMensaje('  Ya subí los contratos al expediente.  ', tokenContador);

  assert.strictEqual(respuesta.statusCode, 201);
  assert.strictEqual(respuesta.body.mensaje, 'Mensaje enviado correctamente');
  const nuevo = respuesta.body.nuevo_mensaje;
  assert.ok(Number.isInteger(nuevo.id) && nuevo.id > 0);
  assert.strictEqual(nuevo.auditoria_id, auditoria.id);
  assert.strictEqual(nuevo.texto, 'Ya subí los contratos al expediente.', 'se guardan sin espacios sobrantes');
  assert.deepStrictEqual(nuevo.autor, { id: contador.id, nombre: contador.nombre, rol: 'contador' });
  assert.match(nuevo.creado_en, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'hora local YYYY-MM-DD HH:mm:ss');
}

async function testPermisos() {
  const ajeno = await enviarMensaje('Hola', tokenOtroContador);
  assert.strictEqual(ajeno.statusCode, 403, 'un contador no asignado no escribe');
  assert.strictEqual((await listarMensajes(tokenOtroContador)).statusCode, 403, 'ni lee el chat');

  assert.strictEqual((await enviarMensaje('Hola', tokenAdmin, 999999999)).statusCode, 404);
  assert.strictEqual((await listarMensajes(tokenAdmin, 999999999)).statusCode, 404);

  const delAdmin = await enviarMensaje('Revisa el requerimiento, por favor.', tokenAdmin);
  assert.strictEqual(delAdmin.statusCode, 201, 'el administrador escribe en cualquier auditoría');
  assert.strictEqual(delAdmin.body.nuevo_mensaje.autor.rol, 'administrador');

  const sinSesion = await peticion(servidor.puerto, 'GET', `/auditorias/${auditoria.id}/mensajes`);
  assert.strictEqual(sinSesion.statusCode, 401);
}

async function testValidaciones() {
  const casos = [
    ['', /mensaje/],
    ['    ', /mensaje/],
    ['x'.repeat(1001), /1000/],
    [42, /mensaje/],
    [null, /mensaje/],
  ];
  for (const [texto, esperado] of casos) {
    const respuesta = await enviarMensaje(texto, tokenContador);
    assert.strictEqual(respuesta.statusCode, 400, `debe rechazar ${JSON.stringify(texto).slice(0, 40)}`);
    assert.match(respuesta.body.mensaje, esperado);
  }

  const justo = await enviarMensaje('x'.repeat(1000), tokenContador);
  assert.strictEqual(justo.statusCode, 201, '1000 caracteres sí caben');
}

async function testListaEnOrden() {
  const propia = await registrarAuditoria(tokenContador);
  await enviarMensaje('Primero', tokenContador, propia.id);
  await enviarMensaje('Segundo', tokenAdmin, propia.id);
  await enviarMensaje('Tercero', tokenContador, propia.id);

  const respuesta = await listarMensajes(tokenContador, propia.id);
  assert.strictEqual(respuesta.statusCode, 200);
  const { mensajes } = respuesta.body;
  assert.deepStrictEqual(
    mensajes.map((m) => m.texto),
    ['Primero', 'Segundo', 'Tercero'],
    'en el orden en que se enviaron'
  );
  assert.deepStrictEqual(
    mensajes.map((m) => m.autor.id),
    [contador.id, administrador.id, contador.id]
  );

  const vacia = await registrarAuditoria(tokenContador);
  assert.deepStrictEqual((await listarMensajes(tokenAdmin, vacia.id)).body.mensajes, [], 'sin mensajes, lista vacía');
}

describe('Chat de auditorías', () => {
  before(async () => {
    await prepararBaseDeDatos();
    servidor = await iniciarServidor();
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    administrador = await crearUsuarioDePrueba('administrador');
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenOtroContador = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
    tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
    auditoria = await registrarAuditoria(tokenContador);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('un contador asignado envía un mensaje al chat de la auditoría', testContadorAsignadoEnviaMensaje);
  test('solo el administrador y los contadores asignados leen y escriben', testPermisos);
  test('el mensaje no puede ir vacío ni pasar de 1000 caracteres', testValidaciones);
  test('el chat se lista en el orden en que se enviaron los mensajes', testListaEnOrden);
});
