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
 * Pruebas de integración de la lista del mes (rebanada 11): `GET /actividades?mes=AAAA-MM` y
 * `PUT /actividades/estado`. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo usa y borra cuentas `zz_test_` (sus filas se borran en cascada).
 */

const MES = '2026-11';
const OTRO_MES = '2026-10';
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
let secuencia = 0;

async function nuevoCliente(token, nombre, rfc) {
  secuencia += 1;
  const cuerpo = { nombre: nombre ?? `Cliente mes ${secuencia}` };
  if (rfc !== undefined) cuerpo.rfc = rfc;
  const respuesta = await peticion(servidor.puerto, 'POST', '/clientes', cuerpo, token);
  assert.strictEqual(respuesta.statusCode, 201);
  return respuesta.body.cliente;
}

async function nuevoTipo(token, nombre, vencimiento = {}) {
  secuencia += 1;
  const respuesta = await peticion(
    servidor.puerto, 'POST', '/tipos-actividad', { nombre: nombre ?? `Tipo mes ${secuencia}`, ...vencimiento }, token
  );
  assert.strictEqual(respuesta.statusCode, 201);
  return respuesta.body.tipo;
}

async function asignar(token, tipo, clientes) {
  const respuesta = await peticion(
    servidor.puerto, 'PUT', `/tipos-actividad/${tipo.id}/clientes`, { agregar: clientes.map((c) => c.id) }, token
  );
  assert.strictEqual(respuesta.statusCode, 200);
}

const listar = (token, mes = MES) =>
  peticion(servidor.puerto, 'GET', `/actividades${mes === null ? '' : `?mes=${mes}`}`, null, token);
const marcar = (token, cliente, tipo, hecha, mes = MES) =>
  peticion(
    servidor.puerto, 'PUT', '/actividades/estado',
    { cliente_id: cliente.id, tipo_id: tipo.id, mes, hecha },
    token
  );
const renglon = (cuerpo, cliente, tipo) =>
  cuerpo.actividades.find((r) => r.cliente_id === cliente.id && r.tipo_id === tipo.id);

async function testSeedCreaLaTablaDeFormaIdempotente() {
  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });
  const columnas = await query('SHOW COLUMNS FROM actividades_mes');
  assert.deepStrictEqual(
    columnas.map((c) => c.Field),
    ['id', 'usuario_id', 'cliente_id', 'tipo_id', 'mes', 'estado', 'hecha_en']
  );
  const unica = await query("SHOW KEYS FROM actividades_mes WHERE Non_unique = 0 AND Key_name <> 'PRIMARY'");
  assert.deepStrictEqual(
    unica.sort((a, b) => a.Seq_in_index - b.Seq_in_index).map((k) => k.Column_name),
    ['cliente_id', 'tipo_id', 'mes']
  );
}

async function testListaUnRenglonPorTipoYClienteAgrupadoPorTipoYOrdenado() {
  const tipoB = await nuevoTipo(tokenAuxiliar, 'Beta lista');
  const tipoA = await nuevoTipo(tokenAuxiliar, 'Alfa lista');
  const sinCartera = await nuevoTipo(tokenAuxiliar, 'Sin cartera lista');
  const zeta = await nuevoCliente(tokenAuxiliar, 'Zeta cliente');
  const arbol = await nuevoCliente(tokenAuxiliar, 'Árbol cliente');
  await asignar(tokenAuxiliar, tipoB, [zeta, arbol]);
  await asignar(tokenAuxiliar, tipoA, [zeta]);

  const respuesta = await listar(tokenAuxiliar);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.mes, MES);
  assert.deepStrictEqual(
    respuesta.body.actividades.map((r) => `${r.tipo}|${r.cliente}`),
    ['Alfa lista|Zeta cliente', 'Beta lista|Árbol cliente', 'Beta lista|Zeta cliente']
  );
  const primero = respuesta.body.actividades[0];
  assert.deepStrictEqual(
    Object.keys(primero).sort(),
    ['cliente', 'cliente_activo', 'cliente_id', 'falta_rfc', 'hecha', 'hecha_en', 'tipo', 'tipo_activo', 'tipo_id', 'vence']
  );
  assert.strictEqual(primero.hecha, false);
  assert.strictEqual(primero.hecha_en, null);
  assert.ok(!respuesta.body.actividades.some((r) => r.tipo_id === sinCartera.id), 'un tipo sin cartera no tiene renglones');
}

