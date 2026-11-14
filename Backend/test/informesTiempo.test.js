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
const { seedDatabase } = require('../src/utils/seed');

/**
 * Pruebas de integración de los informes de horas (rebanada 16): `GET /informes/tiempo`.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa cuentas `zz_test_` (sus filas se borran en
 * cascada). Los bloques de tiempo se insertan directo, siempre con el usuario de prueba, para fijar fechas
 * pasadas sin esperar; las jornadas se guardan con la propia API (`PUT /jornadas/:fecha`).
 */

const DESDE = '2026-10-01';
const HASTA = '2026-10-31';
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

let servidor;
let contador;
let otroContador;
let auxiliar;
let administrador;
let sistema;
let tokenContador;
let tokenOtroContador;
let tokenAuxiliar;
let tokenAdministrador;
let tokenSistema;
let secuencia = 0;

const informe = (token, { desde = DESDE, hasta = HASTA, cliente_id: clienteId, tipo_id: tipoId } = {}) => {
  const partes = [];
  if (desde !== null) partes.push(`desde=${desde}`);
  if (hasta !== null) partes.push(`hasta=${hasta}`);
  if (clienteId !== undefined) partes.push(`cliente_id=${clienteId}`);
  if (tipoId !== undefined) partes.push(`tipo_id=${tipoId}`);
  return peticion(servidor.puerto, 'GET', `/informes/tiempo?${partes.join('&')}`, null, token);
};

async function nuevoRenglon(token, { cobrable = false, nombreCliente, nombreTipo } = {}) {
  secuencia += 1;
  const cliente = (
    await peticion(
      servidor.puerto, 'POST', '/clientes', { nombre: nombreCliente ?? `Cliente informe ${secuencia}` }, token
    )
  ).body.cliente;
  const tipo = (
    await peticion(
      servidor.puerto, 'POST', '/tipos-actividad', { nombre: nombreTipo ?? `Tipo informe ${secuencia}`, cobrable }, token
    )
  ).body.tipo;
  return { cliente, tipo };
}

/**
 * Inserta un bloque terminado de una cuenta de prueba: empieza en `inicio` (AAAA-MM-DD HH:mm:ss) y dura
 * `minutos`. Sin `minutos` queda como un cronómetro en marcha (fin NULL).
 */
