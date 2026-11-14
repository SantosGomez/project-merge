const assert = require('node:assert');
const { describe, test } = require('node:test');
const { calcularVencimiento, esDiaInhabil, festivosDelMes } = require('../src/utils/vencimientoActividad');

/**
 * Pruebas de la utilidad de vencimientos de actividades (rebanada 12).
 * Las fechas esperadas son literales tomados del calendario real (día de la semana verificado),
 * no se recalculan con la misma lógica del código.
 */

describe('esDiaInhabil', () => {
  test('sábados y domingos son inhábiles; un día entre semana común no', () => {
    assert.strictEqual(esDiaInhabil(2026, 11, 14), true); // sábado
    assert.strictEqual(esDiaInhabil(2026, 11, 15), true); // domingo
    assert.strictEqual(esDiaInhabil(2026, 11, 17), false); // martes
  });

  test('festivos de la LFT: fijos y los lunes movibles', () => {
    assert.strictEqual(esDiaInhabil(2026, 1, 1), true);
    assert.strictEqual(esDiaInhabil(2026, 2, 2), true); // primer lunes de febrero
    assert.strictEqual(esDiaInhabil(2026, 2, 9), false);
    assert.strictEqual(esDiaInhabil(2026, 3, 16), true); // tercer lunes de marzo
    assert.strictEqual(esDiaInhabil(2026, 3, 9), false);
    assert.strictEqual(esDiaInhabil(2026, 5, 1), true);
    assert.strictEqual(esDiaInhabil(2026, 9, 16), true);
    assert.strictEqual(esDiaInhabil(2026, 11, 16), true); // tercer lunes de noviembre
    assert.strictEqual(esDiaInhabil(2026, 11, 9), false);
    assert.strictEqual(esDiaInhabil(2026, 12, 25), true);
  });

  test('1 de octubre solo cada seis años desde 2024 (cambio de Poder Ejecutivo)', () => {
    assert.strictEqual(esDiaInhabil(2024, 10, 1), true); // martes
    assert.strictEqual(esDiaInhabil(2030, 10, 1), true); // martes
    assert.strictEqual(esDiaInhabil(2025, 10, 1), false); // miércoles
    assert.strictEqual(esDiaInhabil(2027, 10, 1), false); // viernes
  });
});

describe('calcularVencimiento: reglas sin RFC', () => {
  test('ninguna o regla desconocida no tiene fecha', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'ninguna', mes: '2026-11' }), null);
    assert.strictEqual(calcularVencimiento({ regla: 'otra', mes: '2026-11' }), null);
  });

  test('un mes inválido no tiene fecha', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2026-13' }), null);
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: 'noviembre' }), null);
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes' }), null);
  });

  test('día fijo: ese día si es hábil', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 3, mes: '2026-11' }), '2026-11-03');
  });

  test('día fijo inhábil pasa al siguiente hábil (sábado, festivo y festivo sexenal)', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 7, mes: '2026-11' }), '2026-11-09'); // sábado
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 1, mes: '2026-01' }), '2026-01-02'); // festivo
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 25, mes: '2026-12' }), '2026-12-28'); // festivo viernes
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 1, mes: '2024-10' }), '2024-10-02'); // sexenal
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 1, mes: '2025-10' }), '2025-10-01'); // sin sexenal
  });

  test('día fijo sin día válido no tiene fecha', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', mes: '2026-11' }), null);
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 0, mes: '2026-11' }), null);
    assert.strictEqual(calcularVencimiento({ regla: 'dia_del_mes', dia: 32, mes: '2026-11' }), null);
  });

  test('fin de mes hábil se queda en el último día', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2026-08' }), '2026-08-31'); // lunes
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2024-02' }), '2024-02-29'); // bisiesto, jueves
  });

  test('fin de mes en sábado o domingo pasa al lunes del mes siguiente', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2025-05' }), '2025-06-02'); // sábado 31
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2026-10' }), '2026-11-02'); // sábado 31
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2025-08' }), '2025-09-01'); // domingo 31
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2024-03' }), '2024-04-01'); // domingo 31
  });

  test('fin de mes cuyo siguiente lunes es festivo salta también el festivo', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2026-01' }), '2026-02-03'); // sáb 31, lun 2 festivo
  });

  test('fin de mes de diciembre en domingo cruza de año y salta el 1 de enero', () => {
    assert.strictEqual(calcularVencimiento({ regla: 'fin_de_mes', mes: '2023-12' }), '2024-01-02');
  });
});

