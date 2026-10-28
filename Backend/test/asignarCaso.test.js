const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración: el administrador registra un caso a nombre de un contador
 * (POST /contadores/:id/casos) y el contador recibe un aviso dentro de la app.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let administrador;
let contador;

const tokenAdmin = () => iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
const tokenContador = () => iniciarSesion(servidor.puerto, contador.correo, contador.password);

const CASO_VALIDO = {
  cliente: 'zz_test Lala',
  prioridad: 'Alta',
  fecha_inicio: '2026-11-02',
  fecha_vencimiento: '2026-11-20',
  descripcion: 'Declaración anual',
};

function asignar(contadorId, cuerpo, token) {
  return peticion(servidor.puerto, 'POST', `/contadores/${contadorId}/casos`, cuerpo, token);
}

async function avisosDe(usuarioId) {
  return query('SELECT caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);
}

async function casosDe(contadorId) {
  return query('SELECT id FROM casos WHERE contador_id = ?', [contadorId]);
}

// ---------- El administrador asigna un caso: queda a nombre del contador y se le avisa ----------
async function testAdminAsignaYAvisa() {
  const respuesta = await asignar(contador.id, CASO_VALIDO, await tokenAdmin());

  assert.strictEqual(respuesta.statusCode, 201);
  const { caso } = respuesta.body;
  assert.strictEqual(caso.contador_id, contador.id, 'el caso es del contador elegido, no del administrador');
  assert.strictEqual(caso.cliente, 'zz_test Lala');
  assert.strictEqual(caso.estado, 'Pendiente');
  assert.strictEqual(caso.prioridad, 'Alta');
  assert.match(caso.fecha_inicio, /^2026-11-02/);
  assert.match(caso.fecha_vencimiento, /^2026-11-20/);

  const avisos = await avisosDe(contador.id);
  assert.strictEqual(avisos.length, 1, 'un aviso para el contador');
  assert.strictEqual(avisos[0].caso_id, caso.id);
  assert.strictEqual(avisos[0].leida, 0);
  assert.strictEqual(avisos[0].mensaje, `${administrador.nombre} te asignó el caso «zz_test Lala».`);
}

// ---------- Solo el administrador; contador inexistente o datos inválidos no crean nada ----------
async function testPermisosYValidaciones() {
  const antesCasos = (await casosDe(contador.id)).length;
  const antesAvisos = (await avisosDe(contador.id)).length;

  assert.strictEqual((await asignar(contador.id, CASO_VALIDO, await tokenContador())).statusCode, 403, 'contador');
  assert.strictEqual((await asignar(contador.id, CASO_VALIDO)).statusCode, 401, 'sin sesión');

  const token = await tokenAdmin();
  assert.strictEqual((await asignar(999999999, CASO_VALIDO, token)).statusCode, 404, 'no existe');
  assert.strictEqual((await asignar(`${contador.id}abc`, CASO_VALIDO, token)).statusCode, 404, 'id con letras');
  assert.strictEqual((await asignar(administrador.id, CASO_VALIDO, token)).statusCode, 404, 'no es contador');
  assert.strictEqual((await casosDe(administrador.id)).length, 0, 'el administrador no recibe casos');

  const invalidos = [
    { ...CASO_VALIDO, cliente: '' },
    { ...CASO_VALIDO, prioridad: 'Urgente' },
    { ...CASO_VALIDO, fecha_vencimiento: undefined },
    { ...CASO_VALIDO, fecha_vencimiento: '2026-10-01' },
  ];
  for (const cuerpo of invalidos) {
    assert.strictEqual((await asignar(contador.id, cuerpo, token)).statusCode, 400, JSON.stringify(cuerpo));
  }

  assert.strictEqual((await casosDe(contador.id)).length, antesCasos, 'no se creó ningún caso');
  assert.strictEqual((await avisosDe(contador.id)).length, antesAvisos, 'no se creó ningún aviso');
}

describe('el administrador asigna casos a un contador', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el administrador asigna un caso al contador y este recibe un aviso', testAdminAsignaYAvisa);
  test('solo el administrador; contador inexistente o datos inválidos no crean nada', testPermisosYValidaciones);
});