async function bloque(usuario, { cliente, tipo }, inicio, minutos, { cobrable = false, manual = false } = {}) {
  const mes = inicio.slice(0, 7);
  if (minutos === undefined) {
    await query(
      `INSERT INTO registros_tiempo (usuario_id, cliente_id, tipo_id, mes, inicio, cobrable, manual)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [usuario.id, cliente.id, tipo.id, mes, inicio, cobrable ? 1 : 0]
    );
    return;
  }
  await query(
    `INSERT INTO registros_tiempo (usuario_id, cliente_id, tipo_id, mes, inicio, fin, minutos, cobrable, manual)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(?, INTERVAL ? MINUTE), ?, ?, ?)`,
    [usuario.id, cliente.id, tipo.id, mes, inicio, inicio, minutos, minutos, cobrable ? 1 : 0, manual ? 1 : 0]
  );
}

const jornada = (token, fecha, entrada, salidaDescanso, regreso, salida) =>
  peticion(
    servidor.puerto,
    'PUT',
    `/jornadas/${fecha}`,
    { entrada, salida_descanso: salidaDescanso, regreso_descanso: regreso, salida },
    token
  );

async function testSeedNoNecesitaTablasNuevas() {
  await seedDatabase({ cuentasDemo: false });
  const tablas = await query("SHOW TABLES LIKE 'registros_tiempo'");
  assert.strictEqual(tablas.length, 1);
}

async function testTotalesCobrableYDiasConTiempo() {
  const a = await nuevoRenglon(tokenAuxiliar);
  await bloque(auxiliar, a, '2026-10-05 09:00:00', 60, { cobrable: true });
  await bloque(auxiliar, a, '2026-10-05 11:00:00', 30, { cobrable: false });
  await bloque(auxiliar, a, '2026-10-07 09:00:00', 45, { cobrable: true, manual: true });
  // Fuera del periodo: no cuentan
  await bloque(auxiliar, a, '2026-09-30 09:00:00', 500, { cobrable: true });
  await bloque(auxiliar, a, '2026-11-01 09:00:00', 500, { cobrable: true });

  const respuesta = await informe(tokenAuxiliar);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.deepStrictEqual(Object.keys(respuesta.body).sort(), ['bloques', 'jornadas', 'por_cliente', 'por_tipo', 'resumen']);
  const { resumen } = respuesta.body;
  assert.strictEqual(resumen.minutos_total, 135);
  assert.strictEqual(resumen.minutos_cobrables, 105);
  assert.strictEqual(resumen.minutos_no_cobrables, 30);
  assert.strictEqual(resumen.dias_con_tiempo, 2);
  assert.strictEqual(respuesta.body.bloques.length, 3);
}

async function testSinTiempoDevuelveCerosYListasVacias() {
  const respuesta = await informe(tokenOtroContador);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.resumen.minutos_total, 0);
  assert.strictEqual(respuesta.body.resumen.minutos_cobrables, 0);
  assert.strictEqual(respuesta.body.resumen.minutos_no_cobrables, 0);
  assert.strictEqual(respuesta.body.resumen.dias_con_tiempo, 0);
  assert.deepStrictEqual(respuesta.body.por_cliente, []);
  assert.deepStrictEqual(respuesta.body.por_tipo, []);
  assert.deepStrictEqual(respuesta.body.bloques, []);
}

async function testPorClienteYPorTipoOrdenadosYConPorcentajesQueSuman() {
  const c1 = (await nuevoRenglon(tokenContador, { nombreCliente: 'zz Cliente B', nombreTipo: 'zz Tipo X' }));
  const c2 = await nuevoRenglon(tokenContador, { nombreCliente: 'zz Cliente A', nombreTipo: 'zz Tipo Y' });
  const c3 = await nuevoRenglon(tokenContador, { nombreCliente: 'zz Cliente C', nombreTipo: 'zz Tipo Z' });
  // Tres partes iguales: 33,33 % cada una; el reparto debe sumar 100 exacto.
  await bloque(contador, c1, '2026-10-02 09:00:00', 10);
  await bloque(contador, c2, '2026-10-02 10:00:00', 10);
  await bloque(contador, c3, '2026-10-02 11:00:00', 10);
  // Un cuarto cliente con más tiempo va primero; un segundo bloque suma al mismo cliente y tipo.
  const clienteD = (
    await peticion(servidor.puerto, 'POST', '/clientes', { nombre: 'zz Cliente D' }, tokenContador)
  ).body.cliente;
  const c4 = { cliente: clienteD, tipo: c1.tipo };
  await bloque(contador, c4, '2026-10-03 09:00:00', 30);
  await bloque(contador, c1, '2026-10-03 12:00:00', 20);

  const { body } = await informe(tokenContador);
  assert.strictEqual(body.resumen.minutos_total, 80);
  // Clientes: B=30, D=30, A=10, C=10 (empate: por nombre)
  assert.deepStrictEqual(
    body.por_cliente.map((f) => [f.cliente, f.minutos]),
    [['zz Cliente B', 30], ['zz Cliente D', 30], ['zz Cliente A', 10], ['zz Cliente C', 10]]
  );
  // Tipos: X=60 (B y D), Y=10, Z=10
  assert.deepStrictEqual(
    body.por_tipo.map((f) => [f.tipo, f.minutos]),
    [['zz Tipo X', 60], ['zz Tipo Y', 10], ['zz Tipo Z', 10]]
  );
  for (const lista of [body.por_cliente, body.por_tipo]) {
    assert.strictEqual(lista.reduce((s, f) => s + f.porcentaje, 0), 100);
    for (const fila of lista) assert.ok(Number.isInteger(fila.porcentaje));
  }
  assert.deepStrictEqual(body.por_tipo.map((f) => f.porcentaje), [75, 13, 12]);
  assert.strictEqual(body.por_cliente[0].cliente_id, c1.cliente.id);
  assert.strictEqual(body.por_tipo[0].tipo_id, c1.tipo.id);
}

async function testFiltrosDeClienteYDeTipo() {
  const uno = await nuevoRenglon(tokenOtroContador);
  const dos = await nuevoRenglon(tokenOtroContador);
  const mezcla = { cliente: uno.cliente, tipo: dos.tipo };
  await bloque(otroContador, uno, '2026-10-10 09:00:00', 10);
  await bloque(otroContador, dos, '2026-10-10 10:00:00', 20);
  await bloque(otroContador, mezcla, '2026-10-10 11:00:00', 40);

  const todo = await informe(tokenOtroContador);
  assert.strictEqual(todo.body.resumen.minutos_total, 70);

  const porCliente = await informe(tokenOtroContador, { cliente_id: uno.cliente.id });
  assert.strictEqual(porCliente.body.resumen.minutos_total, 50);
  assert.strictEqual(porCliente.body.bloques.length, 2);
  assert.strictEqual(porCliente.body.por_cliente.length, 1);
  assert.strictEqual(porCliente.body.por_cliente[0].porcentaje, 100);
  assert.strictEqual(porCliente.body.por_tipo.length, 2);

  const porTipo = await informe(tokenOtroContador, { tipo_id: dos.tipo.id });
  assert.strictEqual(porTipo.body.resumen.minutos_total, 60);

  const ambos = await informe(tokenOtroContador, { cliente_id: uno.cliente.id, tipo_id: dos.tipo.id });
  assert.strictEqual(ambos.body.resumen.minutos_total, 40);
  assert.strictEqual(ambos.body.bloques.length, 1);
}

async function testLimitesDelRangoIncluyenLosDiasExtremos() {
  const r = await nuevoRenglon(tokenContador);
  const dia = (inicio, minutos) => bloque(contador, r, inicio, minutos);
  await dia('2026-08-31 23:59:59', 1); // un segundo antes: fuera
  await dia('2026-09-01 00:00:00', 2); // primer segundo del primer día: dentro
  await dia('2026-09-30 23:59:59', 4); // último segundo del último día: dentro
  await dia('2026-10-01 00:00:00', 8); // un instante después: fuera
  // Un bloque que empieza el último día y termina al siguiente pertenece al día de su inicio.
  await dia('2026-09-30 23:30:00', 60);

  const { body } = await informe(tokenContador, { desde: '2026-09-01', hasta: '2026-09-30', cliente_id: r.cliente.id });
  assert.strictEqual(body.resumen.minutos_total, 2 + 4 + 60);
  assert.strictEqual(body.resumen.dias_con_tiempo, 2);
  assert.strictEqual(body.bloques.length, 3);

  // Un solo día: desde = hasta
  const unDia = await informe(tokenContador, { desde: '2026-09-30', hasta: '2026-09-30', cliente_id: r.cliente.id });
  assert.strictEqual(unDia.statusCode, 200);
  assert.strictEqual(unDia.body.resumen.minutos_total, 64);
}

async function testBloquesMasRecientesPrimeroConSuFormato() {
  const r = await nuevoRenglon(tokenContador, { cobrable: true });
  await bloque(contador, r, '2026-10-12 09:00:00', 30, { cobrable: true });
  await bloque(contador, r, '2026-10-14 16:15:00', 20, { manual: true });
  await bloque(contador, r, '2026-10-14 08:00:00', 10);
  // Cambiar el tipo después no cambia la marca guardada en el bloque
  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${r.tipo.id}`, { cobrable: false }, tokenContador);
  await peticion(servidor.puerto, 'PATCH', `/clientes/${r.cliente.id}`, { activo: false }, tokenContador);

  const { body } = await informe(tokenContador, { cliente_id: r.cliente.id });
  assert.deepStrictEqual(
    body.bloques.map((b) => b.inicio),
    ['2026-10-14 16:15:00', '2026-10-14 08:00:00', '2026-10-12 09:00:00']
  );
  const primero = body.bloques[0];
  assert.deepStrictEqual(Object.keys(primero).sort(), [
    'cliente', 'cliente_id', 'cobrable', 'fecha', 'fin', 'id', 'inicio', 'manual', 'minutos', 'tipo', 'tipo_id',
  ]);
  assert.strictEqual(primero.fecha, '2026-10-14');
  assert.match(primero.fin, FORMATO_FECHA);
  assert.strictEqual(primero.fin, '2026-10-14 16:35:00');
  assert.strictEqual(primero.minutos, 20);
  assert.strictEqual(primero.manual, true);
  assert.strictEqual(primero.cobrable, false);
  assert.strictEqual(body.bloques[2].cobrable, true);
  assert.strictEqual(body.bloques[2].manual, false);
  assert.strictEqual(primero.cliente, r.cliente.nombre);
  // El cliente desactivado sigue saliendo (tiene tiempo en el periodo)
  assert.strictEqual(body.por_cliente.length, 1);
  assert.strictEqual(body.resumen.minutos_cobrables, 30);
}

