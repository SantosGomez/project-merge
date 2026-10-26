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
const { query } = require('../src/config/db');
const { formatLocalDate, formatearFechaISO, nowLocal } = require('../src/utils/dateUtils');
const CaseModel = require('../src/models/CaseModel');

// Formato de hora local de RNF-2: sin `T`, sin `Z` y sin milisegundos.
const FORMATO_FECHA_LOCAL = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * Pruebas de integración de las rutas de contadores (counterRoutes).
 * RF-12 a RF-16, RF-08, RF-09, RF-23, RF-48, RNF-2, RNF-5, RNF-6.
 *
 * Levanta la aplicación real en un puerto libre y hace peticiones HTTP reales.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea su propio administrador y sus
 * propios contadores con prefijo `zz_test_`; los conteos y los casos se afirman
 * sobre datos propios (nunca sobre el seed ni sobre `contadores[0]`), el id
 * inexistente se calcula en vez de fijarlo y el `after` borra solo lo que este
 * proceso registró y cierra el pool.
 */

let servidor;
let administrador;
let contador;
let contadorConCasos;
let contadorResumen;
let tokenAdmin;
let tokenContador;

async function iniciarSesionDe(usuario) {
  return iniciarSesion(servidor.puerto, usuario.correo, usuario.password);
}

/**
 * Calcula un id de usuario que no existe: el máximo actual más un margen amplio.
 * Evita depender de un número fijo (aislamiento, plan 9.3).
 * @returns {Promise<number>} Id de usuario inexistente.
 */
async function idDeUsuarioInexistente() {
  const filas = await query('SELECT COALESCE(MAX(id), 0) + 1000 AS id FROM usuarios');
  return Number(filas[0].id);
}

// ---------- RF-12: listar contadores (solo admin) ----------
async function testListarContadoresComoAdmin() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/contadores', null, tokenAdmin);
  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 al listar contadores');
  assert.ok(Array.isArray(respuesta.body.contadores), 'debe devolver un array de contadores');

  // La lista trae todos los contadores de la base: se afirma la presencia de los propios,
  // nunca una cantidad total (otros archivos de prueba y el seed también aparecen).
  const nombres = respuesta.body.contadores.map((fila) => fila.nombre);
  assert.ok(nombres.includes(contador.nombre), 'la lista debe incluir el contador propio');
  assert.ok(nombres.includes(contadorConCasos.nombre), 'la lista debe incluir el contador propio con casos');

  // Cada fila trae solo { id, nombre }: el usuario de acceso ya no se expone.
  for (const fila of respuesta.body.contadores) {
    assert.deepStrictEqual(Object.keys(fila).sort(), ['id', 'nombre'], 'cada contador trae solo id y nombre');
  }
}

// ---------- RF-08: contador no puede listar contadores (acceso denegado) ----------
async function testListarContadoresComoContadorEsDenegado() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/contadores', null, tokenContador);
  assert.strictEqual(respuesta.statusCode, 403, 'debe responder 403 para contador');
  assert.ok(respuesta.body.mensaje.includes('Acceso denegado') || respuesta.body.mensaje.includes('Rol insuficiente'), 'mensaje debe ser de acceso denegado');
}

// ---------- RF-13: conteos por estado con ceros ----------
async function testConteosPorEstado() {
  const respuesta = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contadorConCasos.id}/conteos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con los conteos');
  assert.ok(typeof respuesta.body.pendiente === 'number', 'debe incluir conteo pendiente');
  assert.ok(typeof respuesta.body.en_proceso === 'number', 'debe incluir conteo en_proceso');
  assert.ok(typeof respuesta.body.finalizado === 'number', 'debe incluir conteo finalizado');

  // Conteos exactos sobre los casos propios creados en `before` (2 Pendiente, 0 En proceso, 1 Finalizado).
  assert.strictEqual(respuesta.body.pendiente, 2, 'debe contar exactamente los casos Pendiente propios');
  assert.strictEqual(respuesta.body.en_proceso, 0, 'debe devolver cero cuando no hay casos En proceso (RF-13)');
  assert.strictEqual(respuesta.body.finalizado, 1, 'debe contar exactamente los casos Finalizado propios');
}

// ---------- RF-16: contador inexistente devuelve 404 ----------
async function testContadorInexistenteDevuelve404() {
  const contadorInexistente = await idDeUsuarioInexistente();

  const conteosResp = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contadorInexistente}/conteos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(conteosResp.statusCode, 404, 'debe responder 404 para contador inexistente');
  assert.ok(conteosResp.body.mensaje.includes('No se encontró el contador'), 'mensaje debe indicar no encontrado');

  // El endpoint de casos de un contador inexistente también responde no encontrado.
  const casosResp = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contadorInexistente}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(casosResp.statusCode, 404, 'el endpoint de casos también debe responder 404');
  assert.ok(casosResp.body.mensaje.includes('No se encontró el contador'), 'mensaje debe indicar no encontrado');
  assert.strictEqual(casosResp.body.casos, undefined, 'no debe devolver casos de un contador inexistente');
}