async function testCadaReglaDaSuFechaDeVencimientoEnElMes() {
  const sinRegla = await nuevoTipo(tokenContador);
  const fijo = await nuevoTipo(tokenContador, undefined, { regla_vencimiento: 'dia_del_mes', dia_del_mes: 7 });
  const fin = await nuevoTipo(tokenContador, undefined, { regla_vencimiento: 'fin_de_mes' });
  const diecisiete = await nuevoTipo(tokenContador, undefined, { regla_vencimiento: 'dia_17_rfc' });
  const cliente = await nuevoCliente(tokenContador, undefined, 'ABCD260105AB1');
  for (const tipo of [sinRegla, fijo, fin, diecisiete]) await asignar(tokenContador, tipo, [cliente]);

  const noviembre = (await listar(tokenContador, '2026-11')).body;
  assert.strictEqual(renglon(noviembre, cliente, sinRegla).vence, null);
  assert.strictEqual(renglon(noviembre, cliente, sinRegla).falta_rfc, false);
  assert.strictEqual(renglon(noviembre, cliente, fijo).vence, '2026-11-09', 'el 7 es sábado: pasa al lunes');
  assert.strictEqual(renglon(noviembre, cliente, fin).vence, '2026-11-30');
  assert.strictEqual(renglon(noviembre, cliente, diecisiete).vence, '2026-11-20', 'martes 17 más 3 hábiles (dígito 5)');
  assert.strictEqual(renglon(noviembre, cliente, diecisiete).falta_rfc, false);

  const octubre = (await listar(tokenContador, '2026-10')).body;
  assert.strictEqual(renglon(octubre, cliente, fin).vence, '2026-11-02', 'fin de mes en sábado pasa al mes siguiente');
  assert.strictEqual(renglon(octubre, cliente, diecisiete).vence, '2026-10-22', 'sábado 17 pasa al lunes 19 más 3 hábiles');

  const marzo2024 = (await listar(tokenContador, '2024-03')).body;
  assert.strictEqual(renglon(marzo2024, cliente, diecisiete).vence, '2024-03-22', 'domingo 17 y lunes 18 festivo: martes 19 más 3');
}

async function testSinRfcLaReglaDel17NoDaFechaYAvisaFaltaRfc() {
  const tipo17 = await nuevoTipo(tokenContador, undefined, { regla_vencimiento: 'dia_17_rfc' });
  const tipoFin = await nuevoTipo(tokenContador, undefined, { regla_vencimiento: 'fin_de_mes' });
  const sinRfc = await nuevoCliente(tokenContador);
  const conRfc = await nuevoCliente(tokenContador, undefined, 'ABC260101AB1');
  await asignar(tokenContador, tipo17, [sinRfc, conRfc]);
  await asignar(tokenContador, tipoFin, [sinRfc]);

  const lista = (await listar(tokenContador, '2026-11')).body;
  assert.strictEqual(renglon(lista, sinRfc, tipo17).vence, null);
  assert.strictEqual(renglon(lista, sinRfc, tipo17).falta_rfc, true);
  assert.strictEqual(renglon(lista, conRfc, tipo17).vence, '2026-11-18');
  assert.strictEqual(renglon(lista, conRfc, tipo17).falta_rfc, false);
  assert.strictEqual(renglon(lista, sinRfc, tipoFin).vence, '2026-11-30', 'otras reglas no necesitan RFC');
  assert.strictEqual(renglon(lista, sinRfc, tipoFin).falta_rfc, false);

  await marcar(tokenContador, sinRfc, tipo17, true, '2026-11');
  const hecha = (await listar(tokenContador, '2026-11')).body;
  assert.strictEqual(renglon(hecha, sinRfc, tipo17).hecha, true);
  assert.strictEqual(renglon(hecha, sinRfc, tipo17).falta_rfc, true, 'el aviso no depende de si está hecha');
}