async function testElCronometroEnMarchaNoCuenta() {
  const r = await nuevoRenglon(tokenAuxiliar);
  const antes = (await informe(tokenAuxiliar, { cliente_id: r.cliente.id })).body;
  assert.strictEqual(antes.resumen.minutos_total, 0);
  await bloque(auxiliar, r, '2026-10-20 09:00:00'); // sin minutos: en marcha
  const despues = (await informe(tokenAuxiliar, { cliente_id: r.cliente.id })).body;
  assert.strictEqual(despues.resumen.minutos_total, 0);
  assert.strictEqual(despues.resumen.dias_con_tiempo, 0);
  assert.deepStrictEqual(despues.bloques, []);
  assert.deepStrictEqual(despues.por_cliente, []);
  // Al limpiar no debe quedar un bloque en marcha de la cuenta (la cuenta se borra en cascada)
}

async function testJornadasDelPeriodoConTrabajadoExtraYSinAsignar() {
  const r = await nuevoRenglon(tokenContador);
  await peticion(servidor.puerto, 'PUT', '/jornadas/ajustes', { jornada_base_minutos: 480 }, tokenContador);
  // 2026-06-01: 09:00-14:00 + 15:00-19:00 = 540 min trabajados (60 extra); 200 asignados
  await jornada(tokenContador, '2026-06-01', '09:00', '14:00', '15:00', '19:00');
  await bloque(contador, r, '2026-06-01 10:00:00', 120);
  await bloque(contador, r, '2026-06-01 16:00:00', 80);
  // 2026-06-02: 08:00-13:00 = 300 min trabajados, sin extra; 400 asignados (más que lo trabajado: 0 sin asignar)
  await jornada(tokenContador, '2026-06-02', '08:00', null, null, '13:00');
  await bloque(contador, r, '2026-06-02 08:00:00', 400);
  // 2026-06-03: jornada abierta en un día pasado: solo cuenta el tramo cerrado (180 min)
  await jornada(tokenContador, '2026-06-03', '09:00', '12:00', null, null);
  // Fuera del periodo
  await jornada(tokenContador, '2026-06-30', '09:00', null, null, '18:00');

  const { body } = await informe(tokenContador, { desde: '2026-06-01', hasta: '2026-06-29' });
  assert.deepStrictEqual(body.jornadas.map((j) => j.fecha), ['2026-06-01', '2026-06-02', '2026-06-03']);
  assert.deepStrictEqual(
    body.jornadas.map((j) => [j.minutos_trabajados, j.minutos_extra]),
    [[540, 60], [300, 0], [180, 0]]
  );
  assert.deepStrictEqual(Object.keys(body.jornadas[0]).sort(), [
    'entrada', 'fecha', 'minutos_extra', 'minutos_trabajados', 'regreso_descanso', 'salida', 'salida_descanso',
  ]);
  assert.strictEqual(body.jornadas[0].entrada, '09:00');
  assert.strictEqual(body.jornadas[1].salida_descanso, null);
  assert.deepStrictEqual(body.resumen.jornada, {
    dias: 3,
    jornada_base_minutos: 480,
    minutos_trabajados: 1020,
    minutos_extra: 60,
    // día 1: 540-200 = 340; día 2: 0; día 3: 180-0 = 180
    minutos_sin_asignar: 520,
  });

  // Los filtros de cliente o tipo no cambian la jornada (es del día, no de un cliente)
  const filtrado = await informe(tokenContador, {
    desde: '2026-06-01', hasta: '2026-06-29', cliente_id: r.cliente.id,
  });
  assert.deepStrictEqual(filtrado.body.resumen.jornada, body.resumen.jornada);
}

