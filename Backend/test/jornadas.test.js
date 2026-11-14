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
const { formatearFechaISO } = require('../src/utils/dateUtils');

/**
 * Pruebas de integración de la jornada (rebanada 15): `/jornadas` y sus ajustes. Requiere MariaDB en marcha
 * (XAMPP, puerto 3306). Solo usa cuentas `zz_test_` (sus filas se borran en cascada). Las horas no se esperan:
 * se corrigen con UPDATE filtrados por el usuario de prueba, o con la propia corrección (`PUT /jornadas/:fecha`).
 */

const FORMATO_AHORA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const FORMATO_HORA = /^\d{2}:\d{2}$/;
const DIA_PASADO = '2026-10-05';
const OTRO_DIA_PASADO = '2026-10-06';

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

const hoyISO = () => formatearFechaISO(new Date());
const diaDespues = (dias) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return formatearFechaISO(fecha);
};
const minutosDe = (ahora) => Number(ahora.slice(11, 13)) * 60 + Number(ahora.slice(14, 16));

const hoy = (token) => peticion(servidor.puerto, 'GET', '/jornadas/hoy', null, token);
const marcar = (token, paso, extra = {}) =>
  peticion(servidor.puerto, 'POST', '/jornadas/hoy/marcar', { paso, ...extra }, token);
const mes = (token, valor) => peticion(servidor.puerto, 'GET', `/jornadas?mes=${valor}`, null, token);
const corregir = (token, fecha, horas) => peticion(servidor.puerto, 'PUT', `/jornadas/${fecha}`, horas, token);
const ajustar = (token, cuerpo) => peticion(servidor.puerto, 'PUT', '/jornadas/ajustes', cuerpo, token);

/** Fija las horas de HOY de una cuenta de prueba (UPDATE filtrado por usuario y por fecha). */
async function fijarHoy(usuario, [entrada, salidaDescanso, regreso, salida]) {
  await query(
    `UPDATE jornadas SET entrada = ?, salida_descanso = ?, regreso_descanso = ?, salida = ?
      WHERE usuario_id = ? AND fecha = ?`,
    [entrada, salidaDescanso, regreso, salida, usuario.id, hoyISO()]
  );
}

async function borrarJornadasDe(usuario) {
  await query('DELETE FROM jornadas WHERE usuario_id = ?', [usuario.id]);
}

async function nuevoRenglon(token) {
  secuencia += 1;
  const cliente = (
    await peticion(servidor.puerto, 'POST', '/clientes', { nombre: `Cliente jornada ${secuencia}` }, token)
  ).body.cliente;
  const tipo = (
    await peticion(servidor.puerto, 'POST', '/tipos-actividad', { nombre: `Tipo jornada ${secuencia}` }, token)
  ).body.tipo;
  await peticion(servidor.puerto, 'PUT', `/tipos-actividad/${tipo.id}/clientes`, { agregar: [cliente.id] }, token);
  return { cliente, tipo };
}