describe('calcularVencimiento: día 17 según el RFC', () => {
  const entrada = (rfc, mes) => ({ regla: 'dia_17_rfc', mes, rfc });

  test('cada par de dígitos suma sus días hábiles al día 17 (noviembre de 2026, martes 17)', () => {
    const esperado = {
      1: '2026-11-18', 2: '2026-11-18',
      3: '2026-11-19', 4: '2026-11-19',
      5: '2026-11-20', 6: '2026-11-20',
      7: '2026-11-23', 8: '2026-11-23',
      9: '2026-11-24', 0: '2026-11-24',
    };
    for (const [digito, fecha] of Object.entries(esperado)) {
      const rfc = `ABCD26010${digito}AB1`; // el sexto dígito numérico es el último de la fecha
      assert.strictEqual(calcularVencimiento(entrada(rfc, '2026-11')), fecha, `dígito ${digito}`);
    }
  });

  test('funciona con RFC de persona moral (12) y de persona física (13)', () => {
    assert.strictEqual(calcularVencimiento(entrada('ABC260105AB1', '2026-11')), '2026-11-20');
    assert.strictEqual(calcularVencimiento(entrada('ABCD260105AB1', '2026-11')), '2026-11-20');
  });

  test('acepta el RFC en minúsculas y con espacios alrededor', () => {
    assert.strictEqual(calcularVencimiento(entrada('  abcd260105ab1 ', '2026-11')), '2026-11-20');
  });

  test('la homoclave con dígitos no cambia el sexto dígito', () => {
    assert.strictEqual(calcularVencimiento(entrada('ABCD260101A99', '2026-11')), '2026-11-18');
  });

  test('sin RFC o con RFC que no tiene la forma de un RFC no hay fecha', () => {
    assert.strictEqual(calcularVencimiento(entrada(null, '2026-11')), null);
    assert.strictEqual(calcularVencimiento(entrada(undefined, '2026-11')), null);
    assert.strictEqual(calcularVencimiento(entrada('', '2026-11')), null);
    assert.strictEqual(calcularVencimiento(entrada('ABC123', '2026-11')), null);
    assert.strictEqual(calcularVencimiento(entrada('1234567890123', '2026-11')), null);
  });

  test('el 17 en domingo seguido de lunes festivo (marzo de 2024) avanza al martes 19 y luego suma', () => {
    // domingo 17, lunes 18 festivo (tercer lunes de marzo) → martes 19
    assert.strictEqual(calcularVencimiento(entrada('ABCD240101AB1', '2024-03')), '2024-03-20'); // +1
    assert.strictEqual(calcularVencimiento(entrada('ABCD240103AB1', '2024-03')), '2024-03-21'); // +2
    assert.strictEqual(calcularVencimiento(entrada('ABCD240105AB1', '2024-03')), '2024-03-22'); // +3
    assert.strictEqual(calcularVencimiento(entrada('ABCD240107AB1', '2024-03')), '2024-03-25'); // +4
    assert.strictEqual(calcularVencimiento(entrada('ABCD240109AB1', '2024-03')), '2024-03-26'); // +5
  });

  test('el 17 en domingo seguido de lunes festivo (noviembre de 2024) avanza al martes 19 y luego suma', () => {
    assert.strictEqual(calcularVencimiento(entrada('ABCD240101AB1', '2024-11')), '2024-11-20'); // +1
    assert.strictEqual(calcularVencimiento(entrada('ABCD240105AB1', '2024-11')), '2024-11-22'); // +3
    assert.strictEqual(calcularVencimiento(entrada('ABCD240107AB1', '2024-11')), '2024-11-25'); // +4
    assert.strictEqual(calcularVencimiento(entrada('ABCD240109AB1', '2024-11')), '2024-11-26'); // +5
  });

  test('el 17 en sábado pasa al lunes y luego suma (octubre de 2026)', () => {
    assert.strictEqual(calcularVencimiento(entrada('ABCD260101AB1', '2026-10')), '2026-10-20'); // lun 19 + 1
    assert.strictEqual(calcularVencimiento(entrada('ABCD260107AB1', '2026-10')), '2026-10-23'); // lun 19 + 4
  });
});

describe('festivosDelMes', () => {
  test('lista los festivos del mes como AAAA-MM-DD, en orden', () => {
    assert.deepStrictEqual(festivosDelMes(2026, 11), ['2026-11-16']); // tercer lunes
    assert.deepStrictEqual(festivosDelMes(2026, 12), ['2026-12-25']);
    assert.deepStrictEqual(festivosDelMes(2026, 1), ['2026-01-01']);
    assert.deepStrictEqual(festivosDelMes(2026, 2), ['2026-02-02']); // primer lunes
    assert.deepStrictEqual(festivosDelMes(2026, 3), ['2026-03-16']);
  });

  test('un mes sin festivos da una lista vacía y no cuenta los fines de semana', () => {
    assert.deepStrictEqual(festivosDelMes(2026, 4), []);
    assert.deepStrictEqual(festivosDelMes(2026, 6), []);
  });

  test('el 1 de octubre solo sale en los años del cambio de Poder Ejecutivo', () => {
    assert.deepStrictEqual(festivosDelMes(2024, 10), ['2024-10-01']);
    assert.deepStrictEqual(festivosDelMes(2025, 10), []);
  });

  test('coincide con esDiaInhabil en un festivo que cae en fin de semana (1 de mayo de 2027 es sábado)', () => {
    assert.deepStrictEqual(festivosDelMes(2027, 5), ['2027-05-01']);
  });
});
