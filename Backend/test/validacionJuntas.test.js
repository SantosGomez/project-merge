const assert = require('node:assert');
const { describe, test } = require('node:test');
const { parseFechaHora, validarJunta, validarRango, validarRespuesta } = require('../src/utils/validacionJuntas');

/**
 * Pruebas unitarias de las validaciones puras de juntas (rebanada 21a): sin base de datos.
 */

const BASE = { titulo: 'Revisión mensual', inicio: '2026-12-01 09:00', fin: '2026-12-01 10:30', participantes: [2, 3] };
const CREADOR = 1;

function campoDelError(resultado) {
  assert.ok(resultado.error, 'debía rechazar');
  const coincidencia = /^.+? sobre (.+?): /.exec(resultado.error.mensaje);
  assert.ok(coincidencia, `el error no tiene tres partes: ${resultado.error.mensaje}`);
  return coincidencia[1];
}

describe('parseFechaHora', () => {
  test('acepta AAAA-MM-DD HH:mm reales y rechaza el resto', () => {
    const fecha = parseFechaHora('2026-12-31 23:59');
    assert.strictEqual(fecha.getFullYear(), 2026);
    assert.strictEqual(fecha.getMonth(), 11);
    assert.strictEqual(fecha.getDate(), 31);
    assert.strictEqual(fecha.getHours(), 23);
    assert.strictEqual(fecha.getMinutes(), 59);
    for (const malo of ['2026-02-30 10:00', '2026-12-01 24:00', '2026-12-01 10:60', '2026-12-01', '01-12-2026 10:00', '2026-12-01T10:00', '2026-12-01 10:00:00', 20261201, null, undefined, {}, ['2026-12-01 10:00']]) {
      assert.strictEqual(parseFechaHora(malo), null, `debía rechazar ${JSON.stringify(malo)}`);
    }
  });
});

describe('validarJunta', () => {
  test('privada: si falta es false, acepta solo booleanos y cualquier otro tipo se rechaza sobre privada', () => {
    assert.strictEqual(validarJunta({ ...BASE, privada: true }, CREADOR).valor.privada, true);
    assert.strictEqual(validarJunta({ ...BASE, privada: false }, CREADOR).valor.privada, false);
    assert.strictEqual(validarJunta({ ...BASE, privada: undefined }, CREADOR).valor.privada, false);
    for (const malo of [1, 0, 'true', 'false', null, {}, []]) {
      assert.strictEqual(campoDelError(validarJunta({ ...BASE, privada: malo }, CREADOR)), 'privada', JSON.stringify(malo));
    }
  });

  test('devuelve los valores limpios: texto recortado, fechas con segundos en cero y descripción nula si falta', () => {
    const r = validarJunta({ ...BASE, titulo: '  Revisión mensual  ' }, CREADOR);
    assert.deepStrictEqual(r.valor, {
      titulo: 'Revisión mensual',
      descripcion: null,
      inicio: '2026-12-01 09:00:00',
      fin: '2026-12-01 10:30:00',
      participantes: [2, 3],
      privada: false,
    });
    assert.strictEqual(validarJunta({ ...BASE, descripcion: '  Agenda  ' }, CREADOR).valor.descripcion, 'Agenda');
    assert.strictEqual(validarJunta({ ...BASE, descripcion: '   ' }, CREADOR).valor.descripcion, null);
  });

  test('título: obligatorio, texto y máximo 150; descripción: texto y máximo 1000', () => {
    for (const titulo of [undefined, null, '   ', 5, {}]) {
      assert.strictEqual(campoDelError(validarJunta({ ...BASE, titulo }, CREADOR)), 'título');
    }
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, titulo: 'x'.repeat(151) }, CREADOR)), 'título');
    assert.ok(validarJunta({ ...BASE, titulo: 'x'.repeat(150) }, CREADOR).valor);
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, descripcion: 7 }, CREADOR)), 'descripción');
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, descripcion: 'x'.repeat(1001) }, CREADOR)), 'descripción');
    assert.ok(validarJunta({ ...BASE, descripcion: 'x'.repeat(1000) }, CREADOR).valor);
  });

  test('los mensajes de título y descripción concuerdan en género y llevan las tres partes', () => {
    assert.strictEqual(
      validarJunta({ ...BASE, titulo: 'x'.repeat(151) }, CREADOR).error.mensaje,
      'El título supera los 150 caracteres sobre título: Escribe un título más corto'
    );
    assert.strictEqual(
      validarJunta({ ...BASE, titulo: 5 }, CREADOR).error.mensaje,
      'El título no es texto sobre título: Escribe el título como texto'
    );
    assert.strictEqual(
      validarJunta({ ...BASE, titulo: '  ' }, CREADOR).error.mensaje,
      'Falta el título de la junta sobre título: Escribe el título'
    );
    assert.strictEqual(
      validarJunta({ ...BASE, descripcion: 'x'.repeat(1001) }, CREADOR).error.mensaje,
      'La descripción supera los 1000 caracteres sobre descripción: Escribe una descripción más corta'
    );
    assert.strictEqual(
      validarJunta({ ...BASE, descripcion: 7 }, CREADOR).error.mensaje,
      'La descripción no es texto sobre descripción: Escribe la descripción como texto'
    );
  });

  test('fechas: formato real y fin posterior a inicio, aunque caiga otro día', () => {
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, inicio: '2026-12-01' }, CREADOR)), 'inicio');
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, fin: undefined }, CREADOR)), 'fin');
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, fin: '2026-12-01 09:00' }, CREADOR)), 'fin');
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, fin: '2026-12-01 08:59' }, CREADOR)), 'fin');
    const otroDia = validarJunta({ ...BASE, inicio: '2026-12-01 23:00', fin: '2026-12-02 01:00' }, CREADOR);
    assert.strictEqual(otroDia.valor.fin, '2026-12-02 01:00:00');
  });

  test('participantes: de 0 a 50, enteros positivos, sin repetidos ni el creador', () => {
    for (const participantes of [null, 'x', 3, {}, ['a'], [0], [-1], [1.5], [null], [2, 2], [CREADOR], [2, CREADOR]]) {
      assert.strictEqual(campoDelError(validarJunta({ ...BASE, participantes }, CREADOR)), 'participantes', JSON.stringify(participantes));
    }
    assert.deepStrictEqual(validarJunta({ ...BASE, participantes: [] }, CREADOR).valor.participantes, []);
    assert.deepStrictEqual(validarJunta({ ...BASE, participantes: undefined }, CREADOR).valor.participantes, []);
    const cincuenta = Array.from({ length: 50 }, (_, i) => i + 2);
    assert.ok(validarJunta({ ...BASE, participantes: cincuenta }, CREADOR).valor);
    assert.strictEqual(campoDelError(validarJunta({ ...BASE, participantes: [...cincuenta, 99] }, CREADOR)), 'participantes');
    assert.deepStrictEqual(validarJunta({ ...BASE, participantes: ['2', 3] }, CREADOR).valor.participantes, [2, 3]);
  });

  test('un cuerpo ausente o que no es objeto se rechaza sin lanzar', () => {
    for (const cuerpo of [undefined, null, 'x', 5]) {
      assert.ok(validarJunta(cuerpo, CREADOR).error);
    }
  });
});