async function testSeedCreaLasDosTablasDeFormaIdempotente() {
  await seedDatabase({ cuentasDemo: false });
  await seedDatabase({ cuentasDemo: false });
  const jornadas = await query('SHOW COLUMNS FROM jornadas');
  assert.deepStrictEqual(
    jornadas.map((c) => c.Field),
    ['id', 'usuario_id', 'fecha', 'entrada', 'salida_descanso', 'regreso_descanso', 'salida']
  );
  const tipos = Object.fromEntries(jornadas.map((c) => [c.Field, c.Type]));
  assert.strictEqual(tipos.fecha, 'date');
  for (const campo of ['entrada', 'salida_descanso', 'regreso_descanso', 'salida']) {
    assert.strictEqual(tipos[campo], 'time', campo);
    assert.strictEqual(jornadas.find((c) => c.Field === campo).Null, 'YES', campo);
  }
  const indices = await query('SHOW KEYS FROM jornadas WHERE Non_unique = 0');
  const unico = indices.filter((k) => k.Key_name !== 'PRIMARY').map((k) => k.Column_name);
  assert.deepStrictEqual(unico, ['usuario_id', 'fecha'], 'único por (usuario_id, fecha)');

  const ajustes = await query('SHOW COLUMNS FROM ajustes_actividades');
  assert.deepStrictEqual(
    ajustes.map((c) => c.Field),
    ['usuario_id', 'jornada_base_minutos']
  );
  assert.strictEqual(ajustes[0].Key, 'PRI');
  assert.strictEqual(ajustes[1].Null, 'NO');
  assert.strictEqual(String(ajustes[1].Default), '480');

  for (const tabla of ['jornadas', 'ajustes_actividades']) {
    const [{ 'Create Table': definicion }] = await query(`SHOW CREATE TABLE ${tabla}`);
    assert.match(definicion, /REFERENCES `usuarios` \(`id`\) ON DELETE CASCADE/, `${tabla} cae en cascada`);
  }
}

async function testHoySinJornadaEntregaLosValoresPorDefecto() {
  const respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.statusCode, 200);
  assert.strictEqual(respuesta.body.jornada, null);
  assert.strictEqual(respuesta.body.minutos_trabajados, 0);
  assert.strictEqual(respuesta.body.minutos_actividades, 0);
  assert.strictEqual(respuesta.body.jornada_base_minutos, 480);
  assert.match(respuesta.body.ahora, FORMATO_AHORA);
  assert.strictEqual(respuesta.body.ahora.slice(0, 10), hoyISO(), 'la fecha de hoy es la del servidor');
}

async function testSecuenciaCompletaConSusConflictos() {
  await borrarJornadasDe(contador);
  const antes = await marcar(tokenContador, 'regreso_descanso');
  assert.strictEqual(antes.statusCode, 409, 'regresar sin haber entrado: fuera de orden');
  assert.strictEqual((await marcar(tokenContador, 'salida')).statusCode, 409, 'salir sin entrar');
  assert.strictEqual((await marcar(tokenContador, 'cena')).statusCode, 400, 'paso desconocido');
  assert.strictEqual((await marcar(tokenContador, undefined)).statusCode, 400, 'sin paso');

  // La hora la pone el servidor: lo que mande el equipo se ignora
  const entrada = await marcar(tokenContador, 'entrada', { hora: '03:33', fecha: '2020-01-01' });
  assert.strictEqual(entrada.statusCode, 200);
  assert.match(entrada.body.jornada.entrada, FORMATO_HORA);
  const ahora = (await hoy(tokenContador)).body.ahora;
  assert.ok(
    Math.abs(minutosDe(ahora) - minutosDe(`${hoyISO()} ${entrada.body.jornada.entrada}:00`)) <= 1,
    'la entrada es la hora del servidor'
  );
  assert.strictEqual(entrada.body.jornada.fecha, hoyISO());
  assert.strictEqual(entrada.body.jornada.salida_descanso, null);
  assert.strictEqual(entrada.body.jornada.salida, null);

  assert.strictEqual((await marcar(tokenContador, 'entrada')).statusCode, 409, 'paso repetido');
  assert.strictEqual((await marcar(tokenContador, 'regreso_descanso')).statusCode, 409, 'regreso sin salida');
  const repetido = await marcar(tokenContador, 'entrada');
  assert.ok(repetido.body.mensaje && repetido.body.mensaje.length > 0);

  assert.strictEqual((await marcar(tokenContador, 'salida_descanso')).statusCode, 200);
  assert.strictEqual((await marcar(tokenContador, 'salida_descanso')).statusCode, 409);
  assert.strictEqual((await marcar(tokenContador, 'salida')).statusCode, 409, 'durante el descanso primero se regresa');
  assert.strictEqual((await marcar(tokenContador, 'regreso_descanso')).statusCode, 200);
  assert.strictEqual((await marcar(tokenContador, 'regreso_descanso')).statusCode, 409);
  const salida = await marcar(tokenContador, 'salida');
  assert.strictEqual(salida.statusCode, 200);
  for (const campo of ['entrada', 'salida_descanso', 'regreso_descanso', 'salida']) {
    assert.match(salida.body.jornada[campo], FORMATO_HORA, campo);
  }
  assert.strictEqual((await marcar(tokenContador, 'salida')).statusCode, 409, 'jornada cerrada');
  assert.strictEqual((await marcar(tokenContador, 'entrada')).statusCode, 409);

  const filas = await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id = ? AND fecha = ?', [
    contador.id,
    hoyISO(),
  ]);
  assert.strictEqual(filas[0].n, 1, 'una sola fila por día');
}

