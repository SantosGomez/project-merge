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

/**
 * Rol auxiliar (decisión del usuario, 2026-11-10):
 * - Trabaja casos igual que un contador (propios, registrar, editar) y además los de su contador
 *   (solo el estado) y puede registrar casos a nombre de su contador.
 * - Solo una cuenta con rol auxiliar se asigna como auxiliar; el dueño debe ser contador.
 * - No gestiona auxiliares, no entra a auditorías y no aparece en el dashboard del administrador.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let admin;
let contador;
let auxiliar;
let otroContador;
let tokenAdmin;
let tokenContador;
let tokenAuxiliar;

const pedir = (metodo, ruta, cuerpo, token) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);

const casoNuevo = {
  cliente: 'zz_test caso del auxiliar',
  prioridad: 'Media',
  fecha_vencimiento: '31-12-2030',
};

describe('rol auxiliar', () => {
  before(async () => {
    await prepararBaseDeDatos();
    admin = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    otroContador = await crearUsuarioDePrueba('contador');
    await asignarAuxiliar(contador.id, auxiliar.id);
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el auxiliar registra casos propios', async () => {
    const respuesta = await pedir('POST', '/casos', casoNuevo, tokenAuxiliar);
    assert.strictEqual(respuesta.statusCode, 201, JSON.stringify(respuesta.body));
  });

  test('en «Mis casos» ve los suyos (completos) y los de su contador (solo estado)', async () => {
    const propio = await crearCasoDePrueba(auxiliar.id, { cliente: 'zz_test propio del auxiliar' });
    const delContador = await crearCasoDePrueba(contador.id, { cliente: 'zz_test del contador' });

    const respuesta = await pedir('GET', '/casos/mis-casos', undefined, tokenAuxiliar);

    assert.strictEqual(respuesta.statusCode, 200);
    const buscar = (id) => respuesta.body.casos.find((c) => Number(c.id) === id);
    assert.strictEqual(buscar(propio).solo_estado, false);
    assert.strictEqual(buscar(delContador).solo_estado, true);
  });

  test('cambia el estado de un caso de su contador, pero no el cliente', async () => {
    const casoId = await crearCasoDePrueba(contador.id, { cliente: 'zz_test del contador' });

    assert.strictEqual((await pedir('PATCH', `/casos/${casoId}`, { estado: 'En proceso' }, tokenAuxiliar)).statusCode, 200);
    assert.strictEqual((await pedir('PATCH', `/casos/${casoId}`, { cliente: 'zz_test otro' }, tokenAuxiliar)).statusCode, 403);
  });

  test('registra un caso a nombre de su contador', async () => {
    const respuesta = await pedir('POST', '/casos/para-auxiliar', { ...casoNuevo, contador_id: contador.id }, tokenAuxiliar);
    assert.strictEqual(respuesta.statusCode, 201, JSON.stringify(respuesta.body));
  });

  test('consulta los contadores a los que apoya', async () => {
    const respuesta = await pedir('GET', `/contadores/${auxiliar.id}/contadores-que-me-tienen-como-auxiliar`, undefined, tokenAuxiliar);
    assert.strictEqual(respuesta.statusCode, 200);
    assert.deepStrictEqual(respuesta.body.contadores.map((c) => c.id), [contador.id]);
  });

  test('no gestiona auxiliares ni entra a auditorías', async () => {
    assert.strictEqual((await pedir('GET', `/contadores/${auxiliar.id}/auxiliares`, undefined, tokenAuxiliar)).statusCode, 403);
    assert.strictEqual((await pedir('GET', '/auditorias', undefined, tokenAuxiliar)).statusCode, 403);
  });

  test('al contador solo se le ofrecen cuentas con rol auxiliar como disponibles', async () => {
    const libre = await crearUsuarioDePrueba('auxiliar');

    const respuesta = await pedir('GET', `/contadores/${contador.id}/auxiliares-disponibles`, undefined, tokenContador);

    assert.strictEqual(respuesta.statusCode, 200);
    const ids = respuesta.body.contadores.map((c) => c.id);
    assert.ok(ids.includes(libre.id), 'aparece el auxiliar libre');
    assert.ok(!ids.includes(otroContador.id), 'un contador ya no se ofrece como auxiliar');
    assert.ok(!ids.includes(auxiliar.id), 'el auxiliar ya asignado no se repite');
  });

  test('asignar a un contador como auxiliar se rechaza con un mensaje claro', async () => {
    const respuesta = await pedir('POST', `/contadores/${contador.id}/auxiliares/${otroContador.id}`, undefined, tokenContador);

    assert.strictEqual(respuesta.statusCode, 400);
    assert.match(respuesta.body.mensaje, /no es un auxiliar/i);
  });

  test('el contador sí asigna una cuenta con rol auxiliar', async () => {
    const nuevo = await crearUsuarioDePrueba('auxiliar');
    const respuesta = await pedir('POST', `/contadores/${contador.id}/auxiliares/${nuevo.id}`, undefined, tokenContador);
    assert.ok([200, 201].includes(respuesta.statusCode), JSON.stringify(respuesta.body));
  });

  test('el dashboard del administrador no lista auxiliares', async () => {
    const respuesta = await pedir('GET', '/contadores', undefined, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 200);
    const ids = respuesta.body.contadores.map((c) => c.id);
    assert.ok(ids.includes(contador.id));
    assert.ok(!ids.includes(auxiliar.id));
  });
});