async function testLaJornadaBaseDelUsuarioDefineLasHorasExtra() {
  const r = await nuevoRenglon(tokenOtroContador);
  await bloque(otroContador, r, '2026-07-01 09:00:00', 10);
  await jornada(tokenOtroContador, '2026-07-01', '09:00', null, null, '17:00'); // 480 trabajados
  const defecto = (await informe(tokenOtroContador, { desde: '2026-07-01', hasta: '2026-07-01' })).body;
  assert.strictEqual(defecto.resumen.jornada.jornada_base_minutos, 480);
  assert.strictEqual(defecto.resumen.jornada.minutos_extra, 0);
  await peticion(servidor.puerto, 'PUT', '/jornadas/ajustes', { jornada_base_minutos: 420 }, tokenOtroContador);
  const sieteHoras = (await informe(tokenOtroContador, { desde: '2026-07-01', hasta: '2026-07-01' })).body;
  assert.strictEqual(sieteHoras.resumen.jornada.jornada_base_minutos, 420);
  assert.strictEqual(sieteHoras.resumen.jornada.minutos_extra, 60);
}

async function testSinJornadasEnElPeriodoElResumenLoDice() {
  const { body } = await informe(tokenContador, { desde: '2026-03-01', hasta: '2026-03-31' });
  assert.deepStrictEqual(body.jornadas, []);
  assert.strictEqual(body.resumen.jornada, null);
}