async function testSalidaSinDescanso() {
  await borrarJornadasDe(auxiliar);
  assert.strictEqual((await marcar(tokenAuxiliar, 'entrada')).statusCode, 200);
  const salida = await marcar(tokenAuxiliar, 'salida');
  assert.strictEqual(salida.statusCode, 200, 'desde la entrada se puede salir sin descanso');
  assert.strictEqual(salida.body.jornada.salida_descanso, null);
  assert.strictEqual(salida.body.jornada.regreso_descanso, null);
  assert.match(salida.body.jornada.salida, FORMATO_HORA);
  assert.strictEqual((await marcar(tokenAuxiliar, 'salida_descanso')).statusCode, 409, 'ya salió');
  assert.strictEqual((await marcar(tokenAuxiliar, 'regreso_descanso')).statusCode, 409);
}

async function testDosMarcadasSimultaneasDelMismoPasoSoloUnaGana() {
  await borrarJornadasDe(otroContador);
  const resultados = await Promise.all([
    marcar(tokenOtroContador, 'entrada'),
    marcar(tokenOtroContador, 'entrada'),
    marcar(tokenOtroContador, 'entrada'),
  ]);
  const codigos = resultados.map((r) => r.statusCode).sort();
  assert.deepStrictEqual(codigos, [200, 409, 409]);
  const filas = await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id = ?', [otroContador.id]);
  assert.strictEqual(filas[0].n, 1);
}

async function testMinutosTrabajadosConYSinDescansoYConLaJornadaAbierta() {
  await borrarJornadasDe(contador);
  await marcar(tokenContador, 'entrada');

  await fijarHoy(contador, ['09:00:00', '14:00:00', '15:00:00', '18:00:00']);
  let respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.body.minutos_trabajados, 480, 'con descanso: 300 + 180');
  assert.strictEqual(respuesta.body.jornada.entrada, '09:00');
  assert.strictEqual(respuesta.body.jornada.salida, '18:00');

  await fijarHoy(contador, ['09:00:00', null, null, '17:30:00']);
  respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.body.minutos_trabajados, 510, 'sin descanso');

  await fijarHoy(contador, ['09:00:00', '14:00:00', null, null]);
  respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.body.minutos_trabajados, 300, 'en descanso: el descanso no cuenta');

  // Jornada abierta desde la medianoche: hasta ahora (la misma hora que entrega la respuesta)
  await fijarHoy(contador, ['00:00:00', null, null, null]);
  respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.body.minutos_trabajados, minutosDe(respuesta.body.ahora));

  await fijarHoy(contador, ['00:00:00', '00:00:00', '00:00:00', null]);
  respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.body.minutos_trabajados, minutosDe(respuesta.body.ahora), 'abierta tras el descanso');
}