describe('validarRango', () => {
  test('devuelve desde a medianoche y el límite exclusivo al día siguiente de hasta', () => {
    assert.deepStrictEqual(validarRango('2026-12-01', '2026-12-31').valor, {
      desde: '2026-12-01 00:00:00',
      hastaExclusivo: '2027-01-01 00:00:00',
    });
    assert.deepStrictEqual(validarRango('2026-12-01', '2026-12-01').valor, {
      desde: '2026-12-01 00:00:00',
      hastaExclusivo: '2026-12-02 00:00:00',
    });
  });

  test('rechaza faltantes, formatos raros, hasta anterior a desde y más de 400 días', () => {
    for (const [desde, hasta] of [[undefined, '2026-12-01'], ['2026-12-01', undefined], ['2026-12-01', '2026-11-30'], ['2026-13-01', '2026-12-01'], ['01-12-2026', '2026-12-31'], [['2026-12-01'], '2026-12-31'], ['2026-12-01 10:00', '2026-12-31'], ['2026-02-30', '2026-03-05']]) {
      assert.strictEqual(campoDelError(validarRango(desde, hasta)), 'rango de fechas', `${desde} ${hasta}`);
    }
    assert.ok(validarRango('2026-01-01', '2027-02-05').valor, '400 días exactos entran');
    assert.ok(validarRango('2026-01-01', '2027-02-06').error, '401 días no entran');
  });
});

describe('validarRespuesta', () => {
  test('acepta solo aceptada o rechazada', () => {
    assert.deepStrictEqual(validarRespuesta({ respuesta: 'aceptada' }), { valor: 'aceptada' });
    assert.deepStrictEqual(validarRespuesta({ respuesta: 'rechazada' }), { valor: 'rechazada' });
  });

  test('rechaza cualquier otro valor con tres partes sobre respuesta', () => {
    for (const cuerpo of [{ respuesta: 'pendiente' }, { respuesta: 'Aceptada' }, { respuesta: 1 }, { respuesta: null }, {}, null, undefined, 'aceptada']) {
      assert.strictEqual(campoDelError(validarRespuesta(cuerpo)), 'respuesta');
    }
  });
});