async function testFechasInvalidasRangoInvertidoYMasDe366Dias() {
  const casos = [
    [{ desde: null }, 'falta desde'],
    [{ hasta: null }, 'falta hasta'],
    [{ desde: '01-10-2026' }, 'formato DD-MM-AAAA'],
    [{ desde: '2026-10' }, 'solo mes'],
    [{ hasta: 'ayer' }, 'texto'],
    [{ desde: '2026-02-30' }, 'día inexistente'],
    [{ hasta: '2026-13-01' }, 'mes inexistente'],
    [{ desde: '2026-11-01', hasta: '2026-10-31' }, 'rango invertido'],
    [{ desde: '2026-01-01', hasta: '2027-01-02' }, '367 días'],
    [{ desde: '2020-01-01', hasta: '2026-10-31' }, 'años'],
    [{ cliente_id: 'abc' }, 'cliente no numérico'],
    [{ cliente_id: 0 }, 'cliente cero'],
    [{ tipo_id: -1 }, 'tipo negativo'],
    [{ tipo_id: '1.5' }, 'tipo decimal'],
  ];
  for (const [parametros, motivo] of casos) {
    const respuesta = await informe(tokenContador, parametros);
    assert.strictEqual(respuesta.statusCode, 400, motivo);
    assert.ok(respuesta.body.mensaje.length > 0, motivo);
    assert.match(respuesta.body.mensaje, /^.+ sobre .+: .+$/, motivo);
  }
  // Un año bisiesto completo son exactamente 366 días: se permite
  assert.strictEqual((await informe(tokenContador, { desde: '2024-01-01', hasta: '2024-12-31' })).statusCode, 200);
  assert.strictEqual((await informe(tokenContador, { desde: '2024-01-01', hasta: '2025-01-01' })).statusCode, 400);
  assert.strictEqual((await informe(tokenContador, { desde: '2024-02-29', hasta: '2024-02-29' })).statusCode, 200);
}