// ---------- RF-14: casos de un contador (admin) ----------
async function testCasosDeContadorComoAdmin() {
  const respuesta = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contadorConCasos.id}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con los casos del contador');
  assert.ok(Array.isArray(respuesta.body.casos), 'debe devolver un array de casos');

  // Solo los casos propios de ese contador, exactamente los creados en `before`.
  assert.strictEqual(respuesta.body.casos.length, 3, 'debe devolver exactamente los casos propios del contador');
  assert.ok(
    respuesta.body.casos.every((caso) => caso.contador_id === contadorConCasos.id),
    'todos los casos deben pertenecer al contador consultado'
  );
  const clientes = respuesta.body.casos.map((caso) => caso.cliente).sort();
  assert.deepStrictEqual(
    clientes,
    ['Cliente finalizado', 'Cliente pendiente dos', 'Cliente pendiente uno'],
    'debe devolver el detalle de cada caso propio con su cliente'
  );
}

// ---------- RF-48, RNF-2, criterio 23: fechas de los casos en hora local ----------
async function testFechasDeCasosEnHoraLocal() {
  const respuesta = await peticion(
    servidor.puerto,
    'GET',
    `/contadores/${contadorConCasos.id}/casos`,
    null,
    tokenAdmin
  );
  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 con los casos del contador');
  assert.ok(respuesta.body.casos.length > 0, 'debe haber casos propios para comprobar sus fechas');

  for (const caso of respuesta.body.casos) {
    const filas = await query('SELECT creado_en, actualizado_en FROM casos WHERE id = ?', [caso.id]);
    for (const campo of ['creado_en', 'actualizado_en']) {
      assert.strictEqual(typeof caso[campo], 'string', `${campo} debe llegar como texto`);
      assert.match(caso[campo], FORMATO_FECHA_LOCAL, `${campo} debe tener el formato YYYY-MM-DD HH:mm:ss`);
      assert.strictEqual(
        caso[campo],
        formatLocalDate(filas[0][campo]),
        `${campo} debe coincidir con la hora local guardada en la base de datos`
      );
    }
  }
}

// ---------- Dashboard: resumen de casos del equipo (KPIs) ----------
const CAMPOS_RESUMEN = ['abiertos', 'alta_abiertos', 'en_proceso', 'finalizado', 'pendiente', 'vencidos'];

/** Fecha AAAA-MM-DD a `dias` de hoy (negativo = pasado), en hora local. */
function fechaDesdeHoy(dias) {
  const fecha = nowLocal();
  fecha.setDate(fecha.getDate() + dias);
  return formatearFechaISO(fecha);
}

async function testResumenDelEquipo() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/contadores/resumen', null, tokenAdmin);
  assert.strictEqual(respuesta.statusCode, 200, 'el administrador recibe el resumen');
  const { equipo, por_contador: porContador } = respuesta.body;
  assert.ok(Array.isArray(porContador), 'trae el desglose por contador');

  // Conteos exactos del contador propio (casos creados en `before`).
  const propio = porContador.find((fila) => fila.contador_id === contadorResumen.id);
  assert.deepStrictEqual(
    propio,
    { contador_id: contadorResumen.id, pendiente: 2, en_proceso: 2, finalizado: 1, abiertos: 4, vencidos: 2, alta_abiertos: 2 },
    'vencido = vencimiento antes de hoy y no finalizado; alta abierta = Alta no finalizada'
  );

  // Un contador sin casos aparece con todo en cero.
  const sinCasos = porContador.find((fila) => fila.contador_id === contador.id);
  assert.deepStrictEqual(
    CAMPOS_RESUMEN.map((campo) => sinCasos[campo]),
    [0, 0, 0, 0, 0, 0],
    'el contador sin casos tiene ceros'
  );

  // Solo cuentan los casos de contadores: el caso del administrador de prueba no aparece.
  assert.ok(!porContador.some((fila) => fila.contador_id === administrador.id), 'sin cuentas que no son contador');

  // El total del equipo es la suma de las filas de la misma respuesta.
  for (const campo of CAMPOS_RESUMEN) {
    const suma = porContador.reduce((total, fila) => total + fila[campo], 0);
    assert.strictEqual(equipo[campo], suma, `equipo.${campo} es la suma por contador`);
  }
  assert.deepStrictEqual(Object.keys(equipo).sort(), CAMPOS_RESUMEN, 'el equipo trae solo los campos del resumen');
}

async function testResumenSoloAdministrador() {
  const comoContador = await peticion(servidor.puerto, 'GET', '/contadores/resumen', null, tokenContador);
  assert.strictEqual(comoContador.statusCode, 403, 'un contador recibe acceso denegado');
  assert.strictEqual(comoContador.body.equipo, undefined, 'y no recibe el resumen');

  const sinSesion = await peticion(servidor.puerto, 'GET', '/contadores/resumen', null, null);
  assert.strictEqual(sinSesion.statusCode, 401, 'sin sesión se responde 401');
}

