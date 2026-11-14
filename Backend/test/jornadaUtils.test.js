const assert = require('node:assert');
const { describe, test } = require('node:test');
const {
  PASOS,
  JORNADA_BASE_DEFECTO,
  horaAMinutos,
  minutosTrabajados,
  validarHoras,
  evaluarPaso,
  jornadaBaseEsValida,
} = require('../src/utils/jornada');

/**
 * Pruebas puras de la jornada (rebanada 15): minutos trabajados, orden de las cuatro horas,
 * secuencia de pasos y jornada base. No tocan la base de datos.
 */

const jornada = (entrada, salida_descanso, regreso_descanso, salida) => ({
  entrada: entrada ?? null,
  salida_descanso: salida_descanso ?? null,
  regreso_descanso: regreso_descanso ?? null,
  salida: salida ?? null,
});

describe('jornada (funciones puras)', () => {
  test('horaAMinutos lee HH:MM y HH:MM:SS y rechaza lo demás', () => {
    assert.strictEqual(horaAMinutos('09:30'), 570);
    assert.strictEqual(horaAMinutos('09:30:45'), 570, 'ignora los segundos');
    assert.strictEqual(horaAMinutos('00:00'), 0);
    assert.strictEqual(horaAMinutos('23:59'), 1439);
    for (const mala of ['24:00', '9:30', '09:60', '', null, undefined, 930, '09-30', '09:30:61']) {
      assert.strictEqual(horaAMinutos(mala), null, `rechaza ${String(mala)}`);
    }
  });

  test('minutos trabajados con y sin descanso, y con la jornada abierta', () => {
    assert.strictEqual(minutosTrabajados(jornada(), 600), 0, 'sin entrada no hay nada');
    assert.strictEqual(minutosTrabajados(jornada('09:00', null, null, '17:30')), 510, 'sin descanso');
    assert.strictEqual(
      minutosTrabajados(jornada('09:00', '14:00', '15:00', '18:00')),
      480,
      'entrada→descanso (300) + regreso→salida (180)'
    );
    assert.strictEqual(
      minutosTrabajados(jornada('09:00', '14:00', null, null), 15 * 60),
      300,
      'en descanso: solo el tramo anterior, sin contar el descanso'
    );
    assert.strictEqual(minutosTrabajados(jornada('09:00'), 9 * 60 + 40), 40, 'abierta sin descanso: hasta ahora');
    assert.strictEqual(
      minutosTrabajados(jornada('09:00', '14:00', '15:00'), 16 * 60 + 10),
      300 + 70,
      'abierta tras el descanso: tramo anterior + regreso→ahora'
    );
    assert.strictEqual(minutosTrabajados(jornada('09:00')), 0, 'abierta sin hora de ahora no cuenta el tramo abierto');
    assert.strictEqual(minutosTrabajados(jornada('09:00', null, null, '08:00')), 0, 'nunca negativo');
    assert.strictEqual(minutosTrabajados(jornada('09:00:50', null, null, '10:00:10')), 60, 'ignora segundos');
  });

  test('validarHoras exige el orden entrada ≤ descanso ≤ regreso ≤ salida', () => {
    assert.strictEqual(validarHoras(jornada('09:00', '14:00', '15:00', '18:00')).valido, true);
    assert.strictEqual(validarHoras(jornada('09:00', '09:00', '09:00', '09:00')).valido, true, 'iguales son válidas');
    assert.strictEqual(validarHoras(jornada('09:00', null, null, '18:00')).valido, true, 'sin descanso');
    assert.strictEqual(validarHoras(jornada('09:00', '14:00')).valido, true, 'jornada en descanso');
    assert.strictEqual(validarHoras(jornada('09:00')).valido, true);

    const descansoAntes = validarHoras(jornada('09:00', '08:00'));
    assert.strictEqual(descansoAntes.valido, false);
    assert.strictEqual(descansoAntes.campo, 'salida_descanso');

    const regresoAntes = validarHoras(jornada('09:00', '14:00', '13:00'));
    assert.strictEqual(regresoAntes.valido, false);
    assert.strictEqual(regresoAntes.campo, 'regreso_descanso');

    const salidaAntes = validarHoras(jornada('09:00', '14:00', '15:00', '14:30'));
    assert.strictEqual(salidaAntes.valido, false);
    assert.strictEqual(salidaAntes.campo, 'salida');

    const salidaAntesDeEntrada = validarHoras(jornada('09:00', null, null, '08:00'));
    assert.strictEqual(salidaAntesDeEntrada.valido, false);
    assert.strictEqual(salidaAntesDeEntrada.campo, 'salida');
  });

  test('validarHoras: no hay regreso sin salida a descanso ni horas sin entrada', () => {
    const sinSalida = validarHoras(jornada('09:00', null, '15:00'));
    assert.strictEqual(sinSalida.valido, false);
    assert.strictEqual(sinSalida.campo, 'regreso_descanso');

    const sinEntrada = validarHoras(jornada(null, null, null, '18:00'));
    assert.strictEqual(sinEntrada.valido, false);
    assert.strictEqual(sinEntrada.campo, 'entrada');

    const formato = validarHoras(jornada('9:00'));
    assert.strictEqual(formato.valido, false);
    assert.strictEqual(formato.campo, 'entrada');
    assert.match(formato.motivo, /HH:MM/);
  });

  test('validarHoras normaliza lo vacío a null y recorta espacios', () => {
    const resultado = validarHoras({ entrada: ' 09:00 ', salida_descanso: '', regreso_descanso: undefined, salida: null });
    assert.strictEqual(resultado.valido, true);
    assert.deepStrictEqual(resultado.horas, jornada('09:00'));
  });

  test('evaluarPaso: la secuencia y sus conflictos', () => {
    assert.deepStrictEqual(PASOS, ['entrada', 'salida_descanso', 'regreso_descanso', 'salida']);
    assert.strictEqual(evaluarPaso(null, 'entrada'), 'ok');
    assert.strictEqual(evaluarPaso(jornada(), 'entrada'), 'ok');
    assert.strictEqual(evaluarPaso(jornada(), 'salida_descanso'), 'fuera_de_orden');
    assert.strictEqual(evaluarPaso(jornada(), 'salida'), 'fuera_de_orden');

    const trabajando = jornada('09:00');
    assert.strictEqual(evaluarPaso(trabajando, 'entrada'), 'repetido');
    assert.strictEqual(evaluarPaso(trabajando, 'salida_descanso'), 'ok');
    assert.strictEqual(evaluarPaso(trabajando, 'salida'), 'ok', 'salida directa sin descanso');
    assert.strictEqual(evaluarPaso(trabajando, 'regreso_descanso'), 'fuera_de_orden');

    const enDescanso = jornada('09:00', '14:00');
    assert.strictEqual(evaluarPaso(enDescanso, 'salida_descanso'), 'repetido');
    assert.strictEqual(evaluarPaso(enDescanso, 'regreso_descanso'), 'ok');
    assert.strictEqual(evaluarPaso(enDescanso, 'salida'), 'fuera_de_orden', 'primero regresa del descanso');

    const regreso = jornada('09:00', '14:00', '15:00');
    assert.strictEqual(evaluarPaso(regreso, 'regreso_descanso'), 'repetido');
    assert.strictEqual(evaluarPaso(regreso, 'salida_descanso'), 'repetido');
    assert.strictEqual(evaluarPaso(regreso, 'salida'), 'ok');

    const cerrada = jornada('09:00', null, null, '18:00');
    assert.strictEqual(evaluarPaso(cerrada, 'salida'), 'repetido');
    assert.strictEqual(evaluarPaso(cerrada, 'salida_descanso'), 'fuera_de_orden', 'ya salió: no hay descanso');
    assert.strictEqual(evaluarPaso(cerrada, 'regreso_descanso'), 'fuera_de_orden');

    assert.strictEqual(evaluarPaso(jornada(), 'otro'), 'desconocido');
    assert.strictEqual(evaluarPaso(jornada(), undefined), 'desconocido');
  });

  test('jornada base: de 1 a 16 horas en medias horas, 8 por defecto', () => {
    assert.strictEqual(JORNADA_BASE_DEFECTO, 480);
    for (const buena of [60, 90, 480, 510, 960]) assert.strictEqual(jornadaBaseEsValida(buena), true, String(buena));
    for (const mala of [0, 30, 59, 61, 45, 990, 1020, -60, 480.5, '480', null, undefined, NaN]) {
      assert.strictEqual(jornadaBaseEsValida(mala), false, `rechaza ${String(mala)}`);
    }
  });
});