async function testCadaQuienVeSoloLoSuyoYUnIdAjenoNoRevelaDatos() {
  const mio = await nuevoRenglon(tokenContador);
  await bloque(contador, mio, '2026-10-15 09:00:00', 90, { cobrable: true });

  const ajeno = await informe(tokenOtroContador, { desde: '2026-10-15', hasta: '2026-10-15' });
  assert.strictEqual(ajeno.body.resumen.minutos_total, 0);
  assert.deepStrictEqual(ajeno.body.bloques, []);

  // Un cliente_id o tipo_id ajeno se comporta igual que uno que no existe: sin datos y sin pistas
  const inexistente = await informe(tokenOtroContador, { cliente_id: 999999999 });
  const clienteAjeno = await informe(tokenOtroContador, { cliente_id: mio.cliente.id });
  assert.strictEqual(clienteAjeno.statusCode, 200);
  assert.deepStrictEqual(clienteAjeno.body, inexistente.body);
  const tipoAjeno = await informe(tokenOtroContador, { tipo_id: mio.tipo.id });
  assert.strictEqual(tipoAjeno.statusCode, 200);
  assert.deepStrictEqual(tipoAjeno.body, (await informe(tokenOtroContador, { tipo_id: 999999999 })).body);
  assert.strictEqual(clienteAjeno.body.resumen.minutos_total, 0);

  // Y mezclar mi cliente con el tipo de otro tampoco trae nada de lo mío
  const otro = await nuevoRenglon(tokenOtroContador);
  const mezcla = await informe(tokenOtroContador, { cliente_id: mio.cliente.id, tipo_id: otro.tipo.id });
  assert.strictEqual(mezcla.body.resumen.minutos_total, 0);

  // El dueño sí lo ve
  const propio = await informe(tokenContador, { desde: '2026-10-15', hasta: '2026-10-15', cliente_id: mio.cliente.id });
  assert.strictEqual(propio.body.resumen.minutos_total, 90);
}

async function testSoloContadorYAuxiliarYSinSesion() {
  for (const token of [tokenAdministrador, tokenSistema]) {
    const respuesta = await informe(token);
    assert.strictEqual(respuesta.statusCode, 403);
    assert.ok(respuesta.body.mensaje);
  }
  assert.strictEqual((await informe(undefined)).statusCode, 401);
  assert.strictEqual((await informe(tokenContador)).statusCode, 200);
  assert.strictEqual((await informe(tokenAuxiliar)).statusCode, 200);
}

describe('GET /informes/tiempo: informes de horas', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    administrador = await crearUsuarioDePrueba('administrador');
    sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    servidor = await iniciarServidor();
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenOtroContador = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
    tokenAdministrador = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
    tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el seed no necesita tablas nuevas', testSeedNoNecesitaTablasNuevas);
  test('totales, cobrables, no cobrables y días con tiempo dentro del periodo', testTotalesCobrableYDiasConTiempo);
  test('sin tiempo en el periodo: ceros y listas vacías', testSinTiempoDevuelveCerosYListasVacias);
  test('por cliente y por tipo: orden, minutos y porcentajes que suman 100', testPorClienteYPorTipoOrdenadosYConPorcentajesQueSuman);
  test('filtros de cliente y de tipo', testFiltrosDeClienteYDeTipo);
  test('límites del rango: días extremos incluidos y un día solo', testLimitesDelRangoIncluyenLosDiasExtremos);
  test('bloques: más recientes primero, formato, marca guardada y desactivados', testBloquesMasRecientesPrimeroConSuFormato);
  test('el cronómetro en marcha no cuenta', testElCronometroEnMarchaNoCuenta);
  test('jornadas del periodo: trabajado, extra y sin asignar', testJornadasDelPeriodoConTrabajadoExtraYSinAsignar);
  test('la jornada base del usuario define las horas extra', testLaJornadaBaseDelUsuarioDefineLasHorasExtra);
  test('sin jornadas en el periodo el resumen lo dice', testSinJornadasEnElPeriodoElResumenLoDice);
  test('fechas inválidas, rango invertido y más de 366 días: 400', testFechasInvalidasRangoInvertidoYMasDe366Dias);
  test('cada quien ve solo lo suyo y un id ajeno no revela datos', testCadaQuienVeSoloLoSuyoYUnIdAjenoNoRevelaDatos);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliarYSinSesion);
});