async function testSinMesUsaElMesActualYRechazaMesesInvalidos() {
  const respuesta = await listar(tokenContador, null);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.match(respuesta.body.mes, /^\d{4}-(0[1-9]|1[0-2])$/);
  const esperado = new Date();
  const mesActual = `${esperado.getFullYear()}-${String(esperado.getMonth() + 1).padStart(2, '0')}`;
  assert.strictEqual(respuesta.body.mes, mesActual);

  for (const mes of ['2026-13', '2026-00', '2026-1', 'noviembre', '2026-11-01', '26-11']) {
    const invalido = await listar(tokenContador, mes);
    assert.strictEqual(invalido.statusCode, 400, mes);
    assert.match(invalido.body.mensaje, / sobre .+: /);
  }
}

async function testMarcarYDesmarcarSeGuardaYSeVeEnLaLista() {
  const tipo = await nuevoTipo(tokenContador);
  const a = await nuevoCliente(tokenContador);
  const b = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [a, b]);

  const marcada = await marcar(tokenContador, a, tipo, true);
  assert.strictEqual(marcada.statusCode, 200);
  assert.strictEqual(marcada.body.actividad.hecha, true);
  assert.strictEqual(marcada.body.actividad.cliente_id, a.id);
  assert.strictEqual(marcada.body.actividad.mes, MES);
  assert.match(marcada.body.actividad.hecha_en, FORMATO_FECHA);

  const lista = (await listar(tokenContador)).body;
  assert.strictEqual(renglon(lista, a, tipo).hecha, true);
  assert.match(renglon(lista, a, tipo).hecha_en, FORMATO_FECHA);
  assert.strictEqual(renglon(lista, b, tipo).hecha, false);

  const otraVez = await marcar(tokenContador, a, tipo, true);
  assert.strictEqual(otraVez.statusCode, 200, 'marcar dos veces es idempotente');
  const filas = await query('SELECT COUNT(*) AS n FROM actividades_mes WHERE cliente_id = ? AND tipo_id = ?', [a.id, tipo.id]);
  assert.strictEqual(filas[0].n, 1);

  const desmarcada = await marcar(tokenContador, a, tipo, false);
  assert.strictEqual(desmarcada.statusCode, 200);
  assert.strictEqual(desmarcada.body.actividad.hecha, false);
  assert.strictEqual(desmarcada.body.actividad.hecha_en, null);
  assert.strictEqual(renglon((await listar(tokenContador)).body, a, tipo).hecha, false);
  const sinFila = await query('SELECT COUNT(*) AS n FROM actividades_mes WHERE cliente_id = ? AND tipo_id = ?', [a.id, tipo.id]);
  assert.strictEqual(sinFila[0].n, 0, 'lo pendiente no ocupa filas');
  assert.strictEqual((await marcar(tokenContador, a, tipo, false)).statusCode, 200, 'desmarcar lo pendiente tampoco falla');
}

async function testCadaMesTieneSuPropioEstado() {
  const tipo = await nuevoTipo(tokenContador);
  const cliente = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [cliente]);
  await marcar(tokenContador, cliente, tipo, true, OTRO_MES);

  assert.strictEqual(renglon((await listar(tokenContador, OTRO_MES)).body, cliente, tipo).hecha, true);
  const noviembre = (await listar(tokenContador, MES)).body;
  assert.strictEqual(renglon(noviembre, cliente, tipo).hecha, false, 'lo pendiente sale con la cartera actual en cualquier mes');
  const futuro = (await listar(tokenContador, '2027-05')).body;
  assert.strictEqual(renglon(futuro, cliente, tipo).hecha, false);
}