// ---------- Dashboard del admin: solo casos importantes con ?importantes=true ----------
async function contadorConImportantes() {
  const contador = await crearUsuarioDePrueba('contador');
  const caso = (cliente, estado, importante) =>
    CaseModel.create({ contador_id: contador.id, cliente, estado, prioridad: 'Media', importante });
  await caso('zz_test_imp pendiente', 'Pendiente', true);
  await caso('zz_test_imp en proceso', 'En proceso', true);
  await caso('zz_test_normal pendiente', 'Pendiente', false);
  await caso('zz_test_normal finalizado', 'Finalizado', false);
  return contador;
}

async function testConteosSoloImportantes() {
  const contador = await contadorConImportantes();
  const ruta = `/contadores/${contador.id}/conteos`;

  const importantes = await peticion(servidor.puerto, 'GET', `${ruta}?importantes=true`, null, tokenAdmin);
  const todos = await peticion(servidor.puerto, 'GET', ruta, null, tokenAdmin);

  assert.strictEqual(importantes.statusCode, 200);
  assert.deepStrictEqual(
    [importantes.body.pendiente, importantes.body.en_proceso, importantes.body.finalizado],
    [1, 1, 0],
    'con importantes=true solo cuenta los importantes'
  );
  assert.deepStrictEqual([todos.body.pendiente, todos.body.en_proceso, todos.body.finalizado], [2, 1, 1], 'sin el parámetro cuenta todos');
}

async function testCasosSoloImportantes() {
  const contador = await contadorConImportantes();
  const ruta = `/contadores/${contador.id}/casos`;

  const importantes = await peticion(servidor.puerto, 'GET', `${ruta}?importantes=true`, null, tokenAdmin);
  const todos = await peticion(servidor.puerto, 'GET', ruta, null, tokenAdmin);

  assert.strictEqual(importantes.statusCode, 200);
  assert.deepStrictEqual(
    importantes.body.casos.map((c) => c.cliente).sort(),
    ['zz_test_imp en proceso', 'zz_test_imp pendiente'],
    'con importantes=true solo devuelve los importantes'
  );
  assert.strictEqual(todos.body.casos.length, 4, 'sin el parámetro devuelve todos');
}

describe('rutas de contadores', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    contadorConCasos = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesionDe(administrador);
    tokenContador = await iniciarSesionDe(contador);

    // Casos propios con conteos conocidos: 2 Pendiente, 0 En proceso, 1 Finalizado.
    await crearCasoDePrueba(contadorConCasos.id, { cliente: 'Cliente pendiente uno', estado: 'Pendiente' });
    await crearCasoDePrueba(contadorConCasos.id, { cliente: 'Cliente pendiente dos', estado: 'Pendiente' });
    await crearCasoDePrueba(contadorConCasos.id, { cliente: 'Cliente finalizado', estado: 'Finalizado' });

    // Resumen: 2 vencidos (Pendiente y En proceso), uno que vence hoy (no vencido), un finalizado
    // vencido (no cuenta) y uno futuro; 2 de prioridad Alta abiertos. Más un caso del administrador.
    contadorResumen = await crearUsuarioDePrueba('contador');
    const casoResumen = (estado, prioridad, dias) =>
      CaseModel.create({
        contador_id: contadorResumen.id,
        cliente: `zz_test_resumen ${estado} ${prioridad}`,
        estado,
        prioridad,
        fecha_inicio: fechaDesdeHoy(-30),
        fecha_vencimiento: fechaDesdeHoy(dias),
      });
    await casoResumen('Pendiente', 'Alta', -1);
    await casoResumen('En proceso', 'Media', -1);
    await casoResumen('En proceso', 'Alta', 0);
    await casoResumen('Finalizado', 'Alta', -1);
    await casoResumen('Pendiente', 'Baja', 1);
    await crearCasoDePrueba(administrador.id, { cliente: 'zz_test_resumen caso de admin' });
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el administrador lista los contadores propios', testListarContadoresComoAdmin);
  test('el contador no puede listar contadores', testListarContadoresComoContadorEsDenegado);
  test('los conteos por estado son exactos e incluyen ceros', testConteosPorEstado);
  test('un contador inexistente responde 404 en conteos y en casos', testContadorInexistenteDevuelve404);
  test('el administrador lee exactamente los casos propios del contador', testCasosDeContadorComoAdmin);
  test('las fechas de los casos de un contador llegan en hora local YYYY-MM-DD HH:mm:ss', testFechasDeCasosEnHoraLocal);
  test('el resumen del equipo cuenta exacto por contador y el total es su suma', testResumenDelEquipo);
  test('el resumen del equipo es solo para el administrador', testResumenSoloAdministrador);
  test('los conteos con importantes=true cuentan solo los casos importantes', testConteosSoloImportantes);
  test('los casos con importantes=true devuelven solo los importantes', testCasosSoloImportantes);
});