async function testMinutosDeActividadesDelDia() {
  await borrarJornadasDe(contador);
  const renglon = await nuevoRenglon(tokenContador);
  const bloque = async (minutos) =>
    (
      await peticion(
        servidor.puerto,
        'POST',
        '/tiempo/manual',
        { cliente_id: renglon.cliente.id, tipo_id: renglon.tipo.id, mes: hoyISO().slice(0, 7), minutos },
        tokenContador
      )
    ).body.bloque;
  const moverBloque = (id, inicio) =>
    query('UPDATE registros_tiempo SET inicio = ? WHERE id = ? AND usuario_id = ?', [inicio, id, contador.id]);

  const deHoy = await bloque(45);
  await moverBloque(deHoy.id, `${hoyISO()} 10:00:00`);
  const otroDeHoy = await bloque(15);
  await moverBloque(otroDeHoy.id, `${hoyISO()} 23:50:00`);
  const deAyer = await bloque(100);
  await moverBloque(deAyer.id, `${diaDespues(-1)} 10:00:00`);
  const enMarcha = await peticion(
    servidor.puerto,
    'POST',
    '/tiempo/iniciar',
    { cliente_id: renglon.cliente.id, tipo_id: renglon.tipo.id, mes: hoyISO().slice(0, 7) },
    tokenContador
  );
  assert.strictEqual(enMarcha.statusCode, 200);

  const respuesta = await hoy(tokenContador);
  assert.strictEqual(respuesta.body.minutos_actividades, 60, 'solo terminados con inicio de hoy; el de ayer y el que corre no');

  await peticion(servidor.puerto, 'POST', '/tiempo/detener', {}, tokenContador);
}