async function testLoHechoSeConservaAunqueSaleDeLaCartera() {
  const tipo = await nuevoTipo(tokenContador);
  const quitado = await nuevoCliente(tokenContador);
  const pendiente = await nuevoCliente(tokenContador);
  const desactivado = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [quitado, pendiente, desactivado]);
  await marcar(tokenContador, quitado, tipo, true);
  await marcar(tokenContador, desactivado, tipo, true);

  await peticion(
    servidor.puerto, 'PUT', `/tipos-actividad/${tipo.id}/clientes`,
    { quitar: [quitado.id, pendiente.id] }, tokenContador
  );
  await peticion(servidor.puerto, 'PATCH', `/clientes/${desactivado.id}`, { activo: false }, tokenContador);

  const lista = (await listar(tokenContador)).body;
  const hechoQuitado = renglon(lista, quitado, tipo);
  assert.strictEqual(hechoQuitado.hecha, true, 'lo hecho sigue saliendo aunque el cliente salga de la cartera');
  assert.strictEqual(hechoQuitado.cliente, quitado.nombre);
  assert.strictEqual(renglon(lista, pendiente, tipo), undefined, 'lo pendiente sale solo con la cartera actual');
  const hechoDesactivado = renglon(lista, desactivado, tipo);
  assert.strictEqual(hechoDesactivado.hecha, true);
  assert.strictEqual(hechoDesactivado.cliente_activo, false);
  assert.strictEqual(hechoDesactivado.tipo_activo, true);

  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${tipo.id}`, { activo: false }, tokenContador);
  const conTipoInactivo = (await listar(tokenContador)).body;
  assert.strictEqual(renglon(conTipoInactivo, quitado, tipo).tipo_activo, false);
  assert.strictEqual(renglon(conTipoInactivo, quitado, tipo).hecha, true);
  assert.strictEqual(renglon(conTipoInactivo, pendiente, tipo), undefined);
}

async function testPendientesDeClientesOTiposDesactivadosNoSalen() {
  const tipo = await nuevoTipo(tokenContador);
  const tipoInactivo = await nuevoTipo(tokenContador);
  const cliente = await nuevoCliente(tokenContador);
  const clienteInactivo = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [cliente, clienteInactivo]);
  await asignar(tokenContador, tipoInactivo, [cliente]);
  await peticion(servidor.puerto, 'PATCH', `/clientes/${clienteInactivo.id}`, { activo: false }, tokenContador);
  await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${tipoInactivo.id}`, { activo: false }, tokenContador);

  const lista = (await listar(tokenContador)).body;
  assert.ok(renglon(lista, cliente, tipo));
  assert.strictEqual(renglon(lista, clienteInactivo, tipo), undefined);
  assert.strictEqual(renglon(lista, cliente, tipoInactivo), undefined);
}

async function testSoloSePuedeMarcarLoDeLaCarteraActiva() {
  const tipo = await nuevoTipo(tokenContador);
  const cliente = await nuevoCliente(tokenContador);
  const inactivo = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [inactivo]);
  await peticion(servidor.puerto, 'PATCH', `/clientes/${inactivo.id}`, { activo: false }, tokenContador);

  const fueraDeCartera = await marcar(tokenContador, cliente, tipo, true);
  assert.strictEqual(fueraDeCartera.statusCode, 400);
  assert.match(fueraDeCartera.body.mensaje, / sobre .+: /);
  const desactivado = await marcar(tokenContador, inactivo, tipo, true);
  assert.strictEqual(desactivado.statusCode, 400);
  const filas = await query('SELECT COUNT(*) AS n FROM actividades_mes WHERE tipo_id = ?', [tipo.id]);
  assert.strictEqual(filas[0].n, 0);
}

async function testRechazaCuerposInvalidosYAjenos() {
  const tipo = await nuevoTipo(tokenContador);
  const cliente = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [cliente]);
  const ajenoTipo = await nuevoTipo(tokenOtroContador);
  const ajenoCliente = await nuevoCliente(tokenOtroContador);
  await asignar(tokenOtroContador, ajenoTipo, [ajenoCliente]);

  const base = { cliente_id: cliente.id, tipo_id: tipo.id, mes: MES, hecha: true };
  const invalidos = [
    [{ ...base, hecha: 'si' }, 'hecha que no es booleano'],
    [{ ...base, hecha: undefined }, 'falta hecha'],
    [{ ...base, mes: '2026-13' }, 'mes inválido'],
    [{ ...base, mes: undefined }, 'falta el mes'],
    [{ ...base, cliente_id: 'x' }, 'cliente inválido'],
    [{ ...base, tipo_id: 0 }, 'tipo inválido'],
  ];
  for (const [cuerpo, descripcion] of invalidos) {
    const respuesta = await peticion(servidor.puerto, 'PUT', '/actividades/estado', cuerpo, tokenContador);
    assert.strictEqual(respuesta.statusCode, 400, descripcion);
    assert.match(respuesta.body.mensaje, / sobre .+: /, `${descripcion}: mensaje en tres partes`);
  }

  assert.strictEqual((await marcar(tokenContador, ajenoCliente, tipo, true)).statusCode, 404);
  assert.strictEqual((await marcar(tokenContador, cliente, ajenoTipo, true)).statusCode, 404);
  assert.strictEqual((await marcar(tokenContador, ajenoCliente, ajenoTipo, false)).statusCode, 404);
  assert.strictEqual((await marcar(tokenContador, { id: 99999999 }, tipo, true)).statusCode, 404);
}

async function testCadaUsuarioSoloVeLoSuyo() {
  const tipo = await nuevoTipo(tokenContador);
  const cliente = await nuevoCliente(tokenContador);
  await asignar(tokenContador, tipo, [cliente]);
  await marcar(tokenContador, cliente, tipo, true);

  const ajena = (await listar(tokenOtroContador)).body;
  assert.ok(!ajena.actividades.some((r) => r.tipo_id === tipo.id || r.cliente_id === cliente.id));
  const propia = (await listar(tokenContador)).body;
  assert.strictEqual(renglon(propia, cliente, tipo).hecha, true);
}

async function testSoloContadorYAuxiliar() {
  for (const cuenta of [administrador, sistema]) {
    const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    assert.strictEqual((await listar(token)).statusCode, 403);
    assert.strictEqual(
      (await peticion(servidor.puerto, 'PUT', '/actividades/estado', { cliente_id: 1, tipo_id: 1, mes: MES, hecha: true }, token)).statusCode,
      403
    );
  }
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/actividades')).statusCode, 401);
  assert.strictEqual((await peticion(servidor.puerto, 'PUT', '/actividades/estado', {})).statusCode, 401);
}

describe('/actividades (lista del mes)', () => {
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
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el seed crea actividades_mes y se puede repetir', testSeedCreaLaTablaDeFormaIdempotente);
  test('lista un renglón por tipo y cliente, agrupado por tipo y ordenado', testListaUnRenglonPorTipoYClienteAgrupadoPorTipoYOrdenado);
  test('cada regla da su fecha de vencimiento dentro del mes', testCadaReglaDaSuFechaDeVencimientoEnElMes);
  test('sin RFC la regla del 17 no da fecha y avisa que falta el RFC', testSinRfcLaReglaDel17NoDaFechaYAvisaFaltaRfc);
  test('sin mes usa el mes actual y rechaza meses inválidos', testSinMesUsaElMesActualYRechazaMesesInvalidos);
  test('marcar y desmarcar se guarda y se ve en la lista', testMarcarYDesmarcarSeGuardaYSeVeEnLaLista);
  test('cada mes tiene su propio estado', testCadaMesTieneSuPropioEstado);
  test('lo hecho se conserva aunque salga de la cartera o se desactive', testLoHechoSeConservaAunqueSaleDeLaCartera);
  test('lo pendiente de clientes o tipos desactivados no sale', testPendientesDeClientesOTiposDesactivadosNoSalen);
  test('solo se marca lo de la cartera activa (400)', testSoloSePuedeMarcarLoDeLaCarteraActiva);
  test('rechaza cuerpos inválidos (400) y datos ajenos (404)', testRechazaCuerposInvalidosYAjenos);
  test('cada usuario solo ve lo suyo', testCadaUsuarioSoloVeLoSuyo);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