async function testCorregirHoyYUnDiaAnterior() {
  await borrarJornadasDe(contador);
  const completa = { entrada: '09:00', salida_descanso: '14:00', regreso_descanso: '15:00', salida: '18:00' };

  const anterior = await corregir(tokenContador, DIA_PASADO, completa);
  assert.strictEqual(anterior.statusCode, 200);
  assert.deepStrictEqual(anterior.body.jornada, { fecha: DIA_PASADO, ...completa });
  const filas = await query(
    "SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(entrada, '%H:%i') AS entrada FROM jornadas WHERE usuario_id = ?",
    [contador.id]
  );
  assert.deepStrictEqual(filas, [{ fecha: DIA_PASADO, entrada: '09:00' }], 'la fecha no se desplaza');

  // Reemplaza todo: lo que no se envía queda vacío
  const reemplazo = await corregir(tokenContador, DIA_PASADO, { entrada: '08:30', salida: '16:00' });
  assert.strictEqual(reemplazo.statusCode, 200);
  assert.deepStrictEqual(reemplazo.body.jornada, {
    fecha: DIA_PASADO,
    entrada: '08:30',
    salida_descanso: null,
    regreso_descanso: null,
    salida: '16:00',
  });
  assert.strictEqual(
    (await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id = ?', [contador.id]))[0].n,
    1,
    'no duplica la fila'
  );

  const deHoy = await corregir(tokenContador, hoyISO(), { entrada: '07:00', salida_descanso: '12:00' });
  assert.strictEqual(deHoy.statusCode, 200);
  const consultada = await hoy(tokenContador);
  assert.strictEqual(consultada.body.jornada.entrada, '07:00');
  assert.strictEqual(consultada.body.jornada.salida_descanso, '12:00');
  assert.strictEqual(consultada.body.minutos_trabajados, 300);
}

async function testCorregirValidaOrdenFormatoYFechas() {
  await borrarJornadasDe(contador);
  const conError = async (fecha, cuerpo, campoEsperado) => {
    const respuesta = await corregir(tokenContador, fecha, cuerpo);
    assert.strictEqual(respuesta.statusCode, 400, JSON.stringify(cuerpo));
    assert.ok(respuesta.body.mensaje, 'trae mensaje');
    if (campoEsperado) assert.match(respuesta.body.mensaje, new RegExp(campoEsperado));
    return respuesta;
  };

  await conError(DIA_PASADO, { entrada: '09:00', salida_descanso: '08:00' }, 'salida a descanso');
  await conError(DIA_PASADO, { entrada: '09:00', salida_descanso: '14:00', regreso_descanso: '13:00' }, 'regreso');
  await conError(DIA_PASADO, { entrada: '09:00', salida_descanso: '14:00', regreso_descanso: '15:00', salida: '14:30' }, 'salida');
  await conError(DIA_PASADO, { entrada: '09:00', regreso_descanso: '15:00' }, 'regreso');
  await conError(DIA_PASADO, { salida: '18:00' }, 'entrada');
  await conError(DIA_PASADO, { entrada: '9:00' }, 'HH:MM');
  await conError(DIA_PASADO, { entrada: '25:00' }, 'HH:MM');
  await conError(DIA_PASADO, { entrada: 900 }, 'HH:MM');

  await conError(diaDespues(1), { entrada: '09:00' }, 'futur');
  await conError('2026-02-30', { entrada: '09:00' });
  await conError('2026-2-3', { entrada: '09:00' });
  await conError('05-10-2026', { entrada: '09:00' });
  await conError('hoy', { entrada: '09:00' });

  const filas = await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id = ?', [contador.id]);
  assert.strictEqual(filas[0].n, 0, 'ningún rechazo guarda nada');
}

async function testGuardarTodoVacioBorraLaJornada() {
  await borrarJornadasDe(contador);
  await corregir(tokenContador, DIA_PASADO, { entrada: '09:00', salida: '17:00' });
  await corregir(tokenContador, OTRO_DIA_PASADO, { entrada: '10:00' });

  for (const vacio of [{}, { entrada: null, salida: null }, { entrada: '', salida_descanso: '', regreso_descanso: '', salida: '' }]) {
    await corregir(tokenContador, DIA_PASADO, { entrada: '09:00' });
    const borrada = await corregir(tokenContador, DIA_PASADO, vacio);
    assert.strictEqual(borrada.statusCode, 204, JSON.stringify(vacio));
    assert.strictEqual(borrada.body, null);
    const filas = await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id = ? AND fecha = ?', [contador.id, DIA_PASADO]);
    assert.strictEqual(filas[0].n, 0);
  }
  assert.strictEqual(
    (await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id = ? AND fecha = ?', [contador.id, OTRO_DIA_PASADO]))[0].n,
    1,
    'no borra otros días'
  );
  assert.strictEqual((await corregir(tokenContador, '2026-10-20', {})).statusCode, 204, 'vacío sobre un día sin jornada');
}

async function testListarElMesEntregaSoloLoMio() {
  await borrarJornadasDe(contador);
  await borrarJornadasDe(otroContador);
  await corregir(tokenContador, '2026-09-30', { entrada: '09:00', salida: '17:00' });
  await corregir(tokenContador, '2026-10-12', { entrada: '09:15', salida_descanso: '14:00' });
  await corregir(tokenContador, '2026-10-03', { entrada: '08:00', salida: '16:30' });
  await corregir(tokenContador, '2026-11-01', { entrada: '08:00' });
  await corregir(tokenOtroContador, '2026-10-07', { entrada: '11:00' });

  const octubre = await mes(tokenContador, '2026-10');
  assert.strictEqual(octubre.statusCode, 200);
  assert.deepStrictEqual(
    octubre.body.jornadas.map((j) => j.fecha),
    ['2026-10-03', '2026-10-12'],
    'solo del mes y propias, ordenadas por fecha, sin desplazar el día'
  );
  assert.deepStrictEqual(octubre.body.jornadas[1], {
    fecha: '2026-10-12',
    entrada: '09:15',
    salida_descanso: '14:00',
    regreso_descanso: null,
    salida: null,
  });
  const delOtro = await mes(tokenOtroContador, '2026-10');
  assert.deepStrictEqual(delOtro.body.jornadas.map((j) => j.fecha), ['2026-10-07']);
  assert.deepStrictEqual((await mes(tokenContador, '2025-01')).body.jornadas, []);

  for (const malo of ['2026-13', '2026-1', '202610', 'octubre', '']) {
    assert.strictEqual((await mes(tokenContador, malo)).statusCode, 400, `mes ${malo}`);
  }
  assert.strictEqual((await peticion(servidor.puerto, 'GET', '/jornadas', null, tokenContador)).statusCode, 400);
}

async function testJornadaBase() {
  await query('DELETE FROM ajustes_actividades WHERE usuario_id IN (?, ?)', [contador.id, otroContador.id]);
  assert.strictEqual((await hoy(tokenContador)).body.jornada_base_minutos, 480, 'por defecto 8 horas');

  const media = await ajustar(tokenContador, { jornada_base_minutos: 510 });
  assert.strictEqual(media.statusCode, 200);
  assert.strictEqual(media.body.jornada_base_minutos, 510);
  assert.strictEqual((await hoy(tokenContador)).body.jornada_base_minutos, 510);
  assert.strictEqual((await ajustar(tokenContador, { jornada_base_minutos: 60 })).statusCode, 200, 'mínimo 1 hora');
  assert.strictEqual((await ajustar(tokenContador, { jornada_base_minutos: 960 })).statusCode, 200, 'máximo 16 horas');
  assert.strictEqual((await ajustar(tokenContador, { jornada_base_minutos: 360 })).statusCode, 200, 'se puede cambiar de nuevo');
  assert.strictEqual(
    (await query('SELECT COUNT(*) AS n FROM ajustes_actividades WHERE usuario_id = ?', [contador.id]))[0].n,
    1,
    'una sola fila por usuario'
  );

  for (const malo of [0, 30, 45, 59, 1000, 1020, -60, 480.5, '480', null, undefined]) {
    const respuesta = await ajustar(tokenContador, { jornada_base_minutos: malo });
    assert.strictEqual(respuesta.statusCode, 400, `rechaza ${String(malo)}`);
    assert.ok(respuesta.body.mensaje);
  }
  assert.strictEqual((await ajustar(tokenContador, {})).statusCode, 400);
  assert.strictEqual((await hoy(tokenContador)).body.jornada_base_minutos, 360, 'lo rechazado no cambia nada');

  assert.strictEqual((await hoy(tokenOtroContador)).body.jornada_base_minutos, 480, 'cada quien la suya');
  // «ajustes» no se confunde con una fecha
  assert.strictEqual((await corregir(tokenContador, 'ajustes', { entrada: '09:00' })).statusCode, 400);
}

async function testCadaQuienSoloVeYCambiaSuJornada() {
  await borrarJornadasDe(contador);
  await borrarJornadasDe(otroContador);
  await corregir(tokenContador, DIA_PASADO, { entrada: '09:00', salida: '17:00' });
  await corregir(tokenContador, hoyISO(), { entrada: '09:00' });

  const delOtro = await hoy(tokenOtroContador);
  assert.strictEqual(delOtro.body.jornada, null, 'no ve la jornada de otro');
  assert.strictEqual(delOtro.body.minutos_trabajados, 0);
  assert.deepStrictEqual((await mes(tokenOtroContador, '2026-10')).body.jornadas, []);

  // Corregir o marcar solo toca la fila propia, aunque comparta la fecha
  await corregir(tokenOtroContador, DIA_PASADO, { entrada: '06:00', salida: '07:00' });
  await marcar(tokenOtroContador, 'entrada');
  await ajustar(tokenOtroContador, { jornada_base_minutos: 600 });
  const mia = await mes(tokenContador, '2026-10');
  assert.deepStrictEqual(mia.body.jornadas.map((j) => [j.entrada, j.salida]), [['09:00', '17:00']]);
  assert.strictEqual((await hoy(tokenContador)).body.jornada.entrada, '09:00');
  assert.strictEqual((await hoy(tokenContador)).body.jornada_base_minutos, 360);

  // Borrar la del otro no toca la mía
  await corregir(tokenOtroContador, DIA_PASADO, {});
  assert.strictEqual((await mes(tokenContador, '2026-10')).body.jornadas.length, 1);

  // El usuario sale de la sesión, no del cuerpo: un usuario_id enviado se ignora
  await corregir(tokenOtroContador, OTRO_DIA_PASADO, { entrada: '05:00', usuario_id: contador.id });
  assert.deepStrictEqual(
    (await mes(tokenContador, '2026-10')).body.jornadas.map((j) => j.fecha),
    [DIA_PASADO]
  );
  assert.strictEqual((await mes(tokenOtroContador, '2026-10')).body.jornadas.length, 1);
}

async function testSoloContadorYAuxiliar() {
  const llamadas = [
    ['GET', '/jornadas/hoy', null],
    ['POST', '/jornadas/hoy/marcar', { paso: 'entrada' }],
    ['GET', '/jornadas?mes=2026-10', null],
    ['PUT', `/jornadas/${DIA_PASADO}`, { entrada: '09:00' }],
    ['PUT', '/jornadas/ajustes', { jornada_base_minutos: 480 }],
  ];
  for (const token of [tokenAdministrador, tokenSistema]) {
    for (const [metodo, ruta, cuerpo] of llamadas) {
      const respuesta = await peticion(servidor.puerto, metodo, ruta, cuerpo, token);
      assert.strictEqual(respuesta.statusCode, 403, `${metodo} ${ruta}`);
      assert.ok(respuesta.body.mensaje);
    }
  }
  for (const [metodo, ruta, cuerpo] of llamadas) {
    const respuesta = await peticion(servidor.puerto, metodo, ruta, cuerpo);
    assert.strictEqual(respuesta.statusCode, 401, `sin token: ${metodo} ${ruta}`);
  }
  const filas = await query('SELECT COUNT(*) AS n FROM jornadas WHERE usuario_id IN (?, ?)', [
    administrador.id,
    sistema.id,
  ]);
  assert.strictEqual(filas[0].n, 0, 'los 403 no guardan nada');
  // El auxiliar sí puede
  assert.strictEqual((await hoy(tokenAuxiliar)).statusCode, 200);
}

describe('/jornadas (entrada, descanso y salida)', () => {
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

  test('el seed crea jornadas y ajustes_actividades y se puede repetir', testSeedCreaLasDosTablasDeFormaIdempotente);
  test('hoy sin jornada entrega los valores por defecto', testHoySinJornadaEntregaLosValoresPorDefecto);
  test('secuencia completa de pasos con hora del servidor y sus 409', testSecuenciaCompletaConSusConflictos);
  test('salida sin descanso', testSalidaSinDescanso);
  test('el mismo paso marcado a la vez solo lo gana una petición', testDosMarcadasSimultaneasDelMismoPasoSoloUnaGana);
  test('minutos trabajados con y sin descanso y con la jornada abierta', testMinutosTrabajadosConYSinDescansoYConLaJornadaAbierta);
  test('minutos de actividades: terminados con inicio en el día', testMinutosDeActividadesDelDia);
  test('corregir hoy y un día anterior (reemplaza y no desplaza la fecha)', testCorregirHoyYUnDiaAnterior);
  test('corregir valida orden, formato y fechas (400)', testCorregirValidaOrdenFormatoYFechas);
  test('guardar todo vacío borra la jornada del día', testGuardarTodoVacioBorraLaJornada);
  test('listar el mes entrega solo lo propio y valida el mes', testListarElMesEntregaSoloLoMio);
  test('jornada base: límites, medias horas y una por usuario', testJornadaBase);
  test('cada quien solo ve y cambia su jornada', testCadaQuienSoloVeYCambiaSuJornada);
  test('solo contador y auxiliar; administrador y sistema reciben 403', testSoloContadorYAuxiliar);
});
